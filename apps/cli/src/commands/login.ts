import { Command, Option } from 'clipanion';
import { ApiClient } from '../client/http.js';
import { saveCredentials } from '../client/store.js';
import { promptHidden, promptLine } from '../ui/input.js';
import { fmtError } from '../ui/format.js';
import { AGENT } from '../version.js';

interface LoginResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: { id: string; email: string; org_id: string; org_role: string };
}

export class LoginCommand extends Command {
  static override paths = [['login']];
  static override usage = Command.Usage({
    description: 'Authenticate against a keynv server.',
    examples: [
      ['Interactive', '$0 login --server http://localhost:8080'],
      ['Non-interactive', '$0 login --server http://... --email a@b.com --password ...'],
    ],
  });

  server = Option.String('--server', { description: 'Server base URL.' });
  email = Option.String('--email', { description: 'Email address.' });
  password = Option.String('--password', { description: 'Password (use stdin to avoid argv leak).' });

  async execute(): Promise<number> {
    const serverUrl =
      this.server ?? (await promptLine('server URL [http://localhost:8080]: ')) ?? '';
    const finalServerUrl = serverUrl.length > 0 ? serverUrl : 'http://localhost:8080';
    const email = this.email ?? (await promptLine('email: '));
    const password = this.password ?? (await promptHidden('password: '));

    const res = await fetch(new URL('/v1/auth/login', finalServerUrl).toString(), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-keynv-agent': AGENT },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const text = await res.text();
      let msg = `login failed (${res.status})`;
      try {
        const parsed = JSON.parse(text) as { error?: { message?: string; code?: string } };
        msg = parsed.error?.message ?? msg;
        this.context.stderr.write(
          `${fmtError({
            status: res.status,
            ...(parsed.error?.code ? { code: parsed.error.code } : {}),
            message: msg,
          })}\n`,
        );
      } catch {
        this.context.stderr.write(`keynv: ${msg}\n`);
      }
      return 1;
    }

    const data = (await res.json()) as LoginResponse;
    saveCredentials({
      server_url: finalServerUrl,
      user_id: data.user.id,
      email: data.user.email,
      org_id: data.user.org_id,
      org_role: data.user.org_role,
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      access_expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString(),
    });
    this.context.stdout.write(`logged in as ${data.user.email} (${data.user.org_role})\n`);
    new ApiClient(); // warms cache; harmless
    return 0;
  }
}

export class LogoutCommand extends Command {
  static override paths = [['logout']];
  static override usage = Command.Usage({ description: 'Clear local credentials and revoke the refresh token.' });

  async execute(): Promise<number> {
    const client = new ApiClient();
    if (!client.isLoggedIn) {
      this.context.stdout.write('not logged in\n');
      return 0;
    }
    try {
      await client.request('/v1/auth/logout', {
        method: 'POST',
        body: { refresh_token: client.currentUser?.refresh_token },
      });
    } catch {
      // best-effort
    }
    const { clearCredentials } = await import('../client/store.js');
    clearCredentials();
    this.context.stdout.write('logged out\n');
    return 0;
  }
}

export class WhoamiCommand extends Command {
  static override paths = [['whoami']];
  static override usage = Command.Usage({ description: 'Show current user identity and project memberships.' });

  json = Option.Boolean('--json', false);

  async execute(): Promise<number> {
    const client = new ApiClient();
    if (!client.isLoggedIn) {
      this.context.stderr.write('keynv: not logged in. Run `keynv login`.\n');
      return 1;
    }
    const data = await client.request<{
      id: string;
      email: string;
      org_id: string;
      org_role: string;
      memberships: Array<{ project_id: string; role: string }>;
    }>('/v1/whoami');
    if (this.json) {
      this.context.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
      return 0;
    }
    this.context.stdout.write(`user:    ${data.email} (${data.id})\n`);
    this.context.stdout.write(`org:     ${data.org_id}\n`);
    this.context.stdout.write(`role:    ${data.org_role}\n`);
    if (data.memberships.length === 0) {
      this.context.stdout.write('memberships: (none)\n');
    } else {
      this.context.stdout.write('memberships:\n');
      for (const m of data.memberships) {
        this.context.stdout.write(`  ${m.project_id}: ${m.role}\n`);
      }
    }
    return 0;
  }
}

import { Command, Option } from 'clipanion';
import { runBrowserAuth } from '../client/browser-auth.js';
import { DEFAULT_SERVER_URL } from '../client/defaults.js';
import { ApiClient } from '../client/http.js';
import { saveCredentials } from '../client/store.js';
import { fmtError } from '../ui/format.js';
import { promptHidden, promptLine } from '../ui/input.js';
import { AGENT } from '../version.js';

interface LoginResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: { id: string; email: string; org_id: string; org_role: string };
}

interface WhoamiResponse {
  id: string;
  email: string;
  org_id: string;
  org_role: string;
}

export class LoginCommand extends Command {
  static override paths = [['login']];
  static override usage = Command.Usage({
    description: 'Authenticate against a keynv server.',
    examples: [
      ['Browser login', '$0 login'],
      ['Self-hosted browser login', '$0 login --server http://localhost:8080'],
      ['Headless token login', '$0 login --server http://... --token kt_...'],
      ['Non-interactive', '$0 login --server http://... --email a@b.com --password ...'],
    ],
  });

  server = Option.String('--server', { description: 'Server base URL.' });
  token = Option.String('--token', { description: 'CLI token for headless auth.' });
  email = Option.String('--email', { description: 'Email address.' });
  password = Option.String('--password', {
    description: 'Password (use stdin to avoid argv leak).',
  });

  async execute(): Promise<number> {
    const finalServerUrl = this.server ?? DEFAULT_SERVER_URL;

    if (this.token) {
      return this.loginWithToken(finalServerUrl, this.token);
    }

    if (!this.email && !this.password) {
      this.context.stdout.write(`Opening browser for ${finalServerUrl} ...\n`);
      try {
        const creds = await runBrowserAuth(finalServerUrl);
        await saveCredentials(creds);
        this.context.stdout.write(`logged in as ${creds.email} (${creds.org_role})\n`);
        return 0;
      } catch (err) {
        this.context.stderr.write(
          `keynv: ${err instanceof Error ? err.message : 'browser login failed'}\n`,
        );
        return 1;
      }
    }

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
    try {
      await saveCredentials({
        auth_kind: 'session',
        server_url: finalServerUrl,
        user_id: data.user.id,
        email: data.user.email,
        org_id: data.user.org_id,
        org_role: data.user.org_role,
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        access_expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString(),
      });
    } catch (err) {
      this.context.stderr.write(
        `keynv: failed to persist credentials: ${err instanceof Error ? err.message : String(err)}\n`,
      );
      return 1;
    }
    this.context.stdout.write(`logged in as ${data.user.email} (${data.user.org_role})\n`);
    return 0;
  }

  private async loginWithToken(serverUrl: string, token: string): Promise<number> {
    const res = await fetch(new URL('/v1/whoami', serverUrl).toString(), {
      headers: { authorization: `Bearer ${token}`, 'x-keynv-agent': AGENT },
    });

    if (!res.ok) {
      const text = await res.text();
      let msg = `token login failed (${res.status})`;
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

    const data = (await res.json()) as WhoamiResponse;
    try {
      await saveCredentials({
        auth_kind: 'cli_token',
        server_url: serverUrl,
        user_id: data.id,
        email: data.email,
        org_id: data.org_id,
        org_role: data.org_role,
        access_token: token,
        refresh_token: '',
        access_expires_at: '9999-12-31T23:59:59.999Z',
      });
    } catch (err) {
      this.context.stderr.write(
        `keynv: failed to persist credentials: ${err instanceof Error ? err.message : String(err)}\n`,
      );
      return 1;
    }
    this.context.stdout.write(`logged in as ${data.email} (${data.org_role})\n`);
    return 0;
  }
}

export class LogoutCommand extends Command {
  static override paths = [['logout']];
  static override usage = Command.Usage({
    description: 'Clear local credentials and revoke the refresh token.',
  });

  async execute(): Promise<number> {
    const client = new ApiClient();
    await client.ensureHydrated();
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
  static override usage = Command.Usage({
    description: 'Show current user identity and project memberships.',
  });

  json = Option.Boolean('--json', false);

  async execute(): Promise<number> {
    const client = new ApiClient();
    await client.ensureHydrated();
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

import { AGENT } from '../version.js';
import {
  type Credentials,
  loadCredentials,
  loadCredentialsAsync,
  saveCredentials,
} from './store.js';

export interface ClientError extends Error {
  status: number;
  code?: string;
  details?: unknown;
}

export function isClientError(err: unknown): err is ClientError {
  return err instanceof Error && typeof (err as { status?: unknown }).status === 'number';
}

function clientError(
  status: number,
  code: string,
  message: string,
  details?: unknown,
): ClientError {
  const err = Object.assign(new Error(message), { status, code, details });
  return err as ClientError;
}

interface FetchOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  query?: Record<string, string | number | undefined>;
  body?: unknown;
  /** When true, sends the access token. Defaults to true. */
  authed?: boolean;
}

function buildUrl(base: string, path: string, query?: FetchOptions['query']): string {
  const url = new URL(path, base);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

async function tryRefresh(creds: Credentials): Promise<Credentials | null> {
  if (creds.auth_kind === 'cli_token' || creds.refresh_token.length === 0) return null;

  const res = await fetch(buildUrl(creds.server_url, '/v1/auth/refresh'), {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-keynv-agent': AGENT },
    body: JSON.stringify({ refresh_token: creds.refresh_token }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };
  const updated: Credentials = {
    ...creds,
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    access_expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString(),
  };
  await saveCredentials(updated);
  return updated;
}

export class ApiClient {
  private creds: Credentials | null;
  private hydrated: Promise<void> | null = null;

  constructor(creds?: Credentials | null) {
    this.creds = creds ?? loadCredentials();
    if (this.creds === null) {
      // Best-effort hydrate from the encrypted store on first use.
      this.hydrated = loadCredentialsAsync().then((c) => {
        if (this.creds === null) this.creds = c;
      });
    }
  }

  get isLoggedIn(): boolean {
    return this.creds !== null;
  }

  get currentUser(): Credentials | null {
    return this.creds;
  }

  async ensureHydrated(): Promise<void> {
    if (this.hydrated) {
      try {
        await this.hydrated;
      } catch (err) {
        // Keychain / credential-store failure. Surface the message so the
        // user understands why they're seeing "not logged in" instead of
        // silently treating it as a missing session.
        process.stderr.write(
          `${err instanceof Error ? err.message : `keynv: credential load failed — ${String(err)}`}\n`,
        );
      }
    }
  }

  async setCredentials(creds: Credentials): Promise<void> {
    this.creds = creds;
    await saveCredentials(creds);
  }

  clearCredentials(): void {
    this.creds = null;
  }

  async request<T = unknown>(path: string, opts: FetchOptions = {}): Promise<T> {
    if (this.hydrated) await this.hydrated;
    if (!this.creds && opts.authed !== false) {
      throw clientError(401, 'auth.missing_token', 'Not connected. Run `keynv` first.');
    }
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      'x-keynv-agent': AGENT,
    };
    if (this.creds && opts.authed !== false) {
      headers.authorization = `Bearer ${this.creds.access_token}`;
    }
    const url = this.creds ? buildUrl(this.creds.server_url, path, opts.query) : path;
    let res: Response;
    try {
      res = await fetch(url, {
        method: opts.method ?? 'GET',
        headers,
        ...(opts.body !== undefined ? { body: JSON.stringify(opts.body) } : {}),
      });
    } catch (err) {
      const cause = err instanceof Error ? err.message : String(err);
      const serverUrl = this.creds?.server_url ?? url;
      throw new Error(
        `keynv: cannot reach server '${serverUrl}' — ${cause}\n` +
          `       Check the server is running: curl ${serverUrl}/v1/health`,
      );
    }

    // 401 → try refresh once
    if (res.status === 401 && this.creds && opts.authed !== false) {
      const refreshed = await tryRefresh(this.creds);
      if (refreshed) {
        this.creds = refreshed;
        headers.authorization = `Bearer ${refreshed.access_token}`;
        try {
          res = await fetch(url, {
            method: opts.method ?? 'GET',
            headers,
            ...(opts.body !== undefined ? { body: JSON.stringify(opts.body) } : {}),
          });
        } catch (err) {
          const cause = err instanceof Error ? err.message : String(err);
          const serverUrl = this.creds?.server_url ?? url;
          throw new Error(
            `keynv: cannot reach server '${serverUrl}' — ${cause}\n` +
              `       Check the server is running: curl ${serverUrl}/v1/health`,
          );
        }
      }
    }

    if (res.status === 204) return undefined as T;

    const text = await res.text();
    let parsed: unknown;
    try {
      parsed = text ? JSON.parse(text) : undefined;
    } catch {
      parsed = text;
    }

    if (!res.ok) {
      const errPayload = (
        parsed as { error?: { code?: string; message?: string; details?: unknown } }
      )?.error;
      throw clientError(
        res.status,
        errPayload?.code ?? 'unknown',
        errPayload?.message ?? `Request failed (${res.status})`,
        errPayload?.details,
      );
    }
    return parsed as T;
  }
}

export function newClient(): ApiClient {
  return new ApiClient();
}

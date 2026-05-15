import type { Credentials } from './credentials.js';
import { AGENT } from './version.js';

interface RequestOpts {
  method?: 'GET' | 'POST';
  body?: unknown;
  query?: Record<string, string | number | undefined>;
}

export class McpApiClient {
  constructor(private creds: Credentials) {}

  private async refreshIfNeeded(): Promise<Credentials> {
    const expiresAt = new Date(this.creds.access_expires_at).getTime();
    const bufferMs = 60 * 1000;
    if (Date.now() + bufferMs < expiresAt) return this.creds;

    const serverUrl = this.creds.server_url;
    const res = await fetch(new URL('/v1/auth/refresh', serverUrl).toString(), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-keynv-agent': AGENT },
      body: JSON.stringify({ refresh_token: this.creds.refresh_token }),
    });

    if (!res.ok) {
      throw new Error(`keynv-mcp: token refresh failed (${res.status}). Re-run keynv.`);
    }

    const data = (await res.json()) as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
    };

    this.creds = {
      ...this.creds,
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      access_expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString(),
    };

    return this.creds;
  }

  async request<T = unknown>(path: string, opts: RequestOpts = {}): Promise<T> {
    const creds = await this.refreshIfNeeded();
    const url = new URL(path, creds.server_url);
    if (opts.query) {
      for (const [k, v] of Object.entries(opts.query)) {
        if (v !== undefined) url.searchParams.set(k, String(v));
      }
    }
    const init: RequestInit = {
      method: opts.method ?? 'GET',
      headers: {
        'content-type': 'application/json',
        'x-keynv-agent': AGENT,
        authorization: `Bearer ${creds.access_token}`,
      },
      ...(opts.body !== undefined ? { body: JSON.stringify(opts.body) } : {}),
    };
    const res = await fetch(url.toString(), init);
    if (res.status === 204) return undefined as T;
    const text = await res.text();
    let parsed: unknown;
    try {
      parsed = text ? JSON.parse(text) : undefined;
    } catch {
      parsed = text;
    }
    if (!res.ok) {
      const err = (parsed as { error?: { code?: string; message?: string } })?.error;
      const message = err?.message ?? `request failed (${res.status})`;
      throw new Error(`${err?.code ?? 'unknown'}: ${message}`);
    }
    return parsed as T;
  }
}

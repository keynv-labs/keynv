import type { Credentials } from './credentials.js';

const AGENT = 'keynv-mcp/0.0.0';

interface RequestOpts {
  method?: 'GET' | 'POST';
  body?: unknown;
  query?: Record<string, string | number | undefined>;
}

export class McpApiClient {
  constructor(private readonly creds: Credentials) {}

  async request<T = unknown>(path: string, opts: RequestOpts = {}): Promise<T> {
    const url = new URL(path, this.creds.server_url);
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
        authorization: `Bearer ${this.creds.access_token}`,
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

import { spawn } from 'node:child_process';
import { hostname, platform } from 'node:os';
import { AGENT } from '../version.js';
import type { Credentials } from './store.js';

interface BrowserStartResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  verification_uri_complete: string;
  expires_in: number;
  interval: number;
}

interface BrowserPollResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: { id: string; email: string; org_id: string; org_role: string };
}

export class BrowserAuthError extends Error {}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function errorMessage(res: Response, fallback: string): Promise<string> {
  const text = await res.text();
  if (!text) return fallback;
  try {
    const parsed = JSON.parse(text) as { error?: { message?: string } };
    return parsed.error?.message ?? fallback;
  } catch {
    return fallback;
  }
}

function isSafeUrl(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export function openBrowser(url: string): boolean {
  if (!isSafeUrl(url)) return false;
  try {
    const os = platform();
    const command = os === 'win32' ? 'cmd' : os === 'darwin' ? 'open' : 'xdg-open';
    const args = os === 'win32' ? ['/c', 'start', '', url] : [url];
    const child = spawn(command, args, { detached: true, stdio: 'ignore' });
    child.unref();
    return true;
  } catch {
    return false;
  }
}

export async function runBrowserAuth(serverUrl: string): Promise<Credentials> {
  const startRes = await fetch(new URL('/v1/auth/cli/browser/start', serverUrl).toString(), {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-keynv-agent': AGENT },
    body: JSON.stringify({ device_name: hostname() }),
  });
  if (!startRes.ok) {
    throw new BrowserAuthError(
      await errorMessage(startRes, `Browser auth failed to start (${startRes.status}).`),
    );
  }

  const start = (await startRes.json()) as BrowserStartResponse;
  const opened = openBrowser(start.verification_uri_complete);
  if (opened) {
    process.stderr.write(
      `\n  Your code: ${start.user_code}\n  Complete auth in your browser, then return here.\n\n`,
    );
  } else {
    process.stderr.write(
      `\n  Could not open a browser automatically.\n  Open this URL manually:\n\n    ${start.verification_uri_complete}\n\n  Your code: ${start.user_code}\n  Waiting for you to complete auth in the browser...\n\n`,
    );
  }

  const deadline = Date.now() + start.expires_in * 1000;
  const intervalMs = Math.max(1, start.interval) * 1000;
  while (Date.now() < deadline) {
    await sleep(intervalMs);
    const pollRes = await fetch(new URL('/v1/auth/cli/browser/poll', serverUrl).toString(), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-keynv-agent': AGENT },
      body: JSON.stringify({ device_code: start.device_code }),
    });

    if (pollRes.status === 202) continue;
    if (!pollRes.ok) {
      throw new BrowserAuthError(
        await errorMessage(pollRes, `Browser auth failed (${pollRes.status}).`),
      );
    }

    const data = (await pollRes.json()) as BrowserPollResponse;
    return {
      auth_kind: 'session',
      server_url: serverUrl,
      user_id: data.user.id,
      email: data.user.email,
      org_id: data.user.org_id,
      org_role: data.user.org_role,
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      access_expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString(),
    };
  }

  throw new BrowserAuthError('Browser auth timed out. Run `keynv` to try again.');
}

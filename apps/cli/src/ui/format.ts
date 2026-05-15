import { isClientError } from '../client/http.js';

/**
 * Lightweight table renderer. ASCII output by default; the only
 * external dependency we want is none.
 */
export function table(headers: string[], rows: string[][]): string {
  const widths = headers.map((h, i) => Math.max(h.length, ...rows.map((r) => (r[i] ?? '').length)));
  const renderRow = (cells: readonly string[]): string =>
    cells.map((cell, i) => cell.padEnd(widths[i] ?? 0)).join('  ');
  const border = widths.map((w) => '─'.repeat(w)).join('  ');
  const lines = [renderRow(headers), border, ...rows.map((r) => renderRow(r))];
  return lines.join('\n');
}

export function isTty(): boolean {
  return process.stdout.isTTY === true;
}

export function fmtError(err: { code?: string; message: string; status?: number }): string {
  const code = err.code ? ` [${err.code}]` : '';
  const status = err.status ? ` (${err.status})` : '';
  return `keynv:${code}${status} ${err.message}`;
}

/**
 * Catches expected errors (API errors, network errors, logical errors) and
 * prints a clean single-line message. Returns 1. Re-throws only for
 * programming bugs that are not Error instances.
 */
export function handleExecError(stderr: NodeJS.WritableStream, err: unknown): 1 {
  if (isClientError(err)) {
    const code = err.code ? `[${err.code}] ` : '';
    stderr.write(`keynv: ${code}${err.message}\n`);
  } else if (err instanceof Error) {
    stderr.write(`keynv: ${err.message}\n`);
  } else {
    stderr.write('keynv: unexpected error\n');
  }
  return 1;
}

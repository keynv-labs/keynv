import { spawn } from 'node:child_process';
import { platform } from 'node:os';

/** Raised when no clipboard tool is available. Callers MUST NOT fall back
 * to printing the secret value when they catch this. */
export class ClipboardUnavailableError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'ClipboardUnavailableError';
  }
}

/** Candidate clipboard-write commands per platform, tried in order. */
function clipboardCommands(): Array<{ cmd: string; args: string[] }> {
  switch (platform()) {
    case 'darwin':
      return [{ cmd: 'pbcopy', args: [] }];
    case 'win32':
      return [{ cmd: 'clip', args: [] }];
    default:
      // Linux/BSD: prefer Wayland, then X11 tools.
      return [
        { cmd: 'wl-copy', args: [] },
        { cmd: 'xclip', args: ['-selection', 'clipboard'] },
        { cmd: 'xsel', args: ['--clipboard', '--input'] },
      ];
  }
}

/**
 * Writes `value` to the OS clipboard via a platform tool, piping through
 * the child's stdin so the value never appears in argv (and thus never in
 * `ps` output or shell history). Rejects with {@link ClipboardUnavailableError}
 * when no clipboard tool is installed — callers MUST NOT fall back to
 * printing the secret.
 */
export async function copyToClipboard(value: string): Promise<void> {
  const candidates = clipboardCommands();
  let lastErr: Error | undefined;
  for (const { cmd, args } of candidates) {
    try {
      await pipeToCommand(cmd, args, value);
      return;
    } catch (err) {
      lastErr = err as Error;
      // ENOENT → tool not installed; try the next candidate.
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') continue;
      throw err;
    }
  }
  throw new ClipboardUnavailableError(
    `no clipboard tool found (tried ${candidates.map((c) => c.cmd).join(', ')})`,
    { cause: lastErr },
  );
}

function pipeToCommand(cmd: string, args: string[], input: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ['pipe', 'ignore', 'ignore'] });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} exited with code ${code}`));
    });
    child.stdin.on('error', reject);
    child.stdin.end(input);
  });
}

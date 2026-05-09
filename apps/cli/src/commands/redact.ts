import { readFileSync } from 'node:fs';
import { createRedactStream, redact } from '@keynv/redactor';
import { Command, Option } from 'clipanion';

export class RedactCommand extends Command {
  static override paths = [['redact']];
  static override usage = Command.Usage({
    description: 'Apply the redactor to a file or - (stdin), printing the result.',
    details: `
Useful for ad-hoc cleanup of logs, screenshots-as-text, or anything
else you're about to paste into a chat. Multi-line patterns (PEM/PGP
private-key blocks) are detected because this is the batch API.
`,
    examples: [
      ['Redact a file', '$0 redact path/to/log.txt'],
      ['Redact piped input', 'cat log.txt | $0 redact -'],
    ],
  });

  file = Option.String();
  json = Option.Boolean('--json', false);

  async execute(): Promise<number> {
    let input: string;
    if (this.file === '-') {
      const chunks: Buffer[] = [];
      for await (const chunk of this.context.stdin) {
        chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : (chunk as Buffer));
      }
      input = Buffer.concat(chunks).toString('utf8');
    } else {
      input = readFileSync(this.file, 'utf8');
    }
    const result = redact(input);
    if (this.json) {
      this.context.stdout.write(`${JSON.stringify({ matches: result.matches }, null, 2)}\n`);
      return 0;
    }
    this.context.stdout.write(result.text);
    return 0;
  }
}

export class RedactStreamCommand extends Command {
  static override paths = [['redact-stream']];
  static override usage = Command.Usage({
    description: 'Stream stdin through the line-buffered redactor to stdout.',
    details: `
Used as a hook handler by per-agent integrations (e.g., Claude Code's
PostToolUse hook): \`keynv redact-stream\` reads its tool output on
stdin and writes a redacted version on stdout, preserving the original
line structure. Multi-line patterns are NOT applied here (see the
streaming-mode limitation in @keynv/redactor).
`,
  });

  async execute(): Promise<number> {
    return new Promise<number>((resolve, reject) => {
      const transform = createRedactStream();
      this.context.stdin
        .pipe(transform)
        .pipe(this.context.stdout)
        .on('error', reject)
        .on('finish', () => resolve(0));
      this.context.stdin.on('error', reject);
    });
  }
}

import { Command, Option } from 'clipanion';
import { ApiClient } from '../client/http.js';
import { isInteractive } from '../ui/helpers/tty.js';
import { runInitFlow } from '../ui/flows/init.js';
import { UserCancelled } from '../ui/helpers/cancel.js';

export class InitCommand extends Command {
  static override paths = [['init']];
  static override usage = Command.Usage({
    description: 'Migrate an existing project from .env to keynv.',
    details: `
Walks the current directory's .env files, prompts you to mark which
keys are real secrets, uploads those to the keynv vault, writes a
.keynv.env file with alias references, and (optionally) wraps your
package.json scripts with \`keynv exec\`.

Safe to re-run: existing .keynv.env entries are preserved; new
entries are appended below a marker.

Requires an interactive terminal (clack TUI). For scripted
migration, use the lower-level \`keynv project\` and \`keynv secret\`
commands directly.
`,
    examples: [
      ['Walk the current project', '$0 init'],
      ['Preview without writing or uploading', '$0 init --dry-run'],
      ['Skip the package.json script-wrapping step', '$0 init --no-scripts'],
    ],
  });

  dryRun = Option.Boolean('--dry-run', false, {
    description: 'Show what would be done without writing files or uploading secrets.',
  });
  noScripts = Option.Boolean('--no-scripts', false, {
    description: 'Skip the package.json script-wrapping step.',
  });

  async execute(): Promise<number> {
    if (!isInteractive()) {
      this.context.stderr.write(
        'keynv init requires an interactive terminal. Use the lower-level commands (`keynv project`, `keynv secret`) for scripted setup.\n',
      );
      return 1;
    }

    const client = new ApiClient();
    await client.ensureHydrated();
    if (!client.isLoggedIn) {
      this.context.stderr.write('keynv: not logged in. Run `keynv login` first.\n');
      return 1;
    }

    try {
      const outcome = await runInitFlow(client, {
        cwd: process.cwd(),
        dryRun: this.dryRun,
        noScripts: this.noScripts,
      });
      return outcome.exitCode;
    } catch (err) {
      if (err instanceof UserCancelled) return 130;
      const e = err as { code?: string; message: string; status?: number };
      this.context.stderr.write(`keynv: ${e.message}\n`);
      return 1;
    }
  }
}

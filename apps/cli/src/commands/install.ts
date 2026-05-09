import { type InstallReport, REGISTRY, findIntegration } from '@keynv/integrations';
import { Command, Option } from 'clipanion';

function printReport(stdout: NodeJS.WritableStream, report: InstallReport): void {
  stdout.write(`[${report.agent}] ${report.summary}\n`);
  for (const change of report.changes) {
    const note = change.note ? `: ${change.note}` : '';
    stdout.write(`  ${change.action.padEnd(7)} ${change.path}${note}\n`);
  }
}

export class InstallCommand extends Command {
  static override paths = [['install']];
  static override usage = Command.Usage({
    description: 'Install per-agent file deny lists, hooks, and config templates.',
    details: `
Each integration writes a small, idempotent set of files. Re-running
yields the same state. Use --dry-run to preview changes before they
land.
`,
    examples: [
      ['Install Claude Code', '$0 install claude-code'],
      ['Preview the change', '$0 install claude-code --dry-run'],
      ['Install all detected', '$0 install --all'],
      ['List supported integrations', '$0 install list'],
    ],
  });

  agent = Option.String({ required: false });
  dryRun = Option.Boolean('--dry-run', false);
  all = Option.Boolean('--all', false);

  async execute(): Promise<number> {
    if (this.agent === 'list') {
      this.context.stdout.write('Supported integrations:\n');
      for (const i of REGISTRY) {
        this.context.stdout.write(`  ${i.name.padEnd(14)} ${i.displayName}\n`);
      }
      return 0;
    }

    if (this.all) {
      const cwd = process.cwd();
      let any = false;
      for (const integration of REGISTRY) {
        const detected = await integration.detect({ cwd });
        if (!detected) continue;
        any = true;
        const report = await integration.install({ cwd, dryRun: this.dryRun });
        printReport(this.context.stdout, report);
      }
      if (!any) {
        this.context.stdout.write('no integrations detected in this directory\n');
      }
      return 0;
    }

    if (!this.agent) {
      this.context.stderr.write(
        'keynv: usage: keynv install <agent> | keynv install --all | keynv install list\n',
      );
      return 2;
    }
    const integration = findIntegration(this.agent);
    if (!integration) {
      this.context.stderr.write(
        `keynv: unknown integration '${this.agent}'. Try \`keynv install list\`.\n`,
      );
      return 1;
    }
    const report = await integration.install({ cwd: process.cwd(), dryRun: this.dryRun });
    printReport(this.context.stdout, report);
    return 0;
  }
}

export class UninstallCommand extends Command {
  static override paths = [['uninstall']];
  static override usage = Command.Usage({
    description: 'Remove keynv-managed entries written by an earlier `keynv install`.',
  });

  agent = Option.String();
  dryRun = Option.Boolean('--dry-run', false);

  async execute(): Promise<number> {
    const integration = findIntegration(this.agent);
    if (!integration) {
      this.context.stderr.write(
        `keynv: unknown integration '${this.agent}'. Try \`keynv install list\`.\n`,
      );
      return 1;
    }
    const report = await integration.uninstall({ cwd: process.cwd(), dryRun: this.dryRun });
    printReport(this.context.stdout, report);
    return 0;
  }
}

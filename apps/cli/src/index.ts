import { Builtins, Cli } from 'clipanion';
import { AuditListCommand, AuditVerifyCommand } from './commands/audit.js';
import { DoctorCommand } from './commands/doctor.js';
import { EnvAddCommand, EnvListCommand } from './commands/env.js';
import { ExecCommand } from './commands/exec.js';
import { InitCommand } from './commands/init.js';
import { LoginCommand, LogoutCommand, WhoamiCommand } from './commands/login.js';
import { MemberAddCommand, MemberListCommand, MemberRemoveCommand } from './commands/member.js';
import {
  ProjectCreateCommand,
  ProjectDeleteCommand,
  ProjectDescribeCommand,
  ProjectListCommand,
} from './commands/project.js';
import { RedactCommand, RedactStreamCommand } from './commands/redact.js';
import { ScrubCommand } from './commands/scrub.js';
import {
  SecretCreateCommand,
  SecretDeleteCommand,
  SecretGetCommand,
  SecretListCommand,
  SecretRotateCommand,
  SecretRotationsCommand,
  SecretSetRotationCommand,
} from './commands/secret.js';
import {
  ShellInstallCommand,
  ShellStatusCommand,
  ShellUninstallCommand,
} from './commands/shell.js';
import { TestCommand } from './commands/test.js';
import { UICommand } from './commands/ui.js';
import { WatchStartCommand, WatchStatusCommand, WatchStopCommand } from './commands/watch.js';
import { fmtError } from './ui/format.js';
import { VERSION } from './version.js';

const cli = new Cli({
  binaryName: 'keynv',
  binaryLabel: 'keynv — AI-safe secrets management',
  binaryVersion: VERSION,
  enableCapture: false,
});

cli.register(Builtins.HelpCommand);
cli.register(Builtins.VersionCommand);

cli.register(LoginCommand);
cli.register(LogoutCommand);
cli.register(WhoamiCommand);

cli.register(ProjectCreateCommand);
cli.register(ProjectListCommand);
cli.register(ProjectDescribeCommand);
cli.register(ProjectDeleteCommand);

cli.register(EnvListCommand);
cli.register(EnvAddCommand);

cli.register(SecretCreateCommand);
cli.register(SecretGetCommand);
cli.register(SecretListCommand);
cli.register(SecretRotateCommand);
cli.register(SecretDeleteCommand);
cli.register(SecretSetRotationCommand);
cli.register(SecretRotationsCommand);

cli.register(MemberAddCommand);
cli.register(MemberRemoveCommand);
cli.register(MemberListCommand);

cli.register(AuditListCommand);
cli.register(AuditVerifyCommand);

cli.register(ExecCommand);
cli.register(InitCommand);
cli.register(RedactCommand);
cli.register(RedactStreamCommand);
cli.register(DoctorCommand);
cli.register(ScrubCommand);
cli.register(ShellInstallCommand);
cli.register(ShellUninstallCommand);
cli.register(ShellStatusCommand);

cli.register(WatchStartCommand);
cli.register(WatchStopCommand);
cli.register(WatchStatusCommand);

cli.register(TestCommand);
cli.register(UICommand);

const argv = process.argv.slice(2);

async function main(): Promise<number> {
  if (argv.length === 0) {
    // No subcommand → open the interactive menu (when on a TTY) instead of
    // dumping a help page. The UICommand itself falls back to a short hint
    // when stdin/stdout are not a TTY (CI, pipes), so scripts still get
    // sensible behavior.
    const { runMenu } = await import('./ui/menu.js');
    const { isInteractive } = await import('./ui/helpers/tty.js');
    if (isInteractive()) {
      return runMenu();
    }

    process.stdout.write(
      'keynv — AI-safe secrets management.\n' +
        'Run `keynv --help` for the full command list, or run `keynv` in an interactive\n' +
        'terminal to open the menu.\n',
    );
    return 0;
  }

  return cli.run(argv);
}

main()
  .then((code) => {
    process.exitCode = code ?? 0;
  })
  .catch((err: { code?: string; message: string; status?: number }) => {
    process.stderr.write(`${fmtError(err)}\n`);
    process.exitCode = 1;
  });

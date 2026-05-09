import { Builtins, Cli } from 'clipanion';
import { AuditListCommand, AuditVerifyCommand } from './commands/audit.js';
import { LoginCommand, LogoutCommand, WhoamiCommand } from './commands/login.js';
import { MemberAddCommand, MemberListCommand, MemberRemoveCommand } from './commands/member.js';
import {
  ProjectCreateCommand,
  ProjectDeleteCommand,
  ProjectDescribeCommand,
  ProjectListCommand,
} from './commands/project.js';
import {
  SecretCreateCommand,
  SecretDeleteCommand,
  SecretGetCommand,
  SecretListCommand,
  SecretRotateCommand,
} from './commands/secret.js';
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

cli.register(SecretCreateCommand);
cli.register(SecretGetCommand);
cli.register(SecretListCommand);
cli.register(SecretRotateCommand);
cli.register(SecretDeleteCommand);

cli.register(MemberAddCommand);
cli.register(MemberRemoveCommand);
cli.register(MemberListCommand);

cli.register(AuditListCommand);
cli.register(AuditVerifyCommand);

cli
  .runExit(process.argv.slice(2))
  .catch((err: { code?: string; message: string; status?: number }) => {
    process.stderr.write(`${fmtError(err)}\n`);
    process.exit(1);
  });

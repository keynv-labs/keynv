import { Command } from 'clipanion';
import { isInteractive } from '../ui/helpers/tty.js';
import { runMenu } from '../ui/menu.js';

/**
 * Default command: opens the interactive TUI when `keynv` is invoked
 * with no arguments. Also available explicitly as `keynv ui`. In a
 * non-TTY environment falls back to clipanion's help so scripts and
 * pipes still get sensible behavior.
 */
export class UICommand extends Command {
  static override paths = [['ui']];
  static override usage = Command.Usage({
    description: 'Open the interactive menu (also runs by default when no args are given).',
  });

  async execute(): Promise<number> {
    if (!isInteractive()) {
      this.context.stdout.write(
        'keynv — AI-safe secrets management.\n' +
          'Run `keynv --help` for the full command list, or run `keynv` in an interactive\n' +
          'terminal to open the menu.\n',
      );
      return 0;
    }
    return runMenu();
  }
}

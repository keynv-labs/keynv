import { loadCredentials } from './credentials.js';
import { runStdio } from './server.js';

async function main(): Promise<void> {
  const creds = await loadCredentials();
  if (!creds) {
    process.stderr.write(
      'keynv-mcp: no credentials. Run `keynv login` first; the MCP server inherits the developer session.\n',
    );
    process.exit(1);
  }
  await runStdio({ creds });
}

main().catch((err) => {
  process.stderr.write(`keynv-mcp: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});

export const VERSION = '0.0.0-phase2';

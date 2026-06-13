import { McpApiClient } from './api-client.js';
import { loadCredentials } from './credentials.js';
import { resolveTokenToValue, startResolver } from './resolver.js';
import { runStdio } from './server.js';
export { VERSION } from './version.js';

async function main(): Promise<void> {
  const creds = await loadCredentials();
  if (!creds) {
    process.stderr.write(
      'keynv-mcp: no credentials. Run `keynv` first; the MCP server inherits the developer session.\n',
    );
    process.exit(1);
  }

  // Start the reference-token resolver so `keynv exec --resolve <token>` can
  // redeem the single-use tokens that `keynv.use_secret` hands the agent.
  // Best-effort: if the socket can't bind, the MCP tools still work — only
  // the resolve hop is unavailable, and the CLI reports that clearly.
  const resolverApi = new McpApiClient(creds);
  try {
    await startResolver((token) => resolveTokenToValue(resolverApi, token));
  } catch (err) {
    process.stderr.write(
      `keynv-mcp: could not start token resolver (${err instanceof Error ? err.message : String(err)}). use_secret tokens will not be resolvable.\n`,
    );
  }

  await runStdio({ creds });
}

main().catch((err) => {
  process.stderr.write(`keynv-mcp: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});

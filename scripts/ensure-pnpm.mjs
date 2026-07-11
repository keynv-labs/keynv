// Enforce pnpm for repo setup.
//
// keynv is a pnpm workspace; its internal packages (@keynv/core, redactor, …)
// are declared as `workspace:*`, a protocol only pnpm resolves. Running
// `npm install` or `yarn install` fails with a cryptic "@keynv/core not
// found" / "Unsupported URL Type workspace:" instead of a helpful message.
//
// Fail-open by design: only block when the package-manager user agent
// EXPLICITLY says npm or yarn. An empty/unknown user agent (some CI shells,
// sandboxes) never blocks, so this can't wedge a legitimate pnpm-driven
// install — including the release pipeline's `pnpm install --frozen-lockfile`.
const ua = process.env.npm_config_user_agent || '';

if (/\b(npm|yarn)\//.test(ua) && !ua.includes('pnpm')) {
  const red = (s) => `\x1b[31m${s}\x1b[0m`;
  const bold = (s) => `\x1b[1m${s}\x1b[0m`;
  console.error(
    `\n${red('This repo uses pnpm.')} npm and yarn can't resolve its workspace:* dependencies — that's the "@keynv/core not found" error.\n\n  1. Install pnpm:  ${bold('corepack enable')}  (or https://pnpm.io/installation)\n  2. From the repo root, run:  ${bold('pnpm install')}\n`,
  );
  process.exit(1);
}

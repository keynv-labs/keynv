import { aider } from './aider.js';
import { claudeCode } from './claude-code.js';
import { codexCli } from './codex.js';
import { cursor } from './cursor.js';
import { opencode } from './opencode.js';
import type { Integration } from './types.js';

export type { FileChange, InstallOptions, InstallReport, Integration } from './types.js';
export { KEYNV_FILE_DENY_PATTERNS } from './file-deny-list.js';
export { ensureKeynvBlock, removeKeynvBlock, KEYNV_BEGIN, KEYNV_END } from './fs-utils.js';

export const REGISTRY: ReadonlyArray<Integration> = [claudeCode, cursor, opencode, codexCli, aider];

export function findIntegration(name: string): Integration | null {
  return REGISTRY.find((i) => i.name === name) ?? null;
}

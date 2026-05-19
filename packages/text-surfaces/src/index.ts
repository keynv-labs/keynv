export type {
  RewriteFileResult,
  RewriteOptions,
  RewriteResult,
  ScanOptions,
  TextSurface,
  TextSurfaceFileScan,
  TextSurfaceMatchPreview,
  TextSurfaceScanResult,
} from './types.js';
export { RewriteNotImplementedError } from './types.js';
export { builtinSurfaces, discoverPresentSurfaces } from './discover.js';
export { scanFile, SCAN_DEFAULTS } from './scan.js';
export { rewriteFile, rewriteSingleFile } from './rewrite.js';
export {
  createBashHistorySurface,
  createFishHistorySurface,
  createZshHistorySurface,
} from './surfaces/shell-history.js';
export { createClaudeCodeSurface } from './surfaces/claude-code.js';
export { createCursorSurface } from './surfaces/cursor.js';
export {
  bashHistoryPath,
  claudeCodeProjectsDir,
  cursorLogsDir,
  fishHistoryPath,
  keynvHome,
  zshHistoryPath,
} from './paths.js';

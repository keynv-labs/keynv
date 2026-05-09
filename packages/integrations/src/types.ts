/**
 * The result of an `install()` invocation. Reports any files that
 * would be (or were) created or modified, plus the human-readable
 * summary line(s) printed by the CLI.
 */
export interface InstallReport {
  readonly agent: string;
  readonly applied: boolean;
  readonly changes: ReadonlyArray<FileChange>;
  readonly summary: string;
}

export interface FileChange {
  readonly path: string;
  readonly action: 'create' | 'update' | 'remove' | 'skip';
  readonly note?: string;
}

export interface InstallOptions {
  /**
   * Working directory for project-scoped writes (e.g., `.cursorignore`).
   * Defaults to `process.cwd()`.
   */
  readonly cwd?: string;
  /**
   * If true, no files are modified; the report describes what would
   * happen.
   */
  readonly dryRun?: boolean;
  /**
   * If false, install/uninstall stop at the first conflict instead of
   * merging or overwriting. Defaults to true (idempotent merges).
   */
  readonly merge?: boolean;
}

export interface Integration {
  readonly name: string;
  readonly displayName: string;
  /** Returns true if this agent's config is detected at the cwd. */
  detect(opts?: InstallOptions): Promise<boolean>;
  install(opts?: InstallOptions): Promise<InstallReport>;
  uninstall(opts?: InstallOptions): Promise<InstallReport>;
}

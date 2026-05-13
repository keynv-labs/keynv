import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resolveWindowsCmd, spawnPrivileged } from './spawn.js';

// ---------------------------------------------------------------------------
// resolveWindowsCmd — unit tests
// ---------------------------------------------------------------------------

describe('resolveWindowsCmd', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'keynv-spawn-test-'));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it('returns null for commands that already have an extension', () => {
    expect(resolveWindowsCmd('node.exe', { PATH: tmp })).toBeNull();
    expect(resolveWindowsCmd('next.cmd', { PATH: tmp })).toBeNull();
    expect(resolveWindowsCmd('script.bat', { PATH: tmp })).toBeNull();
  });

  it('returns null for absolute paths', () => {
    const abs = process.platform === 'win32' ? 'C:\\Windows\\node.exe' : '/usr/bin/node';
    expect(resolveWindowsCmd(abs, { PATH: tmp })).toBeNull();
  });

  it('returns null for relative paths with separators', () => {
    expect(resolveWindowsCmd('./node', { PATH: tmp })).toBeNull();
    expect(resolveWindowsCmd('bin/next', { PATH: tmp })).toBeNull();
  });

  it('finds a .cmd file in PATH and returns the full path', () => {
    const cmdPath = join(tmp, 'mycli.cmd');
    writeFileSync(cmdPath, '@echo off\r\necho hello\r\n');

    const result = resolveWindowsCmd('mycli', {
      PATH: tmp,
      PATHEXT: '.COM;.EXE;.BAT;.CMD',
    });
    expect(result).toBe(cmdPath);
  });

  it('finds a .bat file when .cmd is not present', () => {
    const batPath = join(tmp, 'mybat.bat');
    writeFileSync(batPath, '@echo off\r\necho bat\r\n');

    const result = resolveWindowsCmd('mybat', {
      PATH: tmp,
      PATHEXT: '.COM;.EXE;.BAT;.CMD',
    });
    expect(result).toBe(batPath);
  });

  it('returns null when command is not found in any PATH directory', () => {
    const result = resolveWindowsCmd('definitely-not-a-real-binary', {
      PATH: tmp,
      PATHEXT: '.COM;.EXE;.BAT;.CMD',
    });
    expect(result).toBeNull();
  });

  it('returns the first match across multiple PATH directories', () => {
    const dir1 = mkdtempSync(join(tmpdir(), 'keynv-spawn-p1-'));
    const dir2 = mkdtempSync(join(tmpdir(), 'keynv-spawn-p2-'));
    try {
      const first = join(dir1, 'tool.cmd');
      const second = join(dir2, 'tool.cmd');
      writeFileSync(first, '@echo first');
      writeFileSync(second, '@echo second');

      const pathStr = [dir1, dir2].join(delimiter);
      const result = resolveWindowsCmd('tool', { PATH: pathStr });
      expect(result).toBe(first);
    } finally {
      rmSync(dir1, { recursive: true, force: true });
      rmSync(dir2, { recursive: true, force: true });
    }
  });

  it('uses process.env.PATHEXT as fallback when not in subprocessEnv', () => {
    const cmdPath = join(tmp, 'fallbacktool.cmd');
    writeFileSync(cmdPath, '@echo off');

    // Don't pass PATHEXT in subprocessEnv — should fall back to process.env.PATHEXT
    const result = resolveWindowsCmd('fallbacktool', { PATH: tmp });
    // On Windows, process.env.PATHEXT should include .CMD
    // On Linux/macOS, PATHEXT defaults to '.COM;.EXE;.BAT;.CMD' so it still works
    expect(result).toBe(cmdPath);
  });

  it('ignores directories that cannot be read', () => {
    const nonexistent = join(tmp, 'does-not-exist');
    const realPath = join(tmp, 'realbin.cmd');
    writeFileSync(realPath, '@echo ok');

    const pathStr = [nonexistent, tmp].join(process.platform === 'win32' ? ';' : ':');
    const result = resolveWindowsCmd('realbin', { PATH: pathStr });
    expect(result).toBe(realPath);
  });
});

// ---------------------------------------------------------------------------
// spawnPrivileged — integration tests
// These run real subprocesses, so they exercise actual OS behavior.
// ---------------------------------------------------------------------------

describe('spawnPrivileged — flag passthrough', () => {
  it('passes flags starting with - through to the subprocess', async () => {
    // `node --version` exits 0 and prints the version. If -v / --version were
    // intercepted by keynv's option parser before reaching spawn, the
    // subprocess would never start and we'd get an error.
    const result = await spawnPrivileged({
      command: 'node',
      args: ['--version'],
      injectedEnv: {},
      resolved: [],
      noRedact: true,
    });
    expect(result.exitCode).toBe(0);
  });

  it('passes multiple flags with values through to the subprocess', async () => {
    // `node -e "process.exit(0)"` — tests that -e flag and its value both
    // reach the subprocess without being consumed by keynv.
    const result = await spawnPrivileged({
      command: 'node',
      args: ['-e', 'process.exit(0)'],
      injectedEnv: {},
      resolved: [],
      noRedact: true,
    });
    expect(result.exitCode).toBe(0);
  });

  it('exits with the subprocess exit code', async () => {
    const result = await spawnPrivileged({
      command: 'node',
      args: ['-e', 'process.exit(42)'],
      injectedEnv: {},
      resolved: [],
      noRedact: true,
    });
    expect(result.exitCode).toBe(42);
  });

  it('injects env vars into the subprocess', async () => {
    // Subprocess reads KEYNV_TEST_VAR and exits with 0 if it's set.
    const result = await spawnPrivileged({
      command: 'node',
      args: ['-e', 'process.exit(process.env.KEYNV_TEST_VAR === "hello" ? 0 : 1)'],
      injectedEnv: { KEYNV_TEST_VAR: 'hello' },
      resolved: [],
      noRedact: true,
    });
    expect(result.exitCode).toBe(0);
  });

  it('does NOT leak caller env vars that are not in the allowlist', async () => {
    // Set a secret-shaped var in the caller process; the subprocess should
    // NOT see it (it's not in ENV_ALLOWLIST and not in injectedEnv).
    process.env.KEYNV_SHOULD_NOT_LEAK = 'super-secret-value';
    try {
      const result = await spawnPrivileged({
        command: 'node',
        args: ['-e', 'process.exit(process.env.KEYNV_SHOULD_NOT_LEAK ? 1 : 0)'],
        injectedEnv: {},
        resolved: [],
        noRedact: true,
      });
      expect(result.exitCode).toBe(0);
    } finally {
      delete process.env.KEYNV_SHOULD_NOT_LEAK;
    }
  });
});

describe('spawnPrivileged — Windows .cmd resolution', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'keynv-spawn-win-'));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it('runs a .cmd wrapper by finding it in PATH (Windows)', async () => {
    if (process.platform !== 'win32') return; // Windows-only

    // Create a fake `mytool.cmd` in a temp dir and put that dir in PATH.
    const cmdPath = join(tmp, 'mytool.cmd');
    // Exit 0 if first arg is "works"
    writeFileSync(cmdPath, '@echo off\r\nif "%1"=="works" (exit /b 0) else (exit /b 1)\r\n');

    const origPath = process.env.PATH ?? '';
    process.env.PATH = `${tmp}${delimiter}${origPath}`;
    try {
      const result = await spawnPrivileged({
        command: 'mytool',
        args: ['works'],
        injectedEnv: {},
        resolved: [],
        noRedact: true,
      });
      expect(result.exitCode).toBe(0);
    } finally {
      process.env.PATH = origPath;
    }
  });

  it('passes -flags to a .cmd wrapper without ENOENT (Windows)', async () => {
    if (process.platform !== 'win32') return;

    // Simulates the `next --version` / `next dev --port 3005` pattern.
    const cmdPath = join(tmp, 'fakecli.cmd');
    // Exit 0 if --port flag is present, 1 otherwise.
    writeFileSync(
      cmdPath,
      '@echo off\r\nif "%1"=="--port" (exit /b 0) else (exit /b 1)\r\n',
    );

    const origPath = process.env.PATH ?? '';
    process.env.PATH = `${tmp}${delimiter}${origPath}`;
    try {
      const result = await spawnPrivileged({
        command: 'fakecli',
        args: ['--port', '3005'],
        injectedEnv: {},
        resolved: [],
        noRedact: true,
      });
      expect(result.exitCode).toBe(0);
    } finally {
      process.env.PATH = origPath;
    }
  });

  it('resolves .cmd in a PATH directory whose name contains spaces (Windows)', async () => {
    if (process.platform !== 'win32') return;

    // Simulate node_modules/.bin living under a user directory with spaces,
    // e.g. C:\Users\John Doe\project\node_modules\.bin\next.cmd
    const { mkdtempSync: mdt, rmSync: rms } = await import('node:fs');
    const spaceDir = mdt(join(tmpdir(), 'keynv space test-'));
    try {
      const cmdPath = join(spaceDir, 'spacetool.cmd');
      writeFileSync(cmdPath, '@echo off\r\nif "%1"=="ok" (exit /b 0) else (exit /b 1)\r\n');

      const origPath = process.env.PATH ?? '';
      process.env.PATH = `${spaceDir}${delimiter}${origPath}`;
      try {
        const result = await spawnPrivileged({
          command: 'spacetool',
          args: ['ok'],
          injectedEnv: {},
          resolved: [],
          noRedact: true,
        });
        expect(result.exitCode).toBe(0);
      } finally {
        process.env.PATH = origPath;
      }
    } finally {
      rms(spaceDir, { recursive: true, force: true });
    }
  });
});

import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  AGENTS_FILE_BASENAME,
  KEYNV_BLOCK_END,
  KEYNV_BLOCK_START,
  renderKeynvBlock,
  writeAiContext,
} from './ai-context.js';

let root: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'keynv-aictx-'));
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

const agentsPath = () => join(root, AGENTS_FILE_BASENAME);

describe('renderKeynvBlock', () => {
  it('wraps the body in start/end markers', () => {
    const block = renderKeynvBlock();
    expect(block.startsWith(KEYNV_BLOCK_START)).toBe(true);
    expect(block.endsWith(KEYNV_BLOCK_END)).toBe(true);
  });

  it('includes the keynv mental-model heading', () => {
    expect(renderKeynvBlock()).toContain('## keynv (secrets)');
  });

  it('includes the hard rules', () => {
    const body = renderKeynvBlock();
    expect(body).toContain('Never print resolved secret values');
    expect(body).toContain('Never write a `.env` file');
  });
});

describe('writeAiContext — create', () => {
  it('creates AGENTS.md with a preamble + the block when file is missing', () => {
    const outcome = writeAiContext(root);
    expect(outcome).toBe('created');
    expect(existsSync(agentsPath())).toBe(true);
    const text = readFileSync(agentsPath(), 'utf8');
    expect(text).toContain('# Agent guidance for this project');
    expect(text).toContain(KEYNV_BLOCK_START);
    expect(text).toContain(KEYNV_BLOCK_END);
  });
});

describe('writeAiContext — update existing block', () => {
  it('replaces only the block content, leaves user prose intact', () => {
    writeFileSync(
      agentsPath(),
      [
        '# My agents',
        '',
        '## My own rules',
        'Be nice to the dog.',
        '',
        KEYNV_BLOCK_START,
        '## keynv (secrets)',
        'OUT-OF-DATE CONTENT',
        KEYNV_BLOCK_END,
        '',
        '## More user content below',
        'Tail content survives.',
      ].join('\n'),
    );
    const outcome = writeAiContext(root);
    expect(outcome).toBe('updated');
    const text = readFileSync(agentsPath(), 'utf8');
    expect(text).toContain('Be nice to the dog.');
    expect(text).toContain('Tail content survives.');
    expect(text).not.toContain('OUT-OF-DATE CONTENT');
    // exactly one keynv block
    const startCount = text.split(KEYNV_BLOCK_START).length - 1;
    const endCount = text.split(KEYNV_BLOCK_END).length - 1;
    expect(startCount).toBe(1);
    expect(endCount).toBe(1);
  });

  it('reports unchanged on a no-op rewrite', () => {
    writeAiContext(root);
    const outcome = writeAiContext(root);
    expect(outcome).toBe('unchanged');
  });
});

describe('writeAiContext — append', () => {
  it('appends the block when AGENTS.md exists with no markers', () => {
    writeFileSync(agentsPath(), '# Pre-existing AGENTS file\n\nUser prose here.\n');
    const outcome = writeAiContext(root);
    expect(outcome).toBe('appended');
    const text = readFileSync(agentsPath(), 'utf8');
    expect(text.startsWith('# Pre-existing AGENTS file')).toBe(true);
    expect(text).toContain('User prose here.');
    expect(text).toContain(KEYNV_BLOCK_START);
  });

  it('handles file missing trailing newline', () => {
    writeFileSync(agentsPath(), 'no trailing newline');
    const outcome = writeAiContext(root);
    expect(outcome).toBe('appended');
    const text = readFileSync(agentsPath(), 'utf8');
    expect(text).toContain('no trailing newline');
    expect(text).toContain(KEYNV_BLOCK_START);
  });

  it('does not duplicate when re-run after appending', () => {
    writeFileSync(agentsPath(), '# Existing\n\n');
    writeAiContext(root);
    writeAiContext(root);
    const text = readFileSync(agentsPath(), 'utf8');
    const startCount = text.split(KEYNV_BLOCK_START).length - 1;
    expect(startCount).toBe(1);
  });
});

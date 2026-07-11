#!/usr/bin/env node

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

const VERSIONED_PACKAGES = [
  'package.json',
  'packages/core/package.json',
  'packages/redactor/package.json',
  'packages/rbac/package.json',
  'packages/testers/package.json',
  'packages/text-surfaces/package.json',
  'apps/cli/package.json',
  'apps/server/package.json',
  'apps/web/package.json',
  'apps/mcp/package.json',
];

const args = process.argv.slice(2);
const check = args.includes('--check');
const versionArg = args.find((arg) => !arg.startsWith('--'));

if (!versionArg) {
  console.error('Usage: node scripts/sync-version.mjs <version> [--check]');
  process.exit(1);
}

const version = versionArg.replace(/^v/, '');
if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
  console.error(`Invalid semver version: ${versionArg}`);
  process.exit(1);
}

let changed = false;

for (const relativePath of VERSIONED_PACKAGES) {
  const path = join(ROOT, relativePath);
  // Defensive: a package can be removed from the monorepo (e.g. apps/landing).
  // Skip missing files with a warning rather than crashing the release build.
  if (!existsSync(path)) {
    console.warn(`skipping ${relativePath} (not found)`);
    continue;
  }
  const source = readFileSync(path, 'utf8');
  const updated = source.replace(/("version"\s*:\s*")[^"]+("\s*,)/, `$1${version}$2`);

  if (source === updated) continue;
  changed = true;

  if (check) {
    console.error(`${relativePath} is not synced to ${version}`);
  } else {
    writeFileSync(path, updated);
    console.info(`${relativePath} -> ${version}`);
  }
}

if (check && changed) process.exit(1);
if (!changed) console.info(`All package versions are already ${version}`);

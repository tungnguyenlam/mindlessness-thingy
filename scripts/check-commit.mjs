#!/usr/bin/env node
// Pre-commit: two checks.
//  1. The usual scoped check on the working tree: errors in the files being committed block.
//  2. The commit as it will land: the index (what git will actually record) is checked out into a
//     temp directory and checked there. This catches a commit that only passes locally because it
//     leans on files that aren't committed, e.g. a note linking to another agent's uncommitted
//     draft. CI checks out exactly this tree, so it would fail there.
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const scoped = spawnSync('node', ['scripts/check.mjs', '--staged'], { cwd: root, stdio: 'inherit' });
if (scoped.status !== 0) process.exit(scoped.status ?? 1);

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'commit-tree-'));
try {
  // GIT_INDEX_FILE is set by git during `git commit -- <paths>`, so this is exactly what lands.
  execFileSync('git', ['checkout-index', '-a', '-f', `--prefix=${tmp}/`], { cwd: root, env: process.env });
  fs.symlinkSync(path.join(root, 'node_modules'), path.join(tmp, 'node_modules'));
  const r = spawnSync('node', ['scripts/check.mjs'], { cwd: tmp, encoding: 'utf8' });
  if (r.status !== 0) {
    process.stderr.write((r.stderr || '') + (r.stdout || '').split('\n').filter((l) => /^(error|  )/.test(l)).join('\n'));
    console.error('\nerror [commit-when-done] The commit as it will land fails the checks, though your working tree passes.');
    console.error('      fix: it depends on files that are not being committed (often a link to a note that exists only as someone');
    console.error('      else\'s uncommitted draft). Commit what it needs, or create stubs with pnpm run new, then commit again.');
    process.exit(1);
  }
  console.log('commit tree check passed');
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

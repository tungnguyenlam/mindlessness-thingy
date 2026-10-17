#!/usr/bin/env node
// Runs the GitHub Actions build job (.github/workflows/deploy.yml) locally, the way CI sees it:
// a clean checkout of HEAD (only committed files), `pnpm install --frozen-lockfile`, then
// `pnpm run check`. A pass here means the deploy job will pass; run it after committing.
// Options: --keep leaves the temp checkout for inspection.
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const keep = process.argv.includes('--keep');

const dirty = execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: root, encoding: 'utf8' }).trim();
if (dirty) console.log('note: uncommitted changes are ignored; CI only sees HEAD.\n');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ci-local-'));
const run = (cmd, args) => {
  console.log(`\n$ ${cmd} ${args.join(' ')}`);
  const r = spawnSync(cmd, args, { cwd: tmp, stdio: 'inherit', env: { ...process.env, CI: 'true' } });
  return r.status ?? 1;
};

let status = 1;
try {
  execFileSync('sh', ['-c', `git archive HEAD | tar -x -C "${tmp}"`], { cwd: root });
  console.log(`checked out ${execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim()} into ${tmp}`);
  status = run('pnpm', ['install', '--frozen-lockfile', '--prefer-offline']);
  if (status === 0) status = run('pnpm', ['run', 'check']);
} finally {
  if (keep) console.log(`\nkept ${tmp}`);
  else fs.rmSync(tmp, { recursive: true, force: true });
}

if (status !== 0) {
  console.error('\nerror [commit-when-done] The CI build job fails on a clean checkout of HEAD.');
  console.error('      fix: read the first error above. If `pnpm run check` passes in your working tree, the commit is');
  console.error('      missing a file it needs (or package.json and pnpm-lock.yaml are out of sync). Fix it, commit, rerun.');
  process.exit(status);
}
console.log('\nci passed: the deploy workflow\'s build job will pass for this commit.');

#!/usr/bin/env node
// Repo checks that the Zod schema can't express. `pnpm run check` runs this, a full `astro build`,
// then the keep-place browser test.
//
// Every problem names a rule from scripts/rules.mjs plus how to fix it, so the output tells an
// agent which rule it broke and where to re-read it. Checks live in scripts/checks/*.mjs; drop a
// new module there to add one.
//
//   node scripts/check.mjs                 all files, human output
//   node scripts/check.mjs --files a,b     only errors in these files fail (others become notes)
//   node scripts/check.mjs --staged        same, scoped to files staged in git (pre-commit hook)
//   node scripts/check.mjs --json          machine output for agent hooks
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadNotes, loadSources, STATUSES } from '../src/lib/content-index.mjs';
import { RULES } from './rules.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const flag = (f) => args.includes(f);
const opt = (f) => {
  const i = args.indexOf(f);
  return i >= 0 ? args[i + 1] : undefined;
};

let scope = null;
if (opt('--files')) scope = new Set(opt('--files').split(',').filter(Boolean));
if (flag('--staged')) {
  const out = execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMR'], { cwd: root, encoding: 'utf8' });
  scope = new Set(out.split('\n').filter(Boolean));
}

// The ratchet (scripts/baseline.json): problems that existed when a rule was introduced are
// listed by file and code and reported as warnings; anything new is an error. Entries are removed
// as files get fixed; a stale entry is itself reported so the baseline only shrinks.
const baselinePath = path.join(root, 'scripts/baseline.json');
const baseline = fs.existsSync(baselinePath) ? JSON.parse(fs.readFileSync(baselinePath, 'utf8')).entries ?? {} : {};
const usedBaseline = new Set();

const problems = [];
const report = (level) => (rule, file, msg, fix, { code } = {}) => {
  if (!RULES[rule]) throw new Error(`check reported unknown rule "${rule}"; add it to scripts/rules.mjs`);
  if (level === 'error' && code && baseline[file]?.includes(code)) {
    usedBaseline.add(`${file}::${code}`);
    problems.push({ level: 'warn', rule, file, msg: `${msg} (baselined, fix when you edit this file)`, fix, code });
    return;
  }
  problems.push({ level, rule, file, msg, fix, code });
};
const ctx = {
  root,
  notes: loadNotes(),
  sources: loadSources(),
  read: (rel) => fs.readFileSync(path.join(root, rel), 'utf8'),
  exists: (rel) => fs.existsSync(path.join(root, rel)),
  list: (dir, ext) => walk(path.join(root, dir), ext).map((p) => path.relative(root, p)),
};
ctx.bySlug = new Map(ctx.notes.map((n) => [n.slug, n]));
ctx.sourceIds = new Set(ctx.sources.map((s) => s.id));

function walk(dir, ext) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = path.join(dir, d.name);
    return d.isDirectory() ? walk(p, ext) : d.name.endsWith(ext) ? [p] : [];
  });
}

const checksDir = path.join(root, 'scripts/checks');
for (const f of fs.readdirSync(checksDir).filter((f) => f.endsWith('.mjs')).sort()) {
  const mod = await import(path.join(checksDir, f));
  mod.default(ctx, { error: report('error'), warn: report('warn') });
}

for (const [file, codes] of Object.entries(baseline)) {
  for (const code of codes) {
    if (!usedBaseline.has(`${file}::${code}`)) {
      problems.push({ level: 'warn', rule: 'catalog-sync', file: 'scripts/baseline.json', msg: `stale entry ${file} → ${code}: that problem is fixed`, fix: 'delete the entry so the baseline only shrinks' });
    }
  }
}

const inScope = (p) => !scope || scope.has(p.file);
const errors = problems.filter((p) => p.level === 'error' && inScope(p));
const outOfScope = problems.filter((p) => p.level === 'error' && !inScope(p));
const warnings = problems.filter((p) => p.level === 'warn' && inScope(p));
const counts = Object.fromEntries(STATUSES.map((s) => [s, ctx.notes.filter((n) => n.data.status === s).length]));
const stubs = ctx.notes.filter((n) => n.data.status === 'stub').map((n) => n.slug);

if (flag('--json')) {
  console.log(JSON.stringify({ errors, warnings, outOfScope, counts, stubs }, null, 1));
  process.exit(errors.length ? 1 : 0);
}

const line = (p) => {
  const head = `${p.level === 'error' ? 'error' : 'warn '} [${p.rule}] ${p.file}: ${p.msg}`;
  return p.fix ? `${head}\n      fix: ${p.fix}` : head;
};
for (const w of warnings) console.warn(line(w));
for (const e of errors) console.error(line(e));
if (outOfScope.length) {
  console.warn(`\n${outOfScope.length} error(s) in files outside this change (not blocking):`);
  for (const e of outOfScope.slice(0, 10)) console.warn(`  [${e.rule}] ${e.file}: ${e.msg}`);
}

console.log(`\n${ctx.notes.length} notes (${STATUSES.map((s) => `${counts[s]} ${s}`).join(', ')}), ${ctx.sources.length} sources`);
if (stubs.length) console.log(`stubs waiting to be written: ${stubs.join(', ')}`);

if (errors.length) {
  const byRule = {};
  for (const e of errors) byRule[e.rule] = (byRule[e.rule] ?? 0) + 1;
  console.error(`\n${errors.length} error(s). Rules broken, re-read them before fixing:`);
  for (const [rule, n] of Object.entries(byRule)) console.error(`  ${rule} ×${n}: ${RULES[rule].title}  →  ${RULES[rule].doc}`);
  process.exit(1);
}
console.log('check passed');

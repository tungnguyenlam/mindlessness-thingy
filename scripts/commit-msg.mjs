#!/usr/bin/env node
// Commit message format: `type(scope): subject`, scope optional. Called by .githooks/commit-msg.
import fs from 'node:fs';

export const TYPES = {
  content: 'notes, sources, research fact sheets',
  feat: 'a new site feature or component',
  fix: 'a bug fix',
  docs: 'AGENTS.md, PRINCIPLES.md, skills, README',
  style: 'visual design and CSS only',
  refactor: 'code change with no behaviour change',
  test: 'tests',
  build: 'dependencies, tooling, CI',
  chore: 'anything else',
};
const RE = new RegExp(`^(${Object.keys(TYPES).join('|')})(\\([a-z0-9][a-z0-9-]*\\))?!?: \\S.*$`);

const file = process.argv[2];
const msg = fs.readFileSync(file, 'utf8');
const subject = msg.split('\n').find((l) => l.trim() && !l.startsWith('#')) ?? '';

if (/^(Merge|Revert|fixup!|squash!|amend!)/.test(subject)) process.exit(0);

const problems = [];
if (!RE.test(subject)) problems.push('subject must look like `type(scope): what changed`');
if (subject.length > 72) problems.push(`subject is ${subject.length} characters; keep it to 72`);
if (/\.$/.test(subject)) problems.push('no full stop at the end of the subject');

if (problems.length) {
  console.error(`error [commit-when-done] bad commit message: "${subject}"`);
  for (const p of problems) console.error(`  - ${p}`);
  console.error('\ntypes:');
  for (const [t, d] of Object.entries(TYPES)) console.error(`  ${t.padEnd(9)}${d}`);
  console.error('\nexamples:\n  content(mla): add absorption-trick stepper\n  feat(trail): restore map pan and zoom on return');
  process.exit(1);
}

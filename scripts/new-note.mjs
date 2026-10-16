#!/usr/bin/env node
// Usage:
//   pnpm run new <concept|system|path> <slug> "Title"           a stub (placeholder other notes can link to)
//   pnpm run new <concept|system|path> <slug> "Title" --draft   a full scaffold from templates/notes/<kind>.mdx
import fs from 'node:fs';
import path from 'node:path';
import { KINDS, KIND_DIRS, NOTES_DIR, SLUG_RE, loadNotes } from '../src/lib/content-index.mjs';

// pnpm passes a literal `--` through to the script; ignore it.
const raw = process.argv.slice(2).filter((a, i) => !(i === 0 && a === '--'));
const draft = raw.includes('--draft');
const args = raw.filter((a) => a !== '--draft');
const [kind, slug, ...titleParts] = args;
const title = titleParts.join(' ') || slug;

if (!KINDS.includes(kind) || !slug) {
  console.error('Usage: pnpm run new <concept|system|path> <slug> "Title" [--draft]');
  process.exit(1);
}
if (!SLUG_RE.test(slug)) {
  console.error(`"${slug}" is not a kebab-case slug`);
  process.exit(1);
}
const existing = loadNotes().find((n) => n.slug === slug);
if (existing) {
  console.error(`"${slug}" already exists: ${existing.file}. Extend it instead of creating a second note (rule one-idea).`);
  process.exit(1);
}

const today = new Date().toISOString().slice(0, 10);
const file = path.join(NOTES_DIR, KIND_DIRS[kind], `${slug}.mdx`);
const steps = kind === 'path' ? '\nsteps: []' : '';
const templateFile = path.resolve(NOTES_DIR, '../../../templates/notes', `${kind}.mdx`);

const body = draft
  ? fs.readFileSync(templateFile, 'utf8').replaceAll('{{title}}', JSON.stringify(title)).replaceAll('{{today}}', today).replaceAll('{{slug}}', slug)
  : `---
title: ${JSON.stringify(title)}
kind: ${kind}
summary: "TODO: one sentence that says what this is and why it matters."
domains: []
prerequisites: []
builds_on: []
contrasts_with: []
related: []
sources: []${steps}
status: stub
updated: ${today}
---

This note is a stub. It exists so other notes can link to it.
`;

fs.mkdirSync(path.dirname(file), { recursive: true });
fs.writeFileSync(file, body);
const rel = path.relative(process.cwd(), file);
console.log(`created ${rel}${draft ? ` from templates/notes/${kind}.mdx` : ''}`);
console.log(
  draft
    ? `next: fill each {/* TODO */} in order (picture before prose), then pnpm run check. It fails until every TODO is gone.`
    : `next: replace the TODO summary with one real sentence and add prerequisites/builds_on so it lands on the map (rule no-dangling).`,
);

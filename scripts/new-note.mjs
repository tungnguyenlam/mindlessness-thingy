#!/usr/bin/env node
// Usage: npm run new -- <concept|system|path> <slug> "Title"
import fs from 'node:fs';
import path from 'node:path';
import { KINDS, KIND_DIRS, NOTES_DIR, SLUG_RE, loadNotes } from '../src/lib/content-index.mjs';

const [kind, slug, ...titleParts] = process.argv.slice(2);
const title = titleParts.join(' ') || slug;

if (!KINDS.includes(kind) || !slug) {
  console.error('Usage: npm run new -- <concept|system|path> <slug> "Title"');
  process.exit(1);
}
if (!SLUG_RE.test(slug)) {
  console.error(`"${slug}" is not a kebab-case slug`);
  process.exit(1);
}
const existing = loadNotes().find((n) => n.slug === slug);
if (existing) {
  console.error(`"${slug}" already exists: ${existing.file}`);
  process.exit(1);
}

const today = new Date().toISOString().slice(0, 10);
const file = path.join(NOTES_DIR, KIND_DIRS[kind], `${slug}.mdx`);
const steps = kind === 'path' ? '\nsteps: []' : '';

fs.mkdirSync(path.dirname(file), { recursive: true });
fs.writeFileSync(
  file,
  `---
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
`,
);
console.log(`created ${path.relative(process.cwd(), file)}`);

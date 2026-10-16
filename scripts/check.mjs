#!/usr/bin/env node
// Graph-level checks that the Zod schema can't express. Run with `pnpm run check`
// (this script, then a full `astro build` for schema and component checks).
import {
  KINDS,
  KIND_DIRS,
  LINK_FIELDS,
  SLUG_RE,
  STATUSES,
  loadNotes,
  loadSources,
} from '../src/lib/content-index.mjs';

const errors = [];
const warnings = [];
const err = (file, msg) => errors.push(`${file}: ${msg}`);
const warn = (file, msg) => warnings.push(`${file}: ${msg}`);

const notes = loadNotes();
const sources = loadSources();
const bySlug = new Map();
const sourceIds = new Set(sources.map((s) => s.id));

for (const n of notes) {
  if (bySlug.has(n.slug)) err(n.file, `duplicate slug "${n.slug}" (also ${bySlug.get(n.slug).file})`);
  bySlug.set(n.slug, n);
}

for (const s of sources) {
  if (!SLUG_RE.test(s.id)) err(s.file, `source id "${s.id}" must be kebab-case`);
  for (const f of ['title', 'short', 'year', 'url', 'type']) {
    if (s.data[f] === undefined) err(s.file, `missing \`${f}\``);
  }
}

const inbound = new Map(notes.map((n) => [n.slug, 0]));
const citedSources = new Set();

for (const n of notes) {
  const d = n.data;
  if (!SLUG_RE.test(n.slug)) err(n.file, `filename must be a kebab-case slug`);
  if (!KINDS.includes(d.kind)) err(n.file, `kind must be one of ${KINDS.join(', ')}`);
  else if (n.dir !== KIND_DIRS[d.kind]) err(n.file, `a ${d.kind} note belongs in notes/${KIND_DIRS[d.kind]}/`);
  if (!STATUSES.includes(d.status)) err(n.file, `status must be one of ${STATUSES.join(', ')}`);
  if (!d.title) err(n.file, 'missing `title`');
  if (!d.summary) err(n.file, 'missing `summary`');

  for (const field of [...LINK_FIELDS, 'steps']) {
    for (const t of d[field] ?? []) {
      if (!bySlug.has(t)) err(n.file, `\`${field}\` points to missing note "${t}"`);
      else if (t === n.slug) err(n.file, `\`${field}\` points to itself`);
      else inbound.set(t, inbound.get(t) + 1);
    }
  }
  for (const t of n.wikilinks) {
    if (!bySlug.has(t)) err(n.file, `wikilink [[${t}]] has no note`);
    else if (t !== n.slug) inbound.set(t, inbound.get(t) + 1);
  }

  for (const s of d.sources ?? []) {
    if (!sourceIds.has(s)) err(n.file, `source "${s}" has no file in src/content/sources/`);
    citedSources.add(s);
  }
  for (const m of n.body.matchAll(/source:\s*['"]([^'"]+)['"]/g)) {
    if (!sourceIds.has(m[1])) err(n.file, `<Spec>/<Cite> source "${m[1]}" has no file in src/content/sources/`);
    citedSources.add(m[1]);
  }
  for (const m of n.body.matchAll(/<Cite\s+id=["']([^"']+)["']/g)) {
    if (!sourceIds.has(m[1])) err(n.file, `<Cite id="${m[1]}"> has no file in src/content/sources/`);
    citedSources.add(m[1]);
  }

  if (d.status !== 'stub' && d.kind !== 'path' && !(d.sources ?? []).length) {
    err(n.file, `${d.status} notes need at least one entry in \`sources\` (use status: stub for placeholders)`);
  }
  if (d.status !== 'stub' && n.body.trim().length < 200) {
    warn(n.file, `body is very short for a ${d.status} note; should it be a stub?`);
  }
}

// Cycles in the "must read first" graph make reading order undefined.
const state = new Map();
const stack = [];
function dfs(slug) {
  state.set(slug, 'visiting');
  stack.push(slug);
  const d = bySlug.get(slug)?.data ?? {};
  for (const t of [...(d.prerequisites ?? []), ...(d.builds_on ?? [])]) {
    if (!bySlug.has(t)) continue;
    if (state.get(t) === 'visiting') {
      err(bySlug.get(slug).file, `prerequisite cycle: ${[...stack.slice(stack.indexOf(t)), t].join(' -> ')}`);
    } else if (!state.has(t)) dfs(t);
  }
  stack.pop();
  state.set(slug, 'done');
}
for (const n of notes) if (!state.has(n.slug)) dfs(n.slug);

for (const n of notes) {
  const d = n.data;
  const outbound = LINK_FIELDS.some((f) => (d[f] ?? []).length) || n.wikilinks.length || (d.steps ?? []).length;
  if (!outbound && !inbound.get(n.slug)) warn(n.file, 'orphan: no links in or out');
}
for (const s of sources) if (!citedSources.has(s.id)) warn(s.file, 'source is not cited by any note');

const stubs = notes.filter((n) => n.data.status === 'stub');
const counts = Object.fromEntries(STATUSES.map((s) => [s, notes.filter((n) => n.data.status === s).length]));

for (const w of warnings) console.warn(`warn  ${w}`);
for (const e of errors) console.error(`error ${e}`);
console.log(
  `\n${notes.length} notes (${STATUSES.map((s) => `${counts[s]} ${s}`).join(', ')}), ${sources.length} sources`,
);
if (stubs.length) console.log(`stubs waiting to be written: ${stubs.map((n) => n.slug).join(', ')}`);
if (errors.length) {
  console.error(`\n${errors.length} error(s). Fix them before building.`);
  process.exit(1);
}
console.log('graph check passed');

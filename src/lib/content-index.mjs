// Plain-Node view of the content folder. Shared by the remark wikilink plugin,
// scripts/check.mjs and scripts/new-note.mjs, so it must not import anything
// from Astro.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export const NOTES_DIR = path.join(root, 'src/content/notes');
export const SOURCES_DIR = path.join(root, 'src/content/sources');

export const KINDS = ['concept', 'system', 'path'];
export const KIND_DIRS = { concept: 'concepts', system: 'systems', path: 'paths' };
export const STATUSES = ['stub', 'draft', 'reviewed', 'verified'];
export const LINK_FIELDS = ['prerequisites', 'builds_on', 'contrasts_with', 'related'];
export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// [[slug]] or [[slug|label]]
export const WIKILINK_RE = /\[\[([^\]|]+?)(?:\|([^\]]+))?\]\]/g;

function walk(dir, ext) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = path.join(dir, d.name);
    if (d.isDirectory()) return walk(p, ext);
    return d.name.endsWith(ext) ? [p] : [];
  });
}

export function splitFrontmatter(raw) {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { data: null, body: raw };
  return { data: YAML.parse(m[1]) ?? {}, body: m[2] };
}

/** Replace MDX comments with blank lines (keeping line numbers), since they never render. */
export function blankComments(body) {
  return body.replace(/\{\/\*[\s\S]*?\*\/\}/g, (c) => '\n'.repeat(c.split('\n').length - 1));
}

/** Strip comments, fenced code, inline code and JSX expression strings that may contain brackets. */
function proseOnly(body) {
  return blankComments(body)
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`\n]*`/g, '');
}

export function extractWikilinks(body) {
  const out = [];
  for (const m of proseOnly(body).matchAll(WIKILINK_RE)) out.push(m[1].trim());
  return out;
}

export function loadNotes() {
  return walk(NOTES_DIR, '.mdx').map((file) => {
    const raw = fs.readFileSync(file, 'utf8');
    const { data, body } = splitFrontmatter(raw);
    return {
      slug: path.basename(file, '.mdx'),
      file: path.relative(root, file),
      dir: path.basename(path.dirname(file)),
      data: data ?? {},
      body,
      /** `body` with MDX comments blanked out: what actually renders. Use this to look for content. */
      text: blankComments(body),
      /** 1-based line in the file where `body` starts, for error messages. */
      bodyLine: raw.slice(0, raw.length - body.length).split('\n').length,
      wikilinks: extractWikilinks(body),
    };
  });
}

export function loadSources() {
  return walk(SOURCES_DIR, '.yaml').map((file) => ({
    id: path.basename(file, '.yaml'),
    file: path.relative(root, file),
    data: YAML.parse(fs.readFileSync(file, 'utf8')) ?? {},
  }));
}

let cache = { at: 0, notes: new Map() };

/** slug -> { title, status, kind }. Re-scanned at most once a second so dev picks up new notes. */
export function noteLookup() {
  const now = Date.now();
  if (now - cache.at > 1000) {
    cache = {
      at: now,
      notes: new Map(
        loadNotes().map((n) => [
          n.slug,
          { title: n.data.title ?? n.slug, status: n.data.status ?? 'draft', kind: n.data.kind },
        ]),
      ),
    };
  }
  return cache.notes;
}

// Links between notes. Rules: no-dangling, reading-order, wikilinks.
import { LINK_FIELDS } from '../../src/lib/content-index.mjs';

// Markdown links or <a href> pointing at our own pages instead of [[slug]].
const RAW_INTERNAL = /\]\((?:\/|\.\.?\/|https?:\/\/tungnguyenlam\.github\.io)[^)]*\)|<a\s[^>]*href=["']\/(?!\/)/g;

export default function links({ notes, bySlug }, { error, warn }) {
  const inbound = new Map(notes.map((n) => [n.slug, 0]));

  for (const n of notes) {
    const d = n.data;
    for (const field of [...LINK_FIELDS, 'steps']) {
      for (const t of d[field] ?? []) {
        if (!bySlug.has(t)) error('no-dangling', n.file, `\`${field}\` points to missing note "${t}"`, `create it: pnpm run new concept ${t} "Title" (then give it a real summary)`);
        else if (t === n.slug) error('no-dangling', n.file, `\`${field}\` points to itself`);
        else inbound.set(t, inbound.get(t) + 1);
      }
    }
    for (const t of n.wikilinks) {
      if (!bySlug.has(t)) error('no-dangling', n.file, `wikilink [[${t}]] has no note`, `create it: pnpm run new concept ${t} "Title"`);
      else if (t !== n.slug) inbound.set(t, inbound.get(t) + 1);
    }
    for (const m of n.text.replace(/```[\s\S]*?```/g, '').matchAll(RAW_INTERNAL)) {
      error('wikilinks', n.file, `raw internal link ${m[0].slice(0, 60)}`, 'use [[slug]] or [[slug|text]]: it is checked, gets a hover preview and survives base-path changes');
    }
  }

  // Cycles in the "must read first" graph make reading order undefined.
  const state = new Map();
  const stack = [];
  const dfs = (slug) => {
    state.set(slug, 'visiting');
    stack.push(slug);
    const d = bySlug.get(slug)?.data ?? {};
    for (const t of [...(d.prerequisites ?? []), ...(d.builds_on ?? [])]) {
      if (!bySlug.has(t)) continue;
      if (state.get(t) === 'visiting') {
        error('reading-order', bySlug.get(slug).file, `prerequisite cycle: ${[...stack.slice(stack.indexOf(t)), t].join(' -> ')}`, 'one of these is not a true dependency; move it to `related`');
      } else if (!state.has(t)) dfs(t);
    }
    stack.pop();
    state.set(slug, 'done');
  };
  for (const n of notes) if (!state.has(n.slug)) dfs(n.slug);

  for (const n of notes) {
    const d = n.data;
    const outbound = LINK_FIELDS.some((f) => (d[f] ?? []).length) || n.wikilinks.length || (d.steps ?? []).length;
    if (!outbound && !inbound.get(n.slug)) warn('no-dangling', n.file, 'orphan: no links in or out', 'add prerequisites/builds_on so it lands on the map');
  }
}

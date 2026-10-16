// Sources and citations. Rule: sourced-numbers.
import { SLUG_RE } from '../../src/lib/content-index.mjs';

export default function sources({ notes, sources, sourceIds }, { error, warn }) {
  for (const s of sources) {
    if (!SLUG_RE.test(s.id)) error('sourced-numbers', s.file, `source id "${s.id}" must be kebab-case`);
    for (const f of ['title', 'short', 'year', 'url', 'type']) {
      if (s.data[f] === undefined) error('sourced-numbers', s.file, `missing \`${f}\``, 'see an existing file in src/content/sources/ for the shape');
    }
  }

  const cited = new Set();
  const missing = (id) => `create src/content/sources/${id}.yaml (title, short, authors, year, url, type) or fix the id; ls src/content/sources`;
  for (const n of notes) {
    const d = n.data;
    for (const s of d.sources ?? []) {
      if (!sourceIds.has(s)) error('sourced-numbers', n.file, `source "${s}" has no file in src/content/sources/`, missing(s));
      cited.add(s);
    }
    for (const m of n.text.matchAll(/source:\s*['"]([^'"]+)['"]/g)) {
      if (!sourceIds.has(m[1])) error('sourced-numbers', n.file, `<Spec> source "${m[1]}" has no file in src/content/sources/`, missing(m[1]));
      cited.add(m[1]);
    }
    for (const m of n.text.matchAll(/<Cite\s+id=["']([^"']+)["']/g)) {
      if (!sourceIds.has(m[1])) error('sourced-numbers', n.file, `<Cite id="${m[1]}"> has no file in src/content/sources/`, missing(m[1]));
      cited.add(m[1]);
    }
    if (d.status !== 'stub' && d.kind !== 'path' && !(d.sources ?? []).length) {
      error('sourced-numbers', n.file, `${d.status} notes need at least one entry in \`sources\``, 'add the paper/report/config you used, or set status: stub if this is a placeholder');
    }
  }
  for (const s of sources) if (!cited.has(s.id)) warn('sourced-numbers', s.file, 'source is not cited by any note');
}

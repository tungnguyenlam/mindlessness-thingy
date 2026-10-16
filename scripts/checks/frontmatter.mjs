// Frontmatter, slugs and folders. Rule: frontmatter (and no-dangling for placeholder summaries).
import { KINDS, KIND_DIRS, SLUG_RE, STATUSES } from '../../src/lib/content-index.mjs';

export default function frontmatter({ notes }, { error }) {
  const seen = new Map();
  for (const n of notes) {
    const d = n.data;
    if (seen.has(n.slug)) error('frontmatter', n.file, `duplicate slug "${n.slug}" (also ${seen.get(n.slug)})`, 'slugs are filenames and must be unique; extend the existing note instead');
    seen.set(n.slug, n.file);
    if (!SLUG_RE.test(n.slug)) error('frontmatter', n.file, 'filename must be a kebab-case slug', 'rename to lowercase-words-with-dashes before anything links to it');
    if (!KINDS.includes(d.kind)) error('frontmatter', n.file, `kind must be one of ${KINDS.join(', ')}`);
    else if (n.dir !== KIND_DIRS[d.kind]) error('frontmatter', n.file, `a ${d.kind} note belongs in notes/${KIND_DIRS[d.kind]}/`, `git mv it to src/content/notes/${KIND_DIRS[d.kind]}/ (links use the slug, so nothing breaks)`);
    if (!STATUSES.includes(d.status)) error('frontmatter', n.file, `status must be one of ${STATUSES.join(', ')}`);
    if (!d.title) error('frontmatter', n.file, 'missing `title`');
    if (!d.summary) error('frontmatter', n.file, 'missing `summary`');
    else if (/^\s*TODO/i.test(d.summary)) {
      error('no-dangling', n.file, 'summary is still the placeholder', 'write one real sentence (under 220 characters): what this is and why it matters. Stubs need it too, it is shown in hover previews');
    }
  }
}

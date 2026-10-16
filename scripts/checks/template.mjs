// Notes scaffolded from templates/notes/ carry `{/* TODO ... */}` markers. A written note must
// have none left. Rule: template-complete.
const MARKER = /\{\/\*\s*(TODO|TEMPLATE)\b/g;

export default function template({ notes }, { error, warn }) {
  for (const n of notes) {
    const d = n.data;
    if (d.status === 'stub') continue;
    const lines = [...n.body.matchAll(MARKER)].map((m) => n.body.slice(0, m.index).split('\n').length + n.bodyLine - 1);
    if (lines.length) {
      error('template-complete', n.file, `${lines.length} template marker(s) left (line ${lines.join(', ')})`, 'write each section, then delete its {/* TODO */} comment; or set status: stub');
    }
    if (n.body.trim().length < 200) warn('template-complete', n.file, `body is very short for a ${d.status} note`, 'should it be a stub?');
  }
}

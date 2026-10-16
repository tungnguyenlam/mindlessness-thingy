// Model data (src/content/models/*.yaml) and the components that read it. Rules: sourced-numbers
// (every value has a source that exists), no-dangling (notes, parents and type slugs exist) and
// one-idea (a system note with model data shows it with <ModelSpec>, not a hand-typed <Spec>).
import { loadModels } from '../../src/lib/content-index.mjs';
import { FIELD, FIELDS } from '../../src/lib/models/fields.mjs';
import { DERIVED, parsePattern, resolveModels } from '../../src/lib/models/data.mjs';
import { findComponents } from '../lib/mdx-props.mjs';

// Values of slug fields that name a plain architecture rather than a note.
const PLAIN = new Set(['dense']);
const META = new Set(['title', 'note', 'family', 'extends']);

export default function models(ctx, { error, warn }) {
  const list = loadModels();
  const ids = new Set(list.map((m) => m.id));
  const bySlug = ctx.bySlug;
  for (const m of list) {
    const d = m.data;
    for (const [k, v] of Object.entries(d)) {
      if (META.has(k)) continue;
      const f = FIELD[k];
      if (!f) {
        error('sourced-numbers', m.file, `unknown field "${k}"`, `use a key from src/lib/models/fields.mjs (${FIELDS.map((x) => x.key).join(', ')}), or add the field there once with its label and concept`, { code: 'unknown-field' });
        continue;
      }
      if (!v || typeof v !== 'object' || v.v == null || !v.source || !v.where) {
        error('sourced-numbers', m.file, `${k} must be { v, source, where }`, 'every value names its source id and where in it (section, table or config key)', { code: 'unsourced' });
        continue;
      }
      if (!ctx.sourceIds.has(v.source)) error('sourced-numbers', m.file, `${k} cites unknown source "${v.source}"`, 'add src/content/sources/<id>.yaml or fix the id', { code: 'unknown-source' });
      if (f.kind === 'slug' && !PLAIN.has(v.v) && !bySlug.has(v.v)) error('no-dangling', m.file, `${k} "${v.v}" is not a note`, `use a note slug, or create a stub: pnpm run new concept ${v.v} "Title"`, { code: 'unknown-type' });
      if (f.kind === 'pattern') {
        try {
          const layers = parsePattern(v.v);
          if (typeof d.layers?.v === 'number' && layers.length !== d.layers.v) error('sourced-numbers', m.file, `layer_pattern has ${layers.length} layers but layers is ${d.layers.v}`, 'fix the pattern against the config (layer_types / hybrid_override_pattern)', { code: 'pattern-length' });
        } catch (e) {
          error('sourced-numbers', m.file, `layer_pattern: ${e.message}`, 'tokens are sublayer codes like AD or CD, optionally *n; see src/lib/models/fields.mjs SUBLAYERS', { code: 'bad-pattern' });
        }
      }
    }
    if (!d.title || !d.family) error('frontmatter', m.file, 'model needs title and family');
    if (d.extends && !ids.has(d.extends)) error('no-dangling', m.file, `extends unknown model "${d.extends}"`, 'fix the id; parents live in src/content/models/', { code: 'unknown-parent' });
    const note = d.note ?? m.id;
    if (!bySlug.has(note)) error('no-dangling', m.file, `no system note "${note}" for this model`, `create it: pnpm run new system ${note} "${d.title ?? note}"`, { code: 'no-note' });
  }
  let resolved;
  try {
    resolved = resolveModels(new Map(list.map((m) => [m.id, m.data])));
  } catch (e) {
    error('reading-order', 'src/content/models', e.message, 'break the extends cycle');
    return;
  }

  // Components that reference models.
  const modelNotes = new Map([...resolved.values()].map((m) => [m.note, m.id]));
  for (const n of ctx.notes) {
    for (const use of findComponents(n.text, ['ModelSpec', 'Compare', 'LayerStrip', 'ModelDiagram'])) {
      const line = use.line + n.bodyLine - 1;
      if (use.error) {
        error('sourced-numbers', n.file, `line ${line}: <${use.name}> ${use.error}`, 'write props as literals');
        continue;
      }
      const refs = use.name === 'Compare' ? (use.props.models ?? []) : [use.props.model];
      if (use.name === 'Compare' && refs.length < 2) error('sourced-numbers', n.file, `line ${line}: <Compare> needs at least two models`, 'models={["a", "b"]}');
      for (const id of refs) if (!resolved.has(id)) error('no-dangling', n.file, `line ${line}: <${use.name}> names unknown model "${id}"`, `add src/content/models/${id}.yaml (see docs/workflow.md)`);
      for (const k of use.props.fields ?? []) if (!FIELD[k] && !DERIVED.some((x) => x.key === k)) error('sourced-numbers', n.file, `line ${line}: <${use.name}> field "${k}" is not in the vocabulary`, 'see FIELDS in src/lib/models/fields.mjs and DERIVED in src/lib/models/data.mjs');
    }
    if (n.data.kind !== 'system' || n.data.status === 'stub') continue;
    const model = modelNotes.get(n.slug);
    if (!model) {
      warn('one-idea', n.file, 'system note has no model data', `add src/content/models/${n.slug}.yaml so it shows up in <Compare> and /compare/`);
      continue;
    }
    if (!/<ModelSpec\b/.test(n.text)) error('one-idea', n.file, `model data exists (${model}) but the note doesn't show it`, `use <ModelSpec model="${model}" /> instead of retyping the numbers`, { code: 'no-modelspec' });
    const labels = new Set(FIELDS.map((f) => f.label.toLowerCase()));
    for (const use of findComponents(n.text, ['Spec'])) {
      for (const r of use.props.rows ?? []) {
        if (labels.has(String(r.label).toLowerCase())) warn('one-idea', n.file, `line ${use.line + n.bodyLine - 1}: <Spec> row "${r.label}" duplicates a model field`, 'drop the row; <ModelSpec> already shows it from the data');
      }
    }
  }
}

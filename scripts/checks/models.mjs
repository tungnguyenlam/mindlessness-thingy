// Model and tokenizer data (src/content/models/, src/content/tokenizers/) and the components that
// read them. Rules: sourced-numbers (every value has a source that exists), no-dangling (notes,
// parents, tokenizers and type slugs exist), one-idea (a system note with model data shows it with
// <ModelSpec>, not a hand-typed <Spec>), model-card (it also shows <ModelOverview> and <Tokenizer>)
// and diagram-geometry (every generated architecture diagram of every model lays out cleanly).
import fs from 'node:fs';
import path from 'node:path';
import { loadModels, loadTokenizers, root } from '../../src/lib/content-index.mjs';
import { FIELD, FIELDS, KINDS } from '../../src/lib/models/fields.mjs';
import { DERIVED, parsePattern, resolveModels } from '../../src/lib/models/data.mjs';
import { overviewParts } from '../../src/lib/models/overview.mjs';
import { paramBreakdown, fmtParams } from '../../src/lib/models/params.mjs';
import { lintDiagram } from '../../src/lib/diagram/geometry.mjs';
import { TOKENIZER_FIELD } from '../../src/lib/tokenizers/fields.mjs';
import { findComponents } from '../lib/mdx-props.mjs';

const SAMPLES_FILE = 'src/data/tokenizer-samples.json';
const TOKENIZER_META = new Set(['title', 'note', 'family', 'file', 'pretokenizer', 'specials']);

// Values of slug fields that name a plain architecture rather than a note.
const PLAIN = new Set(['dense']);
const META = new Set(['title', 'note', 'family', 'extends', 'kind', 'stages']);

const sourcedOk = (v) => v && typeof v === 'object' && v.v != null && v.source && v.where;

function tokenizers(ctx, { error }) {
  const list = loadTokenizers();
  let generated = {};
  try {
    generated = JSON.parse(fs.readFileSync(path.join(root, SAMPLES_FILE), 'utf8')).tokenizers ?? {};
  } catch {
    if (list.length) error('sourced-numbers', SAMPLES_FILE, 'missing or unreadable', 'run python3 scripts/tokenizer-samples.py', { code: 'no-samples' });
  }
  const cite = (t, k, v) => {
    if (!sourcedOk(v)) return error('sourced-numbers', t.file, `${k} must be { v, source, where }`, 'name the source id and where in it (JSON path, section)', { code: 'unsourced' });
    if (!ctx.sourceIds.has(v.source)) error('sourced-numbers', t.file, `${k} cites unknown source "${v.source}"`, 'add src/content/sources/<id>.yaml or fix the id', { code: 'unknown-source' });
  };
  for (const t of list) {
    const d = t.data;
    for (const [k, v] of Object.entries(d)) {
      if (TOKENIZER_META.has(k)) continue;
      if (!TOKENIZER_FIELD[k]) error('sourced-numbers', t.file, `unknown field "${k}"`, 'use a key from src/lib/tokenizers/fields.mjs or add it there once', { code: 'unknown-field' });
      else cite(t, k, v);
    }
    (d.pretokenizer ?? []).forEach((r, i) => cite(t, `pretokenizer[${i}]`, r));
    if (d.specials && !ctx.sourceIds.has(d.specials.source)) error('sourced-numbers', t.file, `specials cite unknown source "${d.specials.source}"`, 'fix the id', { code: 'unknown-source' });
    if (!d.title || !d.family || !d.file) error('frontmatter', t.file, 'tokenizer needs title, family and file (the source id of its tokenizer.json)');
    if (d.file && !ctx.sourceIds.has(d.file)) error('sourced-numbers', t.file, `file "${d.file}" is not a source`, 'add the tokenizer files as a source (type: config)', { code: 'unknown-source' });
    if (d.note && !ctx.bySlug.has(d.note)) error('no-dangling', t.file, `no note "${d.note}" for this tokenizer`, `create it: pnpm run new system ${d.note} "${d.title}"`, { code: 'no-note' });
    if (!generated[t.id]) error('sourced-numbers', t.file, `no generated samples for "${t.id}"`, `add it to TOKENIZERS in scripts/tokenizer-samples.py and run python3 scripts/tokenizer-samples.py`, { code: 'no-samples' });
  }
  return { ids: new Set(list.map((t) => t.id)), byId: new Map(list.map((t) => [t.id, t.data])), notes: new Set(list.map((t) => t.data.note).filter(Boolean)), generated };
}

// A pipeline's stages: sourced, linked to notes that exist, wired to stages that exist, one backbone.
function stagesCheck(ctx, m, error) {
  const stages = m.data.stages ?? [];
  const fix = 'see "Papers that aren\'t language models" in docs/workflow.md';
  if (!stages.length) return error('frontmatter', m.file, 'kind: pipeline needs a stages: list', fix);
  const ids = new Set();
  for (const st of stages) {
    if (!st.id || !st.label || !st.role) error('frontmatter', m.file, `stage ${st.id ?? '?'} needs id, label and role`, fix);
    if (ids.has(st.id)) error('frontmatter', m.file, `stage id "${st.id}" is used twice`, 'give each stage its own id');
    ids.add(st.id);
    if (!st.source || !st.where) error('sourced-numbers', m.file, `stage "${st.id}" needs source and where`, 'name where the paper describes this stage', { code: 'unsourced' });
    else if (!ctx.sourceIds.has(st.source)) error('sourced-numbers', m.file, `stage "${st.id}" cites unknown source "${st.source}"`, 'add src/content/sources/<id>.yaml or fix the id', { code: 'unknown-source' });
    if (st.link && !ctx.bySlug.has(st.link)) error('no-dangling', m.file, `stage "${st.id}" links to unknown note "${st.link}"`, `create a stub: pnpm run new concept ${st.link} "Title"`);
  }
  for (const st of stages)
    for (const f of st.from ?? []) {
      const id = typeof f === 'string' ? f : f?.id;
      if (!ids.has(id)) error('no-dangling', m.file, `stage "${st.id}" reads unknown stage "${id}"`, 'from: lists ids of earlier stages');
    }
  const backbones = stages.filter((st) => st.backbone).length;
  if (backbones !== 1) error('frontmatter', m.file, `a pipeline needs exactly one backbone stage (has ${backbones})`, 'mark the stage drawn from the model fields with backbone: true');
}

export default function models(ctx, { error, warn }) {
  const toks = tokenizers(ctx, { error });
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
      if (f.kind === 'tokenizer' && !toks.ids.has(v.v)) error('no-dangling', m.file, `tokenizer "${v.v}" has no data`, `add src/content/tokenizers/${v.v}.yaml (docs/workflow.md#tokenizers)`, { code: 'unknown-tokenizer' });
      if (f.kind === 'bool' && typeof v.v !== 'boolean') error('sourced-numbers', m.file, `${k} must be true or false`, 'write v: true or v: false', { code: 'bad-bool' });
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
    if (d.kind && !KINDS.includes(d.kind)) error('frontmatter', m.file, `kind "${d.kind}" is not one of ${KINDS.join(', ')}`, 'lm for text-to-next-token models, pipeline for a chain of stages');
    if (d.kind === 'pipeline') stagesCheck(ctx, m, error);
    else if (d.stages) error('frontmatter', m.file, 'stages are only drawn for kind: pipeline', 'add kind: pipeline, or drop the stages');
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

  // Every generated diagram of every model, linted here so a data change that breaks a layout is
  // caught per turn, not at build.
  for (const m of resolved.values()) {
    const file = list.find((x) => x.id === m.id)?.file ?? 'src/content/models';
    const t = toks.byId.get(m.values.tokenizer?.v);
    let parts = [];
    try {
      parts = overviewParts(m, { has: (s) => bySlug.has(s), tokenizer: t ? { title: t.title, note: t.note, algorithm: t.algorithm?.v } : null });
    } catch (e) {
      error('diagram-geometry', file, `generated diagrams: ${e.message}`, 'fix the data (layer_pattern, attention type)', { code: 'generated-diagram' });
    }
    for (const p of parts) {
      for (const pr of lintDiagram(p.props)) {
        if (pr.level === 'error') error('diagram-geometry', file, `generated "${p.tab}" view: ${pr.msg}`, `the generator is src/lib/models/overview.mjs; ${pr.fix}`, { code: 'generated-diagram' });
      }
    }
    // The matrices the views draw should add up to the reported size. When they don't, a size in the
    // data is usually the config's nominal value rather than what the model builds (LFM2's
    // auto-adjusted FFN width), or a total was inherited from a parent of a different size.
    const pb = paramBreakdown(m);
    const pt = m.values.params_total;
    if (pb.complete && pt && !pt.inherited && Math.abs(pb.total - pt.v) / pt.v > 0.03)
      warn('sourced-numbers', file, `the matrices in the data sum to ${fmtParams(pb.total)}, but params_total is ${fmtParams(pt.v)}`, 'check each size against what the modeling code builds (not only config.json), or the total against its source; the Parameters tab of <ModelOverview> shows the breakdown', { code: 'params-mismatch' });
    const parent = m.extends && resolved.get(m.extends);
    if (pt?.inherited && parent) {
      const pp = paramBreakdown(parent);
      if (pp.total && Math.abs(pb.total - pp.total) / pp.total > 0.03)
        warn('sourced-numbers', file, `params_total (${fmtParams(pt.v)}) is inherited from ${m.extends}, but this model's matrices sum to ${fmtParams(pb.total)}${pb.complete ? '' : ' or more'} against ${fmtParams(pp.total)} for ${m.extends}`, `set params_total from this model's own source, or write it as not reported`, { code: 'params-inherited' });
    }
  }

  // Components that reference models and tokenizers.
  const modelNotes = new Map([...resolved.values()].map((m) => [m.note, m.id]));
  const sampleIds = new Set(Object.values(toks.generated)[0] ? Object.keys(Object.values(toks.generated)[0].samples) : []);
  for (const n of ctx.notes) {
    for (const use of findComponents(n.text, ['Tokenizer', 'TokenizerFlow', 'TokenizerCompare'])) {
      const line = use.line + n.bodyLine - 1;
      if (use.error) {
        error('sourced-numbers', n.file, `line ${line}: <${use.name}> ${use.error}`, 'write props as literals');
        continue;
      }
      const p = use.props;
      const refs = use.name === 'TokenizerCompare' ? (p.tokenizers ?? []) : use.name === 'TokenizerFlow' ? [p.tokenizer] : p.id ? [p.id] : [];
      if (use.name === 'Tokenizer' && !p.id && !p.model) error('sourced-numbers', n.file, `line ${line}: <Tokenizer> needs model="..." or id="..."`, 'model= in a model note, id= in a tokenizer note');
      if (use.name === 'Tokenizer' && p.model && !resolved.get(p.model)?.values.tokenizer) error('no-dangling', n.file, `line ${line}: <Tokenizer model="${p.model}">: the model has no tokenizer field`, 'add tokenizer: { v, source, where } to its data');
      if (use.name === 'TokenizerCompare' && refs.length < 2) error('sourced-numbers', n.file, `line ${line}: <TokenizerCompare> needs at least two tokenizers`, 'tokenizers={["a", "b"]}');
      for (const id of refs) if (!toks.ids.has(id)) error('no-dangling', n.file, `line ${line}: <${use.name}> names unknown tokenizer "${id}"`, `add src/content/tokenizers/${id}.yaml`);
      for (const s of [...(p.samples ?? []), ...(p.sample ? [p.sample] : [])]) if (!sampleIds.has(s)) error('no-dangling', n.file, `line ${line}: <${use.name}> sample "${s}" was not generated`, `use one of ${[...sampleIds].join(', ')}, or add it to SAMPLES in scripts/tokenizer-samples.py`);
    }
    for (const use of findComponents(n.text, ['ModelSpec', 'Compare', 'LayerStrip', 'ModelDiagram', 'ModelOverview'])) {
      const line = use.line + n.bodyLine - 1;
      if (use.error) {
        error('sourced-numbers', n.file, `line ${line}: <${use.name}> ${use.error}`, 'write props as literals');
        continue;
      }
      const refs = use.name === 'Compare' ? (use.props.models ?? []) : use.name === 'LayerStrip' && use.props.models ? use.props.models : [use.props.model];
      if (use.name === 'Compare' && refs.length < 2) error('sourced-numbers', n.file, `line ${line}: <Compare> needs at least two models`, 'models={["a", "b"]}');
      for (const id of refs) if (!resolved.has(id)) error('no-dangling', n.file, `line ${line}: <${use.name}> names unknown model "${id}"`, `add src/content/models/${id}.yaml (see docs/workflow.md)`);
      for (const k of use.props.fields ?? []) if (!FIELD[k] && !DERIVED.some((x) => x.key === k)) error('sourced-numbers', n.file, `line ${line}: <${use.name}> field "${k}" is not in the vocabulary`, 'see FIELDS in src/lib/models/fields.mjs and DERIVED in src/lib/models/data.mjs');
    }
    if (n.data.kind !== 'system' || n.data.status === 'stub') continue;
    const model = modelNotes.get(n.slug);
    if (toks.notes.has(n.slug)) continue; // a tokenizer's note: its data is the tokenizer file
    if (!model) {
      warn('one-idea', n.file, 'system note has no model data', `add src/content/models/${n.slug}.yaml so it shows up in <Compare> and /compare/`);
      continue;
    }
    if (!/<ModelSpec\b/.test(n.text)) error('one-idea', n.file, `model data exists (${model}) but the note doesn't show it`, `use <ModelSpec model="${model}" /> instead of retyping the numbers`, { code: 'no-modelspec' });
    if (!/<ModelOverview\b/.test(n.text)) error('model-card', n.file, `model data exists (${model}) but the note has no whole-model view`, `add <ModelOverview model="${model}" /> near the top: input to output, every part down to its projections`, { code: 'no-overview' });
    // A pipeline has no tokenizer: its input is drawn as stages.
    const lm = resolved.get(model)?.kind !== 'pipeline';
    if (lm && resolved.get(model)?.values.tokenizer && !/<Tokenizer\b/.test(n.text)) error('model-card', n.file, `${model} names a tokenizer but the note doesn't show it`, `add a "## Tokenizer" section with <Tokenizer model="${model}" />`, { code: 'no-tokenizer' });
    else if (lm && !resolved.get(model)?.values.tokenizer) warn('model-card', n.file, `${model} has no tokenizer in its data`, 'add tokenizer: { v, source, where } and src/content/tokenizers/<id>.yaml (docs/workflow.md#tokenizers)', { code: 'no-tokenizer-data' });
    const labels = new Set(FIELDS.map((f) => f.label.toLowerCase()));
    for (const use of findComponents(n.text, ['Spec'])) {
      for (const r of use.props.rows ?? []) {
        if (labels.has(String(r.label).toLowerCase())) warn('one-idea', n.file, `line ${use.line + n.bodyLine - 1}: <Spec> row "${r.label}" duplicates a model field`, 'drop the row; <ModelSpec> already shows it from the data');
      }
    }
  }
}

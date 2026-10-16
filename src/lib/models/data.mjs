// Model data: inheritance, layer patterns and derived numbers. Pure functions over the raw YAML
// objects, shared by the components (via getCollection) and scripts/checks/models.mjs (via
// loadModels below), so the page and the check agree on every value.
import { FIELD, FIELDS, SUBLAYERS } from './fields.mjs';

/**
 * Resolve `extends`: a model inherits every field it doesn't set. Each resolved value records
 * where it came from (`from`), so tables can show "inherited from X" and keep the parent's source.
 * @param {Map<string, object>} raw  id → YAML data
 */
export function resolveModels(raw) {
  const out = new Map();
  const visit = (id, seen = []) => {
    if (out.has(id)) return out.get(id);
    const m = raw.get(id);
    if (!m) return null;
    if (seen.includes(id)) throw new Error(`model extends cycle: ${[...seen, id].join(' → ')}`);
    const parent = m.extends ? visit(m.extends, [...seen, id]) : null;
    const values = {};
    if (parent) for (const [k, v] of Object.entries(parent.values)) values[k] = { ...v, inherited: true };
    for (const f of FIELDS) if (m[f.key] != null) values[f.key] = { ...m[f.key], from: id, inherited: false };
    const r = { id, title: m.title, note: m.note ?? id, family: m.family, extends: m.extends ?? null, values };
    r.derived = derive(r);
    out.set(id, r);
    return r;
  };
  for (const id of raw.keys()) visit(id);
  return out;
}

/** Fields whose value differs from the parent's (the "what's new" view). */
export function diffFromParent(model, models) {
  if (!model.extends) return null;
  const parent = models.get(model.extends);
  return FIELDS.filter((f) => {
    const a = model.values[f.key];
    const b = parent?.values[f.key];
    return a && !a.inherited && (!b || String(a.v) !== String(b.v));
  }).map((f) => f.key);
}

/**
 * "CD*2 AD CD" → [['C','D'], ['C','D'], ['A','D'], ['C','D']]. Tokens are separated by spaces,
 * each token is one layer's sublayer codes (see SUBLAYERS), `*n` repeats it.
 */
export function parsePattern(src) {
  const layers = [];
  for (const tok of String(src).trim().split(/\s+/)) {
    const m = tok.match(/^([A-Z]+)(?:\*(\d+))?$/);
    if (!m) throw new Error(`bad layer pattern token "${tok}"`);
    for (const c of m[1]) if (!SUBLAYERS[c]) throw new Error(`unknown sublayer code "${c}" in "${tok}" (use ${Object.keys(SUBLAYERS).join(', ')})`);
    for (let i = 0; i < Number(m[2] ?? 1); i++) layers.push([...m[1]]);
  }
  return layers;
}

export const DERIVED = [
  { key: 'head_dim', label: 'Head dimension', group: 'mixer', kind: 'count' },
  { key: 'attention_layers', label: 'Attention layers', group: 'mixer', kind: 'count' },
  { key: 'kv_bytes_per_token', label: 'KV cache per token (16-bit)', group: 'mixer', kind: 'bytes', concept: 'kv-cache' },
  { key: 'kv_bytes_at_context', label: 'KV cache at full context (16-bit)', group: 'mixer', kind: 'bytes', concept: 'kv-cache' },
  { key: 'active_ratio', label: 'Active share of parameters', group: 'size', kind: 'ratio', concept: 'moe' },
];

const num = (m, k) => (typeof m.values[k]?.v === 'number' ? m.values[k].v : null);

/** Numbers computed from sourced values. Each lists its inputs (whose sources it inherits) and formula. */
export function derive(m) {
  const d = {};
  const put = (key, v, formula, inputs) => {
    if (v != null && Number.isFinite(v) && m.values[key] == null) d[key] = { v, formula, inputs, derived: true };
  };
  const hidden = num(m, 'hidden_size');
  const heads = num(m, 'heads');
  // Only standard attention splits the hidden size evenly across heads (MLA heads are wider).
  if (hidden && heads && ['mha', 'gqa', 'mqa'].includes(m.values.attention?.v)) put('head_dim', hidden / heads, 'hidden_size / heads', ['hidden_size', 'heads']);
  const pattern = m.values.layer_pattern ? parsePattern(m.values.layer_pattern.v) : null;
  if (pattern) put('attention_layers', pattern.filter((l) => l.includes('A')).length, 'layers with A in layer_pattern', ['layer_pattern']);
  else if (m.values.attention && num(m, 'layers')) put('attention_layers', num(m, 'layers'), 'every layer has attention', ['layers', 'attention']);

  const get = (k) => num(m, k) ?? d[k]?.v ?? null;
  const attn = m.values.attention?.v;
  const L = get('attention_layers');
  let elems = null;
  let formula = null;
  let inputs = null;
  if (m.values.sparse_topk) {
    // The DSA indexer caches its own keys too; the MLA-only formula would undercount.
  } else if (attn === 'mla' && L && num(m, 'kv_lora_rank') && num(m, 'rope_head_dim')) {
    elems = (num(m, 'kv_lora_rank') + num(m, 'rope_head_dim')) * L;
    formula = '(kv_lora_rank + rope_head_dim) × attention_layers';
    inputs = ['kv_lora_rank', 'rope_head_dim', 'attention_layers'];
  } else if (['mha', 'gqa', 'mqa'].includes(attn) && L && get('head_dim')) {
    const kvh = attn === 'mqa' ? 1 : (num(m, 'kv_heads') ?? (attn === 'mha' ? heads : null));
    if (kvh) {
      elems = 2 * kvh * get('head_dim') * L;
      formula = '2 × kv_heads × head_dim × attention_layers';
      inputs = ['kv_heads', 'head_dim', 'attention_layers'];
    }
  }
  if (elems) {
    put('kv_bytes_per_token', elems * 2, `${formula} × 2 bytes`, inputs);
    const ctx = num(m, 'context_length');
    if (ctx) put('kv_bytes_at_context', elems * 2 * ctx, 'KV cache per token × context_length', ['kv_bytes_per_token', 'context_length']);
  }
  const pt = num(m, 'params_total');
  const pa = num(m, 'params_active');
  if (pt && pa && pa < pt) put('active_ratio', pa / pt, 'params_active / params_total', ['params_active', 'params_total']);
  return d;
}

export function formatDerived(def, v) {
  if (def.kind === 'bytes') {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let i = 0;
    let x = v;
    while (x >= 1024 && i < units.length - 1) {
      x /= 1024;
      i++;
    }
    return `${+x.toPrecision(3)} ${units[i]}`;
  }
  if (def.kind === 'ratio') return `${+(v * 100).toPrecision(3)}%`;
  return Number.isInteger(v) ? v.toLocaleString('en-US') : v.toFixed(1);
}

/** Collect the source ids a derived value rests on, following derived inputs. */
export function derivedSources(m, key, seen = new Set()) {
  const d = m.derived[key];
  if (!d) return [];
  const out = new Set();
  for (const k of d.inputs) {
    if (m.values[k]) out.add(m.values[k].source);
    else if (!seen.has(k)) {
      seen.add(k);
      for (const s of derivedSources(m, k, seen)) out.add(s);
    }
  }
  return [...out];
}

export { FIELD };

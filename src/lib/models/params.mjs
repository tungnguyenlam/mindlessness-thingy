// Where a model's parameters live, from the sizes in its data: every weight matrix the generated
// diagrams draw, its shape and parameter count, summed per sublayer kind, per run of layers and for
// the whole model, total and active per token. Pure JS, shared by <ModelOverview> and
// scripts/checks/models.mjs, which compares the sum with the reported params_total/params_active.
//
//   paramBreakdown(model) → { parts, total, active, missing, reported }
//
// Counted: the matrices (embedding, projections, experts, router, head). Left out: norms and
// biases (tiny), and any part whose shapes the data can't give (listed in `missing`). The sums are
// a derivation, not a source: the page says so and shows them next to the reported numbers.
import { parsePattern } from './data.mjs';

const pos = (x) => (typeof x === 'number' && x > 0 ? x : null);

/** One matrix: `in → out`, times `copies`. Shapes are [number, symbol] pairs so the page can show both. */
const mat = (name, what, [a, sa], [b, sb], copies = 1, copiesText = copies > 1 ? `${copies}` : '') => ({ name, what, in: a, out: b, inSym: sa, outSym: sb, copies, copiesText, params: a * b * copies });

/**
 * Matrices of each sublayer kind for one layer, or { missing } when the data can't size them.
 * Exported for the per-tab tables (keyed like the overview tabs: mixer-A, ffn-D, ...).
 */
export function sublayerWeights(m, code) {
  const g = (k) => pos(m.values[k]?.v ?? m.derived?.[k]?.v);
  const d = g('hidden_size');
  if (!d) return { missing: 'hidden size' };
  const D = [d, 'd'];
  if (code === 'A') {
    const attn = String(m.values.attention?.v ?? '');
    const [nh, dh] = [g('heads'), g('head_dim')];
    if (attn === 'mla') {
      const [dc, dR, dv, dq] = [g('kv_lora_rank'), g('rope_head_dim'), g('v_head_dim') ?? dh, g('q_lora_rank')];
      if (!(nh && dh && dc && dR && dv)) return { missing: 'MLA sizes' };
      const qw = nh * (dh + dR);
      const rows = [
        ...(dq
          ? [mat('W^DQ', 'query down', D, [dq, 'd_q']), mat('W^UQ, W^QR', 'query up, RoPE query', [dq, 'd_q'], [qw, 'n_h·(d_h + d_h^R)'])]
          : [mat('W^Q', 'queries', D, [qw, 'n_h·(d_h + d_h^R)'])]),
        mat('W^DKV', 'KV down (cached)', D, [dc, 'd_c']),
        mat('W^KR', 'RoPE key (cached)', D, [dR, 'd_h^R']),
        mat('W^UK, W^UV', 'key, value up', [dc, 'd_c'], [nh * (dh + dv), 'n_h·(d_h + d_v)']),
        mat('W^O', 'output', [nh * dv, 'n_h·d_v'], D),
      ];
      // The DSA lightning indexer has its own projections; their shapes aren't in the data.
      return g('sparse_topk') ? { rows, missing: 'lightning indexer' } : { rows };
    }
    if (['mha', 'gqa', 'mqa'].includes(attn)) {
      const kvh = attn === 'mqa' ? 1 : attn === 'mha' ? nh : g('kv_heads');
      if (!(nh && dh && kvh)) return { missing: 'attention sizes' };
      const outGate = m.values.attn_output_gate?.v === true;
      return {
        rows: [
          mat('W_Q', outGate ? 'queries + output gate' : 'queries', D, [outGate ? 2 * nh * dh : nh * dh, outGate ? '2·n_h·d_h' : 'n_h·d_h']),
          mat('W_K, W_V', 'keys, values', D, [kvh * dh, 'n_kv·d_h'], 2),
          mat('W_O', 'output', [nh * dh, 'n_h·d_h'], D),
        ],
      };
    }
    return { missing: `${attn || 'attention'} projections` };
  }
  if (code === 'X') {
    // Queries and output live in the backbone's width; keys and values are projected from the
    // conditioning inputs, whose widths the data doesn't give.
    const [nh, dh] = [g('heads'), g('head_dim')];
    if (!(nh && dh)) return { missing: 'cross-attention sizes' };
    return { rows: [mat('W_Q', 'queries', D, [nh * dh, 'n_h·d_h']), mat('W_O', 'output', [nh * dh, 'n_h·d_h'], D)], missing: 'cross-attention keys and values' };
  }
  if (code === 'C') {
    const k = g('conv_window');
    if (!k) return { missing: 'conv kernel' };
    return {
      rows: [
        mat('Linear in', 'B, C, h̃', D, [3 * d, '3·d']),
        mat('Conv', 'depthwise kernel', D, [k, 'k']),
        mat('Linear out', 'output', D, D),
      ],
    };
  }
  if (code === 'G') {
    const [nqk, nv, dqk, dv, k] = [g('linear_k_heads'), g('linear_v_heads'), g('linear_k_dim'), g('linear_v_dim'), g('conv_window')];
    if (!(nqk && nv && dqk && dv && k)) return { missing: 'Gated DeltaNet sizes' };
    const qkvWidth = 2 * nqk * dqk + nv * dv;
    const vWidth = nv * dv;
    return {
      rows: [
        mat('W_QKV', 'queries, keys, values', D, [qkvWidth, '2·n_qk·d_qk + n_v·d_v']),
        mat('W_z', 'output gate z', D, [vWidth, 'n_v·d_v']),
        mat('W_a, W_b', 'decay α_t, rate β_t', D, [nv, 'n_v'], 2),
        mat('Conv', 'depthwise causal kernel', [qkvWidth, '2·n_qk·d_qk + n_v·d_v'], [k, 'k']),
        mat('W_O', 'output', [vWidth, 'n_v·d_v'], D),
      ],
    };
  }
  if (code === 'D') {
    const f = g('ffn_hidden');
    if (!f) return { missing: 'dense FFN width' };
    return { rows: [mat('W_gate, W_up', 'gate, up', D, [f, 'd_ff'], 2), mat('W_down', 'down', [f, 'd_ff'], D)] };
  }
  if (code === 'E') {
    const [nr, kr, de] = [g('routed_experts'), g('active_experts'), g('expert_hidden')];
    if (!(nr && kr && de)) return { missing: 'MoE sizes' };
    const ns = g('shared_experts') ?? 0;
    const expert = 3 * d * de;
    const rows = [
      { ...mat('Routed experts', `gate, up, down each; ${kr} run`, D, [de, 'd_e'], 3 * nr, `3 × ${nr.toLocaleString('en-US')}`), active: 3 * d * de * kr, per: expert, count: nr, activeCount: kr },
      ...(ns ? [{ ...mat('Shared experts', 'gate, up, down; every token', D, [de, 'd_e'], 3 * ns, `3 × ${ns}`), per: expert, count: ns, activeCount: ns }] : []),
      mat('Router', 'expert centroids e_i', D, [nr, 'N_r']),
    ];
    return { rows };
  }
  return { missing: 'Mamba-2 sizes' };
}

const sum = (rows, key = 'params') => rows.reduce((s, r) => s + (r[key] ?? r.params), 0);

export function paramBreakdown(m) {
  const g = (k) => pos(m.values[k]?.v);
  const [V, d] = [g('vocab_size'), g('hidden_size')];
  const layers = m.values.layer_pattern ? parsePattern(m.values.layer_pattern.v) : null;
  const parts = [];
  const missing = [];
  if (m.kind === 'pipeline') {
    // Only the backbone is drawn down to its matrices; its input and output projections, the
    // AdaLN modulation and the other trained stages are sized only in the source.
    missing.push('input and output projections');
    if (m.values.modulation) missing.push('AdaLN modulation');
    if ((m.stages ?? []).some((st) => !st.backbone && !st.frozen && st.role === 'weight')) missing.push('the other trained stages');
  } else if (V && d) {
    parts.push({ id: 'emb', label: 'Embedding table', layers: 1, total: V * d, active: V * d, rows: [mat('E', 'one row per token id', [V, 'V'], [d, 'd'])] });
    if (m.values.tie_embeddings?.v === true) parts.push({ id: 'head', label: 'Output head', note: 'tied to the embedding', layers: 1, total: 0, active: 0, rows: [] });
    else parts.push({ id: 'head', label: 'Output head', layers: 1, total: d * V, active: d * V, rows: [mat('W_out', 'logits', [d, 'd'], [V, 'V'])] });
  } else missing.push('embedding');
  if (g('engram_heads')) missing.push('Engram memory tables');
  if (layers) {
    for (const code of ['A', 'X', 'C', 'M', 'G', 'D', 'E']) {
      const count = layers.filter((l) => l.includes(code)).length;
      if (!count) continue;
      const w = sublayerWeights(m, code);
      if (w.missing) missing.push(w.missing);
      if (!w.rows) continue;
      const per = sum(w.rows);
      const act = sum(w.rows, 'active');
      parts.push({ id: code, code, layers: count, perLayer: per, total: per * count, active: act * count, rows: w.rows });
    }
  } else missing.push('layer pattern');
  const total = parts.reduce((s, p) => s + p.total, 0);
  const active = parts.reduce((s, p) => s + p.active, 0);
  const reported = { total: g('params_total'), active: g('params_active') };
  return { parts, total, active, missing, reported, complete: !missing.length };
}

/** 1.17e9 → "1.17B", 6.71e11 → "671B", 4.4e7 → "44.0M". */
export function fmtParams(x) {
  if (x == null) return '—';
  const [div, unit] = x >= 1e12 ? [1e12, 'T'] : x >= 1e9 ? [1e9, 'B'] : x >= 1e6 ? [1e6, 'M'] : x >= 1e3 ? [1e3, 'K'] : [1, ''];
  const v = x / div;
  return `${v >= 100 ? Math.round(v) : v.toPrecision(3)}${unit}`;
}

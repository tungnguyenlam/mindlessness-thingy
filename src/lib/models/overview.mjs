// Generated architecture diagrams for a model, from its data in src/content/models/. Pure JS (no
// Astro), so <ModelOverview>/<ModelDiagram> render exactly what scripts/checks/models.mjs lints:
// every part of every model goes through lintDiagram on each check, not only at build.
//
//   overviewParts(model, ctx) → [{ id, tab, props }]   props are <ArchDiagram> props
//   layerDiagram(model, ctx)  → props for one layer (what <ModelDiagram> draws)
//   symbolRows(model)         → the symbols the diagrams use, with the field that gives each value
//
// ctx = { has(slug) → boolean, tokenizer: { title, note } | null }
//
// These are pictures of one specific model, so sizes are drawn as that model's numbers (T × 7,168,
// not T × d). Every number comes from the model data, which is sourced; the symbol table under the
// picture maps each number back to its symbol (as the concept notes write it) and its source. Only
// T, the sequence length, stays a symbol. A size the data lacks falls back to its symbol.
// Hand-drawn concept diagrams do the opposite: symbols only (rule diagram-geometry).
import { parsePattern, DERIVED, formatDerived } from './data.mjs';

const ATTN_SHORT = { mla: 'MLA', gqa: 'GQA', mha: 'MHA', mqa: 'MQA' };
const ATTN_LABEL = { mla: 'Latent attention (MLA)', gqa: 'Grouped-query attn', mha: 'Multi-head attn', mqa: 'Multi-query attn' };

const n = (x) => (typeof x === 'number' ? x.toLocaleString('en-US') : String(x));

function access(m) {
  const v = (k) => m.values[k]?.v ?? m.derived?.[k]?.v;
  const layers = m.values.layer_pattern ? parsePattern(m.values.layer_pattern.v) : null;
  const count = (c) => (layers ? layers.filter((l) => l.includes(c)).length : 0);
  const present = (codes) => [...codes].filter((c) => count(c) > 0);
  /** A size as drawn: the model's number for `key`, or `sym` when the data doesn't have it. */
  const z = (key, sym) => (v(key) != null ? n(v(key)) : sym);
  /** a·b (or a+b) as one number when both are known, else the symbolic expression. */
  const zz = (op, [ka, sa], [kb, sb]) => {
    const [a, b] = [v(ka), v(kb)];
    if (typeof a === 'number' && typeof b === 'number') return n(op === '+' ? a + b : a * b);
    return `${z(ka, sa)}${op === '+' ? ' + ' : '·'}${z(kb, sb)}`;
  };
  return { v, z, zz, layers, count, present };
}

const join = (...parts) => parts.filter(Boolean).join(' · ');
const linkIf = (ctx, slug) => (slug && ctx.has(slug) ? slug : undefined);

function mixerInfo(m, ctx, c) {
  const { v } = access(m);
  const attn = String(v('attention') ?? '');
  if (c === 'A')
    return {
      short: ATTN_SHORT[attn] ?? 'Attention',
      label: ATTN_LABEL[attn] ?? 'Attention',
      link: linkIf(ctx, attn),
      cache: attn === 'mla' ? 'Latent KV cache' : 'KV cache',
      cacheLink: linkIf(ctx, 'kv-cache'),
    };
  if (c === 'C') return { short: 'Conv', label: 'Gated short conv', link: linkIf(ctx, 'gated-short-conv'), cache: 'Conv window', cacheLink: undefined };
  if (c === 'G') return { short: 'DeltaNet', label: 'Gated DeltaNet', link: linkIf(ctx, 'gated-deltanet'), cache: 'DeltaNet state', cacheLink: undefined };
  return { short: 'Mamba-2', label: 'Mamba-2', link: linkIf(ctx, 'mamba-2'), cache: 'SSM state', cacheLink: undefined };
}

function ffnInfo(m, ctx, c) {
  const { v } = access(m);
  if (c === 'D') return { short: 'dense FFN', label: 'Dense FFN', link: undefined, role: 'weight' };
  const note = v('shared_experts') ? 'deepseek-moe' : 'moe';
  return { short: 'MoE', label: 'MoE FFN', link: linkIf(ctx, note) ?? linkIf(ctx, 'moe'), role: 'route' };
}

const normName = (m) => (/rmsnorm/i.test(String(m.values.norm?.v ?? 'RMSNorm')) ? 'RMSNorm' : 'Norm');

/** One layer: norm → mixer (+ cache) → add → norm → FFN → add, one column per sublayer kind. */
// zoom: inside <ModelOverview>, where each mixer and FFN block opens its own tab (`open`) instead of
// linking to the concept note; the detail views link to the notes.
export function layerDiagram(m, ctx, { title, zoom = false } = {}) {
  const { v, z, layers, count, present } = access(m);
  if (!layers) throw new Error(`model "${m.id}" needs a layer_pattern`);
  const mixers = present('ACMG');
  const ffns = present('DE');
  const times = (c, list) => (list.length > 1 ? `× ${count(c)}` : null);
  const width = Math.max(mixers.length, ffns.length, 1) === 1 ? 1 : 3;
  const center = width === 1 ? 0 : 1;
  const spread = (k) => (k === 1 ? [center] : k === 2 ? [0, 2] : [0, 1, 2]);
  const R = { in: 0, n1: 1, mix: 2, cache: 3, add1: 4 };
  const R2 = { n2: R.add1 + 1, ffn: R.add1 + 2, add2: R.add1 + 3 };
  const norm = normName(m);
  const blocks = [
    { id: 'in', label: 'Hidden state', sub: `T × ${z('hidden_size', 'd')}`, role: 'activation', col: center, row: R.in },
    { id: 'n1', label: norm, role: 'op', col: center, row: R.n1 },
    { id: 'add1', label: 'Add', role: 'op', col: center, row: R.add1 },
    { id: 'n2', label: norm, role: 'op', col: center, row: R2.n2 },
    { id: 'add2', label: 'Add', role: 'op', col: center, row: R2.add2 },
  ];
  const edges = [
    { from: 'in', to: 'n1' },
    { from: 'in', to: 'add1', side: 'left' },
    { from: 'add1', to: 'n2' },
    { from: 'add1', to: 'add2', side: 'left' },
  ];
  const attn = String(v('attention') ?? '');
  mixers.forEach((c, i) => {
    const info = mixerInfo(m, ctx, c);
    const col = spread(mixers.length)[i];
    let sub = times(c, mixers);
    if (c === 'A') sub = join(sub, attn === 'gqa' || attn === 'mqa' ? `${z('heads', 'n_h')} Q / ${z('kv_heads', 'n_kv')} KV heads` : `${z('heads', 'n_h')} heads`);
    if (c === 'C') sub = join(sub, `kernel ${z('conv_window', 'k')}`);
    if (c === 'G') sub = join(sub, `${z('linear_k_heads', 'n_qk')} QK / ${z('linear_v_heads', 'n_v')} V heads`);
    const open = zoom && 'ACG'.includes(c) ? `mixer-${c}` : undefined;
    blocks.push({ id: `mix-${c}`, label: info.label, sub: sub || undefined, role: 'op', col, row: R.mix, ...(open ? { open } : { link: info.link }) });
    blocks.push({ id: `cache-${c}`, label: info.cache, sub: c === 'A' ? 'grows with context' : 'fixed size', role: 'cache', col, row: R.cache, link: info.cacheLink });
    edges.push({ from: 'n1', to: `mix-${c}` }, { from: `mix-${c}`, to: `cache-${c}`, dashed: true }, { from: `mix-${c}`, to: 'add1' });
  });
  ffns.forEach((c, i) => {
    const info = ffnInfo(m, ctx, c);
    let sub = times(c, ffns);
    if (c === 'D') sub = join(sub, `width ${z('ffn_hidden', 'd_ff')}`);
    if (c === 'E') sub = join(sub, `${z('active_experts', 'K_r')} of ${z('routed_experts', 'N_r')}${v('shared_experts') ? ` + ${z('shared_experts', 'N_s')}` : ''}`);
    blocks.push({ id: `ffn-${c}`, label: info.label, sub: sub || undefined, role: info.role, col: spread(ffns.length)[i], row: R2.ffn, ...(zoom ? { open: `ffn-${c}` } : { link: info.link }) });
    edges.push({ from: 'n2', to: `ffn-${c}` }, { from: `ffn-${c}`, to: 'add2' });
  });
  const groups = [{ label: `${n(layers.length)} layers`, blocks: blocks.filter((b) => b.row >= R.n1).map((b) => b.id) }];
  return { title: title ?? `A ${m.title} layer`, blocks, edges, groups };
}

/** Consecutive runs of identical layers: "AD*3 AE*58" → [{codes:'AD', from:1, to:3}, ...]. */
function runs(layers) {
  const out = [];
  layers.forEach((l, i) => {
    const codes = l.join('');
    if (out.at(-1)?.codes === codes) out.at(-1).to = i + 1;
    else out.push({ codes, from: i + 1, to: i + 1 });
  });
  return out;
}

/** Text to logits: tokenizer, embedding, the layer stack, final norm, output head, sampling. */
function wholeModel(m, ctx) {
  const { v, z, layers, present } = access(m);
  const C = 1;
  const [V, d] = [z('vocab_size', 'V'), z('hidden_size', 'd')];
  const blocks = [];
  const edges = [];
  let row = 0;
  const add = (b) => {
    blocks.push({ col: C, row: row++, ...b });
    return b.id;
  };
  const chain = (...ids) => ids.slice(1).forEach((id, i) => edges.push({ from: ids[i], to: id }));
  const tok = ctx.tokenizer;
  add({ id: 'text', label: 'Input text', sub: 'a string', role: 'op' });
  add({ id: 'tok', label: 'Tokenizer', sub: String(tok?.algorithm ?? 'splits text into ids'), role: 'op', link: tok?.note && ctx.has(tok.note) ? tok.note : undefined });
  add({ id: 'ids', label: 'Token ids', sub: 'T integers', role: 'activation' });
  add({ id: 'emb', label: 'Embedding table', sub: `${V} × ${d}`, role: 'weight' });
  add({ id: 'h0', label: 'Hidden states', sub: `T × ${d}`, role: 'activation' });
  chain('text', 'tok', 'ids', 'emb', 'h0');

  const stack = [];
  const rs = layers ? runs(layers) : [];
  if (rs.length && rs.length <= 3) {
    for (const r of rs) {
      const [mx, ff] = [r.codes[0], r.codes[1]];
      const label = `${mixerInfo(m, ctx, mx).short} + ${ff ? ffnInfo(m, ctx, ff).short : ''}`.trim();
      stack.push(add({ id: `run-${r.from}`, label, sub: r.from === r.to ? `layer ${r.from}` : `layers ${r.from}–${r.to}`, role: 'op', open: 'layer' }));
    }
  } else {
    const mix = present('ACMG').map((c) => `${access(m).count(c)} ${mixerInfo(m, ctx, c).short}`);
    const mixSub = `${mix.join(' · ')}, interleaved`;
    stack.push(add({ id: 'stack', label: 'Layer stack', sub: layers ? (mixSub.length <= 28 ? mixSub : mix.join(' · ')) : `${z('layers', 'L')} layers`, role: 'op', ...(layers ? { open: 'layer' } : {}) }));
  }
  chain('h0', ...stack);
  // What decoding keeps between steps, beside the stack.
  const caches = present('ACMG').map((c) => mixerInfo(m, ctx, c).cache);
  // Bytes per token across all layers (derived, 16-bit), when the data gives it.
  const kv = m.derived?.kv_bytes_per_token?.v;
  const kvPerToken = kv ? formatDerived(DERIVED.find((x) => x.key === 'kv_bytes_per_token'), kv) : null;
  if (caches.length) {
    blocks.push({ id: 'cache', label: caches.length > 1 ? 'Per-layer caches' : caches[0], sub: caches.length > 1 ? caches.join(' + ') : kvPerToken ? `${kvPerToken} per token` : 'kept between steps', role: 'cache', col: 2, row: blocks.find((b) => b.id === stack[0]).row, link: present('A').length ? linkIf(ctx, 'kv-cache') : undefined });
    edges.push({ from: stack[0], to: 'cache', dashed: true });
  }
  add({ id: 'fnorm', label: `Final ${normName(m)}`, sub: `T × ${d}`, role: 'op' });
  add({ id: 'head', label: 'Output head', sub: v('tie_embeddings') === true ? `${d} × ${V}, tied` : `${d} × ${V}`, role: 'weight' });
  add({ id: 'logits', label: 'Logits', sub: `T × ${V}`, role: 'activation' });
  add({ id: 'sample', label: 'Softmax, sample', sub: 'next token id', role: 'op' });
  chain(stack.at(-1), 'fnorm', 'head', 'logits', 'sample');
  // Decoding loops: the sampled id is appended and the model runs again on one more token.
  edges.push({ from: 'sample', to: 'ids', side: 'left', dashed: true });
  if (v('mtp_depth')) {
    // Beside the last layer it reads from, so the arrow stays clear of the group label.
    const row = blocks.find((b) => b.id === stack.at(-1)).row;
    const free = !blocks.some((b) => b.col === 2 && b.row === row);
    blocks.push({ id: 'mtp', label: 'MTP module', sub: 'one more token, training', role: 'op', col: free ? 2 : 0, row, open: 'mtp' });
    edges.push({ from: stack.at(-1), to: 'mtp', dashed: true });
  }
  const groups = [{ label: layers ? `${n(layers.length)} layers` : 'layers', blocks: stack }];
  return { title: `${m.title}, text to next token`, blocks, edges, groups };
}

/** Multi-head latent attention: queries and keys/values squeezed through latents, RoPE on a side path. */
function mlaDetail(m, ctx) {
  const { v, z, zz } = access(m);
  const sparse = v('sparse_topk') != null;
  const norm = v('latent_norm') === true ? ', RMSNorm' : '';
  const [d, nh, dh, dR, dv] = [z('hidden_size', 'd'), z('heads', 'n_h'), z('head_dim', 'd_h'), z('rope_head_dim', 'd_h^R'), z('v_head_dim', 'd_v')];
  const qk = zz('+', ['head_dim', 'd_h'], ['rope_head_dim', 'd_h^R']);
  const blocks = [
    { id: 'h', label: 'Normed hidden h', sub: `T × ${d}`, role: 'activation', col: 1, row: 0, span: 2 },
    { id: 'cq', label: 'Query latent c^Q', sub: `T × ${z('q_lora_rank', 'd_q')}${norm}`, role: 'activation', col: 0, row: 1 },
    { id: 'ckv', label: 'KV latent c^KV', sub: `T × ${z('kv_lora_rank', 'd_c')}${norm}`, role: 'cache', col: 2, row: 1, link: linkIf(ctx, 'kv-cache') },
    { id: 'kr', label: 'RoPE key k^R', sub: `T × ${dR}, all heads`, role: 'cache', col: 3, row: 1, link: linkIf(ctx, 'rope') },
    { id: 'q', label: 'Queries', sub: `T × ${nh} × (${dh} + ${dR})`, role: 'activation', col: 0, row: 2 },
    { id: 'kv', label: 'Keys and values', sub: dh === dv ? `T × ${nh} × ${dh}` : `T × ${nh} × ${dh} / ${dv}`, role: 'activation', col: 2, row: 2 },
    { id: 'attn', label: sparse ? 'Sparse causal attention' : 'Causal attention', sub: sparse ? `over ${z('sparse_topk', 'k_top')} picked tokens` : `softmax(q·kᵀ / √${/\D/.test(qk) ? `(${qk})` : qk}) · v`, role: 'op', col: 1, row: 3, span: 2, link: linkIf(ctx, sparse ? 'dsa' : 'mla') },
    { id: 'o', label: 'Heads concatenated', sub: `T × ${zz('*', ['heads', 'n_h'], ['v_head_dim', 'd_v'])}`, role: 'activation', col: 1, row: 4, span: 2 },
    { id: 'out', label: 'Attention output', sub: `T × ${d}`, role: 'activation', col: 1, row: 5, span: 2 },
  ];
  const edges = [
    { from: 'h', to: 'cq', label: 'W^DQ' },
    { from: 'h', to: 'ckv', label: 'W^DKV' },
    { from: 'h', to: 'kr', label: 'W^KR' },
    { from: 'cq', to: 'q', label: 'W^UQ, W^QR' },
    { from: 'ckv', to: 'kv', label: 'W^UK, W^UV' },
    { from: 'q', to: 'attn' },
    { from: 'kv', to: 'attn' },
    { from: 'kr', to: 'attn' },
    { from: 'attn', to: 'o' },
    { from: 'o', to: 'out', label: 'W^O' },
  ];
  if (sparse) {
    blocks.push({ id: 'idx', label: 'Lightning indexer', sub: `${z('index_heads', 'n_I')} heads`, role: 'route', col: 3, row: 2, link: linkIf(ctx, 'dsa') });
    edges.push({ from: 'kr', to: 'idx', dashed: true }, { from: 'idx', to: 'attn', label: 'top k_top' });
  }
  return { title: `${m.title}: inside latent attention`, blocks, edges };
}

/** Grouped-query (or multi-head) attention with optional QK-Norm and the KV cache. */
function gqaDetail(m, ctx) {
  const { v, z } = access(m);
  const attn = String(v('attention') ?? '');
  const [d, nh, dh] = [z('hidden_size', 'd'), z('heads', 'n_h'), z('head_dim', 'd_h')];
  const kvh = attn === 'mha' ? nh : attn === 'mqa' ? '1' : z('kv_heads', 'n_kv');
  const share = typeof v('heads') === 'number' && typeof v('kv_heads') === 'number' ? n(v('heads') / v('kv_heads')) : 'n_h / n_kv';
  const pos = v('qk_norm') === true ? 'QK-Norm, RoPE' : 'RoPE';
  const outGate = v('attn_output_gate') === true;
  const blocks = [
    { id: 'h', label: 'Normed hidden h', sub: `T × ${d}`, role: 'activation', col: 1, row: 0 },
    { id: 'q', label: outGate ? 'Queries + gate g' : 'Queries', sub: outGate ? `2 × (T × ${nh} × ${dh})` : `T × ${nh} × ${dh}`, role: 'activation', col: 0, row: 1 },
    { id: 'k', label: 'Keys', sub: `T × ${kvh} × ${dh}`, role: 'activation', col: 1, row: 1 },
    { id: 'v', label: 'Values', sub: `T × ${kvh} × ${dh}`, role: 'activation', col: 2, row: 1 },
    { id: 'qn', label: pos, sub: 'per query head', role: 'op', col: 0, row: 2, link: linkIf(ctx, 'rope') },
    { id: 'kn', label: pos, sub: 'per key head', role: 'op', col: 1, row: 2, link: linkIf(ctx, 'rope') },
    { id: 'cache', label: 'KV cache', sub: 'keys, values of past tokens', role: 'cache', col: 1, row: 3, span: 2, link: linkIf(ctx, 'kv-cache') },
    { id: 'attn', label: 'Causal attention', sub: attn === 'gqa' ? `${share} query heads share a KV head` : `softmax(q·kᵀ / √${dh}) · v`, role: 'op', col: 0, row: 4, span: 2, link: linkIf(ctx, attn) },
    { id: 'out', label: 'Attention output', sub: outGate ? `σ(g) ⊙ attn → T × ${d}` : `T × ${d}`, role: 'activation', col: 0, row: 5, span: 2 },
  ];
  const edges = [
    { from: 'h', to: 'q', label: 'W_Q' },
    { from: 'h', to: 'k', label: 'W_K' },
    { from: 'h', to: 'v', label: 'W_V' },
    { from: 'q', to: 'qn' },
    { from: 'k', to: 'kn' },
    { from: 'kn', to: 'cache' },
    { from: 'v', to: 'cache' },
    { from: 'qn', to: 'attn' },
    { from: 'cache', to: 'attn' },
    { from: 'attn', to: 'out', label: 'W_O' },
  ];
  return { title: `${m.title}: inside attention`, blocks, edges };
}

/** Gated DeltaNet linear attention: QKV + depthwise conv, decay/step gates, recurrent state S_t = α_t S + β_t(v − S k)kᵀ, gated RMSNorm. */
function deltanetDetail(m, ctx) {
  const { z } = access(m);
  const [d, k] = [z('hidden_size', 'd'), z('conv_window', 'k')];
  const [nqk, nv, dqk, dv] = [z('linear_k_heads', 'n_qk'), z('linear_v_heads', 'n_v'), z('linear_k_dim', 'd_qk'), z('linear_v_dim', 'd_v')];
  const blocks = [
    { id: 'h', label: 'Normed hidden h', sub: `T × ${d}`, role: 'activation', col: 1, row: 0 },
    { id: 'z', label: 'Output gate z', sub: `T × ${nv} × ${dv}`, role: 'activation', col: 0, row: 1 },
    { id: 'qkv', label: 'QKV + depthwise conv', sub: `Q, K: ${nqk}×${dqk}; V: ${nv}×${dv}; k=${k}`, role: 'op', col: 1, row: 1 },
    { id: 'gates', label: 'Decay α_t, rate β_t', sub: `T × ${nv} each`, role: 'route', col: 2, row: 1 },
    { id: 'rule', label: 'Gated delta rule', sub: 'S_t = α_t S + β_t (v − S k) kᵀ', role: 'op', col: 1, row: 2, link: linkIf(ctx, 'gated-deltanet') },
    { id: 'state', label: 'Recurrent state S', sub: `${nv} × ${dqk} × ${dv} + conv`, role: 'cache', col: 2, row: 2 },
    { id: 'norm', label: 'RMSNorm(y) ⊙ SiLU(z)', sub: `T × ${nv} × ${dv}`, role: 'op', col: 0, row: 3, span: 2 },
    { id: 'out', label: 'DeltaNet output', sub: `T × ${d}`, role: 'activation', col: 0, row: 4, span: 2 },
  ];
  const edges = [
    { from: 'h', to: 'z', label: 'W_z' },
    { from: 'h', to: 'qkv', label: 'W_QKV' },
    { from: 'h', to: 'gates', label: 'W_a, W_b' },
    { from: 'qkv', to: 'rule', label: 'q, k, v' },
    { from: 'gates', to: 'rule' },
    { from: 'rule', to: 'state', dashed: true },
    { from: 'rule', to: 'norm', label: 'y = S_t q' },
    { from: 'z', to: 'norm' },
    { from: 'norm', to: 'out', label: 'W_O' },
  ];
  return { title: `${m.title}: inside Gated DeltaNet`, blocks, edges };
}

/** LFM2's gated short convolution: (B, C, h̃) = Linear(h); y = B ⊙ h̃; z = Conv_k(y); out = W(C ⊙ z). */
function convDetail(m, ctx) {
  const { z } = access(m);
  const [d, k] = [z('hidden_size', 'd'), z('conv_window', 'k')];
  const blocks = [
    { id: 'h', label: 'Normed hidden h', sub: `T × ${d}`, role: 'activation', col: 1, row: 0 },
    { id: 'lin', label: 'Linear in', sub: `${d} → 3 × ${d}, split`, role: 'weight', col: 1, row: 1 },
    { id: 'b', label: 'Gate B', sub: `T × ${d}`, role: 'activation', col: 0, row: 2 },
    { id: 'ht', label: 'Input h̃', sub: `T × ${d}`, role: 'activation', col: 1, row: 2 },
    { id: 'c', label: 'Gate C', sub: `T × ${d}`, role: 'activation', col: 2, row: 2 },
    { id: 'y', label: 'y = B ⊙ h̃', sub: `T × ${d}`, role: 'op', col: 1, row: 3 },
    { id: 'conv', label: 'Depthwise conv', sub: `kernel ${k}, along T`, role: 'op', col: 1, row: 4, link: linkIf(ctx, 'gated-short-conv') },
    { id: 'state', label: 'Conv window', sub: `last ${k} inputs y`, role: 'cache', col: 0, row: 4 },
    { id: 'gate', label: 'C ⊙ z', sub: `T × ${d}`, role: 'op', col: 1, row: 5 },
    { id: 'out', label: 'Linear out', sub: `T × ${d}`, role: 'weight', col: 1, row: 6 },
  ];
  const edges = [
    { from: 'h', to: 'lin' },
    { from: 'lin', to: 'b' },
    { from: 'lin', to: 'ht' },
    { from: 'lin', to: 'c' },
    { from: 'b', to: 'y' },
    { from: 'ht', to: 'y' },
    { from: 'y', to: 'conv' },
    { from: 'conv', to: 'state', dashed: true },
    { from: 'conv', to: 'gate', label: 'z' },
    { from: 'c', to: 'gate' },
    { from: 'gate', to: 'out' },
  ];
  return { title: `${m.title}: inside the gated short conv`, blocks, edges };
}

/** Dense gated FFN (SwiGLU when the data says so). */
function denseDetail(m, ctx, { title } = {}) {
  const { v, z } = access(m);
  const [d, width] = [z('hidden_size', 'd'), z('ffn_hidden', 'd_ff')];
  const swiglu = /swiglu/i.test(String(v('ffn_activation') ?? ''));
  const blocks = [
    { id: 'u', label: 'Normed hidden u', sub: `T × ${d}`, role: 'activation', col: 1, row: 0 },
    { id: 'g', label: 'Gate projection', sub: `T × ${width}`, role: 'weight', col: 0, row: 1 },
    { id: 'up', label: 'Up projection', sub: `T × ${width}`, role: 'weight', col: 2, row: 1 },
    { id: 'act', label: swiglu ? 'SiLU(gate) ⊙ up' : 'act(gate) ⊙ up', sub: `T × ${width}`, role: 'op', col: 1, row: 2 },
    { id: 'down', label: 'Down projection', sub: `T × ${d}`, role: 'weight', col: 1, row: 3 },
  ];
  const edges = [
    { from: 'u', to: 'g' },
    { from: 'u', to: 'up' },
    { from: 'g', to: 'act' },
    { from: 'up', to: 'act' },
    { from: 'act', to: 'down' },
  ];
  return { title: title ?? `${m.title}: inside the dense FFN`, blocks, edges };
}

/** DeepSeekMoE-style MoE: router → top-K_r (group-limited) → routed experts, plus shared experts. */
function moeDetail(m, ctx) {
  const { v, z } = access(m);
  const [d, K] = [z('hidden_size', 'd'), z('active_experts', 'K_r')];
  const scoring = String(v('router_scoring') ?? 'score');
  const grouped = (v('expert_groups') ?? 0) > 0;
  const shared = v('shared_experts') != null;
  const blocks = [
    { id: 'u', label: 'Normed hidden u', sub: `T × ${d}`, role: 'activation', col: 1, row: 0, span: 2 },
    { id: 'router', label: 'Router', sub: `${scoring}(u · e_i)`, role: 'route', col: 0, row: 1, link: linkIf(ctx, 'moe') },
    { id: 'topk', label: `Top-${K} experts`, sub: grouped ? `within ${z('expert_groups_active', 'M')} of ${z('expert_groups', 'G')} groups` : 'highest scores', role: 'route', col: 0, row: 2, link: linkIf(ctx, 'aux-loss-free-balancing') },
    { id: 'experts', label: 'Routed experts', sub: `${K} of ${z('routed_experts', 'N_r')} run, width ${z('expert_hidden', 'd_e')}`, role: 'weight', col: 1, row: 3, span: 2, link: linkIf(ctx, 'deepseek-moe') },
    { id: 'sum', label: 'Weighted sum', sub: shared ? 'shared + Σ g_i · expert_i(u)' : 'Σ g_i · expert_i(u)', role: 'op', col: 1, row: 4, span: 2 },
    { id: 'out', label: 'FFN output', sub: `T × ${d}`, role: 'activation', col: 1, row: 5, span: 2 },
  ];
  const edges = [
    { from: 'u', to: 'router' },
    { from: 'router', to: 'topk' },
    { from: 'u', to: 'experts' },
    { from: 'topk', to: 'experts', label: 'which' },
    { from: 'topk', to: 'sum', label: 'gates g' },
    { from: 'experts', to: 'sum' },
    { from: 'sum', to: 'out' },
  ];
  if (shared) {
    blocks.push({ id: 'shared', label: 'Shared experts', sub: `${z('shared_experts', 'N_s')}, every token`, role: 'weight', col: 3, row: 2, link: linkIf(ctx, 'deepseek-moe') });
    edges.push({ from: 'u', to: 'shared' }, { from: 'shared', to: 'sum' });
  }
  return { title: `${m.title}: inside the MoE FFN`, blocks, edges };
}

/** DeepSeek-V3's multi-token prediction module (one per depth k). */
function mtpDetail(m, ctx) {
  const norm = normName(m);
  const d = access(m).z('hidden_size', 'd');
  const blocks = [
    { id: 'hm', label: 'Hidden from depth k−1', sub: `h_i, T × ${d}`, role: 'activation', col: 0, row: 0 },
    { id: 'e', label: 'Embedding of t_(i+k)', sub: 'table shared with main', role: 'weight', col: 2, row: 0 },
    { id: 'n1', label: norm, role: 'op', col: 0, row: 1 },
    { id: 'n2', label: norm, role: 'op', col: 2, row: 1 },
    { id: 'cat', label: 'Concatenate, project', sub: `M_k: 2 × ${d} → ${d}`, role: 'weight', col: 1, row: 2 },
    { id: 'trm', label: 'Transformer block', sub: `TRM_k, T × ${d}`, role: 'op', col: 1, row: 3, link: linkIf(ctx, 'transformer-block') },
    { id: 'head', label: 'Output head', sub: 'shared with main', role: 'weight', col: 1, row: 4 },
    { id: 'p', label: 'Predicts t_(i+k+1)', sub: 'extra training loss', role: 'activation', col: 1, row: 5, link: linkIf(ctx, 'mtp') },
  ];
  const edges = [
    { from: 'hm', to: 'n1' },
    { from: 'e', to: 'n2' },
    { from: 'n1', to: 'cat' },
    { from: 'n2', to: 'cat' },
    { from: 'cat', to: 'trm' },
    { from: 'trm', to: 'head' },
    { from: 'head', to: 'p' },
  ];
  return { title: `${m.title}: one MTP module`, blocks, edges };
}

/** Every generated view of a model, in reading order. */
export function overviewParts(m, ctx) {
  const { v, present, layers } = access(m);
  const parts = [{ id: 'model', tab: 'Whole model', props: wholeModel(m, ctx) }];
  if (layers) parts.push({ id: 'layer', tab: 'One layer', props: layerDiagram(m, ctx, { zoom: true }) });
  const attn = String(v('attention') ?? '');
  for (const c of present('ACMG')) {
    if (c === 'A' && attn === 'mla') parts.push({ id: 'mixer-A', tab: 'Attention (MLA)', props: mlaDetail(m, ctx) });
    else if (c === 'A') parts.push({ id: 'mixer-A', tab: `Attention (${ATTN_SHORT[attn] ?? 'attn'})`, props: gqaDetail(m, ctx) });
    else if (c === 'C') parts.push({ id: 'mixer-C', tab: 'Gated conv', props: convDetail(m, ctx) });
    else if (c === 'G') parts.push({ id: 'mixer-G', tab: 'Gated DeltaNet', props: deltanetDetail(m, ctx) });
  }
  for (const c of present('DE')) {
    if (c === 'D') parts.push({ id: 'ffn-D', tab: 'Dense FFN', props: denseDetail(m, ctx) });
    else parts.push({ id: 'ffn-E', tab: 'MoE FFN', props: moeDetail(m, ctx) });
  }
  if (v('mtp_depth')) parts.push({ id: 'mtp', tab: 'MTP', props: mtpDetail(m, ctx) });
  return parts;
}

// Symbols used in the diagrams, and the model field (or derived value) that gives each one.
const SYMBOLS = [
  ['T', 'tokens in the sequence', null],
  ['V', 'vocabulary, embedding rows', 'vocab_size'],
  ['d', 'hidden size', 'hidden_size'],
  ['L', 'layers', 'layers'],
  ['n_h', 'query heads', 'heads'],
  ['n_kv', 'key/value heads', 'kv_heads'],
  ['d_h', 'head dimension', 'head_dim'],
  ['d_v', 'value head dimension', 'v_head_dim'],
  ['n_qk', 'DeltaNet Q/K heads', 'linear_k_heads'],
  ['n_v', 'DeltaNet value heads', 'linear_v_heads'],
  ['d_qk', 'DeltaNet Q/K head dim', 'linear_k_dim'],
  ['d_v', 'DeltaNet value head dim', 'linear_v_dim'],
  ['d_q', 'query latent width', 'q_lora_rank'],
  ['d_c', 'KV latent width (cached)', 'kv_lora_rank'],
  ['d_h^R', 'decoupled RoPE width', 'rope_head_dim'],
  ['k_top', 'tokens each query reads', 'sparse_topk'],
  ['n_I', 'indexer heads', 'index_heads'],
  ['k', 'conv kernel size', 'conv_window'],
  ['d_ff', 'dense FFN hidden size', 'ffn_hidden'],
  ['N_r', 'routed experts', 'routed_experts'],
  ['K_r', 'routed experts per token', 'active_experts'],
  ['N_s', 'shared experts', 'shared_experts'],
  ['d_e', 'expert hidden size', 'expert_hidden'],
  ['G', 'expert groups', 'expert_groups'],
  ['M', 'groups a token may use', 'expert_groups_active'],
  ['D', 'MTP depth', 'mtp_depth'],
];

export function symbolRows(m) {
  return SYMBOLS.filter(([, , key]) => key == null || m.values[key] != null || m.derived?.[key] != null).map(([sym, meaning, key]) => ({ sym, meaning, key }));
}

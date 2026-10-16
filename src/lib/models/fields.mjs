// The model field vocabulary. Every model in src/content/models/ uses these keys and nothing else,
// which is what lets <ModelSpec>, <Compare>, /compare/ and the derived rows line models up.
// Add a field here once (with the note that explains it) rather than inventing a label in a note.
//
// kind: count | params | tokens | text | slug | pattern
//   slug    → value must be a note slug; rendered as a link
//   pattern → layer pattern, see parsePattern() in ./data.mjs
export const GROUPS = [
  { id: 'size', label: 'Size' },
  { id: 'shape', label: 'Shape' },
  { id: 'mixer', label: 'Token mixing' },
  { id: 'ffn', label: 'Feed-forward' },
  { id: 'train', label: 'Training and context' },
];

export const FIELDS = [
  { key: 'params_total', label: 'Total parameters', group: 'size', kind: 'params' },
  { key: 'params_active', label: 'Active per token', group: 'size', kind: 'params', concept: 'moe' },

  { key: 'layers', label: 'Layers', group: 'shape', kind: 'count' },
  { key: 'layer_pattern', label: 'Layer pattern', group: 'shape', kind: 'pattern' },
  { key: 'hidden_size', label: 'Hidden size', group: 'shape', kind: 'count' },
  { key: 'vocab_size', label: 'Vocabulary', group: 'shape', kind: 'count' },

  { key: 'attention', label: 'Attention type', group: 'mixer', kind: 'slug' },
  { key: 'attention_layers', label: 'Attention layers', group: 'mixer', kind: 'count' },
  { key: 'heads', label: 'Query heads', group: 'mixer', kind: 'count', concept: 'mha' },
  { key: 'kv_heads', label: 'Key/value heads', group: 'mixer', kind: 'count', concept: 'gqa' },
  { key: 'head_dim', label: 'Head dimension', group: 'mixer', kind: 'count' },
  { key: 'kv_lora_rank', label: 'KV latent width d_c', group: 'mixer', kind: 'count', concept: 'mla' },
  { key: 'q_lora_rank', label: 'Query latent width', group: 'mixer', kind: 'count', concept: 'mla' },
  { key: 'rope_head_dim', label: 'Decoupled RoPE dim', group: 'mixer', kind: 'count', concept: 'rope' },
  { key: 'rope_theta', label: 'RoPE θ', group: 'mixer', kind: 'count', concept: 'rope' },
  { key: 'sparse_topk', label: 'Sparse attention top-k tokens', group: 'mixer', kind: 'count', concept: 'dsa' },
  { key: 'conv_layers', label: 'Conv layers', group: 'mixer', kind: 'count', concept: 'gated-short-conv' },
  { key: 'conv_window', label: 'Conv window', group: 'mixer', kind: 'count', concept: 'gated-short-conv' },

  { key: 'ffn', label: 'FFN type', group: 'ffn', kind: 'slug' },
  { key: 'ffn_hidden', label: 'Dense FFN hidden size', group: 'ffn', kind: 'count' },
  { key: 'dense_layers', label: 'Dense layers before MoE', group: 'ffn', kind: 'count' },
  { key: 'routed_experts', label: 'Routed experts', group: 'ffn', kind: 'count', concept: 'moe' },
  { key: 'active_experts', label: 'Routed experts per token', group: 'ffn', kind: 'count', concept: 'moe' },
  { key: 'shared_experts', label: 'Shared experts', group: 'ffn', kind: 'count', concept: 'deepseek-moe' },
  { key: 'expert_hidden', label: 'Expert hidden size', group: 'ffn', kind: 'count' },
  { key: 'mtp_depth', label: 'MTP depth', group: 'ffn', kind: 'count', concept: 'mtp' },

  { key: 'context_length', label: 'Context length', group: 'train', kind: 'tokens' },
  { key: 'training_tokens', label: 'Training tokens', group: 'train', kind: 'tokens' },
  { key: 'knowledge_cutoff', label: 'Knowledge cutoff', group: 'train', kind: 'text' },
];

export const FIELD = Object.fromEntries(FIELDS.map((f) => [f.key, f]));

// Sublayer codes used in layer_pattern. Colours reuse the role palette with a fixed mapping:
// attention is where the growing KV cache lives (cache), MoE is routing (route), dense FFN is
// weights (weight), conv and SSM keep a small fixed state (op / activation).
export const SUBLAYERS = {
  A: { label: 'Attention', role: 'cache', concept: null }, // concept comes from the model's `attention`
  C: { label: 'Gated short conv', role: 'op', concept: 'gated-short-conv' },
  M: { label: 'Mamba-2', role: 'activation', concept: 'mamba-2' },
  D: { label: 'Dense FFN', role: 'weight', concept: null },
  E: { label: 'MoE FFN', role: 'route', concept: 'moe' },
};

const SI = [
  [1e12, 'T'],
  [1e9, 'B'],
  [1e6, 'M'],
  [1e3, 'K'],
];

export function formatValue(field, value) {
  if (value == null) return '';
  if (value.display) return value.display;
  const v = value.v;
  if (typeof v !== 'number') return String(v);
  // Context windows are usually powers of two: 32768 reads as 32K, as model cards write it.
  if (field.kind === 'tokens' && v % 1024 === 0 && v < 2 ** 24) return `${v / 1024}K`;
  if (field.kind === 'params' || field.kind === 'tokens') {
    for (const [n, s] of SI) if (Math.abs(v) >= n) return `${+(v / n).toPrecision(4)}${s}`;
  }
  return v.toLocaleString('en-US');
}

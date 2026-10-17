// The tokenizer field vocabulary, the counterpart of src/lib/models/fields.mjs. Every tokenizer in
// src/content/tokenizers/ uses these keys; each value is { v, source, where } like a model value.
// Counts come from the released tokenizer.json (where: the JSON path), descriptions from the
// report that introduced the tokenizer.
export const TOKENIZER_FIELDS = [
  { key: 'algorithm', label: 'Algorithm', kind: 'text', concept: 'byte-level-bpe' },
  { key: 'base_vocab', label: 'Learned tokens', kind: 'count' },
  { key: 'merges', label: 'Merge rules', kind: 'count', concept: 'byte-level-bpe' },
  { key: 'added_tokens', label: 'Added tokens (special and reserved)', kind: 'count' },
  { key: 'max_id', label: 'Highest token id', kind: 'count' },
  { key: 'normalizer', label: 'Normalization before splitting', kind: 'text' },
  { key: 'digits', label: 'Digits', kind: 'text' },
  { key: 'add_bos', label: 'Begin-of-sequence token added', kind: 'text' },
  { key: 'chat_format', label: 'Chat format', kind: 'text' },
  { key: 'trained_for', label: 'Trained for', kind: 'text' },
];

export const TOKENIZER_FIELD = Object.fromEntries(TOKENIZER_FIELDS.map((f) => [f.key, f]));

/** Embedding rows no token id can reach: the table is padded past the last id (usually for GPU-friendly shapes). */
export function unusedRows(model, tokenizer) {
  const rows = model.values.vocab_size?.v;
  const max = tokenizer?.max_id?.v;
  if (typeof rows !== 'number' || typeof max !== 'number') return null;
  return { v: rows - (max + 1), formula: 'vocab_size − (highest token id + 1)' };
}

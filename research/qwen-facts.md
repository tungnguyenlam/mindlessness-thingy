# Qwen 2.5 → 3.8 architectures — sourced fact sheet

Compiled 2026-10-21. Every value was read from a primary source in this session (tech report / official blog / Hugging Face model card / `config.json`). Config values from `https://huggingface.co/Qwen/<repo>/raw/main/config.json` (fetched 2026-10-21; `main` may change later). "UNVERIFIED" = no primary source found. Prefer config for released checkpoints when sources disagree.

Shorthand: `[Q2.5]` = arXiv 2412.15115, `[Q3]` = arXiv 2505.09388, `card:<repo>` = that Hugging Face model card, `cfg:<repo>` = that repo's config.json, `blog:qwen3.5` = qwen.ai/blog?id=qwen3.5 (and 3.6 / 3.8 similarly).

Flagship open-weight checkpoint chosen per generation: Qwen2.5-72B, Qwen3-235B-A22B, Qwen3.5-397B-A17B, Qwen3.6-27B, Qwen3.8-2.4T-A95B. Qwen3.8-27B's `config.json` matches Qwen3.6-27B; the 3.8 page is the Max-class 2.4T model.

---

## Disagreements (prefer config / card for released checkpoints)

| field | paper / table | config.json / card | used in notes |
|---|---|---|---|
| Qwen2.5-72B context | [Q2.5] Table 1: 128K / 8K | cfg `max_position_embeddings: 131072`; card "131,072 tokens" | 131,072 (config/card) |
| Qwen3-235B-A22B context | [Q3] Table 2: 128K | card: 32,768 natively and 131,072 with YaRN; cfg `max_position_embeddings: 40960`, `rope_scaling: null` | 32,768 native (card); config 40,960 is a prompt+output margin, same pattern as DeepSeek YaRN |
| Qwen3 tokenizer size | [Q3] §2: 151,669 | tokenizer.json 151,643 BPE + 26 added = 151,669; cfg `vocab_size: 151936` | 151,669 ids, 151,936 embedding rows (padding) |
| Qwen2.5 tokenizer size | [Q2.5] §2: 151,643 regular + 22 control | tokenizer.json added ids 151643–151664; cfg `vocab_size: 152064` | 151,665 ids, 152,064 embedding rows |
| Qwen3.5/3.6/3.8 embedding | cards: 248,320 (Padded) | tokenizer.json 248,044 BPE + 26 added (max id 248069); cfg `vocab_size: 248320` | 248,070 ids, 248,320 rows |
| Qwen3.5/3.6/3.8 training tokens | — | not on cards or configs | UNVERIFIED, omitted |

---

## Qwen2.5-72B (`Qwen/Qwen2.5-72B`)

| field | value | source |
|---|---|---|
| Parameters | 72.7B (70.0B non-embedding) | card:Qwen2.5-72B |
| Layers | 80, all attention + dense FFN | cfg `num_hidden_layers`; pattern `AD*80` |
| Hidden size | 8192 | cfg `hidden_size` |
| FFN intermediate | 29568 | cfg `intermediate_size` |
| Query / KV heads | 64 / 8 (GQA) | cfg; card; [Q2.5] Table 1 |
| Head dim | 128 | Derived: 8192/64 (no `head_dim` key) |
| Vocab (embedding rows) | 152064 | cfg `vocab_size` |
| Tie embeddings | no | cfg `tie_word_embeddings`; [Q2.5] Table 1 |
| RoPE θ | 1,000,000 | cfg `rope_theta` |
| Context | 131,072 | cfg; card |
| Training tokens | 18T (family pre-training data) | [Q2.5] Abstract; §3 |
| Architecture | RoPE, SwiGLU, RMSNorm, Attention QKV bias; no QK-Norm | card; [Q2.5] §2; qwen2-modeling |
| Sliding window | `use_sliding_window: false`; `sliding_window: 131072` | cfg (SWA off) |
| Tokenizer | byte-level BPE, 151,643 regular tokens, 22 control, NFC, one digit per token, ChatML, no BOS | [Q2.5] §2; tokenizer.json |

---

## Qwen3-235B-A22B (`Qwen/Qwen3-235B-A22B`)

| field | value | source |
|---|---|---|
| Parameters | 235B total, 22B activated (234B non-embedding) | card; [Q3] §2 |
| Layers | 94, all attention + MoE (`mlp_only_layers: []`, `decoder_sparse_step: 1`) | cfg; pattern `AE*94` |
| Hidden size | 4096 | cfg |
| Dense FFN width (unused) | 12288 | cfg `intermediate_size` (no dense layers) |
| Query / KV heads | 64 / 4 (GQA) | cfg; [Q3] Table 2 |
| Head dim | 128 | cfg `head_dim` (not hidden/heads = 64) |
| Experts | 128 total, 8 activated, no shared expert | cfg; [Q3] §2 |
| Expert hidden | 1536 | cfg `moe_intermediate_size` |
| Router | softmax top-k, `norm_topk_prob: true` | cfg; qwen3-moe-modeling |
| Vocab (embedding rows) | 151936 | cfg |
| Tie embeddings | no | cfg |
| RoPE θ | 1,000,000; `rope_scaling: null` | cfg |
| Native context | 32,768; 131,072 with YaRN factor 4 over 32,768 | card |
| Training tokens | 36T, 119 languages | [Q3] Abstract; §3.1 |
| What is new vs Qwen2.5 | drop QKV-bias; add QK-Norm; MoE without shared experts; thinking / non-thinking in one model | [Q3] §2 |
| Tokenizer | same 151,643 BPE as Qwen2.5 + 26 added (incl. `<think>`, `</think>`, `<tool_response>`) | tokenizer.json; [Q3] §2 (151,669) |

---

## Qwen3.5-397B-A17B (`Qwen/Qwen3.5-397B-A17B`)

| field | value | source |
|---|---|---|
| Type | Causal LM with vision encoder | card |
| LLM parameters | 397B total, 17B activated | card "Language Model" |
| Layers | 60 | cfg `text_config.num_hidden_layers` |
| Hidden layout | 15 × (3 × Gated DeltaNet→MoE then 1 × gated attention→MoE) | card; cfg `layer_types`, `full_attention_interval: 4` |
| Pattern | `GE*3 AE` × 15 | cfg `layer_types` |
| Hidden size | 4096 | cfg |
| Gated DeltaNet | 16 QK heads, 64 V heads, dim 128, conv kernel 4 | cfg `linear_*`; card |
| Gated GQA | 32 Q / 2 KV, head dim 256, `attn_output_gate: true` | cfg |
| Partial RoPE | 0.25 of 256 = 64 dims, θ = 10,000,000, interleaved M-RoPE [11, 11, 10] | cfg `rope_parameters` |
| MoE | 512 experts, top-10 routed + 1 shared, intermediate 1024 | cfg; card |
| Vocab (padded) | 248320 | cfg; card |
| MTP | `mtp_num_hidden_layers: 1` | cfg |
| Context | 262,144 natively, extensible to 1,010,000 | card; cfg `max_position_embeddings: 262144` |
| Vision | 27-layer ViT, width 1152, FFN 4304, 16 heads, patch 16, spatial merge 2 | cfg `vision_config` |
| Tokenizer | new 248,044 BPE; words include Unicode marks (`\p{L}\p{M}`); same special set as Qwen3 plus vision pads | tokenizer.json |

---

## Qwen3.6-27B (`Qwen/Qwen3.6-27B`)

| field | value | source |
|---|---|---|
| Type | Causal LM with vision encoder | card |
| Parameters | 27B | card |
| Layers | 64 | cfg `text_config.num_hidden_layers` |
| Hidden layout | 16 × (3 × Gated DeltaNet→FFN then 1 × gated attention→FFN) | card; cfg `layer_types` |
| Pattern | `GD*3 AD` × 16 | cfg `layer_types` |
| Hidden size | 5120 | cfg |
| Dense FFN | 17408 | cfg `intermediate_size` |
| Gated DeltaNet | 16 QK heads, 48 V heads, dim 128, conv kernel 4 | cfg; card |
| Gated GQA | 24 Q / 4 KV, head dim 256, `attn_output_gate: true` | cfg |
| Partial RoPE | 0.25 of 256, θ = 10,000,000, interleaved M-RoPE [11, 11, 10] | cfg `rope_parameters` |
| Vocab (padded) | 248320 | cfg; card |
| MTP | `mtp_num_hidden_layers: 1` | cfg |
| Context | 262,144 natively, extensible to 1,010,000 | card |
| Tokenizer | shared with Qwen3.5 | card Token Embedding; vocab_size |

---

## Qwen3.8-2.4T-A95B (`Qwen/Qwen3.8-2.4T-A95B`)

| field | value | source |
|---|---|---|
| Type | Causal language model, text-only (no `vision_config`) | card; cfg `Qwen3_5MoeForCausalLM` |
| Parameters | 2.4T total, 95B activated | card |
| Layers | 92 | cfg `num_hidden_layers` |
| Hidden layout | 23 × (3 × Gated DeltaNet→MoE then 1 × gated attention→MoE) | card; cfg `layer_types` |
| Pattern | `GE*3 AE` × 23 | cfg `layer_types` |
| Hidden size | 8192 | cfg |
| Gated DeltaNet | 16 QK heads, 128 V heads, dim 128, conv kernel 4 | cfg; card |
| Gated GQA | 64 Q / 4 KV, head dim 256, `attn_output_gate: true` | cfg |
| Partial RoPE | 0.25 of 256, θ = 10,000,000; no M-RoPE section (text-only) | cfg `rope_parameters` |
| MoE | 512 experts, top-10 routed + 1 shared, intermediate 2048 | cfg; card |
| Vocab (padded) | 248320 | cfg; card |
| MTP | `mtp_num_hidden_layers: 1` | cfg |
| Context | 262,144 natively, extensible to 1,010,000 | card |
| Thinking | required; cannot be disabled on this open checkpoint | card |
| Tokenizer | shared with Qwen3.5 | card Token Embedding; vocab_size |

Qwen3.8-Max is the hosted product on this checkpoint with vision input, non-thinking support and 1M context by default (card). The open weights are the text-only thinking model.

---

## Tokenizers

| id | BPE tokens | added | max id | embedding rows | notes |
|---|---|---|---|---|---|
| qwen2-5 | 151,643 | 22 | 151,664 | 152,064 | NFC; letters-only words; ChatML |
| qwen3 | 151,643 | 26 | 151,668 | 151,936 | same BPE as 2.5; +`<think>` `</think>` `<tool_response>` |
| qwen3-5 | 248,044 | 26 | 248,069 | 248,320 | words include marks; vision + think tokens; used by 3.5, 3.6, 3.8 |

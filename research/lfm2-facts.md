# LFM2 / LFM2.5 architectures — sourced fact sheet

Compiled 2026-10-16. Every value below was read from a primary source in this session (LFM2 tech report / official blog / Hugging Face model card / `config.json`). Config values are copied from `https://huggingface.co/LiquidAI/<repo>/raw/main/config.json` (fetched 2026-10-16; `main` may change later). "UNVERIFIED" = no primary source found. "Derived" = arithmetic on sourced numbers, not a stated claim.

Shorthand: `[LFM2]` = arXiv 2511.23404 (HTML v1), `card:<repo>` = that Hugging Face model card, `cfg:<repo>` = that repo's config.json, `blog:<slug>` = liquid.ai/blog/<slug>.

LFM2.5 reuses the LFM2 hybrid backbone (gated short convolutions + GQA). There is no separate LFM2.5 architecture paper as of 2026-10-16; cards cite `[LFM2]` plus size-specific blogs.

---

## Disagreements (prefer config for released LFM2.5 checkpoints)

| field | LFM2 paper (Table 1) | LFM2.5 config.json | used in notes |
|---|---|---|---|
| LFM2-350M / LFM2.5-350M FF dim | 4608 | `intermediate_size: 6656`, `block_ff_dim: 6656` | 6656 (config) |
| LFM2-1.2B / LFM2.5-1.2B FF dim | 8192 | `intermediate_size: 12288`, `block_ff_dim: 12288` | 12288 (config) |
| LFM2-2.6B / LFM2.5-2.6B FF dim | 10752 | `intermediate_size: 10752` | 10752 (agree) |
| Small-model context | 32,768 | `max_position_embeddings: 128000` on 230M / 350M / 1.2B | cards: 32,768 supported; config has extra room |
| 2.6B context | paper 32,768 (LFM2-2.6B) | Base `128000`; post-trained `131072`; cards `131,072` | cards 131,072; note Base vs post-trained config split |
| 1.2B parameter count | Table 1 "1.2B" | not in config | cards: 1.17B in the feature list, 1.2B in the family table |
| 2.6B parameter count | Table 1 "2.6B" | not in config | cards: 2.69B |

230M does not appear in `[LFM2]` Table 1. It is an LFM2.5 size.

---

## Operator (shared)

| field | value | source |
|---|---|---|
| Mixer search outcome | gated short conv for most layers + minority GQA; no extra SSM / linear-attention operator | [LFM2] §2.1 Outcomes |
| Gated short conv | $(B,C,\tilde h)=\mathrm{Linear}(h)$; $y=B\odot\tilde h$; $z=\mathrm{Conv}_k(y)$; $o=\mathrm{Linear}_{out}(C\odot z)$ | [LFM2] §2.2 "Gated short convolution block" |
| Conv type | depthwise 1D along sequence, kernel $k$ | [LFM2] §2.2 |
| Conv $k$ | 3 | [LFM2] Table 1; cfg `conv_L_cache: 3` |
| Attention | GQA + RoPE + QK-Norm | [LFM2] §2.2 "Block choices and layout"; "Attention and MLP" |
| MLP | SwiGLU | [LFM2] §2.2; cfg `block_use_swiglu: true` |
| Norm | pre-norm RMSNorm | [LFM2] §2.2 |
| Tokenizer (LFM2) | byte-level BPE, vocab 65,536 | [LFM2] §2.2 "Tokenizer and special tokens" |

Conv decode cache length is not stated as a formula in the paper. Notes that need a number use `conv_L_cache` from config (3) as the stored window, matching kernel size 3, and label it as that config key.

---

## LFM2 paper dense sizes (Table 1) — original LFM2, not LFM2.5

| Model | Params | Layers | $d_{model}$ | FF dim | H / KV / $H_{size}$ | Attn blocks | Conv $k$ |
|---|---|---|---|---|---|---|---|
| LFM2-350M | 350M | 16 | 1024 | 4608 | 16/8/64 | 6 | 3 |
| LFM2-700M | 700M | 16 | 1536 | 6912 | 24/8/64 | 6 | 3 |
| LFM2-1.2B | 1.2B | 16 | 2048 | 8192 | 32/8/64 | 6 | 3 |
| LFM2-2.6B | 2.6B | 30 | 2048 | 10752 | 32/8/64 | 8 | 3 |
| LFM2-8B-A1B | 8.3B / 1.5B active | 24 | 2048 | 7168 | 32/8/64 | 6 | 3 |

LFM2 dense pretrain: 10T at 4096 context, then 1T mid-train at 32,768 ([LFM2] §3.2).

---

## LFM2.5-230M (`LiquidAI/LFM2.5-230M`)

| field | value | source |
|---|---|---|
| Parameters | 230M | card:LFM2.5-230M "Number of parameters" |
| Layers | 14 (8 conv + 6 GQA) | card; cfg `num_hidden_layers: 14` |
| `layer_types` | C,C,A,C,A,C,A,C,A,C,A,C,A,C | cfg (`conv` / `full_attention`) |
| Hidden size | 1024 | cfg `hidden_size` |
| FFN intermediate | 2560 | cfg `intermediate_size` |
| Query / KV heads | 16 / 8 | cfg `num_attention_heads` / `num_key_value_heads` |
| Head dim | 64 | Derived: 1024/16 |
| `conv_L_cache` | 3 | cfg |
| Vocab | 65,536 | card; cfg `vocab_size` |
| Training tokens | 19T, including a 32K context-extension phase | card; blog:lfm2-5-230m |
| Supported context | 32,768 | card |
| `max_position_embeddings` | 128000 | cfg |
| Knowledge cutoff | Mid-2024 | card |
| Post-training | (1) SFT with distillation from LFM2.5-350M, (2) DPO, (3) multi-domain RL | blog:lfm2-5-230m |
| Origin | Distilled from LFM2.5-350M | card; blog:lfm2-5-230m |
| Decode speed (card) | 213 tok/s Galaxy S25 Ultra; 42 tok/s Raspberry Pi 5 | card; blog:lfm2-5-230m |

---

## LFM2.5-350M (`LiquidAI/LFM2.5-350M`)

| field | value | source |
|---|---|---|
| Parameters | 350M | card:LFM2.5-350M |
| Layers | 16 (10 conv + 6 GQA) | card; cfg `num_hidden_layers: 16` |
| `layer_types` | C,C,A,C,C,A,C,C,A,C,A,C,A,C,A,C | cfg |
| Hidden size | 1024 | cfg `hidden_size` |
| FFN intermediate | 6656 | cfg `intermediate_size` (LFM2 Table 1 had 4608) |
| Query / KV heads | 16 / 8 | cfg |
| Head dim | 64 | [LFM2] Table 1; Derived 1024/16 |
| Training tokens | 28T (blog: extended from 10T to 28T) | card; blog:lfm2-5-350m-no-size-left-behind |
| Supported context | 32,768 | card |
| `max_position_embeddings` | 128000 | cfg |
| Vocab | 65,536 | card; cfg |
| Knowledge cutoff | Mid-2024 | card |
| Decode (blog table, 1K prefill / 100 decode) | 313 tok/s AMD Ryzen AI Max 395+ CPU llama.cpp Q4, 434MB | blog:lfm2-5-350m-no-size-left-behind |

---

## LFM2.5-1.2B-Instruct (`LiquidAI/LFM2.5-1.2B-Instruct`)

| field | value | source |
|---|---|---|
| Parameters | 1.17B (family table says 1.2B) | card:LFM2.5-1.2B-Instruct |
| Layers | 16 (10 conv + 6 GQA) | card; cfg `num_hidden_layers: 16` |
| `layer_types` | same as 350M | cfg |
| Hidden size | 2048 | cfg `hidden_size` |
| FFN intermediate | 12288 | cfg `intermediate_size` (LFM2 Table 1 had 8192) |
| Query / KV heads | 32 / 8 | cfg |
| Head dim | 64 | [LFM2] Table 1; Derived 2048/32 |
| Training tokens | 28T | card; blog:introducing-lfm2-5-the-next-generation-of-on-device-ai |
| Supported context | 32,768 | card |
| `max_position_embeddings` | 128000 | cfg |
| Vocab | 65,536 | card; cfg |
| Post-training | SFT, preference alignment, large-scale multi-stage RL | blog:introducing-lfm2-5… |
| DSpark drafter | 296M, ~2.1× faster decode (SGLang) | card |
| Decode (card) | 239 tok/s AMD CPU; 82 tok/s mobile NPU | card |

---

## LFM2.5-1.2B-Thinking (`LiquidAI/LFM2.5-1.2B-Thinking`)

Same `config.json` widths/layers as Instruct. Differences are post-training.

| field | value | source |
|---|---|---|
| Parameters / layers / widths | same as Instruct (1.17B, 16 layers, …) | card:LFM2.5-1.2B-Thinking; cfg |
| Training tokens | 28T | card |
| Generation temperature (card) | 0.05 (Instruct uses 0.1) | cards |
| Post-training | reasoning traces in mid-training; SFT on synthetic traces; DPO with loop-aware rejected samples; RLVR (GRPO-style); curriculum by domain then model merging (25 unique checkpoints in family tree) | blog:lfm2-5-1-2b-thinking-on-device-reasoning-under-1gb |
| Doom-loop ratio | 15.74% mid-training → 14.98% SFT → 4.32% DPO → 0.36% RLVR | blog (table) |
| MATH-500 | 87.96 vs Instruct 63.20 | blog; card |
| AIME25 | 31.73 vs Instruct 14.00 | blog; card |
| Memory on phone (blog lede) | fits within 900 MB | blog |

---

## LFM2.5-2.6B-Base (`LiquidAI/LFM2.5-2.6B-Base`)

| field | value | source |
|---|---|---|
| Parameters | 2.69B | card:LFM2.5-2.6B-Base |
| Layers | 30 (22 conv + 8 GQA) | card; cfg `num_hidden_layers: 30` |
| `layer_types` | C,C,A,C,C,A,C,C,C,A,C,C,C,A,C,C,C,A,C,C,C,A,C,C,A,C,C,A,C,C | cfg |
| Hidden size | 2048 | cfg |
| FFN intermediate | 10752 | cfg (matches [LFM2] Table 1) |
| Query / KV heads | 32 / 8 | cfg |
| Training tokens | 34T | card |
| Vocab | 128,000 | card; cfg `vocab_size: 128000` |
| Context (card) | 131,072 | card |
| `max_position_embeddings` | 128000 | cfg (post-trained 2.6B cfg is 131072) |
| `rope_theta` | 10,000,000 | cfg `rope_parameters.rope_theta` (small models use 1,000,000) |
| Vocab change vs LFM2 | doubled to 128K by extending the tokenizer in place (same procedure as LFM2.5-8B-A1B) | blog:lfm2-5-2-6b |
| Mid-training | dedicated 128K context-extension phase | blog:lfm2-5-2-6b; card:LFM2.5-2.6B |

---

## LFM2.5-2.6B (`LiquidAI/LFM2.5-2.6B`, post-trained)

Architecture matches Base except `max_position_embeddings: 131072`.

| field | value | source |
|---|---|---|
| Parameters / layers / widths | same as Base | card:LFM2.5-2.6B; cfg |
| Post-training | four stages: two-round SFT, per-domain teacher specialization, multi-domain on-policy distillation (MOPD), agentic RL inside harnesses | card; blog:lfm2-5-2-6b |
| Always thinks | "pure reasoning model that always thinks before it answers"; chat template inserts a think tag | card:LFM2.5-2.6B |
| DSpark drafter | 328M, ~2.6× faster decode | card |
| Decode (card) | 220 tok/s Apple M5 Max; 113 tok/s AMD Ryzen CPU; under 2.5 GB | card |
| GPU (card) | almost 15K output tok/s at high concurrency, ~1.3B tokens/day on one H100 | card |

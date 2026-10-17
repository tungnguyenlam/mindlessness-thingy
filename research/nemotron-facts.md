# NVIDIA Nemotron 3 / 3.5: sourced fact sheet

Compiled 2026-10-16. Every value below was read from a primary source on that date: a full-text PDF via pdftotext, a HF `raw/main/config.json`, or a HF `raw/main/README.md`. "UNVERIFIED" means no primary source was found. "Derived" means arithmetic on sourced numbers, not a stated claim. Papers marked "abstract only" were read at the arXiv abstract page only.

Shorthand:
- `[N3.5]` = Nemotron 3.5 Super & Lightning tech report, https://research.nvidia.com/labs/nemotron/files/NVIDIA-Nemotron-3.5-Super-and-Lightning-Technical-Report.pdf (dated 2026-10-14)
- `[S3]` = Nemotron 3 Super, arXiv 2604.12374v1
- `[N3]` = Nemotron 3 Nano, arXiv 2512.20848
- `[U3]` = Nemotron 3 Ultra, arXiv 2606.15007v1
- `[Omni]` = Nemotron 3 Nano Omni, arXiv 2604.24954
- `[LMoE]` = LatentMoE, arXiv 2601.18089
- `[M2]` = Mamba-2, arXiv 2405.21060
- `cfg:<repo>` = https://huggingface.co/nvidia/<repo>/raw/main/config.json
- `card:<repo>` = that repo's README.md

Exact HF repo names (all return HTTP 200 for config.json):
- `NVIDIA-Nemotron-3.5-Super-VL-120B-A12B-BF16`
- `NVIDIA-Nemotron-3.5-Lightning-30B-A3B-BF16`
- `NVIDIA-Nemotron-3-Super-120B-A12B-BF16`
- `NVIDIA-Nemotron-3-Nano-30B-A3B-BF16`
- `NVIDIA-Nemotron-3-Ultra-550B-A55B-BF16`

Also exist: `C-RADIOv3-H`, `C-RADIOv4-H`.

Important: the [N3.5] report has **no architecture section**. Its sections are §1 Intro, §2 Pretraining, §3 Post-training, §4 Quantization, §5 Inference, §6 Conclusion. It cites [S3] ("NVIDIA, 2026b") for the backbone and MTP design, and [Omni] ("NVIDIA, 2026a") for the vision projector. So architecture facts mostly come from [S3] and the configs.

---

## 1. Nemotron 3.5 Super (VL 120B-A12B)

| field | value | source |
|---|---|---|
| Total / active params | 120B / 12B, multimodal | [N3.5] Abstract; §1 |
| Param count incl. vision + MTP | N = 124.453B; stored NVFP4 payload S = 74.987 GB → 4.82 bits/param | [N3.5] §4.1 |
| Components | "C-RADIO vision encoder, a hybrid Mamba/attention language backbone with 512 routed experts per MoE layer, and a multi-token prediction (MTP) head" | [N3.5] §4.2 |
| Initialization | Super 3.5 Base initialized from Super 3 Base | [N3.5] §1, §2.2 |
| Layers | 88: 40 Mamba-2 (M), 40 MoE (E), 8 attention (*). Pattern `MEMEMEM*EMEMEMEM*EMEMEMEM*EMEMEMEMEM*EMEMEMEMEM*EMEMEMEMEM*EMEMEMEMEM*EMEMEMEM*EMEMEMEME`, identical to Super 3 | cfg:…3.5-Super-VL `llm_config.layers_block_type` (counted); compare cfg:…3-Super `hybrid_override_pattern` |
| Attention | GQA, 32 Q heads, 2 KV heads, head_dim 128 | cfg; [S3] Table 1, §2.1.3 |
| Positional encoding | None. [S3] §2.1.3: "Consistent with prior Nemotron models, we omit positional embeddings" (inherited). [N3.5] does not restate it. | [S3] §2.1.3 |
| Other dims | hidden 4096; Mamba: 128 heads × head_dim 64, state 128, 8 groups, conv 4, expand 2, chunk 128; MoE: 512 routed + 1 shared, top-22, expert inter 2688, shared inter 5376, latent 1024, relu2, routed_scaling 5.0; vocab 131072; max_position_embeddings 1048576 | cfg (already known); matches [S3] Table 1 |
| MTP | One recursively shared head. Initialized from the **first** of Super 3 Base's MTP heads (checkpoint taken before long-context extension); second head discarded. MTP module = 1 attention + 1 MoE layer with no output projection of its own; a single lm_head is shared between verification and drafting. | [N3.5] §1, §2.1, §4.7; cfg `num_nextn_predict_layers: 1`, `mtp_layers_block_type: [attention, moe]` |
| MTP training | 100B-token warm-up with backbone frozen, using hidden-state mixing (step k samples inputs from earlier MTP steps 1…k−1, not only k−1). MTP loss scale 0.1 during distillation; aux-loss scale 0.3 in SFT ("two shared-weight MTP layers"). | [N3.5] §2.1, §2.2, §3.1 |
| MTP boosting | Backbone frozen. 4k steps from the SFT checkpoint, then 25k steps on the final backbone, with a KD loss (LK loss) against the backbone. Average acceptance length at draft length 7: 4.287 → 4.718 (temp 0), 3.787 → 4.612 (temp 1), i.e. +21.8% | [N3.5] §3.7, Table 8; Abstract |
| Distillation | 1T tokens, teacher Ultra 3 Base, Skew Reverse KL (α=0.1). LR 4.5e-6 → 4.5e-5 (ramp over 200B) → linear decay (800B). MoE seq load-balancing coefficient 1e-5. | [N3.5] §2.2 (recipe "same as Lightning") |
| Training stages (tokens) | MTP warm-up 100B → distillation 1T → Indic CPT 100B (10B Indic + 90B prior mix) → long context (LC) at 1M ctx 35B → agentic SWE mid-training 65.4B at 256K ctx → LC recovery 9B | [N3.5] §1, §2.1–2.5 |
| LC detail | Constant LR 4.5e-6; CP16 / TP8 / EP64 on GB300. After 256K mid-training, RULER-1M fell 79.9 → 33.5; 9B-token recovery brought it to 81.0. | [N3.5] §2.4 |
| Indic synthetic corpus | ~2.83T generated tokens (2,825.6B), 22 languages, 34 language-script configurations (Gemma-4 tokenizer) | [N3.5] §2.3, Table 1 |
| Vision | Base model is text-only. Vision is added in SFT after a vision-projector warm-up, then 2-stage SFT jointly fine-tunes language + vision. Packed sequences up to 524,288 tokens, global batch 32, LR 1e-5. | [N3.5] §3.1 |
| Vision encoder | C-RADIO (version not named in [N3.5] or the card). cfg vision_config: radio, vit_huge_patch16_224, hidden 1280, 32 layers, 16 heads, patch 16; min/max patches 1024/13312; 3 teachers; 7 registers; video_temporal_patch_size 2 | cfg (already known + `vision_config.args`) |
| Connector | Card says only "vision-language connector". cfg: `downsample_ratio 0.5`, `ps_version "v2"`, `projector_hidden_size 20480`, `image_tag_type "internvl"`. Design for the sibling [Omni] model: "MLP projectors"; "pixel shuffle operation with 4× downsampling" before projection; Conv3D compresses every 2 video frames into 1. | card; cfg; [Omni] §2 |
| NVFP4 released recipe ("Aggressive") | NVFP4 for MoE + shared-expert GEMMs. FP8 for attention QKV/out projections, Mamba linear, lm_head. BF16 for latent down/up projections, C-RADIO, VL connector, embeddings, Mamba conv. KV cache FP8; Mamba SSM cache FP16 + stochastic rounding; router computed in FP32. 4.82 BPE. | [N3.5] §4.1, Table 12 |
| NVFP4 results | Median accuracy recovery 99.62% over 36 benchmarks; W4A4 on Blackwell, W4A16 elsewhere; NVFP4 = e2m1; NVFP4 gives 2.43× BF16 throughput | [N3.5] Abstract; §4, §4.1 |
| NVFP4 KV ablation | NVFP4 KV payload 4.5 vs FP8 8.0 bits/element → 43.75% less ideal payload (storage calc only). Median recovery 99.36% (NVFP4 KV) vs 99.52% (FP8 KV) on 35 benchmarks. Release defaults to FP8 KV. | [N3.5] §4.5, Table 18 |
| MTP quantization | MTP experts NVFP4 W4A4; MTP attention BF16; AL 4.612 → 4.592; MTP KV precision must follow the backbone | [N3.5] §4.7 |
| KV/state claims | "The KV cache grows linearly with sequence length, whereas the Mamba SSM state is constant in size" (§4). Fewer attention layers with narrower KV heads; Mamba-2 state "does not grow with context" (§5.2). LatentMoE exchanges latent vectors smaller than hidden states, which cuts expert-parallel communication (§5.2). One Mamba cache page ≥ ~4K tokens of attention KV (§5.3). | [N3.5] §4, §5.2, §5.3 |
| ReplaySSM | Checkpoint the state and replay buffered (k, v, α). Per-step state memory traffic goes from T+1 to ~1+1/L. +4.7–6.4% output TPS (16-step buffer, 1 GB200). | [N3.5] §5.4, Table 24 |
| Serving headline | Up to 4,856 output tok/s/GPU on GB200 at ≥50 tok/s/user (20-turn proxy workload, 51,200-token shared prefix, 2K in / 1K out per turn). 2.34× Qwen3.5-122B-A10B and 1.90× Qwen3.8 Flash-Next. | [N3.5] Abstract; §5, Fig 11, Table 24 |
| SWE-bench Pro | 51.78% | [N3.5] Abstract |
| Release date | 10/15/2026 | card (already known) |

Derived (label as derived):
- Per-token KV, whole model: 8 attn layers × 2 (K, V) × 2 heads × 128 = 4,096 elements (8 KiB in BF16).
- Mamba SSM state per layer: 128 heads × 64 × 128 = 1,048,576 elements, i.e. 4 MiB in FP32 (excludes conv state).
- A 4 MiB Mamba state ÷ 1 KiB of BF16 KV per token per attention layer ≈ 4,096 tokens. This is consistent with the [N3.5] §5.3 "~4K tokens" claim. The pairing is my inference.
- LatentMoE compression α = d/ℓ = 4096/1024 = 4.

## 2. Nemotron 3.5 Lightning (30B-A3B, text-only)

| field | value | source |
|---|---|---|
| Total / active | 30B / 3B, text-only | [N3.5] Abstract, §1; card:…3.5-Lightning |
| Initialization | Nano 3 Base | [N3.5] §1, §2.2 |
| Architecture | Same layout as Nano 3: 52 layers (23 M, 23 E, 6 *), identical pattern string. hidden 2688; 32 Q / 2 KV heads, head_dim 128; Mamba 64 heads × 64, state 128, 8 groups; 128 routed experts, top-6, 1 shared (shared inter 3712); expert inter 1856; **`moe_latent_size: None`** (no LatentMoE); relu2; routed_scaling 2.5; `moe_shared_expert_overlap: true`; vocab 131072; max_position_embeddings 262144 | cfg:…3.5-Lightning-30B-A3B-BF16 |
| What's new vs Nano 3 | MTP head added (`num_nextn_predict_layers 1`, `mtp_layers_block_type [attention, moe]`). Nano 3 cfg has no MTP keys. | cfg diff |
| MTP init | From the Super 3 Base MTP head: latent MoE projections fused into the experts' up/down projections, then pruned (hidden 4096→2688, MoE inter 2688→1856, routed experts 512→128). 100B warm-up with backbone frozen, standard 2-step recursive training (no hidden-state mixing). MTP boosting 48k steps. | [N3.5] §2.1, §3.7 |
| Distillation | 1T tokens; top-128 logits from Super 3 Base on Ultra 3 Phase-2 data; forward KL + sink token; KL 0.9 / CE 0.1; LR 1e-5 → 1e-4 over 200B, then linear decay to 1e-5 over 800B; MTP loss scale 0.1; MoE balancing 1e-4 | [N3.5] §2.2 |
| LC | 21B tokens at 1M; LR 1e-5; CP8 / TP8 / EP8 / PP2 on GB200 | [N3.5] §2.4 |
| No Indic CPT / mid-training | Correct for the released Lightning model | [N3.5] §2.3, §2.5 |
| Post-training | Single-stage text SFT + RLVR | [N3.5] §1, §3 |
| Quantization | W4A16 NVFP4 on all GPUs; FP8 KV, FP32 SSM cache; median recovery 99.24% | [N3.5] §4, §4.9 |
| Drafters | DFlash, DSpark | [N3.5] §1 |
| Card claims | "pre-trained with over 20T tokens", "NVFP4 recipe", up to 1M context; release date **August 11, 2026** | card |

## 3. Nemotron 3 Super (120B-A12B), where LatentMoE + MTP debut

| field | value | source |
|---|---|---|
| Params | 120.6B total; 12.7B active (12.1B excl. embeddings) | [S3] §2.1 |
| Firsts in the family | First pre-trained in NVFP4, first with LatentMoE, first with MTP layers | [S3] Abstract, §1 |
| Table 1 | 88 layers; d 4096; 32 Q / 2 KV heads; head 128; Mamba state 128, 8 groups, 128 heads, head dim 64; expert hidden 2688; shared inter 5376; 512 experts; top-22; MoE latent 1024; "MTP layers (shared weight) 2" | [S3] §2.1, Table 1 |
| Layer pattern | Fig 2; cfg `hybrid_override_pattern` (40 M / 40 E / 8 *) | [S3] Fig 2; cfg:…3-Super-120B-A12B-BF16 |
| Why few attention layers | "we predominantly utilize Mamba-2 blocks … constant-sized state during generation"; "a limited number of self-attention layers are strategically inserted as global 'anchors' to enable full-token interaction and long-range information routing" | [S3] §2.1.3 |
| No positional embeddings; no dropout or bias; RMSNorm; untied embeddings | Stated in the report | [S3] §2.1.3 |
| LatentMoE | Token x∈R^d → W↓∈R^{ℓ×d} → experts operate entirely in R^ℓ → W↑∈R^{d×ℓ}. Cuts per-expert weight loads and all-to-all payload by d/ℓ. The savings buy N′ = N·d/ℓ experts and K′ = K·d/ℓ active. Router, shared expert and non-expert layers stay in full d. | [S3] §2.1.1, Fig 3 |
| LatentMoE why (principles) | (1) low-latency serving is bound by expert-weight bandwidth ∝ d×m; (2) throughput serving is bound by all-to-all ∝ d×K; (3) keep the nonlinear budget K·m; (4) d can't go below an effective rank r_eff; (5) larger N and K improve quality | [S3] §2.1.1; [LMoE] §2 |
| MTP | Weights shared across heads during training → one head applied recursively at inference. Average acceptance length 3.45 on SPEED-Bench at draft length 7. | [S3] §2.1.2, Table 2 |
| Router / balancing | Sigmoid router + expert bias; aux-loss-free balancing (update rate 1e-3) + standard balancing loss 1e-4; MTP loss scale 0.3 | [S3] §2.4 |
| Pretraining | 25T tokens = 20T phase 1 + 5T phase 2. WSD schedule: peak LR 4.5e-4, minus-sqrt decay over the last 5T to 4.5e-6. Seq 8192 × batch 3072 ≈ 25.17M tokens/batch. | [S3] §1, §2.4 |
| NVFP4 pretraining | E2M1 elements, 16-element micro-blocks, E4M3 block scales, FP32 global scale; 2D weight blocks; RHT on wgrad inputs; stochastic rounding on gradients. Kept higher precision: final 15% of the network, latent projections, MTP, QKV/attention in BF16; Mamba output projection in MXFP8; embeddings in BF16. | [S3] §2.2, Table 3 |
| LC | 34B tokens at 1,048,576 ctx, then 17B alternating 1M/4K; LR 4.5e-6 | [S3] §2.6 |
| SSM cache quantization | FP16 + stochastic rounding (Philox<5>); naive FP16 raised verbosity up to 37–40% | [S3] §4.3, Table 9 |
| Throughput claim | Up to 2.2× GPT-OSS-120B and 7.5× Qwen3.5-122B at 8k input / 64k output | [S3] Abstract, §1 |
| Card | Release March 11, 2026; separate MTPv2 head checkpoint (`nvidia/Nemotron-3-Super-120B-A12B-BF16-MTPv2`) | card:…3-Super-120B-A12B-BF16 |
| cfg extras | `mtp_hybrid_override_pattern "*E"`, `num_nextn_predict_layers 1`, `n_shared_experts 1`, `max_position_embeddings 262144`, `mamba_ssm_cache_dtype float32` | cfg |

## 4. Nemotron 3 Nano (30B-A3B)

| field | value | source |
|---|---|---|
| Params | 31.6B total, 3.2B active (3.6B incl. embeddings) | [N3] §1, §2.1 |
| Table 1 | 52 layers; d 2688; 32 Q / 2 KV; head 128; Mamba state 128, 8 groups, 64 heads, head dim 64; expert dim 1856; 128 routable experts; 6 active; **2 shared experts** | [N3] Table 1 |
| Design | Builds on the Nemotron-H and Nemotron 2 Nano hybrid by replacing FFNs with granular MoE + shared experts; squared ReLU; learnt MLP router with sigmoid gating; no positional embeddings, dropout or bias; RMSNorm; untied embeddings | [N3] §2.1 |
| Layer pattern | Fig 2; cfg `MEMEM*EMEMEM*EMEMEM*EMEMEM*EMEMEM*EMEMEMEM*EMEMEMEME` (23 / 23 / 6) | [N3] Fig 2; cfg:…3-Nano-30B-A3B-BF16 |
| Pretraining | 25T tokens: 23.5T phase 1 + 1.5T phase 2 (data phases). LR: warm-up 8.4B tokens to 1e-3, held for 20T, decayed to 1e-5 over the last 5T. | [N3] §1, §2.4 |
| LC | 121B tokens, mix of 512K + 4K sequences, LR 1e-5 | [N3] §2.5 |
| Precision | Released Nano 3 was trained in BF16 | [S3] §2.2, Fig 7 caption |
| No MTP, no LatentMoE | cfg has no MTP/latent keys. [S3] says Super is the first with MTP and LatentMoE. | cfg; [S3] Abstract |
| cfg | n_routed_experts 128, top-6, `n_shared_experts 1`, `moe_shared_expert_intermediate_size 3712`, routed_scaling 2.5, max_pos 262144 | cfg |

## 5. Nemotron 3 Ultra (550B-A55B), the 3.5 Super distillation teacher

| field | value | source |
|---|---|---|
| Params | 550B total / 55B active | [U3] Abstract, §2.1 |
| Table 1 | 108 layers; d 8192; 64 Q / 2 KV; head 128; Mamba state 128, 8 groups, 256 heads, head dim 64; expert hidden 5120; shared 10240; 512 experts; top-22; latent 2048; MTP (shared weight) 2 | [U3] Table 1 |
| Layer counts | 48 M / 48 E / 12 * | cfg:…3-Ultra-550B-A55B-BF16 `layers_block_type` (counted) |
| MTP | Two heads in pretraining sharing parameters; each = one attention layer + one MoE layer | [U3] §2.1 |
| Pretraining | 20T tokens; peak LR 2.5e-4; MTP loss scale 0.1; LC 33B tokens (92% of iterations at 1M, 8% at 4K) | [U3] Abstract, §2.4, §2.5 |

Derived: α = 8192/2048 = 4.

## 6. Building blocks and lineage papers

| item | claim | source |
|---|---|---|
| Mamba-2 (Dao & Gu 2024) | SSMs have "linear scaling in sequence length during training and constant state size during generation", vs attention "requiring a cache of size linear in sequence length during autoregressive generation" (§1). Attention "has a state size scaling with sequence length T because it caches its history and does not compress its state" (§6.3, "Comparison to Pure SSM and Attention Models"). Core SSD layer is 2–8× faster than Mamba's selective SSM (Abstract). | [M2] |
| LatentMoE (Elango et al. 2026) | Introduces LatentMoE (§3, eq. 1 ℓ-MoE_eff, eq. 2 ℓ-MoE_acc = default with K′=αK). Quality preserved for compression ratio α ≤ 4, so α=4 is adopted, also verified at 95B-total / 8B-active (§4.1). Adopted by Nemotron 3 Super and Ultra (§1). | [LMoE] arXiv 2601.18089 |
| Primer (So et al. 2021) | "The most effective modification is the improvement from a ReLU activation to a squared ReLU activation in the Transformer's feed forward block" | arXiv 2109.08668 §3 ("Squared ReLU" paragraph), Fig 5 |
| AM-RADIO (Ranzinger et al. 2023) | Merges CLIP, DINOv2, SAM into one vision backbone via multi-teacher distillation | arXiv 2312.06709 (abstract only) |
| RADIOv2.5 (Heinrich et al. 2024) | Improved agglomerative baselines: multi-resolution training, mosaic augmentation, teacher-loss balancing | arXiv 2412.07679 (abstract only) |
| C-RADIOv4 (Ranzinger et al. 2026) | Builds on AM-RADIO/RADIOv2.5; -SO400M (412M) and -H (631M) variants; teachers SigLIP2, DINOv3, SAM3 | arXiv 2601.17237 (abstract only) |
| Nemotron-H (NVIDIA 2025) | 8B and 56B/47B hybrids that "replace the majority of self-attention layers … with Mamba layers that perform constant computation and require constant memory per generated token"; up to 3× faster | arXiv 2504.03624 (abstract only) |
| Nemotron Nano 2 (NVIDIA 2025) | Nemotron-Nano-9B-v2 builds on the Nemotron-H architecture; 12B base pretrained on 20T tokens with FP8, then Minitron compression/distillation | arXiv 2508.14444 (abstract only) |
| Nemotron 3 white paper | Family overview: Nano/Super/Ultra; Super and Ultra use NVFP4 + LatentMoE + MTP | arXiv 2512.20856 (abstract only) |
| Nemotron 3 Nano Omni | Nano 3 30B-A3B + C-RADIOv4-H + Parakeet-TDT-0.6B-v2 via MLP projectors; dynamic resolution with 16×16 patches; 1,024–13,312 visual tokens per image; pixel shuffle 4× downsampling | arXiv 2604.24954 §1, §2 |

---

## Source entries to create

Repo convention: dots become dashes, as in `deepseek-v3-2-report`. `mtp-paper` and `gqa-paper` already exist; reuse them.

| id | title | short | authors | year | url | type |
|---|---|---|---|---|---|---|
| nemotron-3-5-report | Nemotron 3.5 Super and Lightning: Open, Efficient Mixture-of-Experts Hybrid Mamba-Transformer Models for Agentic AI | NVIDIA 2026 (Nemotron 3.5) | NVIDIA | 2026 | https://research.nvidia.com/labs/nemotron/files/NVIDIA-Nemotron-3.5-Super-and-Lightning-Technical-Report.pdf | report |
| nemotron-3-super-report | Nemotron 3 Super: Open, Efficient Mixture-of-Experts Hybrid Mamba-Transformer Model for Agentic Reasoning | NVIDIA 2026 (Nemotron 3 Super) | NVIDIA | 2026 | https://arxiv.org/abs/2604.12374 | report |
| nemotron-3-nano-report | Nemotron 3 Nano: Open, Efficient Mixture-of-Experts Hybrid Mamba-Transformer Model for Agentic Reasoning | NVIDIA 2025 (Nemotron 3 Nano) | NVIDIA | 2025 | https://arxiv.org/abs/2512.20848 | report |
| nemotron-3-ultra-report | Nemotron 3 Ultra: Open, Efficient Mixture-of-Experts Hybrid Mamba-Transformer Model for Agentic Reasoning | NVIDIA 2026 (Nemotron 3 Ultra) | NVIDIA | 2026 | https://arxiv.org/abs/2606.15007 | report |
| nemotron-3-whitepaper | NVIDIA Nemotron 3: Efficient and Open Intelligence | NVIDIA 2025 (Nemotron 3) | NVIDIA | 2025 | https://arxiv.org/abs/2512.20856 | report |
| nemotron-3-nano-omni-report | Nemotron 3 Nano Omni: Efficient and Open Multimodal Intelligence | NVIDIA 2026 (Nano Omni) | NVIDIA | 2026 | https://arxiv.org/abs/2604.24954 | report |
| latentmoe-paper | LatentMoE: Toward Optimal Accuracy per FLOP and Parameter in Mixture of Experts | Elango et al. 2026 | Venmugil Elango, Nidhi Bhatia, Roger Waleffe, Rasoul Shafipour, Tomer Asida, Abhinav Khattar, Nave Assaf, Maximilian Golub, Joey Guman, Tiyasa Mitra, Ritchie Zhao, Ritika Borkar, Ran Zilberstein, Mostofa Patwary, Mohammad Shoeybi, Bita Rouhani | 2026 | https://arxiv.org/abs/2601.18089 | paper |
| mamba2-paper | Transformers are SSMs: Generalized Models and Efficient Algorithms Through Structured State Space Duality | Dao & Gu 2024 | Tri Dao, Albert Gu | 2024 | https://arxiv.org/abs/2405.21060 | paper |
| nemotron-h-paper | Nemotron-H: A Family of Accurate and Efficient Hybrid Mamba-Transformer Models | NVIDIA 2025 (Nemotron-H) | NVIDIA | 2025 | https://arxiv.org/abs/2504.03624 | paper |
| nemotron-nano-2-paper | NVIDIA Nemotron Nano 2: An Accurate and Efficient Hybrid Mamba-Transformer Reasoning Model | NVIDIA 2025 (Nano 2) | NVIDIA | 2025 | https://arxiv.org/abs/2508.14444 | paper |
| am-radio-paper | AM-RADIO: Agglomerative Vision Foundation Model — Reduce All Domains Into One | Ranzinger et al. 2023 | Mike Ranzinger, Greg Heinrich, Jan Kautz, Pavlo Molchanov | 2023 | https://arxiv.org/abs/2312.06709 | paper |
| radio-v2-5-paper | RADIOv2.5: Improved Baselines for Agglomerative Vision Foundation Models | Heinrich et al. 2024 | Greg Heinrich, Mike Ranzinger, Hongxu Yin, Yao Lu, Jan Kautz, et al. | 2024 | https://arxiv.org/abs/2412.07679 | paper |
| c-radio-v4-report | C-RADIOv4 (Tech Report) | Ranzinger et al. 2026 | Mike Ranzinger, Greg Heinrich, Collin McCarthy, Jan Kautz, Andrew Tao, Bryan Catanzaro, Pavlo Molchanov | 2026 | https://arxiv.org/abs/2601.17237 | report |
| primer-paper | Primer: Searching for Efficient Transformers for Language Modeling | So et al. 2021 | David R. So, Wojciech Mańke, Hanxiao Liu, Zihang Dai, Noam Shazeer, Quoc V. Le | 2021 | https://arxiv.org/abs/2109.08668 | paper |
| nemotron-3-5-super-vl-config | NVIDIA-Nemotron-3.5-Super-VL-120B-A12B-BF16 config.json | HF config | NVIDIA | 2026 | https://huggingface.co/nvidia/NVIDIA-Nemotron-3.5-Super-VL-120B-A12B-BF16/blob/main/config.json | config |
| nemotron-3-5-super-vl-card | NVIDIA-Nemotron-3.5-Super-VL-120B-A12B-BF16 model card | HF model card | NVIDIA | 2026 | https://huggingface.co/nvidia/NVIDIA-Nemotron-3.5-Super-VL-120B-A12B-BF16 | model-card |
| nemotron-3-5-lightning-config | NVIDIA-Nemotron-3.5-Lightning-30B-A3B-BF16 config.json | HF config | NVIDIA | 2026 | https://huggingface.co/nvidia/NVIDIA-Nemotron-3.5-Lightning-30B-A3B-BF16/blob/main/config.json | config |
| nemotron-3-5-lightning-card | NVIDIA-Nemotron-3.5-Lightning-30B-A3B-BF16 model card | HF model card | NVIDIA | 2026 | https://huggingface.co/nvidia/NVIDIA-Nemotron-3.5-Lightning-30B-A3B-BF16 | model-card |
| nemotron-3-super-config | NVIDIA-Nemotron-3-Super-120B-A12B-BF16 config.json | HF config | NVIDIA | 2026 | https://huggingface.co/nvidia/NVIDIA-Nemotron-3-Super-120B-A12B-BF16/blob/main/config.json | config |
| nemotron-3-nano-config | NVIDIA-Nemotron-3-Nano-30B-A3B-BF16 config.json | HF config | NVIDIA | 2025 | https://huggingface.co/nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B-BF16/blob/main/config.json | config |
| nemotron-3-ultra-config | NVIDIA-Nemotron-3-Ultra-550B-A55B-BF16 config.json | HF config | NVIDIA | 2026 | https://huggingface.co/nvidia/NVIDIA-Nemotron-3-Ultra-550B-A55B-BF16/blob/main/config.json | config |

Optional sources:
- The Nemotron 3 Super card (release date, MTPv2) and Nano 3 card would be `model-card` entries.
- The 3.5 report cites ReplaySSM as "Liou et al. 2026" and blog https://dao-lab.ai/blog/2026/replayssm/. I did not read either.

---

## Disagreements / unverified

1. **Did Super 3 have two shared MTP heads or two separate ones?** [S3] Table 1 says "MTP layers (shared weight) 2" and §2.1.2 says parameters are shared across MTP heads. [U3] §2.1 agrees for Ultra. But [N3.5] §1 says Super 3.5 "consolidates two non-shared MTP heads into a single recursively shared head". [N3.5] §2.1 says Super 3 Base "originally contained two distinct MTP heads", initialized from the first and discarded the second. Yet [N3.5] §3.1 SFT says "retaining two shared-weight MTP layers". The Super 3 cfg has `num_nextn_predict_layers: 1`. Safe wording: Super 3 trained an MTP module with weights shared across 2 prediction steps; 3.5 ships one recursively applied head. Don't assert "non-shared".
2. **"Quadratic growth of the KV cache"** ([S3] §2.1.3) is wrong. The KV cache grows linearly with sequence length ([M2] §1; [N3.5] §4). Don't quote it.
3. **Positional encoding.** [S3] §2.1.3 and [N3] §2.1 say no positional embeddings, yet every config carries `rope_theta: 10000`, `partial_rotary_factor: 1.0`. These look like unused defaults in the NemotronH config class; I did not check the modeling code. Go with the reports (NoPE). Whether the code reads `rope_theta` is UNVERIFIED.
4. **max_position_embeddings.** Super 3, Nano 3, Ultra and Lightning cfgs say 262144, but all claim 1M. The Nano 3 card says the HF default is 256k "due to higher VRAM requirements"; the Super 3 card says to set `--max-model-len 1048576`. The Super VL 3.5 cfg says 1048576.
5. **Nano 3 shared experts.** Report Table 1 says 2. The cfg says `n_shared_experts: 1` with `moe_shared_expert_intermediate_size: 3712` = 2 × 1856 (looks like 2 fused into 1). The card says "128 experts plus 1 shared expert". The same cfg pattern holds in Lightning.
6. **Nano 3 active params.** The report says 3.2B (3.6B with embeddings); the card says 3.5B. Super 3: the report says 120.6B / 12.7B (12.1B excl. embeddings); the headline is 120B / 12B. [N3.5] §4.1 counts N = 124.453B including vision + MTP.
7. **Lightning training tokens and precision.** The card says "pre-trained with over 20T tokens" with an "NVFP4 recipe". [N3.5] says Lightning starts from Nano 3 Base (25T tokens per [N3]; BF16 per [S3] §2.2 Fig 7) plus 1T distillation. The precision of the distillation stage is not stated in [N3.5]. Treat the card figures as UNVERIFIED.
8. **C-RADIO version in Super VL 3.5: UNVERIFIED.** [N3.5] and the card say only "C-RADIO". The cfg patch limits (1024/13312) match [Omni], which uses C-RADIOv4-H. That suggests v4-H but proves nothing.
9. **Connector design for Super VL 3.5: partly UNVERIFIED.** The cfg says `downsample_ratio 0.5`, `ps_version v2`, `projector_hidden_size 20480`, `image_tag_type internvl`. That probably means a 2×2 pixel shuffle (4× fewer tokens) followed by an MLP projector, which is what [Omni] §2 documents for its sibling model. Neither [N3.5] nor the card describes the projector's layers, depth or activation. Cite [Omni] for the design and mark Super-VL specifics as derived from the cfg.
10. **Router function.** [S3] §2.4 uses a sigmoid router with expert bias. The [LMoE] §3 equations write Softmax. Use sigmoid for Nemotron.
11. **Training-schedule wording in Nano 3.** 23.5T + 1.5T are data phases (§1); the 20T + 5T split is the LR schedule (§2.4). Not a conflict, but easy to mix up. Super 3 uses 20T + 5T for both.
12. **Dates.** The Lightning card says August 11, 2026, before the 3.5 report (2026-10-14) and the Super VL release (10/15/2026). Not necessarily a conflict.
13. **Not checked.** No per-component parameter breakdown (vision encoder, projector, MTP) beyond N = 124.453B. No per-head Mamba-2 dt/A details beyond the cfg.

## Lineage (with sources)

```
Nemotron-H (2504.03624) ─┐
Nemotron Nano 2 (2508.14444, builds on Nemotron-H arch) ─┴─► Nemotron 3 Nano 30B-A3B
     [N3 §2.1: "builds upon the hybrid Mamba-Transformer architecture of … Nemotron-H and Nemotron 2 Nano by replacing the standard FFN layers with sparse MoE"]
Nemotron 3 Nano ─(scaled up + LatentMoE [LMoE] + MTP + NVFP4)─► Nemotron 3 Super 120B-A12B
     [S3 §2.1: "scales up the hybrid Mamba-Attention MoE architecture introduced in Nemotron-3 Nano"]
Nemotron 3 Super ─(same arch, scaled)─► Nemotron 3 Ultra 550B-A55B   [U3 §2.1]
Nemotron 3 Super Base ─(init; MTP head from its 1st head; 1T distill from Ultra 3 Base; + C-RADIO + connector in SFT)─► Nemotron 3.5 Super VL   [N3.5 §1, §2.1, §2.2, §3.1; card]
Nemotron 3 Nano Base ─(init; MTP head transplanted/pruned from Super 3 Base; 1T distill from Super 3 Base)─► Nemotron 3.5 Lightning   [N3.5 §1, §2.1, §2.2]
Nemotron 3 Nano ─(+ C-RADIOv4-H + Parakeet via MLP projectors)─► Nemotron 3 Nano Omni; its vision data and projector warm-up recipe are reused by 3.5 Super   [Omni §2; N3.5 §3.1]
```

Building blocks:
- Mamba-2 layers: [M2], cited by [S3] §2.1.3.
- Squared ReLU: Primer §3; used per [N3] §2.1 and cfg `mlp_hidden_act: relu2`.
- MTP: Gloeckle et al. 2024 (existing `mtp-paper`) and DeepSeek-V3, cited by [S3] §2.1.2 and [N3.5] §1.
- GQA: `gqa-paper` exists.
- Aux-loss-free balancing: `loss-free-balancing-paper` exists, cited by [S3] §2.4.

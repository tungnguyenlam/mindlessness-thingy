# DeepSeek model architectures — sourced fact sheet

Compiled 2026-10-16. Every value below was read from a primary source in this session (arXiv paper / official tech report / HuggingFace `config.json` / official model card or API docs). Config values are copied verbatim from `https://huggingface.co/deepseek-ai/<repo>/raw/main/config.json` (fetched 2026-10-16; `main` branch may change later). "UNVERIFIED" = no primary source found. "Derived" = arithmetic on sourced numbers, not a stated claim.

Shorthand used in source column: `[V2]` = arXiv 2405.04434 (HTML v-latest), `[V3]` = arXiv 2412.19437, `[V3.2]` = arXiv 2512.02556, `[V4]` = arXiv 2606.19348, `[V4.1]` = arXiv 2609.19969 / `DeepSeek_V41_Tech_Report.pdf`, `cfg:<repo>` = that repo's config.json.

---

## 1. DeepSeek-V2

| field | value | source |
|---|---|---|
| Total params | 236B | [V2] Abstract; §3.1.2 "Model Hyper-Parameters" — https://arxiv.org/abs/2405.04434 |
| Active params / token | 21B | [V2] Abstract; §3.1.2 |
| Layers | 60 (`num_hidden_layers: 60`) | [V2] §3.1.2; cfg:DeepSeek-V2 https://huggingface.co/deepseek-ai/DeepSeek-V2/blob/main/config.json |
| Hidden size | 5120 (`hidden_size: 5120`) | [V2] §3.1.2; cfg:DeepSeek-V2 |
| Attention heads n_h | 128 (`num_attention_heads: 128`, `num_key_value_heads: 128`) | [V2] §3.1.2; cfg:DeepSeek-V2 |
| Per-head dim d_h | 128 | [V2] §3.1.2 |
| KV compression dim d_c (`kv_lora_rank`) | 512 | [V2] §3.1.2; cfg:DeepSeek-V2 |
| Query compression dim d_c' (`q_lora_rank`) | 1536 | [V2] §3.1.2; cfg:DeepSeek-V2 |
| Decoupled RoPE dim d_h^R (`qk_rope_head_dim`) | 64 | [V2] §3.1.2; cfg:DeepSeek-V2 |
| `qk_nope_head_dim` | 128 | cfg:DeepSeek-V2 (= d_h in paper) |
| `v_head_dim` | 128 | cfg:DeepSeek-V2 |
| MLA dims relation | "d_c is set to 4d_h and d_h^R is set to d_h/2 … KV cache is equal to GQA with only 2.25 groups" | [V2] §2.1.4, Table 1 caption |
| KV cache per token (elements) | (d_c + d_h^R)·l = (512+64)·60 = 34,560 elements | Derived from [V2] Table 1 formula + §3.1.2 |
| Shared / routed experts | 2 shared, 160 routed (`n_shared_experts: 2`, `n_routed_experts: 160`) | [V2] §3.1.2; cfg:DeepSeek-V2 |
| Top-k routed | 6 (`num_experts_per_tok: 6`) | [V2] §3.1.2; cfg:DeepSeek-V2 |
| Expert intermediate size | 1536 (`moe_intermediate_size: 1536`) | [V2] §3.1.2; cfg:DeepSeek-V2 |
| First dense layers | "all FFNs except for the first layer" are MoE → 1 (`first_k_dense_replace: 1`) | [V2] §3.1.2; cfg:DeepSeek-V2 |
| Dense FFN intermediate size | 12288 (`intermediate_size: 12288`) | cfg:DeepSeek-V2 (not stated in paper) |
| Gating function | Softmax over token-expert affinity (`scoring_func: "softmax"`), `norm_topk_prob: false` | [V2] §2.2.1 eq. for s_{i,t}; cfg:DeepSeek-V2 |
| Device-limited routing | experts on D=8 devices, each token to at most M=3 devices (`n_group: 8`, `topk_group: 3`, `topk_method: "group_limited_greedy"`) | [V2] §2.2.2, §3.1.2 "Training Hyper-Parameters"; cfg:DeepSeek-V2 |
| Balance-loss weights | α1 = 0.003 (expert), α2 = 0.05 (device), α3 = 0.02 (communication) | [V2] §3.1.2 "Training Hyper-Parameters" |
| Token dropping | device-level token dropping in training (capacity factor 1.0); none at eval | [V2] §2.2.4, §3.1.2 |
| `routed_scaling_factor` | 16.0 | cfg:DeepSeek-V2 (paper only says "additional scaling factors at the width bottlenecks", §3.1.2) |
| Context length | 128K | [V2] Abstract; §3.1.4 |
| Context extension | YaRN from 4K → 128K; s=40, α=1, β=32, target max 160K; √t = 0.0707 ln s + 1; 1000 steps at 32K seq len | [V2] §3.1.4 |
| `max_position_embeddings` | 163840 (rope_scaling: yarn, factor 40, original 4096, mscale 0.707) | cfg:DeepSeek-V2 |
| Vocab | paper: "100K" BBPE; config `vocab_size: 102400` | [V2] §3.1.1; cfg:DeepSeek-V2 |
| Training tokens | 8.1T | [V2] Abstract; §3.1.1 |
| Pre-train seq len | 4K | [V2] §3.1.2 |
| KV cache reduction | 93.3% vs DeepSeek 67B | [V2] Abstract; §1 |
| Training-cost saving | 42.5% vs DeepSeek 67B (172.8K vs 300.6K H800 GPU hours per trillion tokens) | [V2] Abstract; §3.2 (paragraph "Training Costs", after §3.2.1) |
| Max generation throughput | 5.76× DeepSeek 67B; >50K tokens/s on a single node of 8 H800 GPUs; prompt input >100K tokens/s (deployed with FP8 params + ~6-bit KV cache quantization) | [V2] Abstract; §3.2 (paragraph "Inference Efficiency", after §3.2.1) |

---

## 2. DeepSeek-V3

| field | value | source |
|---|---|---|
| Total params | 671B | [V3] Abstract; §4.2 "Model Hyper-Parameters" — https://arxiv.org/abs/2412.19437 |
| Active params / token | 37B | [V3] Abstract; §4.2 |
| HF checkpoint size | 685B = 671B main + 14B MTP module | Model card https://huggingface.co/deepseek-ai/DeepSeek-V3 ("NOTE: The total size …") |
| Layers | 61 (`num_hidden_layers: 61`) | [V3] §4.2; cfg:DeepSeek-V3 https://huggingface.co/deepseek-ai/DeepSeek-V3/blob/main/config.json |
| Hidden size | 7168 | [V3] §4.2; cfg:DeepSeek-V3 |
| Attention heads n_h | 128 (`num_attention_heads: 128`, `num_key_value_heads: 128`) | [V3] §4.2; cfg:DeepSeek-V3 |
| Per-head dim d_h | 128 (`qk_nope_head_dim: 128`, `v_head_dim: 128`) | [V3] §4.2; cfg:DeepSeek-V3 |
| d_c (`kv_lora_rank`) | 512 | [V3] §4.2; cfg:DeepSeek-V3 |
| d_c' (`q_lora_rank`) | 1536 | [V3] §4.2; cfg:DeepSeek-V3 |
| d_h^R (`qk_rope_head_dim`) | 64 | [V3] §4.2; cfg:DeepSeek-V3 |
| Shared / routed experts | 1 shared, 256 routed | [V3] §4.2; cfg:DeepSeek-V3 |
| Top-k routed | 8 (`num_experts_per_tok: 8`) | [V3] §4.2; cfg:DeepSeek-V3 |
| Expert intermediate size | 2048 (`moe_intermediate_size: 2048`) | [V3] §4.2; cfg:DeepSeek-V3 |
| First dense layers | "all FFNs except for the first three layers" → `first_k_dense_replace: 3` | [V3] §4.2; cfg:DeepSeek-V3 |
| Dense FFN `intermediate_size` | 18432 | cfg:DeepSeek-V3 (not stated in paper) |
| Gating / `scoring_func` | Sigmoid affinity, then normalization among selected scores (`scoring_func: "sigmoid"`, `norm_topk_prob: true`) | [V3] §2.1.2 eqs. 13–15; cfg:DeepSeek-V3 |
| Node-limited routing | experts on 64 GPUs across 8 nodes; each token to at most M=4 nodes, nodes chosen by sum of highest K_r/M affinities (`n_group: 8`, `topk_group: 4`, `topk_method: "noaux_tc"`) | [V3] §2.1.2 "Node-Limited Routing"; §4.2 "Training Hyper-Parameters"; cfg:DeepSeek-V3 |
| `routed_scaling_factor` | 2.5 | cfg:DeepSeek-V3 (paper: "additional scaling factors at the width bottlenecks", §4.2) |
| Aux-loss-free balancing rule | per-expert bias b_i added to affinity only for top-k selection; gating value still from original s_{i,t}; at end of each step, bias −γ if expert overloaded, +γ if underloaded (load monitored over whole batch) | [V3] §2.1.2 "Auxiliary-Loss-Free Load Balancing" |
| γ (bias update speed) schedule | 0.001 for first 14.3T tokens, 0.0 for remaining 500B | [V3] §4.2 "Training Hyper-Parameters" |
| Sequence-wise balance loss α | 0.0001 | [V3] §4.2 "Training Hyper-Parameters" (defined §2.1.2 "Complementary Sequence-Wise Auxiliary Loss") |
| Token dropping | none ("No Token-Dropping") | [V3] §2.1.2 |
| MTP depth D | 1 (`num_nextn_predict_layers: 1`) | [V3] §4.2; cfg:DeepSeek-V3 |
| MTP loss λ schedule | 0.3 for first 10T tokens, 0.1 for remaining 4.8T | [V3] §4.2 "Training Hyper-Parameters" |
| MTP loss form | L_MTP = (λ/D) Σ_k L_MTP^k | [V3] §2.2 "MTP Training Objective" |
| MTP speculative acceptance rate | 85%–90% for the second-token prediction | [V3] §5.4.3 |
| MTP speculative speedup | 1.8× TPS | [V3] §5.4.3 |
| FP8 formats | E4M3 on all tensors (instead of hybrid E4M3/E5M2); GEMMs Fprop, Dgrad, Wgrad all in FP8 | [V3] §3.3.1; §3.3.2 "Mantissa over Exponents" |
| Activation tile size | 1×128 (per token per 128 channels) | [V3] §3.3.2 "Fine-Grained Quantization" |
| Weight block size | 128×128 (`quantization_config.weight_block_size: [128, 128]`, `fmt: "e4m3"`, `activation_scheme: "dynamic"`) | [V3] §3.3.2; cfg:DeepSeek-V3 |
| Accumulation promotion interval N_C | 128 elements (= 4 WGMMAs), promoted to FP32 on CUDA cores | [V3] §3.3.2 "Increasing Accumulation Precision" |
| Special low-precision formats | E5M6 for inputs of the Linear after attention | [V3] §3.3.3 "Low-Precision Activation" |
| Training tokens | 14.8T | [V3] Abstract; §4.2 |
| H800 GPU hours | 2,664K pre-training + 119K context extension + 5K post-training = 2.788M total; 180K per trillion tokens; cluster of 2048 H800 | [V3] §1 / Table 1 |
| Tokenizer / vocab | BBPE, "extended vocabulary of 128K tokens"; config `vocab_size: 129280` | [V3] §4.1; cfg:DeepSeek-V3 |
| Context length | 128K (two YaRN phases: 4K→32K, 32K→128K, 1000 steps each; s=40, α=1, β=32, √t = 0.1 ln s + 1) | [V3] §4.3 |
| `max_position_embeddings` | 163840 (rope_scaling yarn, factor 40, original 4096, mscale 1.0) | cfg:DeepSeek-V3 |

---

## 3. DeepSeek-V3.1, V3.1-Terminus, V3.2-Exp, V3.2

### 3.1 V3.1 (HF repo created 2025-08-21; Base 2025-08-19 — from HF API `createdAt`, https://huggingface.co/api/models?author=deepseek-ai)

| field | value | source |
|---|---|---|
| Architecture change vs V3 | None in config other than `quantization_config.scale_fmt: "ue8m0"` (all dims identical: 61 layers, 7168 hidden, 256+1 experts, top-8, MLA dims unchanged) | Diff of cfg:DeepSeek-V3 vs cfg:DeepSeek-V3.1 https://huggingface.co/deepseek-ai/DeepSeek-V3.1/blob/main/config.json |
| FP8 scale format | "trained using the UE8M0 FP8 scale data format on both model weights and activations" | Model card https://huggingface.co/deepseek-ai/DeepSeek-V3.1 |
| Params / context | 671B total, 37B active, 128K | Model card (Model Downloads table) |
| Long-context extension | 32K phase increased 10× to 630B tokens; 128K phase extended 3.3× to 209B tokens | Model card |
| Behavioral change | Hybrid thinking / non-thinking in one model via chat template | Model card |

### 3.2 V3.2-Exp (HF repo created 2025-09-29) and V3.2 (HF repo created 2025-12-01)

| field | value | source |
|---|---|---|
| Only architectural change vs V3.1-Terminus | DeepSeek Sparse Attention (DSA), added via continued training | [V3.2] §2 intro — https://arxiv.org/abs/2512.02556 |
| V3.2 vs V3.2-Exp | "exactly the same architecture"; configs are byte-identical after key sort | [V3.2] §2; diff of cfg:DeepSeek-V3.2-Exp vs cfg:DeepSeek-V3.2 |
| DSA components | lightning indexer + fine-grained token selection | [V3.2] §2.1 "Prototype of DSA" |
| Indexer score | I_{t,s} = Σ_j w_{t,j}^I · ReLU(q_{t,j}^I · k_s^I); ReLU "for throughput"; indexer can run in FP8 | [V3.2] §2.1 eq. 1 |
| Indexer heads (`index_n_heads`) | 64 | cfg:DeepSeek-V3.2 https://huggingface.co/deepseek-ai/DeepSeek-V3.2/blob/main/config.json |
| Indexer head dim (`index_head_dim`) | 128 | cfg:DeepSeek-V3.2 |
| Top-k selected tokens (`index_topk`) | 2048 KV tokens per query | [V3.2] §2.1.1 "Sparse Training Stage"; cfg:DeepSeek-V3.2 |
| MLA mode used for DSA | MQA mode of MLA (latent KV shared across all query heads) | [V3.2] §2.1 "Instantiate DSA Under MLA"; Appendix A |
| Dense warm-up | indexer only, KL to summed main-attention distribution; LR 1e-3; 1000 steps × 16 seqs × 128K = 2.1B tokens | [V3.2] §2.1.1 "Dense Warm-up Stage" |
| Sparse training stage | LR 7.3e-6; 15000 steps × 480 seqs × 128K = 943.7B tokens; indexer input detached | [V3.2] §2.1.1 "Sparse Training Stage" |
| Complexity | core attention O(L²) → O(Lk); indexer still O(L²) but cheaper | [V3.2] §2.3 |
| Context length | 128K max | [V3.2] §4.1 |
| Config diff vs V3.1-Terminus | `architectures: DeepseekV32ForCausalLM`, `model_type: deepseek_v32`, + `index_head_dim: 128`, `index_n_heads: 64`, `index_topk: 2048`; all other dims identical | Diff of cfg:DeepSeek-V3.1-Terminus vs cfg:DeepSeek-V3.2-Exp |

---

## 4. DeepSeek-V4 and V4.x

**Yes, V4 exists.** Timeline (all primary):

| event | date | source |
|---|---|---|
| V4 Preview (V4-Pro, V4-Flash + Base models) open-sourced and on API | 2026-04-24 | https://api-docs.deepseek.com/news/news260424/ ; https://www.deepseek.com/en/news/v4-preview/ |
| V4 tech report on arXiv (2606.19348), submitted | 26 Apr 2026 | https://arxiv.org/abs/2606.19348 ; also https://huggingface.co/deepseek-ai/DeepSeek-V4-Pro/blob/main/DeepSeek_V4.pdf |
| V4-Pro/Flash-DSpark (same checkpoint + speculative-decoding module) | HF repos created 2026-06-27 | HF API; model card https://huggingface.co/deepseek-ai/DeepSeek-V4-Pro-DSpark |
| V4-Flash-0731 (official V4-Flash release, re-post-trained, DSpark attached) | 2026-07-31 | https://api-docs.deepseek.com/updates ; https://huggingface.co/deepseek-ai/DeepSeek-V4-Flash-0731 |
| V4-Pro-0813 (official V4-Pro release, DSpark attached) | 2026-08-13 | https://api-docs.deepseek.com/updates ; https://huggingface.co/deepseek-ai/DeepSeek-V4-Pro-0813 |
| V4-Flash-Vision-Exp | 2026-08-21 (changelog) | https://api-docs.deepseek.com/updates ; https://huggingface.co/deepseek-ai/DeepSeek-V4-Flash-Vision-Exp |
| **V4.1-Flash** (new architecture; multimodal) | 2026-09-10 | https://api-docs.deepseek.com/news/news260910 ; arXiv 2609.19969 https://arxiv.org/abs/2609.19969v1 |
| V4.1-Pro | Not released as of 2026-10-16 (news says V4-Pro requests route to V4.1-Flash "until V4.1-Pro launches") | https://api-docs.deepseek.com/news/news260910 |

### 4.1 DeepSeek-V4-Pro and V4-Flash (Preview, arXiv 2606.19348)

| field | V4-Pro | V4-Flash | source |
|---|---|---|---|
| Total / active params | 1.6T / 49B | 284B / 13B | [V4] Abstract; §4.2.1 — https://arxiv.org/abs/2606.19348 |
| Layers | 61 | 43 | [V4] §4.2.1; cfg:DeepSeek-V4-Pro / cfg:DeepSeek-V4-Flash |
| Hidden size d | 7168 | 4096 | [V4] §4.2.1; configs |
| Query heads n_h | 128 | 64 | [V4] §4.2.1; configs |
| KV heads | 1 (shared-KV MQA; `num_key_value_heads: 1`) | 1 | [V4] §2.3.1 "Shared Key-Value MQA"; configs |
| Head dim c | 512 (`head_dim: 512`) | 512 | [V4] §4.2.1; configs |
| Query compression d_c (`q_lora_rank`) | 1536 | 1024 | [V4] §4.2.1; configs |
| Output projection groups g (`o_groups`) | 16 | 8 | [V4] §2.3.1 "Grouped Output Projection"; §4.2.1; configs |
| Intermediate output dim d_g (`o_lora_rank`) | 1024 | 1024 | [V4] §4.2.1; configs |
| Partial RoPE dims | last 64 dims (`qk_rope_head_dim: 64`); RoPE with position −i also applied to outputs | — same — | [V4] §2.3.3 "Partial Rotary Positional Embedding"; configs |
| Attention type | hybrid: Compressed Sparse Attention (CSA) interleaved with Heavily Compressed Attention (HCA) | — same — | [V4] §2.3 |
| First two layers | HCA | pure sliding-window attention | [V4] §4.2.1 |
| CSA compression rate m | 4 | 4 | [V4] §4.2.1; `compress_ratios` entries = 4 |
| HCA compression rate m' | 128 | 128 | [V4] §4.2.1; `compress_ratios` entries = 128 |
| CSA attention top-k (`index_topk`) | 1024 | 512 | [V4] §4.2.1; configs |
| Indexer heads / head dim | 64 / 128 | 64 / 128 | [V4] §4.2.1; configs |
| Sliding window n_win | 128 (`sliding_window: 128`) | 128 | [V4] §4.2.1; configs |
| Attention sink | learnable per-head sink logits added to softmax denominator | — same — | [V4] §2.3.3 "Attention Sink" |
| Q / KV normalization | RMSNorm per query head and on the KV head before core attention; no QK-Clip | — same — | [V4] §2.3.3; §2.4 "Avoiding Exploding Attention Logits" |
| KV cache precision | BF16 for RoPE dims, FP8 for the rest; indexer attention in FP4 | — same — | [V4] §2.3.4 |
| KV cache vs BF16 GQA8 (head dim 128) at 1M | ≈ 2% | — | [V4] §2.3.4 |
| Single-token FLOPs vs V3.2 at 1M | 27% | 10% | [V4] Abstract; §1 |
| KV cache vs V3.2 at 1M | 10% | 7% | [V4] Abstract; §1 |
| Shared / routed experts | 1 / 384 | 1 / 256 | [V4] §4.2.1; configs |
| Top-k routed | 6 | 6 | [V4] §4.2.1; configs |
| Expert intermediate size | 3072 | 2048 | [V4] §4.2.1; configs |
| Dense FFN layers | none — MoE in all blocks; first 3 MoE layers use Hash routing by token ID (`num_hash_layers: 3`) | same | [V4] §2.1 "Mixture-of-Experts"; §4.2.1; configs |
| Affinity function | Sqrt(Softplus(·)) instead of Sigmoid (`scoring_func: "sqrtsoftplus"`) | same | [V4] §2.1; configs |
| Node-limited routing | removed ("we remove the constraint on the number of routing target nodes"); configs have no `n_group`/`topk_group` | same | [V4] §2.1; configs |
| `routed_scaling_factor` | 2.5 | 1.5 | configs (not stated in paper) |
| Aux-loss-free bias update speed | 0.001 | 0.001 | [V4] §4.2.2 |
| Sequence-wise balance loss weight | 0.0001 | 0.0001 | [V4] §4.2.2 |
| MTP | depth 1; "identical to that of DeepSeek-V3"; λ = 0.3 most of training, 0.1 from start of LR decay | same | [V4] §2.1 "Multi-Token Prediction"; §4.2.1; §4.2.2 |
| mHC | residual stream widened n_hc = 4 (`hc_mult: 4`); residual matrix projected onto doubly stochastic matrices via Sinkhorn-Knopp, t_max = 20 (`hc_sinkhorn_iters: 20`); input/output maps via Sigmoid | same | [V4] §2.2; §4.2.1; configs |
| Optimizer | Muon for most params (momentum 0.95, wd 0.1, update RMS rescaled to 0.18, Nesterov); AdamW (β1 0.9, β2 0.95, ε 1e-20, wd 0.1) for embedding, head, RMSNorm weights, mHC static biases/gates | same | [V4] §2.4; §4.2.2 |
| Hybrid Newton-Schulz | 10 iterations: 8 with (3.4445, −4.7750, 2.0315), then 2 with (2, −1.5, 0.5) | same | [V4] §2.4 "Hybrid Newton-Schulz Iterations" |
| Training tokens | 33T | 32T | [V4] §1; §4.2.2 (Abstract/§4.1 say "more than 32T") |
| Peak / end LR | 2.0e-4 / 2.0e-5 | 2.7e-4 / 2.7e-5 | [V4] §4.2.2 |
| Max batch size | 94.4M tokens | 75.5M tokens | [V4] §4.2.2 |
| Seq-len schedule | 4K → 16K → 64K → 1M; sparse attention introduced at 64K (Flash: after 1T dense tokens; Pro: longer dense stage) | same | [V4] §4.2.2 |
| Training stability tricks | Anticipatory Routing (routing from θ_{t−Δt}, ~20% overhead when active, triggered on loss spikes); SwiGLU clamping linear part to [−10, 10], gate upper bound 10 (`swiglu_limit: 10.0`) | same | [V4] §4.2.3; configs |
| Released weight precision | instruct: FP4 (MXFP4) MoE experts + FP8 elsewhere (`expert_dtype: "fp4"`); base: FP8 | same | [V4] §5.2.1; model card table https://huggingface.co/deepseek-ai/DeepSeek-V4-Pro-DSpark |
| FP4 QAT details | FP4 sub-blocks 1×32 inside FP8 128×128 blocks; FP4→FP8 dequant lossless; index scores FP32→BF16 gives 2× top-k selector speedup at 99.7% recall | — | [V4] §5.2.1 |
| Vocab | "still remain the vocabulary size to be 128K" (`vocab_size: 129280`) | same | [V4] §4.1; configs |
| Context / `max_position_embeddings` | 1M / 1048576 (yarn factor 16, original 65536; `compress_rope_theta: 160000`) | same | [V4] Abstract; configs |
| Attention masking | sample-level attention masking (V3 did not) | same | [V4] §4.1 |
| Training GPU hours | UNVERIFIED (not reported in the V4 paper) | UNVERIFIED | — |

V4 config key fields (verbatim, cfg:DeepSeek-V4-Pro https://huggingface.co/deepseek-ai/DeepSeek-V4-Pro/blob/main/config.json):

```json
"architectures": ["DeepseekV4ForCausalLM"], "model_type": "deepseek_v4",
"hidden_size": 7168, "num_hidden_layers": 61, "num_attention_heads": 128, "num_key_value_heads": 1,
"head_dim": 512, "q_lora_rank": 1536, "o_lora_rank": 1024, "o_groups": 16, "qk_rope_head_dim": 64,
"index_n_heads": 64, "index_head_dim": 128, "index_topk": 1024, "sliding_window": 128,
"n_routed_experts": 384, "n_shared_experts": 1, "num_experts_per_tok": 6, "moe_intermediate_size": 3072,
"num_hash_layers": 3, "scoring_func": "sqrtsoftplus", "topk_method": "noaux_tc", "norm_topk_prob": true,
"routed_scaling_factor": 2.5, "num_nextn_predict_layers": 1, "hc_mult": 4, "hc_sinkhorn_iters": 20, "hc_eps": 1e-06,
"swiglu_limit": 10.0, "expert_dtype": "fp4", "vocab_size": 129280, "max_position_embeddings": 1048576,
"rope_theta": 10000, "compress_rope_theta": 160000,
"rope_scaling": {"beta_fast": 32, "beta_slow": 1, "factor": 16, "original_max_position_embeddings": 65536, "type": "yarn"},
"quantization_config": {"activation_scheme": "dynamic", "fmt": "e4m3", "quant_method": "fp8", "scale_fmt": "ue8m0", "weight_block_size": [128, 128]},
"compress_ratios": [128, 128, 4, 128, 4, ... alternating ..., 4, 0]   // 62 entries: 31×128, 30×4, 1×0
```

cfg:DeepSeek-V4-Flash (https://huggingface.co/deepseek-ai/DeepSeek-V4-Flash/blob/main/config.json) differs in: `hidden_size: 4096`, `num_hidden_layers: 43`, `num_attention_heads: 64`, `q_lora_rank: 1024`, `o_groups: 8`, `index_topk: 512`, `n_routed_experts: 256`, `moe_intermediate_size: 2048`, `routed_scaling_factor: 1.5`, `compress_ratios: [0, 0, 4, 128, 4, 128, …, 4, 0]` (44 entries: 3×0, 21×4, 20×128).

### 4.2 V4-Pro-0813 / V4-Flash-0731 (official releases of V4)

| field | value | source |
|---|---|---|
| Backbone architecture | Unchanged from Preview: config diff vs Preview adds only `dspark_*` keys (and longer `compress_ratios`) | Diff of cfg:DeepSeek-V4-Pro vs cfg:DeepSeek-V4-Pro-0813; cfg:DeepSeek-V4-Flash vs cfg:DeepSeek-V4-Flash-0731 |
| What changed | Re-post-trained; DSpark speculative-decoding module attached | Model cards https://huggingface.co/deepseek-ai/DeepSeek-V4-Pro-0813 , https://huggingface.co/deepseek-ai/DeepSeek-V4-Flash-0731 |
| DSpark config (Pro-0813) | `dspark_block_size: 5`, `dspark_markov_rank: 512`, `dspark_noise_token_id: 128799`, `dspark_target_layer_ids: [58, 59, 60]` | cfg:DeepSeek-V4-Pro-0813 |
| DSpark config (Flash-0731) | `dspark_block_size: 5`, `dspark_markov_rank: 256`, `dspark_target_layer_ids: [40, 41, 42]` | cfg:DeepSeek-V4-Flash-0731 |

### 4.3 DeepSeek-V4.1-Flash (2026-09-10; arXiv 2609.19969)

| field | value | source |
|---|---|---|
| Params | 552B backbone + 196B Engram; 8B active per token in prefill, 16B in decode | [V4.1] Abstract; §2.1; §4.2.1 — https://arxiv.org/abs/2609.19969v1 ; PDF https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash/blob/main/DeepSeek_V41_Tech_Report.pdf |
| HF reported model size | 763B params (HF tensor count; includes vision tower/DSpark — breakdown UNVERIFIED) | HF page https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash |
| Modality | native image + text input (DeepSeek-ViT: 32 layers, hidden 1024, 16 heads, patch 14, 3×3 pixel-unshuffle; 2-layer MLP projector, hidden 5120) | [V4.1] §2.1.1; §4.2.1; cfg:DeepSeek-V4.1-Flash `vision_config` |
| Layers | 40 = 20-layer causal encoder + 20-layer decoder ("Causal Encoder-Decoder", CED, inspired by YOCO) | [V4.1] §2.2; §4.2.1; config `num_hidden_layers: 40` |
| CED mechanism | decoder's global KV projected from final encoder hidden states; "nearly halves prefill computation" | [V4.1] §2.1; §2.2 |
| Hidden size | 5120 | [V4.1] §4.2.1; config |
| Attention | pure CSA2 (no HCA); first two layers SWA-only | [V4.1] §1; §4.2.1 |
| CSA2 modes | Full / Reindex / Reuse (cross-layer sharing of global KV + indexer K, and reuse of top-k indices); overlap compression of CSA removed | [V4.1] §1; §2.3 |
| Encoder CSA2 | compression m = 2; 18 layers in 3 groups of 6 (1 Full + 5 Reuse) | [V4.1] §4.2.1; config `compress_ratios` (18×2) |
| Decoder CSA2 | compression m = 1; 5 groups of 4 (group 1: Full + 3 Reuse; groups 2–5: Reindex + 3 Reuse) | [V4.1] §4.2.1; config `compress_ratios` (20×1) |
| Hierarchical Sparse Indexer | up to 2,048 blocks × 8 positions = 16,384 candidate positions (`candidate_topk_blocks: 2048`, `candidate_block_size: 8`, `candidate_source_layer_id: 20`) | [V4.1] §4.2.1; config |
| Indexer heads / dim / top-k | 32 / 128 / 512 | [V4.1] §4.2.1; config |
| Query heads / head dim / q compression | 64 / 512 / 1280 | [V4.1] §4.2.1; config |
| Output groups / d_g | 8 / 1024 | [V4.1] §4.2.1; config |
| Sliding window | 128 | [V4.1] §4.2.1; config |
| MoE | 1 shared + 384 routed, top-6, expert intermediate 2304; MoE in all blocks; modality-specific load balancing | [V4.1] §2.1; §4.2.1; config |
| `scoring_func` | `sqrtsoftplus` (`routed_scaling_factor: 1.5`) | config (paper does not restate) |
| Hash routing | UNVERIFIED — not mentioned in V4.1 model setup; config has no `num_hash_layers` | [V4.1] §4.2.1; config |
| mHC | "Single-Pass mHC", expansion 4, 20 Sinkhorn iterations; Mega-mHC kernel halves activation memory traffic vs four-kernel impl | [V4.1] §1; §2.4.1; §4.2.1 |
| Engram | 196B params in 2 modules at layers 1 and 14 (zero-indexed); N-gram orders {2,3,4}; 8 hash heads; 2048 embedding dim per order; ~16M entries per head; FP8 tables; LR ×5 | [V4.1] §2.4.2; §4.2.2; config `engram_*` |
| MTP | omitted during backbone pre-training; replaced by DSpark trained separately post-pre-training (backbone frozen) | [V4.1] §2.1; §2.4.3 |
| DSpark | 3 Transformer drafter blocks, sliding window 128, 5 draft positions per pass, Markov head, confidence-scheduled verification | [V4.1] §2.4.3; config `dspark_block_size: 5`, `dspark_markov_rank: 256` |
| KV cache precision | FP4 main KV: E2M1 with one E4M3 scale per 16 channels (NVFP4-like without global scale) | [V4.1] §2.4.4 |
| Global KV cache | 890 bytes/token, ≈1/4 of V4-Flash; ≈437× smaller than DeepSeek-V1 (model card Fig. 1 caption) | [V4.1] Abstract; model card |
| Persistent KV cache | ≈1/8 of V4-Flash via "SWA Bounded Replay" (replay only most recent n_win tokens) | [V4.1] Abstract; §3.2.2 |
| Decode FLOPs scaling | 4K → 1M context increases decode FLOPs by only 1/4 | [V4.1] §1 (Fig. 2) |
| Training tokens | 45T multimodal; sparse attention from scratch at 64K, extended to 1M at 34T tokens | [V4.1] Abstract; §4.2.2 |
| Batch / LR | fixed 100.6M tokens; LR 2.6e-4 to 28T, cosine to 2.6e-5 by 40T, constant to 45T | [V4.1] §4.2.2 |
| Optimizer | Muon (linear), AdamW (norms, non-matrix), Sinkhorn-balanced update for embeddings & head (K=11, τ=1e-3) | [V4.1] §4.2.2 |
| Balancing | bias update speed 0.001 (image & text), sequence loss weight 0.0001 | [V4.1] §4.2.2 |
| FP8 weight block size | `weight_block_size: [32, 32]` (V4 used `[128, 128]`) | cfg:DeepSeek-V4.1-Flash |
| Reasoning effort | continuous integer 1–100 | Model card |
| Training GPU hours | UNVERIFIED (not reported) | — |

V4.1-Flash config key fields (verbatim, `text_config` of https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash/blob/main/config.json):

```json
"architectures": ["DeepseekV41ForCausalLM"], "model_type": "deepseek_v41", "image_token_id": 129264,
"quantization_config": {"quant_method": "fp8", "activation_scheme": "dynamic", "weight_block_size": [32, 32], "scale_fmt": "ue8m0", "expert_dtype": "fp4"},
"vocab_size": 129280, "hidden_size": 5120, "moe_intermediate_size": 2304, "num_hidden_layers": 40,
"num_attention_heads": 64, "num_key_value_heads": 1, "head_dim": 512, "qk_rope_head_dim": 64,
"q_lora_rank": 1280, "o_lora_rank": 1024, "o_groups": 8, "swiglu_limit": 10.0, "rms_norm_eps": 1e-20,
"max_position_embeddings": 1048576, "rope_scaling": {"rope_type": "yarn", "factor": 16, "beta_fast": 32, "beta_slow": 1, "original_max_position_embeddings": 65536},
"n_routed_experts": 384, "n_shared_experts": 1, "num_experts_per_tok": 6, "scoring_func": "sqrtsoftplus",
"topk_method": "noaux_tc", "norm_topk_prob": true, "routed_scaling_factor": 1.5, "sliding_window": 128,
"compress_ratios": [0, 0, 2 ×18, 1 ×20, 0, 0, 0],   // 43 entries
"compress_rope_theta": 160000, "kv_source_layer_ids": [2, 8, 14, 20], "index_source_layer_ids": [2, 8, 14, 20, 24, 28, 32, 36],
"index_n_heads": 32, "index_head_dim": 128, "index_topk": 512,
"candidate_source_layer_id": 20, "candidate_topk_blocks": 2048, "candidate_block_size": 8,
"hc_mult": 4, "hc_sinkhorn_iters": 20, "hc_eps": 1e-06,
"engram_layer_ids": [1, 14], "engram_num_embeddings": [384006168, 384016682], "engram_max_ngram_size": 4,
"engram_vocab_size": 16000000, "engram_n_heads": 8, "engram_head_dim": 256, "engram_compressed_vocab_size": 99092,
"num_nextn_predict_layers": 3, "dspark_block_size": 5, "dspark_noise_token_id": 128799,
"dspark_target_layer_ids": [37, 38, 39], "dspark_markov_rank": 256, "dspark_n_routed_experts": 128, "dspark_num_experts_per_tok": 3
```

---

## 5. Discrepancies and caveats (paper vs config, and internal)

1. **V2 balance loss weight.** Paper §3.1.2 sets expert-level α1 = 0.003; cfg:DeepSeek-V2 has `aux_loss_alpha: 0.001`. 0.001 is the value the paper gives for **DeepSeek-V2-Lite** (Appendix B "Training Details"). Cite the paper for V2's training value.
2. **V2 vocab.** Paper says "100K"; config `vocab_size: 102400`. **V3/V4 vocab**: papers say "128K"; configs `129280`. Papers round; configs include padding/special tokens.
3. **Context vs `max_position_embeddings`.** V2/V3 papers claim 128K; configs say 163840 (160K). The V2 paper (§3.1.4) explains YaRN target = 160K "so the model responds well for 128K". Don't present 160K as the supported context.
4. **`routed_scaling_factor`** (V2 16.0, V3 2.5, V4-Pro 2.5, V4-Flash 1.5, V4.1-Flash 1.5) appears only in configs; papers only mention unnamed "additional scaling factors".
5. **Dense `intermediate_size`** (V2 12288, V3 18432) is config-only.
6. **V3.1-Terminus config** lacks `scale_fmt: "ue8m0"` although V3.1 (its predecessor) and V3.2-Exp (its successor) both have it; it also has an empty `attn_module_list_cfg: []`. No architectural meaning found; treat as config housekeeping.
7. **V4 training tokens.** Abstract and §4.1 say "more than 32T"; §1/§4.2.2 give 32T (Flash) and 33T (Pro). Use the per-model figures.
8. **V4 `compress_ratios` length ≠ `num_hidden_layers`.** V4-Pro has 62 entries for 61 layers, V4-Flash 44 for 43; the extra trailing `0` presumably covers the 1 MTP layer (inference; not stated in the paper). In **V4-Pro-0813** (64 entries) and **V4-Flash-0731** (46 entries) there are 3 trailing zeros although `num_nextn_predict_layers` is still 1; this likely corresponds to the 3-block DSpark drafter (inference, UNVERIFIED).
9. **V4.1 MTP vs config.** The V4.1 report says the MTP module is *omitted* and DSpark is used instead, but the config sets `num_nextn_predict_layers: 3`. That value matches the three DSpark drafter blocks (§2.4.3), so the field appears to be reused for DSpark (inference).
10. **V4.1 `rms_norm_eps: 1e-20`** in config (V4 configs: 1e-06). The report uses ε = 1e-20 for AdamW/Sinkhorn updates; no statement about the RMSNorm epsilon was found. Report verbatim, but don't explain it.
11. **V4.1 parameter totals.** Paper: 552B backbone + 196B Engram (= 748B); HF page shows "763B params". The remaining ~15B (vision encoder, DSpark, etc.) breakdown is UNVERIFIED.
12. **V4.1 citation key inconsistency.** The report cites Engram as both "Cheng et al., 2026b" and "2026c" (§2.1 vs §2.4.2). Cosmetic.
13. **V4-Pro API status after Sept 14, 2026.** The 2026-09-10 news post says `deepseek-v4-pro` routes to V4.1-Flash from Sept 14; the change log (same date entry, later text) says V4-Pro API service will *continue* "in response to user demand". Not architectural, but don't state either as fact without checking the current docs.
14. **Release dates from HF `createdAt`** (V3.1, V3.1-Terminus, V3.2-Exp, V3.2, DSpark repos) are repo-creation timestamps, which may be slightly before public announcement (e.g., V4 repos created 2026-04-22, announced 2026-04-24).
15. **V3.2-Exp's own technical report** (cited on its model card as "DeepSeek-V3.2-Exp: Boosting Long-Context Efficiency with DeepSeek Sparse Attention") was not fetched; DSA facts here come from the V3.2 paper, which says V3.2 has the same architecture as V3.2-Exp.

---

## Sources

| suggested id | title | authors/org | year | URL | type |
|---|---|---|---|---|---|
| deepseek-v2-report | DeepSeek-V2: A Strong, Economical, and Efficient Mixture-of-Experts Language Model | DeepSeek-AI | 2024 | https://arxiv.org/abs/2405.04434 | paper |
| deepseek-v2-config | DeepSeek-V2 config.json | DeepSeek-AI | 2024 | https://huggingface.co/deepseek-ai/DeepSeek-V2/blob/main/config.json | config |
| deepseek-v3-report | DeepSeek-V3 Technical Report | DeepSeek-AI | 2024 | https://arxiv.org/abs/2412.19437 | report |
| deepseek-v3-config | DeepSeek-V3 config.json | DeepSeek-AI | 2024 | https://huggingface.co/deepseek-ai/DeepSeek-V3/blob/main/config.json | config |
| deepseek-v3-model-card | DeepSeek-V3 model card | DeepSeek-AI | 2024 | https://huggingface.co/deepseek-ai/DeepSeek-V3 | model-card |
| deepseek-v3-1-model-card | DeepSeek-V3.1 model card | DeepSeek-AI | 2025 | https://huggingface.co/deepseek-ai/DeepSeek-V3.1 | model-card |
| deepseek-v3-1-config | DeepSeek-V3.1 config.json | DeepSeek-AI | 2025 | https://huggingface.co/deepseek-ai/DeepSeek-V3.1/blob/main/config.json | config |
| deepseek-v3-1-terminus-config | DeepSeek-V3.1-Terminus config.json | DeepSeek-AI | 2025 | https://huggingface.co/deepseek-ai/DeepSeek-V3.1-Terminus/blob/main/config.json | config |
| deepseek-v3-2-exp-model-card | DeepSeek-V3.2-Exp model card | DeepSeek-AI | 2025 | https://huggingface.co/deepseek-ai/DeepSeek-V3.2-Exp | model-card |
| deepseek-v3-2-exp-config | DeepSeek-V3.2-Exp config.json | DeepSeek-AI | 2025 | https://huggingface.co/deepseek-ai/DeepSeek-V3.2-Exp/blob/main/config.json | config |
| deepseek-v3-2-report | DeepSeek-V3.2: Pushing the Frontier of Open Large Language Models | DeepSeek-AI | 2025 | https://arxiv.org/abs/2512.02556 | paper |
| deepseek-v3-2-config | DeepSeek-V3.2 config.json | DeepSeek-AI | 2025 | https://huggingface.co/deepseek-ai/DeepSeek-V3.2/blob/main/config.json | config |
| deepseek-v4-report | DeepSeek-V4: Towards Highly Efficient Million-Token Context Intelligence | DeepSeek-AI | 2026 | https://arxiv.org/abs/2606.19348 (also https://huggingface.co/deepseek-ai/DeepSeek-V4-Pro/blob/main/DeepSeek_V4.pdf) | report |
| deepseek-v4-pro-config | DeepSeek-V4-Pro config.json | DeepSeek-AI | 2026 | https://huggingface.co/deepseek-ai/DeepSeek-V4-Pro/blob/main/config.json | config |
| deepseek-v4-flash-config | DeepSeek-V4-Flash config.json | DeepSeek-AI | 2026 | https://huggingface.co/deepseek-ai/DeepSeek-V4-Flash/blob/main/config.json | config |
| deepseek-v4-preview-news | DeepSeek V4 Preview Release | DeepSeek | 2026 | https://api-docs.deepseek.com/news/news260424/ | blog |
| deepseek-v4-dspark-model-card | DeepSeek-V4-Pro-DSpark model card | DeepSeek-AI | 2026 | https://huggingface.co/deepseek-ai/DeepSeek-V4-Pro-DSpark | model-card |
| deepseek-v4-pro-0813-model-card | DeepSeek-V4-Pro-0813 model card | DeepSeek-AI | 2026 | https://huggingface.co/deepseek-ai/DeepSeek-V4-Pro-0813 | model-card |
| deepseek-v4-pro-0813-config | DeepSeek-V4-Pro-0813 config.json | DeepSeek-AI | 2026 | https://huggingface.co/deepseek-ai/DeepSeek-V4-Pro-0813/blob/main/config.json | config |
| deepseek-v4-flash-0731-model-card | DeepSeek-V4-Flash-0731 model card | DeepSeek-AI | 2026 | https://huggingface.co/deepseek-ai/DeepSeek-V4-Flash-0731 | model-card |
| deepseek-v4-flash-0731-config | DeepSeek-V4-Flash-0731 config.json | DeepSeek-AI | 2026 | https://huggingface.co/deepseek-ai/DeepSeek-V4-Flash-0731/blob/main/config.json | config |
| deepseek-v4-flash-vision-exp-model-card | DeepSeek-V4-Flash-Vision-Exp model card | DeepSeek-AI | 2026 | https://huggingface.co/deepseek-ai/DeepSeek-V4-Flash-Vision-Exp | model-card |
| deepseek-v4-1-flash-report | DeepSeek-V4.1-Flash: Pushing the Limits of KV Cache Compression | DeepSeek-AI | 2026 | https://arxiv.org/abs/2609.19969v1 (also https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash/blob/main/DeepSeek_V41_Tech_Report.pdf) | report |
| deepseek-v4-1-flash-config | DeepSeek-V4.1-Flash config.json | DeepSeek-AI | 2026 | https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash/blob/main/config.json | config |
| deepseek-v4-1-flash-model-card | DeepSeek-V4.1-Flash model card | DeepSeek-AI | 2026 | https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash | model-card |
| deepseek-v4-1-flash-news | DeepSeek-V4.1-Flash: Smarter, Faster, More Efficient | DeepSeek | 2026 | https://api-docs.deepseek.com/news/news260910 | blog |
| deepseek-api-changelog | Change Log, DeepSeek API Docs | DeepSeek | 2026 | https://api-docs.deepseek.com/updates | blog |
| hf-deepseek-model-list | Hugging Face API: deepseek-ai models (createdAt timestamps) | Hugging Face | 2026 | https://huggingface.co/api/models?author=deepseek-ai&sort=createdAt&direction=-1 | config |

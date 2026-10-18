# MiniCPM-V 4.7 architectures — sourced fact sheet

Compiled 2026-10-18 from primary sources: Hugging Face model cards (`openbmb/MiniCPM-V-4.7-35B-A3B`, `openbmb/MiniCPM-V-4.7-35B-A3B-DSpark`), released `config.json`, `tokenizer.json`, `tokenizer_config.json`, `preprocessor_config.json`, `model.safetensors.index.json`, Hugging Face `transformers` modeling code (`modeling_minicpmv4_7.py`, `configuration_minicpmv4_7.py`, `modeling_qwen3_5_moe.py`), OpenBMB `llama.cpp-omni` LES documentation, and LLaVA-UHD v4 (`arXiv:2605.08985`).

---

## MiniCPM-V 4.7 35B-A3B (`openbmb/MiniCPM-V-4.7-35B-A3B`)

### Headline & size
| Field | Value | Source | Where |
| --- | --- | --- | --- |
| Variant name | 35B-A3B (first MoE in the MiniCPM-V series) | `minicpm-v-4-7-35b-a3b-card` | Overview, Model Weights |
| Sibling variant | 1B (dense, `qwen3_5_text` backbone) | `minicpm-v-4-7-35b-a3b-card`, `minicpm-v-4-7-1b-config` | Model Weights; `text_config` |
| Exact parameter count (BF16 safetensors) | 35,212,875,824 (70,425,751,648 bytes) | `minicpm-v-4-7-35b-a3b-config` | `model.safetensors.index.json` (`total_size`) |
| Language model parameters (derived from shapes) | 34,659,889,792 (34.66B total; 3,454,268,032 = 3.45B active per token) | Derived from `text_config` & `modeling_qwen3_5_moe.py` | `text_config` |
| Vision tower + mergers parameters (derived from shapes) | 552,986,032 (553M) | Derived from `vision_config` & `modeling_minicpmv4_7.py` | `vision_config` |
| Training token count / data recipe | UNVERIFIED (not reported in model card or config) | — | — |

### Language backbone (`text_config`, `model_type: qwen3_5_moe_text`)
| Field | Value | Source | Where |
| --- | --- | --- | --- |
| Backbone origin | Qwen3.5 / Qwen3.6 (`Qwen3_5MoeTextModel`) | `minicpm-v-4-7-35b-a3b-card`, `minicpm-v-4-7-35b-a3b-config` | Acknowledgements; `text_config.model_type` |
| Layers ($L$) | 40 | `minicpm-v-4-7-35b-a3b-config` | `text_config.num_hidden_layers` |
| Layer pattern | 10 repeats of 3 `linear_attention` (Gated DeltaNet) + 1 `full_attention` (GQA), MoE in every layer (`(GE*3 AE)*10`) | `minicpm-v-4-7-35b-a3b-config` | `text_config.layer_types`, `full_attention_interval: 4` |
| Linear attention layers | 30 (`Qwen3_5MoeGatedDeltaNet`) | `minicpm-v-4-7-35b-a3b-config`, `qwen3-5-moe-modeling` | `text_config.layer_types`; `Qwen3_5MoeDecoderLayer` |
| Full attention layers | 10 (`Qwen3_5MoeAttention`, at 0-indexed layers 3, 7, 11, 15, 19, 23, 27, 31, 35, 39) | `minicpm-v-4-7-35b-a3b-config` | `text_config.layer_types` |
| Hidden size ($d$) | 2,048 | `minicpm-v-4-7-35b-a3b-config` | `text_config.hidden_size` |
| Normalization | Zero-centered RMSNorm (`output * (1 + weight)`), $\epsilon = 10^{-6}$, before each sublayer | `minicpm-v-4-7-35b-a3b-config`, `qwen3-5-moe-modeling` | `text_config.rms_norm_eps`; `Qwen3_5MoeRMSNorm` |
| Full-attention query heads ($n_h$) | 16 | `minicpm-v-4-7-35b-a3b-config` | `text_config.num_attention_heads` |
| Full-attention KV heads ($n_{kv}$) | 2 (GQA, 8 query heads per KV head) | `minicpm-v-4-7-35b-a3b-config` | `text_config.num_key_value_heads` |
| Full-attention head dim ($d_h$) | 256 (note $n_h \cdot d_h = 4096 = 2d$) | `minicpm-v-4-7-35b-a3b-config` | `text_config.head_dim` |
| Attention output gate | `true` (`q_proj` outputs $2 \cdot n_h \cdot d_h = 8192$, split into queries and gate; output multiplied by $\sigma(\text{gate})$ before `o_proj`) | `minicpm-v-4-7-35b-a3b-config`, `qwen3-5-moe-modeling` | `text_config.attn_output_gate`; `Qwen3_5MoeAttention.forward` |
| QK-Norm | `true` (`Qwen3_5MoeRMSNorm` on head_dim 256 per query and key head) | `qwen3-5-moe-modeling` | `Qwen3_5MoeAttention.__init__` |
| RoPE | Partial RoPE (`partial_rotary_factor: 0.25`, rotating 64 of 256 dims), $\theta = 10,000,000$, interleaved M-RoPE sections `[11, 11, 10]`, `mrope_mode: "canvas"` | `minicpm-v-4-7-35b-a3b-config` | `text_config.rope_parameters`, `mrope_mode` |
| Gated DeltaNet key/query heads ($n_{qk}$) | 16, head dim $d_{qk} = 128$ (total key dim 2,048; L2-normalized and repeated $2\times$ to 32 heads) | `minicpm-v-4-7-35b-a3b-config`, `qwen3-5-moe-modeling` | `text_config.linear_num_key_heads`, `linear_key_head_dim` |
| Gated DeltaNet value heads ($n_v$) | 32, head dim $d_v = 128$ (total value dim 4,096) | `minicpm-v-4-7-35b-a3b-config` | `text_config.linear_num_value_heads`, `linear_value_head_dim` |
| Gated DeltaNet conv kernel ($k$) | 4 (depthwise causal Conv1d over $2 \cdot 2048 + 4096 = 8192$ QKV channels, SiLU activation) | `minicpm-v-4-7-35b-a3b-config`, `qwen3-5-moe-modeling` | `text_config.linear_conv_kernel_dim`; `Qwen3_5MoeGatedDeltaNet` |
| Gated DeltaNet recurrent state | $32 \times 128 \times 128$ per layer in FP32 (`mamba_ssm_dtype: "float32"`), plus $8192 \times 4$ conv state | `minicpm-v-4-7-35b-a3b-config`, `qwen3-5-moe-modeling` | `text_config.mamba_ssm_dtype`; `torch_recurrent_gated_delta_rule` |
| Gated DeltaNet output norm | `Qwen3_5MoeRMSNormGated(128)` ($\text{RMSNorm}(y) \odot \text{SiLU}(z)$) before `out_proj` ($4096 \to 2048$) | `qwen3-5-moe-modeling` | `Qwen3_5MoeGatedDeltaNet` |
| Routed experts ($N_r$) | 256 | `minicpm-v-4-7-35b-a3b-config` | `text_config.num_experts` |
| Active routed experts ($K_r$) | 8 | `minicpm-v-4-7-35b-a3b-config` | `text_config.num_experts_per_tok` |
| Expert hidden size ($d_e$) | 512 (SwiGLU, `hidden_act: "silu"`) | `minicpm-v-4-7-35b-a3b-config` | `text_config.moe_intermediate_size`, `hidden_act` |
| Shared experts ($N_s$) | 1 (`shared_expert_intermediate_size: 512`), scaled by $\sigma(\text{shared\_expert\_gate}(u))$ where `shared_expert_gate` is `Linear(2048, 1)` | `minicpm-v-4-7-35b-a3b-config`, `qwen3-5-moe-modeling` | `text_config.shared_expert_intermediate_size`; `Qwen3_5MoeSparseMoeBlock` |
| Router scoring | Softmax over all 256 experts, top-8 selected and renormalized to sum to 1 | `qwen3-5-moe-modeling` | `Qwen3_5MoeTopKRouter.forward` |
| Context length | 262,144 (`256K`) | `minicpm-v-4-7-35b-a3b-config` | `text_config.max_position_embeddings`, `tokenizer_config.model_max_length` |
| Vocabulary (`vocab_size`) | 248,144 (`tie_word_embeddings: false`) | `minicpm-v-4-7-35b-a3b-config` | `text_config.vocab_size`, `tie_word_embeddings` |
| `mtp_num_hidden_layers` | 1 in `text_config`, but no `mtp.*` weights exist in `model.safetensors.index.json` (`_keys_to_ignore_on_load_unexpected = [r"^mtp.*"]`); speculative decoding uses the separate DSpark checkpoint instead | `minicpm-v-4-7-35b-a3b-config`, `qwen3-5-moe-modeling` | `text_config.mtp_num_hidden_layers`; `model.safetensors.index.json` |

### Vision encoder & two-stage token compression (`vision_config` + `MiniCPMV4_7Merger`)
| Field | Value | Source | Where |
| --- | --- | --- | --- |
| Vision backbone origin | SigLIP2 adapted for variable resolution (NaViT patch-n'-pack nearest position interpolation) | `minicpm-v-4-7-35b-a3b-card`, `minicpm-v-4-7-modeling` | Acknowledgements; `MiniCPMV4_7VisionEmbeddings` |
| Vision layers | 27 | `minicpm-v-4-7-35b-a3b-config` | `vision_config.num_hidden_layers` |
| Vision hidden size | 1,152 | `minicpm-v-4-7-35b-a3b-config` | `vision_config.hidden_size` |
| Vision FFN width | 4,304 (`gelu_pytorch_tanh`) | `minicpm-v-4-7-35b-a3b-config` | `vision_config.intermediate_size`, `hidden_act` |
| Vision attention heads | 16 (head dim 72, bidirectional MHA per slice/window) | `minicpm-v-4-7-35b-a3b-config`, `minicpm-v-4-7-modeling` | `vision_config.num_attention_heads`; `MiniCPMV4_7VisionAttention` |
| Patch size & base grid | $14 \times 14$ px; nominal `image_size: 980` ($70 \times 70 = 4,900$ learned position embeddings) | `minicpm-v-4-7-35b-a3b-config`, `minicpm-v-4-7-modeling` | `vision_config.patch_size`, `image_size` |
| Intra-ViT early compression (`vit_merger`) | `MiniCPMV4_7ViTWindowAttentionMerger` inserted after layer `insert_layer_id: 6` (after 7th layer, layers 0..6): $2\times 2$ window self-attention (`window_kernel_size: (2, 2)`), then flattens 4 patches ($4 \times 1152 = 4608$) through `LayerNorm(4608) → Linear(4608 → 17216) → GELU → Linear(17216 → 1152)` plus the 4-patch mean residual | `minicpm-v-4-7-35b-a3b-config`, `minicpm-v-4-7-modeling` | `insert_layer_id: 6`; `MiniCPMV4_7ViTWindowAttentionMerger` |
| Post-ViT connector (`model.merger`) | `MiniCPMV4_7Merger` (`merge_kernel_size: (2, 2)`, `merger_times: 1`): groups $2\times 2$ tokens ($4 \times 1152 = 4608$) through `LayerNorm(4608) → Linear(4608 → 4608) → GELU → Linear(4608 → 2048)` | `minicpm-v-4-7-modeling` | `MiniCPMV4_7DownsampleMLP`, `MiniCPMV4_7Merger` |
| Mixed $16\times / 4\times$ `downsample_mode` | `"16x"` (default): runs both `vit_merger` ($4\times$ after layer 6, so layers 7..26 see $1/4$ the tokens) and `merger` ($4\times$ after layer 26) for $16\times$ total compression. `"4x"`: sets `use_vit_merger = False`, skipping `vit_merger` so all 27 layers run on full tokens and only `merger` ($4\times$) runs at the end | `minicpm-v-4-7-35b-a3b-card`, `minicpm-v-4-7-modeling` | Advanced Parameters; `MiniCPMV4_7Model.get_image_features` |
| LLaVA-UHD v4 reference | Intra-ViT early compression reduces visual-encoding FLOPs by 55.8% (from 3555G to 1573G) vs post-ViT compression under the same $16\times$ final ratio | `llava-uhd-v4-paper` | README / Abstract |
| Slicing & video parameters | `max_slice_nums`: default 9 (recommended 36 for images, 1 for video); `max_num_frames`: default 128; `stack_frames`: default 1 (recommended 3 or 5: 1 main frame + $N-1$ sub-frames composited into a grid image per second) | `minicpm-v-4-7-35b-a3b-card` | Advanced Parameters |

### On-device MoE inference (LES + quantization + DSpark)
| Field | Value | Source | Where |
| --- | --- | --- | --- |
| iPhone 17 Pro Max decode speed | 13+ tokens/s in 3 GB RAM | `minicpm-v-4-7-35b-a3b-card` | Overview |
| iPad Pro 11-inch M4 (16 GB) ablation | SSD baseline: 2.97 tok/s (1.00×) → +LES prefetch & layout: 9.81 tok/s (3.30×) → +layer-wise mixed-precision quantization: 14.92 tok/s (5.02×) → +DSpark speculative sampling: 17.39 tok/s (5.86×) | `minicpm-v-4-7-les-docs` | Results table |
| DSpark draft checkpoint (`MiniCPM-V-4.7-35B-A3B-DSpark`) | 389,223,169 parameters; 5 full-attention GQA layers ($d = 2048$, $d_{ff} = 6144$, 8 Q / 2 KV heads, $d_h = 256$); reads target hidden states at layers `[3, 11, 19, 27, 35]`; drafts 15 tokens per pass (`block_size: 15`) with a rank-256 Markov confidence head; trained for 6 epochs on 2M sequences with CE + L1 + confidence loss; accept length 3.501 (General) to 7.387 (Code) and 5.098–6.126 (Vision) | `minicpm-v-4-7-35b-a3b-dspark-card` | Model Specification, Evaluation, `config.json` |

# StableHand: sourced fact sheet

Compiled 2026-10-16. Every value below was read on that date from one of these: the arXiv HTML (v1), the upstream repo files at commit `0471a45e32` (raw.githubusercontent), or the HF `args.json` files at revision `b523aa8c`. "UNVERIFIED" means no primary source was found. "Derived" means arithmetic on sourced numbers.

Shorthand: `[SH]` = arXiv 2605.18553v1 HTML, https://arxiv.org/html/2605.18553. `repo:<path>` = https://github.com/huajian-zeng/stablehand/blob/main/<path>. `hf:<path>` = https://huggingface.co/huajian-zeng/stablehand/blob/main/<path>.

**Before you write: the paper and the released code describe different models.** The repo ships the "enhanced version", not the paper model. For architecture and results, cite `[SH]`. Treat repo and HF configs as a separate, later release. Details are under "Disagreements".

---

## 1. Identity

| field | value | source |
|---|---|---|
| Title | StableHand: Quality-Aware Flow Matching for World-Space Dual-Hand Motion Estimation from Egocentric Video | [SH] title; arXiv abs |
| Authors | Huajian Zeng, Chaohua Yao, Yuantai Zhang, Jiaqi Yang, Rolandos Alexandros Potamias, Xingxing Zuo | [SH]; arXiv abs |
| Affiliations | MBZUAI; UIUC; Imperial College London | [SH] header |
| arXiv | submitted 18 May 2026 (v1); license CC BY 4.0 | arXiv abs page |
| Venue | NeurIPS 2026 ("accepted … 2026-09-25") | repo:README.md "Updates" |
| Code license | MIT | repo:README.md; commit 0471a45e "Change project license to MIT" |
| Checkpoint license | "research-only-see-terms" | hf:README.md frontmatter |
| Released | Sept 2026 enhanced release: code, checkpoints, HOT3D/ARCTIC caches. Training code and preprocessing code are still TODO | repo:README.md "Updates", "TODO List" |

## 2. Problem setup (paper)

| field | value | source |
|---|---|---|
| Input | Egocentric video V={I_t}, t=1..T; two possibly interacting hands; moving first-person camera | [SH] §3 intro |
| Output | World-space dual-hand motion x ∈ R^{T×108} | [SH] §3 "Setup and notation" |
| Per-hand state | x^h_t = (p, r, θ) ∈ R^54: p ∈ R^3 world root translation; r ∈ R^6 continuous 6D wrist rotation [Zhou et al. 2019]; θ ∈ R^45 MANO finger axis-angle | [SH] §3 |
| Per-frame hand estimator | Frozen WiLoR [34]. Gives a per-hand camera-frame MANO observation y^h_t ∈ R^54 and a visual feature f^h_t ∈ R^1280 | [SH] §3; §4.1 "Implementation details"; App. A ("released WiLoR … checkpoints, with no fine-tuning") |
| Camera / scene | Frozen geometry model G = Depth Anything 3 [18]. Gives a per-frame camera pose g_t ∈ R^9 (6D rotation + 3D translation) and a scene-geometry token s_t ∈ R^3072 | [SH] §3; App. A |
| World-frame observation | The camera pose rigidly transforms the observations into ȳ ∈ R^{T×108}. g_t is also cross-attention conditioning | [SH] §3 |
| Time convention | τ=1 is clean motion, τ=0 is the noise prior. t indexes video frames | [SH] §3 |
| Two learned modules | Quality network (QN) plus a quality-aware flow-matching DiT. Trained in sequence: QN pretrained and frozen, then the DiT is trained on the QN's predicted q̂ | [SH] §3 intro |
| Alternative estimator | Swapping WiLoR for HaMeR and retraining gives HOT3D W-MPJPE 62.16 mm (vs 57.83 with WiLoR) | [SH] App. B.3, Tab. 5 |

## 3. The four quality channels

| field | value | source |
|---|---|---|
| Signal | q_t = [q^L_W, q^L_F, q^R_W, q^R_F] ∈ [0,1]^4: wrist and fingers of each hand | [SH] §3.1 |
| Why separate channels | "wrist error is dominated by global translation drift on the tens-of-millimeter scale, whereas finger error lives at the millimeter scale" | [SH] §3.1 |
| Wrist error | e_W = ‖j̄_0 − j_0‖ + r_0·arccos((tr(R̄ᵀR) − 1)/2), with r_0 = 85 mm (canonical MANO palm radius) | [SH] Eq. 1 |
| Finger error | e_F = mean over 15 finger joints of the joint error in the ground-truth wrist frame (alignment rotation R R̄ᵀ, wrist-relative) | [SH] Eq. 2 |
| Error → quality | RBF: q = exp(−e/σ) | [SH] Eqs. 1–2 |
| Bandwidth | σ_⋆ = p80(e_⋆)/ln 10, so the worst 20% of frames get q < 0.1 (exp(−e/σ) = 0.1 at p80). Calibrated per corpus | [SH] Eq. 3, §3.1 |
| Missing frames | Frames without a valid detection or annotation get q = 0 | [SH] §3.1 |
| HOT3D σ values | σ_W ≈ 26.2 mm, σ_F ≈ 6.4 mm (adaptive, training-time) | [SH] App. C.1 |
| Deployment σ̂ (WiLoR) | σ̂_W = 24.95 mm, σ̂_F = 4.32 mm | [SH] App. B.3 |
| Fixed-σ ablation | Fixed σ = 30/50/80/150 mm gives W-MPJPE 65.52/87.51/118.70/128.04, vs 57.83 adaptive | [SH] App. C.1, Tab. 6 |

## 4. Quality network (paper)

| field | value | source |
|---|---|---|
| Target | Predicts per-component error ê in mm, not q directly ("errors live on a physical scale common to all corpora") | [SH] §3.2 |
| Conversion | q̂ = exp(−ê/σ̂), with σ̂ = p80(ê)/ln 10 computed on a local calibration subset | [SH] Eq. 4, Eq. 3 |
| Inputs | Per hand: world-space MANO observation ȳ^h_t, binary hand-confidence flag δ^h_t, camera pose g_t. The WiLoR feature f is deliberately excluded ("dataset-style shortcut") | [SH] §3.2 "Architecture" |
| Architecture | Learnable [geo] token prepended; temporal self-attention encoder with RoPE; shared per-frame 2-layer MLP outputting log(1+ê) | [SH] §3.2 |
| Size | 4-layer Transformer encoder, hidden 256, 4 heads, "with camera-state cross-attention"; weights shared between hands; 3.6M params | [SH] App. A |
| Undetected frames | δ=0 hard-overrides q̂ = 0 | [SH] §3.2 |
| Loss | L_QN = L_MSE + λ_W·L_W, λ_W = 1.0. L_MSE is MSE in log(1+e) space. L_W is the closed-form 1D Wasserstein-1 between sorted log(1+ê) and log(1+e) in a batch, used to restore spread so that p80(ê) matches p80(e) | [SH] Eqs. 5–7 |
| Pretraining data | 8 egocentric corpora, ~10M frames. Tier 1 (MANO GT): HOT3D 1.5M, ARCTIC 0.24M, Re:InterHand 0.15M, H2O 2.0M, HOI4D 0.7M. Tier 2 (3D joints): EgoDex 2.3M, EgoVerse 1.5M, Ego-Exo4D 1.6M | [SH] §3.2; App. F, Tab. 10 |
| Sharing | One QN shared across both benchmarks; the generative model is trained per benchmark | [SH] §4.1 "Datasets" |
| Augmentation | With prob ½ per hand, one of 5 perturbations: Gaussian noise, depth scaling s~U(0.5,2), wrist-rotation jitter 0.05 rad, finger lock-in (5–30 frames), per-hand dropout (5–30 frames). q is updated consistently (Eqs. 12–13). This raises low-q frames from ~20% to >50% | [SH] App. E |
| Calibration quality | Spearman ρ(q̂, q) on HOT3D test: left fingers 0.734, right fingers 0.735, left wrist 0.570, right wrist 0.502 | [SH] App. B.1 |

## 5. Quality-aware flow matching (paper)

| field | value | source |
|---|---|---|
| Baseline path | Standard CFM [Lipman et al.]: x_τ = τ·x_1 + (1−τ)·ε, ε ~ N(0,I); target u_τ = x_1 − ε | [SH] §3.3 "Per-channel forward process" |
| Broadcast | q is broadcast to q̃ ∈ [0,1]^{T×108}: q^h_W fills the wrist slots (p, r), q^h_F fills the finger slots θ | [SH] §3.3 |
| Per-channel schedule | α(τ, q̃) = 1 − (1−τ)(1−q̃); x_τ = α⊙x_1 + (1−α)⊙ε | [SH] Eq. 8 |
| Quality-adjusted target | u_τ(q̃) = (1−q̃)⊙(x_1 − ε) | [SH] Eq. 8 |
| Extremes | q̃=0 recovers standard FM. q̃=1 freezes the channel at x_1 (α≡1, u≡0) | [SH] §3.3 |
| FM loss | L_FM = E‖v_θ(x_τ, τ; c) − u_τ(q̃)‖² | [SH] Eq. 9 |
| Conditioning bundle c_t | Scene token s_t, camera pose g_t, and per-hand z^h_t = [ȳ^h_t; f^h_t]. Injected by cross-attention | [SH] §3.3 after Eq. 9 |
| Extra losses | L_smooth: second-order difference on the implied clean x̃_1 = x_τ + (1−τ)·v_θ. L_wrist: wrist-translation L2 (rebalances the 3-d wrist slot against the 45-d fingers). λ_smooth = 0.1, λ_wrist = 5.0 | [SH] Eq. 10 and text |
| Inference init | x_0 = q̃⊙ȳ + (1−q̃)⊙ε. This matches the training x_τ at τ=0 because α(0, q̃) = q̃. Contrasted with SDEdit-style truncated reverse processes | [SH] Eq. 11 |
| Solver | Deterministic ODE dx/dτ = v_θ over τ ∈ [0,1]; 20-step Euler | [SH] §3.3; §4.1 |
| Step sweep | n ∈ {2,5,10,20,30,50}. W-MPJPE varies <9% (54.04 at n=2 to 58.81 at n=50). AccEr goes from 13.97 (n=2) to 3.53 (n=20), 3.34 (n=30), 2.91 (n=50) | [SH] App. D, Fig. 8 |
| Classifier-free guidance | Not used. The paper has 0 occurrences of "guidance" or "classifier" | [SH] full-text search |
| Rectified flow | Not cited. Only CFM [21] is cited for the linear path | [SH] references |

## 6. DiT denoiser (paper)

| field | value | source |
|---|---|---|
| Tokenization | 4 tokens per frame (left/right wrist, left/right fingers) | [SH] §3.3 "Denoiser architecture"; App. A |
| AdaLN | Driven by m_t = MLP_τ(τ) + MLP_q(q̃_t). It "scale[s] wrist and finger updates to match the per-channel quality structure" | [SH] §3.3 |
| Attention | Temporal self-attention with RoPE over all 4T tokens; cross-attention to c_t | [SH] §3.3 |
| Depth / width / heads | 8 blocks, hidden 512, 8 heads | [SH] App. A |
| FFN | "4× GeGLU [Shazeer 2020]" | [SH] App. A (the code disagrees, see below) |
| Params | 70.7M total = DiT 66.8M + QN 3.6M + auxiliary heads 0.3M | [SH] App. A |
| Clip length | T = 150 frames | [SH] §4.1; App. D; App. F (ARCTIC at 30 fps) |
| Training | Single H100, bf16 autocast, AdamW lr 1e-4, wd 0.01, batch 16, 1000-step linear warmup + cosine decay, grad clip 1.0, seed 42. Early-stops on eval W-MPJPE in 6–8 H100-hours per benchmark | [SH] App. A |
| Inference cost | 27.29 s per 150-frame clip on H100 in total. DA3 17.09 s, WiLoR 9.96 s, DiT×20 steps 0.23 s, QN <0.01 s | [SH] App. D, Tabs. 8–9 |
| AdaLN-Zero | Not mentioned in the paper | [SH] full-text search |

## 7. Evaluation (paper)

| field | value | source |
|---|---|---|
| Benchmarks | HOT3D (long missing-hand spans) and ARCTIC (persistent hand-object occlusion) | [SH] §4 |
| HOT3D test | 244 clips, n=485 hand-clips | [SH] App. B.3 Tab. 5 caption; repo README "244 HOT3D" |
| ARCTIC test | P2 protocol. The test subject s03 GT is withheld, so they report on the validation subject s05: 34 sequences → 155 clips of T=150 at 30 fps | [SH] App. F |
| Metrics | PA-MPJPE, W-MPJPE (similarity alignment on the first frame), WA-MPJPE (global alignment over all frames), AccEr (m/s²). MRRPE on ARCTIC only. All GT-valid frames, no detection-failure filtering | [SH] §4.1; App. G Eqs. 14–17 |
| SLAM-based baselines | HaMeR-SLAM, WiLoR-SLAM, HMP-SLAM (with DROID-SLAM camera) | [SH] §4.1 "Baselines" |
| Native world-space baselines | HaWoR, UniHand (numbers quoted, code unreleased), Dyn-HaMR | [SH] §4.1 |
| HOT3D headline | Ours: PA 4.02 / W 57.83 / WA 21.02 / AccEr 3.83. HaWoR: 8.65 / 71.89 / 30.20 / 7.80. UniHand‡: 4.76 / 63.97 / 25.24 / 4.93 | [SH] Tab. 1 |
| HOT3D claim | "~20% over HaWoR, the strongest baseline with public code". Derived: (71.89−57.83)/71.89 = 19.6%; vs UniHand 9.6% | [SH] §4.2 |
| ARCTIC headline | Ours: PA 8.07 / W 124.59 / WA 32.66 / AccEr 4.67 / MRRPE 93.71. HMP-SLAM W 166.21. HaWoR W 171.61, MRRPE 112.36 | [SH] Tab. 2 |
| ARCTIC claim | "~25% over the strongest baseline". Derived: vs HMP-SLAM 25.0%, vs HaWoR 27.4% | [SH] §4.2 |
| Key ablations (HOT3D W-MPJPE) | Full 57.83. Standard FM (q̃≡0) 92.32. Single scalar q per hand 61.23. Single global m_t (no per-token AdaLN) 64.66. Single token per frame 118.61. Oracle q 48.16. Per-corpus median q 104.62. Binary detection mask 135.35 | [SH] Tab. 3 |
| Limitations | Quality signal is calibrated to a specific upstream estimator. Over long low-quality horizons the model "may drift toward plausible but not faithfully grounded configurations" | [SH] §5 |

## 8. Released code and configs (enhanced version)

There are no `configs/*.yaml`. Hyperparameters live in `hf:dit_hot3d/args.json`, `hf:dit_arctic/args.json` and `hf:qn/args.json`. Checkpoints are pinned in repo:release/hub-revisions.json.

| field | value | source |
|---|---|---|
| DiT layers / heads | `layers: 8`, `heads: 8` | hf:dit_hot3d/args.json, hf:dit_arctic/args.json |
| Hidden size | inner_dim = heads × 64 = 512 | repo:utils/model_util.py (`inner_dim = args.heads * 64`, `attention_head_dim=64`) |
| Clip length | `max_len: 150`, `min_len: 150` | hf:dit_*/args.json |
| 4-token split | `modality_tokens: true`. Wrist token = rot6d (6) + translation (3) = 9 dims; finger token = 45 dims; a learned modality embedding is added | args.json; repo:model/hand_dit.py `_forward_modality_tokens` |
| Per-component q in AdaLN | `q_adaln: true`, `use_percomp_q: true`, so q_adaln_dim = 4 | args.json; repo:utils/model_util.py |
| How q enters AdaLN | cond = t_emb + head_global + betas_emb + crop_emb; per frame, q_embed(q_t) is added and the same vector goes to all 4 tokens of that frame; then adaln_proj. The last layer of q_embed is zero-initialized | repo:model/hand_dit.py `__init__`, `_forward_modality_tokens` |
| Block structure | LayerNorm without affine; shift/scale/gate modulation around self-attention, then scene/head/obs cross-attentions, then FFN. Learned `scale_shift_table` added to the per-token projection (gated residuals, adaLN-style). `zero_init: false` | repo:model/hand_dit.py `HandDiTBlock`; args.json |
| FFN | `SwiGLU` (w3(silu(w1 x) * w2 x)), inner = 4×dim | repo:model/hand_dit.py `class SwiGLU` |
| RoPE | 1D RoPE over frame index, repeated 4× so all 4 tokens of a frame share a position | repo:model/hand_dit.py |
| Timestep embedding | Sinusoidal of t×1000, then MLP (freq_dim 256) | repo:model/hand_dit.py `ContinuousTimestepEmbedding` |
| Scene features | `scene_feat_dim: 2048` (VGGT-Omega `scene_pooled`) | args.json; docs/enhanced_version.md |
| Visual features | `visual_dim: 1280`, `vit_obs_mode: perhand`, `dit_visual_proj_dim: 256`, `vit_obs_missing_token: true` | args.json; repo:model/quality_network.py `QualityGatedConditioning` |
| Residual wrist | `trans_residual: true`, `trans_base_smooth_win: 9` | args.json; docs/enhanced_version.md |
| eff_t input | `no_eff_t: true`: the per-token effective time is NOT fed as an input feature in the released checkpoints | args.json |
| Obs quality gate | `no_quality_cond_gate: true`: the null-token blending q·obs + (1−q)·null is disabled in the released DiT | args.json; repo:model/quality_network.py |
| QN size | `qn_d_model: 256`, `qn_heads: 4`, `qn_layers: 4`; FFN 4×; pre-norm, GELU | hf:qn/args.json; repo:utils/model_util.py; repo:model/quality_network.py |
| QN output | `qn_output_mode: error`, `qn_output_percomp: true`; `qn_da3_depth_dim: 3` (local depth cue per hand); camera features concatenated (`qn_cam_feat_dim: 9`) | hf:qn/args.json |
| QN geo token | Code passes `use_geo_token=True`; `qn_use_geo_token: false` in args.json is ignored | repo:utils/model_util.py |
| σ̂ calibration | p80 over detected frames / ln 10 | repo:sample/infer_clips.py `calibrate_qn_sigma` |
| σ̂ HOT3D | (W, F) = 26.183, 3.994 mm | repo:README.md `--qn_sigma_override` |
| σ̂ ARCTIC | (W, F) = 29.102, 11.378 mm | repo:README.md `--qn_sigma_override` |
| Sampler | Euler, `--n_steps` default 20 | repo:diffusion/flow_matching.py; repo:sample/infer_clips.py L614 |
| Sampler init | x = q_per_dim⊙proposal + (1−q_per_dim)⊙ε (matches Eq. 11) | repo:diffusion/flow_matching.py `sample_with_quality_schedule` |
| Sampler start time | Integration starts at t_start = min(q_per_dim), clamped to [0, 0.95], not at 0 | repo:diffusion/flow_matching.py `sample_with_quality_schedule` |
| Prediction type | Velocity only (`pred_type="v"`) | repo:diffusion/flow_matching.py |
| Checkpoints | `save/dit_hot3d/model.pt`, `save/dit_arctic/model.pt`, `save/qn/model.pt` (~580 MB total) | repo:README.md |

**What the enhanced version changes** (docs/enhanced_version.md):
- VGGT-Omega replaces Depth Anything 3 for camera poses and scene features.
- The wrist is predicted as a residual correction to a smoothed WiLoR trajectory in a gravity-aligned world frame.
- Each hand's WiLoR visual feature is projected to a compact representation and fused with its observation.
- Joint-velocity and joint-acceleration losses replace the auxiliary wrist-translation loss; the smoothness loss stays.
- The QN additionally uses local depth cues around each hand from VGGT-Omega.

Reported results, paper → enhanced (PA / W / WA / AccErr):
- HOT3D: 4.02/57.83/21.02/3.83 → 3.39/45.19/18.57/2.82
- ARCTIC: 8.07/124.59/32.66/4.67 → 7.57/92.52/30.43/3.36

---

## Sources to create

| id | title | short | authors | year | url | type |
|---|---|---|---|---|---|---|
| stablehand-paper | StableHand: Quality-Aware Flow Matching for World-Space Dual-Hand Motion Estimation from Egocentric Video | StableHand | Zeng, Yao, Zhang, Yang, Potamias, Zuo | 2026 | https://arxiv.org/abs/2605.18553 | paper |
| stablehand-repo | StableHand official code (README) | StableHand repo | Zeng et al. | 2026 | https://github.com/huajian-zeng/stablehand | repo |
| stablehand-enhanced-docs | StableHand Enhanced Version | StableHand enhanced | Zeng et al. | 2026 | https://github.com/huajian-zeng/stablehand/blob/main/docs/enhanced_version.md | docs |
| stablehand-dit-hot3d-config | StableHand HOT3D motion prior args.json | StableHand DiT config | Zeng et al. | 2026 | https://huggingface.co/huajian-zeng/stablehand/blob/main/dit_hot3d/args.json | config |
| stablehand-qn-config | StableHand Quality Network args.json | StableHand QN config | Zeng et al. | 2026 | https://huggingface.co/huajian-zeng/stablehand/blob/main/qn/args.json | config |
| stablehand-model-card | huajian-zeng/stablehand model card | StableHand HF | Zeng et al. | 2026 | https://huggingface.co/huajian-zeng/stablehand | model-card |
| flow-matching-paper | Flow Matching for Generative Modeling | Flow Matching | Lipman, Chen, Ben-Hamu, Nickel, Le | 2022 | https://arxiv.org/abs/2210.02747 | paper |
| rectified-flow-paper | Flow Straight and Fast: Learning to Generate and Transfer Data with Rectified Flow | Rectified Flow | Liu, Gong, Liu | 2022 | https://arxiv.org/abs/2209.03003 | paper |
| dit-paper | Scalable Diffusion Models with Transformers | DiT | Peebles, Xie | 2022 | https://arxiv.org/abs/2212.09748 | paper |
| ddpm-paper | Denoising Diffusion Probabilistic Models | DDPM | Ho, Jain, Abbeel | 2020 | https://arxiv.org/abs/2006.11239 | paper |
| mano-paper | Embodied Hands: Modeling and Capturing Hands and Bodies Together | MANO | Romero, Tzionas, Black | 2017 | https://mano.is.tue.mpg.de/ | paper |
| hot3d-paper | Introducing HOT3D: An Egocentric Dataset for 3D Hand and Object Tracking | HOT3D | Banerjee, Shkodrani, Moulon, Hampali, Zhang, Fountain et al. | 2024 | https://arxiv.org/abs/2406.09598 | paper |
| arctic-paper | ARCTIC: A Dataset for Dexterous Bimanual Hand-Object Manipulation | ARCTIC | Fan, Taheri, Tzionas, Kocabas, Kaufmann, Black, Hilliges | 2022 | https://arxiv.org/abs/2204.13662 | paper |
| wilor-paper | WiLoR: End-to-end 3D Hand Localization and Reconstruction in-the-wild | WiLoR | Potamias, Zhang, Deng, Zafeiriou | 2024 | https://arxiv.org/abs/2409.12259 | paper |
| hamer-paper | Reconstructing Hands in 3D with Transformers | HaMeR | Pavlakos, Shan, Radosavovic, Kanazawa, Fouhey, Malik | 2023 | https://arxiv.org/abs/2312.05251 | paper |
| depth-anything-3-paper | Depth Anything 3: Recovering the Visual Space from Any Views | DA3 | Lin, Chen, Liew, Chen, Li, Shi et al. | 2025 | https://arxiv.org/abs/2511.10647 | paper |
| roformer-paper | RoFormer: Enhanced Transformer with Rotary Position Embedding | RoPE | Su, Lu, Pan, Murtadha, Wen, Liu | 2021 | https://arxiv.org/abs/2104.09864 | paper |
| glu-variants-paper | GLU Variants Improve Transformer | GLU variants | Shazeer | 2020 | https://arxiv.org/abs/2002.05202 | paper |
| sdedit-paper | SDEdit: Guided Image Synthesis and Editing with Stochastic Differential Equations | SDEdit | Meng, He, Song, Song, Wu, Zhu, Ermon | 2021 | https://arxiv.org/abs/2108.01073 | paper |
| rot6d-paper | On the Continuity of Rotation Representations in Neural Networks | 6D rotation | Zhou, Barnes, Lu, Yang, Li | 2018 | https://arxiv.org/abs/1812.07035 | paper |

Notes on these sources:
- **MANO venue:** ACM TOG 36(6), Proc. SIGGRAPH Asia 2017. I took this from [SH] ref [37]; I did not open the MANO paper.
- **Rotation paper date:** arXiv 2018, CVPR 2019 (per [SH] ref [53] "2019").
- **DDPM:** cited only in [SH] Related Work as the generic diffusion reference. There is no DDPM-vs-FM contrast, so it is optional.
- **Rectified flow:** not cited by StableHand. Add it only if your flow-matching note covers straight paths in general.

One-line claims with locations:

| source | claim | location |
|---|---|---|
| flow-matching-paper | FM regresses vector fields of fixed conditional probability paths (simulation-free CNF training) | Abstract |
| flow-matching-paper | OT path: μ_t = t·x_1, σ_t = 1 − (1−σ_min)t, conditional VF u_t = (x_1 − (1−σ_min)x)/(1 − (1−σ_min)t), and the CFM loss | §4.1 "Example II", Eqs. 20–23 |
| flow-matching-paper | The OT path's conditional VF "has constant direction in time" | Fig. 2 caption |
| rectified-flow-paper | Learn an ODE that follows straight paths between π_0 and π_1 via least squares; straight paths are shortest and can be simulated with few steps | Abstract |
| dit-paper | Transformer on latent patches replaces the U-Net; more Gflops → lower FID; DiT-XL/2 reaches FID 2.27 on ImageNet 256 | Abstract |
| dit-paper | adaLN-Zero regresses γ, β plus a dimensionwise scale α applied before each residual connection, initialized so each block is the identity | §3 "DiT block design" (adaLN-Zero block) |
| dit-paper | adaLN-Zero beats cross-attention, in-context and vanilla adaLN conditioning; cross-attention adds ~15% Gflops | §5, Fig. 5 |
| hot3d-paper | >833 min (>3.7M images); 19 subjects, 33 rigid objects; Project Aria + Quest 3; mocap ground truth | Abstract |
| arctic-paper | 2.1M frames of two hands manipulating articulated objects, with 3D hand/object meshes and contact | Abstract |
| wilor-paper | Real-time fully convolutional hand localization + transformer 3D reconstruction; >2M in-the-wild hand images | Abstract |
| hamer-paper | Fully transformer (large ViT) hand mesh recovery; scales data and capacity | Abstract |
| depth-anything-3-paper | Plain transformer, depth-ray target; spatially consistent geometry and camera poses from any number of views | Abstract |
| roformer-paper | RoPE encodes absolute position with a rotation matrix, giving relative-position dependence in attention | Abstract |
| glu-variants-paper | GLU variants in Transformer FFNs beat ReLU/GELU | Abstract |
| sdedit-paper | Add noise to the input, then denoise with a diffusion SDE prior | Abstract |
| rot6d-paper | Rotation representations in ≤4D are discontinuous; 5D/6D are continuous and easier to learn | Abstract |

---

## Fork status

**tungnguyenlam/stablehand is identical to upstream. It has no extra commits.**
- The GitHub compare `huajian-zeng/stablehand:main...tungnguyenlam:stablehand:main` returns `status: identical, ahead_by: 0, behind_by: 0`. The merge base is `0471a45e32` ("Change project license to MIT", 2026-09-25T02:18:11Z).
- Both repos have a single `main` branch at `0471a45e32`.
- The fork was created 2026-10-16T03:45:53Z, with parent huajian-zeng/stablehand.
- Upstream was created 2026-05-12 and has 57 stars.

Every repo fact above therefore applies to the fork as-is.

---

## Disagreements / unverified

**Paper vs code**
1. **FFN type.** The paper says "4× GeGLU" (App. A). The code is `SwiGLU` with SiLU gating, 4× inner (repo:model/hand_dit.py). Possibly the paper's model differed; cite whichever source you describe.
2. **Geometry model.** The paper uses DA3 with a 3072-d scene token. The released model uses VGGT-Omega with `scene_feat_dim: 2048` (enhanced_version.md, args.json).
3. **Wrist target and losses.** The paper predicts absolute wrist translation and uses λ_wrist = 5.0. The release predicts residual wrist translation (`trans_residual: true`) and swaps L_wrist for velocity/acceleration losses (enhanced_version.md). I found no released λ values; training code is not released.
4. **Visual feature.** The paper puts the raw f^h_t (1280-d) into the cross-attention bundle. The release projects it to 256 and uses a missing-token (args.json).
5. **ODE interval.** The paper says ODE over τ ∈ [0,1] from Eq. 11's init. The code starts at t_start = min(q) clamped to [0, 0.95]. In practice this is usually 0, since any undetected frame has q=0, but it is not guaranteed.
6. **Per-token effective time and the obs gate.** The code has both a per-token "effective time" input (eff_t = 1−(1−t)(1−q)) and a quality-gated observation token (q·obs + (1−q)·null). Both are disabled in the released checkpoints (`no_eff_t: true`, `no_quality_cond_gate: true`). Neither appears in the paper. Don't describe them as part of StableHand.
7. **QN camera input.** App. A says the QN has "camera-state cross-attention". §3.2 and the code concatenate g_t into the per-hand input; `qn_cam_ca_dim: 0` in args.json.
8. **Inputs not in the paper.** The code also conditions AdaLN on MANO shape betas (20-d), a head-motion global embedding and a crop-position embedding. None of these are in the paper text.
9. **σ̂ values.** The release uses σ̂_F = 3.99 mm on HOT3D; the paper's App. B.3 has 4.32 mm and App. C.1 has σ_F ≈ 6.4 mm. These come from different calibration sets and model versions.

**Inside the paper**
10. **Table 5 vs Table 1.** Tab. 5 "Ours (WiLoR)" gives WA 19.90 / PA 3.65 / AccEr 3.53. Tab. 1 gives 21.02 / 4.02 / 3.83 for the same setting. W-MPJPE 57.83 matches. The Fig. 8 sweep also gives AccEr 3.53 at n=20 while claiming to be "anchored to Tab. 1". Cite Tab. 1 for headline numbers.
11. **Table 6 caption.** It says rows use oracle q at inference, yet the "adaptive σ (Ours)" row equals the predicted-q full model (57.83), not oracle (48.16, Tab. 3c).
12. **Wrist error definition.** App. E says "the wrist error of Eq. 1 is defined on translation alone", but Eq. 1 includes a rotation term r_0·arccos(…).
13. **Headline percentages.** "20–25%" is relative to different baselines per dataset: HaWoR on HOT3D (excluding UniHand, whose numbers are quoted from its paper) and HMP-SLAM on ARCTIC.

**Unverified / not read**
- MANO internals (e.g. 778 vertices, PCA pose space): MANO paper not opened. The only MANO numbers I can source are StableHand's own: 45-d finger axis-angle, 16 joints / 15 finger joints, palm radius 85 mm.
- VGGT-Omega: only a README link; no paper read; I have no citation for it.
- Exact DiT section numbering: the adaLN-Zero text sits in §3 just before "4. Experimental Setup", and the results are in §5 / Fig. 5. Check the subsection title before using `where=`.
- Project page https://huajian-zeng.github.io/projects/stablehand/: not read.
- DiT param count: 66.8M is from the paper only. I did not load checkpoints to count, and the enhanced model's count is unknown.

---

## Concept map

| idea | general or StableHand-specific | one sentence |
|---|---|---|
| Flow matching / conditional FM | General | Train a vector field by regressing a known conditional velocity along a fixed noise-to-data path, then sample by integrating the ODE; StableHand builds on CFM's linear path [SH §3.3; FM §4.1]. |
| Linear (OT / rectified) interpolation path | General | x_τ = τ·x_1 + (1−τ)·ε with constant velocity x_1 − ε; StableHand cites only CFM for it, not rectified flow. |
| ODE sampling with Euler steps | General | Deterministic integration of dx/dτ = v_θ; StableHand uses 20 Euler steps and shows a smoothness vs step-count trade-off [SH App. D]. |
| Diffusion Transformer (DiT) | General | A transformer denoiser conditioned on timestep (and here quality) via adaptive LayerNorm; StableHand's version is 8 blocks, width 512, 8 heads [SH App. A; DiT]. |
| AdaLN / adaLN-Zero conditioning | General | Regress per-block shift/scale (and gate, in adaLN-Zero) from a conditioning vector; StableHand feeds τ + q̃ through it, and the code uses gated adaLN with a learned scale-shift table but `zero_init: false`. |
| Cross-attention conditioning | General | Inject external context (scene, camera, observations) as keys/values; StableHand puts the observation bundle here rather than in AdaLN. |
| Transformer block, self-attention, RoPE | General | Temporal self-attention over 4T tokens, with rotary positions over the frame index (shared by a frame's 4 tokens in code). |
| GLU-family FFN (GeGLU / SwiGLU) | General | Gated FFN; the paper says GeGLU, the code is SwiGLU. |
| MANO hand model | General (hands domain) | Parametric hand model; StableHand's state is MANO 45-d finger axis-angle plus 6D wrist rotation plus 3D translation [SH §3]. |
| 6D continuous rotation representation | General | Continuous rotation parametrization that is easier to regress than quaternions or Euler angles [Zhou et al.]. |
| Per-frame hand mesh estimators (HaMeR, WiLoR) | General (upstream input) | ViT-based single-image MANO regressors; StableHand freezes WiLoR as its noisy observation source. |
| Monocular camera / geometry estimation (DROID-SLAM, DA3, VGGT-Omega) | General (upstream input) | Provides camera poses that lift camera-frame hands into the world frame; baselines use SLAM, StableHand uses DA3 (paper) or VGGT-Omega (release). |
| World-space MPJPE metric family | General (hands/body domain) | PA-, W-, WA-MPJPE, AccEr and MRRPE separate articulation error, drift and jitter [SH App. G]. |
| SDEdit-style truncated reverse process | General (contrast) | Start every channel from one intermediate noise level; StableHand contrasts this with its per-channel init [SH §3.3]. |
| Per-component observation quality signal (4 channels, RBF + p80 bandwidth) | StableHand-specific | Wrist and finger errors per hand mapped to [0,1] via exp(−e/σ), with σ set so the worst 20% of frames get q < 0.1 [SH §3.1]. |
| Learned quality network with Wasserstein-1 distribution loss | StableHand-specific | Predicts per-component error from observations, detection flags and camera pose, then converts to q with deployment-calibrated σ̂ [SH §3.2]. |
| Per-channel forward schedule + quality-adjusted velocity target | StableHand-specific (core novelty) | α = 1 − (1−τ)(1−q̃) freezes high-quality channels (u=0) and regenerates low-quality ones from noise [SH Eq. 8]. |
| Quality-aware ODE initialization | StableHand-specific | x_0 = q̃⊙ȳ + (1−q̃)⊙ε, matching the training forward process at τ=0 per channel [SH Eq. 11]. |
| Four-token-per-frame tokenization (wrist/fingers × L/R) | StableHand-specific | Lets attention and modulation treat components separately; removing it is the worst ablation (118.61 mm) [SH Tab. 3]. |
| Classifier-free guidance | Not used | Absent from the paper and the code paths I read. |

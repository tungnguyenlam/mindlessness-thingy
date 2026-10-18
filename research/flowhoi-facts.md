# FlowHOI: sourced fact sheet

Compiled 2026-10-18. Every value below was read from the arXiv v1 HTML (`https://arxiv.org/html/2602.13444v1`), the official GitHub repository (`https://github.com/huajian-zeng/flowhoi`), or the Hugging Face checkpoint repository (`https://huggingface.co/huajian-zeng/flowhoi`).

Shorthand:
- `[FH]` = `flowhoi-paper` (arXiv:2602.13444v1 HTML)
- `repo:<path>` = `flowhoi-repo` (`https://github.com/huajian-zeng/flowhoi/blob/main/<path>`)
- `hf:<path>` = `flowhoi-hot3d-config` / `flowhoi-grasp-config` (`https://huggingface.co/huajian-zeng/flowhoi/blob/main/<path>`)

---

## 1. Identity

| Field | Value | Source |
| --- | --- | --- |
| Title | FlowHOI: Flow-based Semantics-Grounded Generation of Hand-Object Interactions for Dexterous Robot Manipulation | `[FH]` title; arXiv abs |
| Authors | Huajian Zeng, Lingyun Chen, Jiaqi Yang, Yuantai Zhang, Fan Shi, Peidong Liu, Xingxing Zuo | `[FH]` header; arXiv abs |
| Affiliations | MBZUAI, Technical University of Munich (TUM), National University of Singapore (NUS), Westlake University | `repo:README.md`; project page |
| Venue | NeurIPS 2026 (accepted 2026-09-25) | `repo:README.md` Updates; project page |
| arXiv | `2602.13444v1` (uploaded 2026-02-13); license CC BY 4.0 | `[FH]`; `repo:README.md` |
| Code release | Two-stage inference and visualization code, pretrained checkpoints (`egodex_grasp`, `grab_full`, `hot3d_full`), and demo data (`flowhoi-data`) released 2026-09-07 | `repo:README.md` Updates |

---

## 2. Problem formulation and representation (`§IV-A`, `App. A`)

| Field | Value | Source |
| --- | --- | --- |
| Inputs | First egocentric RGB observation $\mathbf{I}$ (giving initial hand-object state $\mathbf{x}_{\text{init}} = (\mathbf{O}_0, \mathbf{H}_0^l, \mathbf{H}_0^r)$ and object mesh $\mathcal{M}$), language action description $T$, and 3D Gaussian Splatting (3DGS) scene $\mathcal{G}$ | `[FH]` §IV-A, §IV-C |
| Output sequence | $\mathbf{x} = \{(\mathbf{H}_t^l, \mathbf{H}_t^r, \mathbf{O}_t)\}_{t=0}^{N-1} \in \mathbb{R}^{N \times D}$ | `[FH]` §IV-A, Eq. 6 |
| Sequence length $N$ | $N = 200$ frames total: $N_g = 50$ for grasping ($t = 0 \dots 49$, transition frame $t_g = N_g - 1 = 49$) and $150$ for manipulation | `[FH]` §IV-A, App. A |
| Per-frame dimension $D$ | $D = 117$ ($2 \times 54$ hand features $+ 9$ object pose features); grasping stage generates only the $D_h = 108$ hand features while the object is static | `[FH]` §IV-A Eqs. 7–8, §IV-C, App. A |
| Object pose $\mathbf{O}_t$ | $\mathbf{O}_t = (\boldsymbol{p}_t^o, \boldsymbol{r}_t^o) \in \mathbb{R}^9$: translation $\boldsymbol{p}_t^o \in \mathbb{R}^3$ and continuous 6D rotation $\boldsymbol{r}_t^o \in \mathbb{R}^6$ | `[FH]` §IV-A, Eq. 7 |
| Per-hand state $\mathbf{H}_t^h$ | $\mathbf{H}_t^h = (\tilde{\boldsymbol{p}}_t^h, \boldsymbol{r}_t^h, \boldsymbol{\theta}_t^h, \mathbf{s}_t^h) \in \mathbb{R}^{54}$ for $h \in \{l, r\}$: root translation $\tilde{\boldsymbol{p}}_t^h \in \mathbb{R}^3$, global wrist 6D orientation $\boldsymbol{r}_t^h \in \mathbb{R}^6$, MANO pose coefficients in PCA space $\boldsymbol{\theta}_t^h \in \mathbb{R}^{24}$, and per-joint signed distances $\mathbf{s}_t^h \in \mathbb{R}^{21}$ | `[FH]` §IV-A, Eq. 8 |
| Signed distance vector | $\mathbf{s}_{t,k}^h = \boldsymbol{j}_k^{h,t} - \Pi_{\mathcal{M}_t}(\boldsymbol{j}_k^{h,t})$ for joint $k \in \{1, \dots, 21\}$, where $\Pi_{\mathcal{M}_t}(\cdot)$ is the closest point on posed object mesh $\mathcal{M}_t$ (wait: $21$ scalar signed distances in the 54-D vector: $3 + 6 + 24 + 21 = 54$; in code `sdf_left: (66, 87)` and `sdf_right: (87, 108)`, i.e. 21 values per hand) | `[FH]` §IV-A Eqs. 8–9; `repo:data_loaders/humanml/utils/data_utils.py` |
| Transition-anchored translation | $\tilde{\boldsymbol{p}}_t^h = \boldsymbol{p}_t^h - \boldsymbol{p}_{t_g}^o$, anchoring hand root translations to the object position at the transition frame $t_g = N_g - 1$ | `[FH]` §IV-A, Eq. 10 |

---

## 3. Initial perception and 3D scene representation (`§IV-C`, `App. A`, `App. G`)

| Field | Value | Source |
| --- | --- | --- |
| Initial hand & object pose | Off-the-shelf hand tracker WiLoR [77] estimates initial hand pose; SAM3D [76] reconstructs object mesh $\mathcal{M}$ and 6D pose in first camera frame, transformed to world coordinates | `[FH]` §IV-C |
| Object geometry encoding | Basis Point Set (BPS) [78] encoding (`bps_dim: 3072` in code), projected via MLP to $256$-D and concatenated per frame | `[FH]` §IV-C, App. A; `hf:hot3d_full/args.json` |
| Text encoder | Frozen T5-Large (`google/flan-t5-large`), projected to $d$ and injected via cross-attention | `[FH]` §IV-C, App. A; `hf:hot3d_full/args.json` |
| 3DGS scene sampling | 3DGS scene reconstructed from egocentric video with moving hands/objects masked out; $N_s$ Gaussian centroids $\mathbf{X} \in \mathbb{R}^{N_s \times 3}$ sampled via Farthest Point Sampling (FPS) (up to $25,000$ points in App. A; `max_scene_points: 10000`, `scene_fps1024` in released config) | `[FH]` §IV-C, App. A; `hf:hot3d_full/args.json` |
| Point features | Geometric features $\mathbf{E} \in \mathbb{R}^{N_s \times d_e}$ from Concerto [83] with $d_e = 1536$; semantic features $\mathbf{U} \in \mathbb{R}^{N_s \times d_u}$ from SceneSplat [84] with $d_u = 768$ | `[FH]` §IV-C Eq. 11, App. A |
| Gated scene fusion | Linear projections $\tilde{\mathbf{E}} = \Phi_e(\mathbf{E}), \tilde{\mathbf{U}} = \Phi_u(\mathbf{U}) \in \mathbb{R}^{N_s \times d_h}$ ($d_h = 512$ for manipulation), combined via learnable channel-wise gate $\boldsymbol{\alpha} \in \mathbb{R}^{d_h}$: $\mathbf{F} = \tilde{\mathbf{E}} + \sigma(\boldsymbol{\alpha}) \odot \tilde{\mathbf{U}}$ | `[FH]` §IV-C Eqs. 12–13; `repo:model/hoi_dit_scene.py` (`GatedSceneFusion`) |
| Spatial positional encoding | 3D coordinates $\mathbf{X}$ encoded with Fourier features $\gamma(\mathbf{X})$ (16 frequencies $\to 96\text{-D} \to 64\text{-D}$ MLP in code; App. A says projected to $64$-D), concatenated with $\mathbf{F}$ and projected: $\mathbf{P} = \Psi([\mathbf{F}, \gamma(\mathbf{X})]) \in \mathbb{R}^{N_s \times d_s}$ | `[FH]` §IV-C Eq. 14, App. A; `repo:model/hoi_dit_scene.py` |
| Perceiver bottleneck | $\mathbf{S}_{\text{local}} = \mathrm{Perceiver}(\mathbf{P}; \mathbf{Q}_0) \in \mathbb{R}^{L_s \times d_s}$ with $L_s = 256$ learnable latent queries (`K = 256` in App. A; `scene_perceiver_num_latents: 256`, 2 layers, 8 heads in config). Cuts cross-attention complexity from $\mathcal{O}(N \cdot N_s)$ to $\mathcal{O}(L_s \cdot N_s + N \cdot L_s)$ | `[FH]` §IV-C Eq. 15, App. A; `hf:hot3d_full/args.json` |
| Global scene token | Voxelized occupancy grid $\mathbf{V} \in \{0, 1\}^{48 \times 48 \times 24}$ processed by a ViT (`vit_depth: 6, vit_dim: 1024, vit_heads: 16, vit_mlp_dim: 2048` in config) to produce $\mathbf{S}_{\text{global}} = \mathrm{ViT}(\mathbf{V}) \in \mathbb{R}^{1 \times d_s}$, injected via AdaLN | `[FH]` §IV-C Eq. 16, App. A; `hf:hot3d_full/args.json` |

---

## 4. Two-stage conditional flow matching and DiT backbones (`§III`, `§IV-C`, `App. A`, `App. B`)

| Field | Value | Source |
| --- | --- | --- |
| Optimal-transport path | $\mathbf{x}_\tau = (1 - (1 - \sigma_{\min})\tau)\mathbf{x}_0 + \tau \mathbf{x}_1$ with $\mathbf{x}_0 \sim \mathcal{N}(\mathbf{0}, \mathbf{I})$, $\tau \in [0, 1]$, and $\sigma_{\min} = 10^{-4}$ | `[FH]` §III Eq. 2; `hf:hot3d_full/args.json` (`sigma_min: 0.0001`) |
| $x_1$-prediction & velocity | Network $f_\theta$ predicts clean motion $\mathbf{x}_1$; velocity derived via $\mathbf{v}_\theta(\mathbf{x}_\tau, \tau, \mathbf{c}) = \frac{f_\theta(\mathbf{x}_\tau, \tau, \mathbf{c}) - (1 - \sigma_{\min})\mathbf{x}_\tau}{1 - (1 - \sigma_{\min})\tau}$ | `[FH]` §III Eq. 3, §IV-C Eqs. 18–19, App. B |
| Stage 1 (Grasping DiT) | $L = 8$ layers, $d = 256$, $d_{\text{ff}} = 512$, $n_h = 4$ heads, dropout $0.1$. Generates $N_g = 50$ frames of hand states $\mathbf{x}^g \in \mathbb{R}^{N_g \times 108}$ conditioned on $\mathbf{c}^g = \{\mathrm{BPS}(\mathcal{M}); \mathrm{T5}(T_g); \mathbf{x}_{\text{init}}\}$, where $T_g$ is an MLLM-extracted grasp sub-instruction | `[FH]` §IV-C Eq. 17, App. A; `hf:egodex_grasp/args.json` |
| Stage 2 (Manipulation DiT) | $L = 8$ layers, $d = 512$, $d_{\text{ff}} = 1024$, $n_h = 8$ heads, dropout $0.1$. Generates full $N = 200$ frames $\mathbf{x}^m \in \mathbb{R}^{N \times 117}$ conditioned on $\mathbf{c}^m = \{\mathrm{BPS}(\mathcal{M}); \mathrm{T5}(T); \mathbf{S}_{\text{local}}; \mathbf{S}_{\text{global}}; \mathbf{x}_{t_g}^g\}$ | `[FH]` §IV-C Eq. 22, App. A; `hf:hot3d_full/args.json` |
| Subsequence soft inpainting | Temporal mask $\mathbf{M} \in \{0, 1\}^N$ ($\mathbf{M}_t = 0$ for $t \le t_g$, $\mathbf{M}_t = 1$ for $t > t_g$). For $\tau < 0.9$: $\bar{\mathbf{x}}_\tau^m = \mathbf{M} \odot \mathbf{x}_\tau^m + (1 - \mathbf{M}) \odot \mathbf{x}_{[0, t_g]}^g$. Disabled for $\tau \ge 0.9$ so the final 5 Euler steps refine the full sequence without a seam | `[FH]` §IV-C Eq. 23 |
| Transition hard clamp | At every ODE step, $\bar{\mathbf{x}}_\tau^m[t_g] \leftarrow \mathbf{x}_{t_g}^g$; masked training loss $\mathcal{L}_{\text{flow}}^m$ is applied only to $\mathbf{M}_t = 1$ ($t > t_g$) | `[FH]` §IV-C Eqs. 24–25 |
| Contrastive alignment loss | TMR-inspired symmetric InfoNCE $\mathcal{L}_{\text{align}} = \frac{1}{2}(\mathcal{L}_{\text{t2m}} + \mathcal{L}_{\text{m2t}})$ in a shared $512$-D latent space, weighted by $\lambda_{\text{align}} = 0.1$. Motion encoder: 4-layer Transformer encoder with `[CLS]` token; text pooler: mean pooling over frozen T5-Large + 2-layer MLP; temperature initialized to $0.7$ and clamped to $[0.01, 100]$. Used only during training | `[FH]` §IV-C Eqs. 20–21, 26, App. A |
| Training & sampling | Trained on 1 RTX 6000 Ada GPU (48 GB), batch size 64 (paper §V-B; `batch_size: 128` in `hot3d_full/args.json`), AdamW lr $10^{-4}$, weight decay $0.01$, logit-normal time sampling. Grasping trains 500K steps; manipulation trains 200K steps. CFG drop prob $0.1$, CFG scale $2.5$, 50-step Euler integration ($0.16\text{ s}$ per sequence) | `[FH]` §V-B, §V-D, App. A |

---

## 5. EgoDex HOI reconstruction pipeline (`§IV-B`, `App. C`)

| Step | Details | Source |
| --- | --- | --- |
| 1. Transition frame detection | Smooth wrist trajectory with Gaussian kernel ($\sigma = 2.0$); detect candidate grasp-to-manipulation transition $t_g$ where wrist speed reaches a local minimum within a $1\text{ s}$ window and wrist orientation changes by $> 30^\circ$ | `[FH]` §IV-B, App. C-A |
| 2. 3D object reconstruction | GPT-4o extracts target object label from prompt; sample 8 frames uniformly from $[0, t_g]$ where object is static and segment with SAM3 [74]; estimate metric depth on initial frame with Depth Anything 3 [75] and back-project to a metric 3D point map; reconstruct metric object mesh $\mathcal{M}$ with SAM3D [76] and transform to world coordinates | `[FH]` §IV-B, App. C-B |
| 3. Hand-object alignment | Fit MANO mesh to tracked EgoDex keypoints at $t_g$ via PyRoki IK [96]; optimize object translation offset $\Delta \boldsymbol{p}^o \in \mathbb{R}^3$ and MANO PCA correction $\Delta \boldsymbol{\theta} \in \mathbb{R}^{24}$ via $\min_{\Delta \boldsymbol{p}^o, \Delta \boldsymbol{\theta}} \mathcal{L}_{\text{dist}} + \lambda_{\text{pen}}\mathcal{L}_{\text{pen}} + \lambda_{\text{reg}}\mathcal{L}_{\text{reg}}$ so $\ge 3$ fingers (including thumb) contact the surface without deep penetration; propagate $\Delta \boldsymbol{p}^o, \Delta \boldsymbol{\theta}$ to all frames $0 \dots t_g$ | `[FH]` §IV-B, App. C-C |

---

## 6. Datasets, metrics, and results (`§V`, `App. B`, `App. D–H`)

### Datasets (`§V-A`, `App. D`)
- **GRAB [26]:** 1,335 sequences across 51 everyday objects, downsampled from $\sim 120\text{ Hz}$ to $20\text{ Hz}$; split into 1,125 train / 210 test following DiffH2O [18]. No scene context (`[FH]` App. D-A).
- **HOT3D [29]:** Public training split of 136 Project Aria recordings across 9 subjects ($\sim 2\text{ min}$ each), reconstructed with 3DGS, segmented by object motion into 1,802 clips (1,441 train / 361 test with unseen objects), annotated with GPT-4o descriptions (`[FH]` App. D-B).

### Table I: Main quantitative comparison (`§V-D`, `Tab. I`)

| Dataset | Method | IV ($\text{cm}^3 \downarrow$) | ID ($\text{cm} \downarrow$) | CR ($\% \uparrow$) | IVU ($\downarrow$) | AR ($\uparrow$) | SD ($\text{mm} \uparrow$) | OD ($\text{mm} \uparrow$) | Phy ($\% \uparrow$) | SR ($\% \uparrow$) | HT ($\text{s} \uparrow$) | Time ($\text{s} \downarrow$) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| GRAB | Real Mocap | 6.49 | 0.43 | 6.62 | 0.09 | 1.00 | — | 0.18 | 95.56 | 77.06 | 2.40 | — |
| GRAB | DiffH2O | 13.11 | 1.32 | 8.14 | 0.16 | 0.87 | 0.12 | 0.13 | 89.44 | 33.03 | 0.35 | 6.34 |
| GRAB | LatentHOI | 13.76 | 0.99 | 9.18 | 0.14 | 0.78 | 0.11 | 0.14 | 96.40 | 28.44 | 0.29 | 3.57 |
| GRAB | FlowHOI (Ours) | 10.93 | 1.28 | 6.85 | 0.13 | 0.95 | 0.13 | 0.16 | 90.90 | 55.96 | 1.50 | 0.16 |
| HOT3D | Real Mocap | 2.88 | 0.63 | 1.69 | 0.15 | 1.00 | — | 0.23 | 16.80 | 6.67 | 0.08 | — |
| HOT3D | DiffH2O | 3.25 | 0.66 | 2.07 | 0.18 | 0.71 | 0.15 | 0.23 | 16.47 | 4.00 | 0.03 | 6.54 |
| HOT3D | LatentHOI | 1.54 | 0.44 | 1.59 | 0.21 | 0.65 | 0.12 | 0.18 | 14.36 | 0.00 | 0.00 | 3.21 |
| HOT3D | FlowHOI (Ours) | 3.36 | 0.72 | 2.14 | 0.19 | 0.78 | 0.10 | 0.20 | 17.15 | 5.33 | 0.03 | 0.16 |

### Table II: EgoDex grasping prior ablation on GRAB (`§V-F`, `Tab. II`)
- `w/o prior`: IV $10.40\text{ cm}^3$, ID $1.31\text{ cm}$, CR $6.78\%$, IVU $0.13$, Grasp Error (GE) $0.10\text{ mm}$.
- `w/ prior`: IV $10.93\text{ cm}^3$, ID $1.28\text{ cm}$, CR $6.85\%$, IVU $0.13$, Grasp Error (GE) $0.06\text{ mm}$.

### Table III: Text and scene conditioning ablations (`§V-F`, `Tab. III`)
- **Table III(a) Text encoder (AR $\uparrow$):** CLIP $0.89$, CLIP + Align. Loss $0.88$, T5 $0.92$, T5 + Align. Loss $0.94$.
- **Table III(b) Scene encoder (AR $\uparrow$, FDE $\downarrow$):** w/o scene $(0.73, 0.33)$, PointNet++ $(0.59, 0.44)$, Concerto $(0.75, 0.26)$, SceneSplat $(0.73, 0.30)$, Ours $(0.78, 0.24)$.

### Table IV: Prediction target ablation on GRAB (`App. B`, `Tab. IV`)
- `v-prediction`: Jerk Pos $4.9721\text{ m/s}^3$, Jerk Ang $137.9271\text{ rad/s}^3$, $\text{Acc}_g$ Pos $0.2523\text{ m/s}^2$, $\text{Acc}_l$ Pos $0.1232\text{ m/s}^2$, $\text{Acc}_g$ Rot $0.9567\text{ rad/s}^2$, $\text{Acc}_l$ Rot $3.2414\text{ rad/s}^2$.
- `x-prediction (Ours)`: Jerk Pos $0.0438\text{ m/s}^3$, Jerk Ang $0.4071\text{ rad/s}^3$, $\text{Acc}_g$ Pos $0.0204\text{ m/s}^2$, $\text{Acc}_l$ Pos $0.0055\text{ m/s}^2$, $\text{Acc}_g$ Rot $0.0835\text{ rad/s}^2$, $\text{Acc}_l$ Rot $0.0339\text{ rad/s}^2$.

### Physics simulation & real-robot execution (`§V-C`, `§V-E`, `App. E`, `App. F`)
- **Allegro Hand retargeting:** Allegro Hand v5 (4 fingers, 16 DOF) is $\sim 1.6\times$ larger than a human hand, so MANO 21 keypoints are scaled by $1.6\times$ and solved with PyRoki least-squares IK; pinky targets are approximated by offsetting ring finger keypoints laterally (`[FH]` App. E).
- **Isaac Gym tracking:** DexTrack PPO policy outputs residual joint position targets for low-level PD controllers; 10 trials per test sequence; success requires lifting the object $> 5\text{ cm}$ (or keeping within $5\text{ cm}$ of target trajectory) with sustained finger contact (`[FH]` App. E, App. H-C).
- **Real-world setup:** Dual 7-DOF Franka Emika Panda arms with Allegro Hand v5; offline 3DGS map from MetaCam + Gaussian-LIC; Franka built-in IK for 6D wrist pose + PyRoki for 16-DOF fingers, refined offline by DexTrack and executed open-loop at $1\text{ kHz}$ on four tasks (drinking from a cup, pouring liquid between containers, tilting a container, squeezing dressing) (`[FH]` §V-E, App. F).

---

## 7. Disagreements inside the paper and between paper and code

1. **Scene fusion mechanism (§IV-C Eqs. 12–13 vs App. A):** Main paper §IV-C Eqs. 12–13 describes linear projection and channel-wise sigmoid gating $\mathbf{F} = \tilde{\mathbf{E}} + \sigma(\boldsymbol{\alpha}) \odot \tilde{\mathbf{U}}$, which matches `GatedSceneFusion` in `repo:model/hoi_dit_scene.py`. Appendix A instead says Concerto and SceneSplat features "are fused via bidirectional cross-attention".
2. **Sequence length ($N = 200$ vs `num_frames: 224`):** Appendix A states $N = 200$ frames ($N_g = 50$ grasping, $150$ manipulation). All three released `args.json` files set `num_frames: 224` and `grasp_frame: 49`, while sampling (`repo:sample/condition_hands.py`) cuts sequences to `max_len = 200` / `cut_frame = 200`.
3. **Number of sampled 3DGS scene points ($N_s$):** Appendix A states "up to 25,000 points sampled via Farthest Point Sampling". The released `hot3d_full/args.json` uses `max_scene_points: 10000` and precomputed `scene_fps1024` (`max_concerto_points: 1024`).
4. **Signed distance dimension ($\mathbf{s}_t^h \in \mathbb{R}^{21}$):** Equation 8 writes $\mathbf{s}_t^h \in \mathbb{R}^{21}$ ($3 + 6 + 24 + 21 = 54$ per hand), and `repo:data_loaders/humanml/utils/data_utils.py` confirms 21 scalar signed distances per hand (`sdf_left: (66, 87)`, `sdf_right: (87, 108)`), even though the prose around Eq. 9 calls $\mathbf{s}_{t,k}^h = \boldsymbol{j}_k^{h,t} - \Pi_{\mathcal{M}_t}(\boldsymbol{j}_k^{h,t})$ "vectors".
5. **TMR alignment in released checkpoints:** The paper applies $\mathcal{L}_{\text{align}}$ to both grasping and manipulation (Eqs. 21, 26) with initial temperature $0.7$ (App. A). In the released configs, `use_tmr_alignment` is `true` in `egodex_grasp/args.json` (`tmr_temperature: 0.7`) and `hot3d_full/args.json` (`tmr_temperature: 0.07`), but `false` in `grab_full/args.json`.

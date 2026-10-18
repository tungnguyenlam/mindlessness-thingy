# HumanEgo: sourced fact sheet

Compiled 2026-10-19. Every value below comes from the arXiv v3 paper (`https://arxiv.org/html/2605.24934v3`), the official GitHub repository (`https://github.com/TX-Leo/HumanEgo`), or the Hugging Face checkpoint repository (`https://huggingface.co/Leo-TX/HumanEgo`).

Shorthand:
- `[HE]` = `humanego-paper` (arXiv:2605.24934v3 HTML / LaTeX source)
- `repo:<path>` = `humanego-repo` (`https://github.com/TX-Leo/HumanEgo/blob/main/<path>`)
- `hf:<path>` = `humanego-serve-bread-config` (`https://huggingface.co/Leo-TX/HumanEgo/blob/main/<path>`)

---

## 1. Identity

| Field | Value | Source |
| --- | --- | --- |
| Title | HumanEgo: Zero-Shot Robot Learning from Minutes of Human Egocentric Videos | `[HE]` title; arXiv abs |
| Authors | Zhi Wang, Botao He, Kelin Yu, Seungjae Lee, Ruohan Gao, Furong Huang, Yiannis Aloimonos | `[HE]` header; arXiv abs |
| Affiliation | University of Maryland | `repo:README.md` Contact |
| arXiv | `2605.24934v3` (2026); project page `https://humanego-ai.github.io/` | `[HE]` header; arXiv abs |
| Code & data | `https://github.com/TX-Leo/HumanEgo`, checkpoints at `https://huggingface.co/Leo-TX/HumanEgo`, dataset at `https://huggingface.co/datasets/Leo-TX/HumanEgo` | `[HE]` Abstract; `repo:README.md` |

---

## 2. Sorting the paper's parts (`docs/workflow.md#papers-that-arent-language-models`)

- **What it reuses:**
  - `[[flow-matching]]`: linear interpolation $\mathbf{x}_t = (1 - t)\mathbf{x}_0 + t\mathbf{x}_1$ with $t \sim \mathcal{U}(0, 1)$, $\mathbf{x}_0 \sim \mathcal{N}(\mathbf{0}, \mathbf{I})$, velocity target $\mathbf{v}_{\text{target}} = \mathbf{x}_1 - \mathbf{x}_0$, and $20$-step Euler ODE integration at inference (`[HE]` §3.4, Eq. 2; App. F.1; App. G.3).
  - `[[action-chunking]]`: predicts a $K = 50$-step action chunk $\mathbf{a} \in \mathbb{R}^{K \times D_a}$ and replans at $10\text{ Hz}$ with step stride $2$ ($5\text{ Hz}$ executed rate) and look-ahead offset $25$ (`[HE]` §3.4; App. G.3, Tab. 1).
  - `[[transformer-block]]`, `[[mha]]`, `[[dit]]`: 6-layer, 8-head Transformer decoder ($d = 384$, `AXD*6` sublayers: bidirectional self-attention over $K = 50$ action chunk tokens, cross-attention to RGB patch + ICT context tokens, and dense GELU FFN with $4\times$ ratio $d_{\text{ff}} = 1{,}536$) (`[HE]` App. F.1, Tab. 1; `repo:training/FlowMatchingModel.py`).
  - `[[mano]]`: evaluated in the hand-tracking ablation via WiLoR (`[[wilor-paper]]`) and HaMeR (`[HE]` App. H.1, Figs. 14–15).
  - Related systems: `[[stablehand]]`, `[[flowhoi]]`, `[[vla]]`, `[[vla-cpp]]`.
- **What only HumanEgo does (this system note):**
  1. **Visual & kinematic embodiment bridge:** SAM2 + LaMa arm inpainting with virtual gripper and object keypoint rendering (`§3.2`), plus 5-keypoint MCP Gram–Schmidt hand-to-gripper retargeting (`§3.3`, `App. E.3`) and kinematic grasp latching (`§3.3`, `App. E.1`).
  2. **Interaction-Centric Tokens (ICT):** per-entity 29-D (bimanual) or 20-D (single-hand) token packing entity type $\tau$, reference-frame pose ${}^{\mathrm{REF}}T_E \in \mathbb{R}^9$, viewpoint-invariant relative hand-in-entity poses ${}^ET_{LH}, {}^ET_{RH} \in \mathbb{R}^9$, and grasp state $g \in \mathbb{R}^1$ (`§3.3`, Eq. 1; `repo:utils/ict.py`).
  3. **Flow-matching decoder with region attention & dense auxiliary objectives:** 6-block `AXD` decoder with a learnable Gaussian spotlight bias around the active anchor object (`App. F.1`, Eq. 8) and three dense auxiliary losses—object motion $\mathcal{L}_{\text{OM}}$, 2D trace $\mathcal{L}_{\text{2D}}$, and latent consistency $\mathcal{L}_{\text{LC}}$ (`§3.4`, Eqs. 2–3; `App. F.1`).
  4. **Zero-shot human-to-robot swap:** swapping Aria SLAM triangulation for static RGB-D depth back-projection and arm forward kinematics at $10\text{ Hz}$ (`§3.5`, `App. G`).

---

## 3. Data collection & preprocessing (`§3.1–3.3`, `App. D`, `App. E`, `Tab. 1`)

| Parameter | Value | Source |
| --- | --- | --- |
| Wearable hardware | Project Aria Gen1 glasses: RGB $30\text{ fps}$ at $2\text{ MP}$; $2\times$ monochrome SLAM cameras at $30\text{ fps}$ VGA; $2\times$ eye-tracking cameras at $10\text{ fps}$ QVGA; two 6-axis IMUs at $1000\text{ Hz}$ and $800\text{ Hz}$ | `[HE]` §3.1, App. D.1, Tab. 1 |
| Demonstrations per task | $45$ human demonstrations ($\sim 30\text{ min}$ total; $30\text{–}40\text{ s}$ per human demo vs. $60\text{–}70\text{ s}$ per teleoperated robot demo) | `[HE]` §4.1, App. D.2, Tab. 1 |
| Pre-episode scene sweep | $\sim 1\text{–}2\text{ s}$ ($\sim 30\text{–}60$ frames; Tab. 1 lists $\sim 1\text{ s}$ / $\sim 30$ frames) head pan or walk-in while scene is static to give multi-view triangulation baseline | `[HE]` §4.1, App. E.1, Tab. 1 |
| Object triangulation | Grounding DINO detection + SAM2 mask + $N$ contour keypoints tracked across $F$ sweep frames with CoTracker3; linear system $A_n \mathbf{X}_n = \mathbf{0}$ ($2F \times 4$) solved via SVD; centroid $\mathbf{p}_{\text{obj}} = \frac{1}{N}\sum_{n=1}^N \mathbf{x}_n$; orientation $R_{\text{obj}}$ from Orient-Anything V2 | `[HE]` §3.3, App. E.1 Eq. 4 |
| Kinematic grasp latching | From grasp onset $t_0$, object pose is rigidly tied to the hand: $T_{\text{obj}}^t = T_{\text{hand}}^t \cdot (T_{\text{hand}}^{t_0})^{-1} T_{\text{obj}}^{t_0}$ | `[HE]` §3.3 |
| Phase detection (5 modes) | (0) Manip, (1) Forward, (2) Rotate, (3) Transition, (4) Finished. Manip requires head speed $v_{\text{stop}} < 0.03\text{ m/s}$ and $\omega_{\text{stop}} < 0.15\text{ rad/s}$ for $\ge 15$ frames, demoted to Transition if 5-frame average hand speed $> 0.15\text{ m/s}$. Rotate: $\|\boldsymbol{\omega}_{\text{head}}\| > 0.10\text{ rad/s}$ and $\|\mathbf{v}_{\text{head}}\| < 0.08\text{ m/s}$. Transition buffer: $10$ frames. Finished: trailing stop $\ge 30$ frames. Only Manip (0) and Finished (4) kept for training | `[HE]` App. E.2, Tab. 1 |
| Hand-to-gripper keypoints | $5$ of $21$ Aria MPS 3D keypoints per hand: wrist $\mathbf{p}_w$, thumb MCP $\mathbf{p}_{\text{tMCP}}$, thumb tip $\mathbf{p}_{\text{thumb tip}}$, index MCP $\mathbf{p}_{\text{iMCP}}$, index tip $\mathbf{p}_{\text{index tip}}$ | `[HE]` App. E.3, Fig. 12, Tab. 1 |
| Keypoint smoothing | Confidence threshold $0.8$, min segment $30$ frames, linear/SLERP gap interpolation $\le 10$ frames, Savitzky–Golay filter (window $21$, order $2$) on positions, EMA ($\alpha_x = \alpha_y = 0.15$) + Gram–Schmidt on rotations | `[HE]` App. E.3, Tab. 1 |
| Gripper position & frame | $\mathbf{p}_{\text{ee}} = \frac{1}{2}(\mathbf{p}_{\text{thumb tip}} + \mathbf{p}_{\text{index tip}})$; $\mathbf{x}_{\text{ee}} = \widehat{\mathbf{p}_{\text{iMCP}} - \mathbf{p}_{\text{tMCP}}}$, $\tilde{\mathbf{y}} = \frac{1}{2}(\mathbf{p}_{\text{tMCP}} + \mathbf{p}_{\text{iMCP}}) - \mathbf{p}_w$, $\mathbf{y}_{\text{ee}} = \widehat{\tilde{\mathbf{y}} - (\tilde{\mathbf{y}}^\top \mathbf{x}_{\text{ee}})\mathbf{x}_{\text{ee}}}$, $\mathbf{z}_{\text{ee}} = \mathbf{x}_{\text{ee}} \times \mathbf{y}_{\text{ee}}$ | `[HE]` App. E.3, Eqs. 5–6 |
| Gripper aperture | $g = \mathrm{clip}\!\left(\frac{\|\mathbf{p}_{\text{thumb tip}} - \mathbf{p}_{\text{index tip}}\| - d_{\min}}{d_{\max} - d_{\min}}, 0, 1\right)$, median-filtered and binarized at deployment | `[HE]` App. E.3, Eq. 7 |
| Visual preprocessing | Segment arm/hand with SAM2, remove via LaMa inpainting, render virtual gripper + tracked object keypoints onto inpainted RGB ($240 \times 320$) | `[HE]` §3.2, App. F.1, Tab. 1 |

---

## 4. Interaction-Centric Tokens (ICT) (`§3.3`, `Eq. 1`, `repo:utils/ict.py`, `repo:training/FlowMatchingModel.py`)

- **Bimanual token ($\mathrm{ICT}_k \in \mathbb{R}^{29}$):**
  $$\mathrm{ICT}_k = \bigl[\underbrace{\tau}_{1} \;\|\; \underbrace{{}^{\mathrm{REF}}T_E}_{9} \;\|\; \underbrace{{}^ET_{LH}}_{9} \;\|\; \underbrace{{}^ET_{RH}}_{9} \;\|\; \underbrace{g}_{1}\bigr]$$
  - $\tau \in \mathbb{R}^1$: entity type ID (`0` pad, `1` left hand, `2` right hand, `3` anchor object, `4` other object in `repo:utils/ict.py`).
  - ${}^{\mathrm{REF}}T_E \in \mathbb{R}^9$: entity $k$'s pose in the episode reference frame $\mathrm{REF}$ (3D normalized translation + 6D continuous rotation), where $\mathrm{REF}$ is the frozen camera frame at manipulation onset (`cam0`) or `virtual_static_anchor` during training, and the static camera frame at robot deployment (`§3.3`, `§3.5`, `repo:utils/ict.py`).
  - ${}^ET_{LH}, {}^ET_{RH} \in \mathbb{R}^9$: left and right hand poses expressed in entity $k$'s local frame $E$ (${}^ET_H = T_E^{-1} T_H$), which are **exact viewpoint-invariant** because camera extrinsics cancel out (`§3.3`).
  - $g \in \mathbb{R}^1$: grasp state (binarized finger distance for hands; $-1.0$ sentinel for objects in `repo:utils/ict.py`).
- **Single-hand variant ($\mathbb{R}^{20}$):** omits the unused hand's 9-D relative block (`1 + 9 + 9 + 1 = 20`), padded up to `max_ict = 8` entities (`repo:training/FlowMatchingModel.py`, `repo:utils/ict.py`).

---

## 5. Policy architecture & training (`§3.4`, `App. F.1`, `Tab. 1`, `repo:training/FlowMatchingModel.py`)

| Field | Value | Source |
| --- | --- | --- |
| Backbone | 6-layer, 8-head Transformer decoder (`AXD*6`), hidden size $d = 384$, head dim $d_h = 48$, MLP ratio $4.0$ ($d_{\text{ff}} = 1{,}536$, GELU activation), dropout $0.05$, LayerNorm (`use_pre_norm: True` in `serve_bread`, `False` in `water_flowers`) | `[HE]` App. F.1, Tab. 1; `repo:training/FlowMatchingModel.py`; `hf:serve_bread/config.json` |
| Context tokens | $300$ visual patch tokens ($240 \times 320$ RGB with $16 \times 16$ `Conv2d` patch embed $\to 15 \times 20 = 300$) + up to $N_{\text{ict}} = 8$ ICT tokens linearly projected from $29\text{-D}$ (or $20\text{-D}$) to $384\text{-D}$ with learned positional embeddings | `[HE]` App. F.1, Tab. 1; `repo:training/FlowMatchingModel.py` |
| Action query tokens | $K = 50$ action-chunk tokens $\mathbf{x}_t \in \mathbb{R}^{50 \times D_a}$ linearly projected to $384\text{-D}$, summed with learned horizon position embeddings ($50 \times 384$) and sinusoidal flow-time MLP embedding ($384 \to 768 \to 384$ with Mish) | `[HE]` §3.4, App. F.1; `repo:training/FlowMatchingModel.py` |
| Action dimension $D_a$ | $10$ per hand ($3$ pos + $6$ 6D rot + $1$ grasp): $D_a = 20$ for bimanual (`10` for single-hand); when object-motion co-training (`use_aux_obj_dynamics`) is enabled in code, $9$ object-pose dims are appended to the joint flow manifold ($D_a = 29$ bimanual / $19$ single-hand) | `[HE]` §3.4, App. F.1; `repo:training/FlowMatchingModel.py` |
| Region attention spotlight | Gaussian bias $w(u, v) = \exp\!\left(-\frac{(u - u_0)^2 + (v - v_0)^2}{2\sigma^2}\right)$ centered on the active anchor's 2D projection $(u_0, v_0)$ with learnable $\sigma \in [0.05, 1.0]$ added to visual cross-attention logits | `[HE]` App. F.1, Eq. 8; `repo:training/FlowMatchingModel.py` |
| Flow matching loss $\mathcal{L}_{\text{FM}}$ | $\mathbb{E}_{t, \mathbf{x}_0, \mathbf{x}_1}[w_p \|\Delta \mathbf{p}\|^2 + w_r \|\Delta \mathbf{r}\|^2 + w_g \|\Delta g\|^2]$ with $w_p = 5$, $w_r = 1$, $w_g = 10$ | `[HE]` §3.4 Eq. 2, App. F.1, Tab. 1 |
| Auxiliary losses | Total loss $\mathcal{L} = \mathcal{L}_{\text{FM}} + \lambda_{\text{OM}}\mathcal{L}_{\text{OM}} + \lambda_{\text{2D}}\mathcal{L}_{\text{2D}} + \lambda_{\text{LC}}\mathcal{L}_{\text{LC}}$: (1) Object motion $\mathcal{L}_{\text{OM}}$ ($9\text{-D}$ object trajectory, weighted by $0.5(w_p, w_r)$); (2) 2D trace $\mathcal{L}_{\text{2D}}$ ($K \times 3 \times 2$ normalized coordinates, $\lambda_{\text{2D}} = 20$; paper App. F.1 describes a shallow deconvolution stack, while `FlowMatchingModel.py` replaces it with a `384 → 256 → K*targets*2` Mish MLP on pooled context); (3) Latent consistency $\mathcal{L}_{\text{LC}}$ (predicts hand ICT tokens $K$ steps ahead via a 2-layer Mish MLP, $\lambda_{\text{LC}} \in [0.1, 1.0]$). Code also includes a binary task-termination head `head_done` ($w_{\text{done}} = 0.2$) | `[HE]` §3.4 Eq. 3, App. F.1, Tab. 1; `repo:training/FlowMatchingModel.py` |
| Optimization | AdamW, lr $10^{-4}$, weight decay $0.01$, cosine schedule with $200$ warmup steps, min-LR ratio $0.05$, batch size $32$, $400$ epochs, grad clip $1.0$, bfloat16 AMP, EMA decay $0.999$ | `[HE]` App. F.1, Tab. 1; `hf:serve_bread/config.json` |
| Deployment & control | $20$ Euler ODE steps ($\Delta t = 1/20$), $10\text{ Hz}$ control loop on 1 RTX 4090 ($\sim 100\text{ ms}$ per cycle), step stride $2$ ($5\text{ Hz}$ effective rate), look-ahead offset $25$ steps, grasp threshold $0.6$ (any-over-horizon), position EMA $\alpha = 0.5$, quaternion SLERP, trajectory-overlap blend $12$, safety cage $\le 0.08\text{ m}$ and $\le 0.02\text{ rad}$ | `[HE]` §3.5, App. G.1–G.3, Tab. 1 |

---

## 6. Quantitative results (`§4.1–4.4`, `App. H`, `Figs. 4, 5, 7, 9, 10, 14–16`)

### Main real-world evaluation across 4 tasks (40 trials per task, `%` success, `Fig. 4`, `§4.1`)

| Method | Data source & budget | Serve Bread | Downstack Cups | Water Flowers | Adjust Table | Overall |
| --- | --- | --- | --- | --- | --- | --- |
| **HumanEgo-30** | 30 min human video (45 demos) | **95.0** | **87.5** | **95.0** | **92.5** | **92.5** |
| **HumanEgo-15** | 15 min human video | 82.5 | 67.5 | 75.0 | 75.0 | 75.0 |
| ACT (Robot Teleop) | 30 min robot teleop | 52.5 | 45.0 | 45.0 | 62.5 | 51.2 |
| SPOT | 30 min human video | 62.5 | 35.0 | 45.0 | 37.5 | 45.0 |
| ZeroMimic | 30 min human video | 47.5 | 27.5 | 30.0 | 0.0 | 26.2 |
| Track2Act | 30 min human video | 35.0 | 12.5 | 17.5 | 10.0 | 18.8 |
| Point Policy | 30 min human video | 12.5 | 2.5 | 7.5 | 5.0 | 6.9 |
| EgoZero | 30 min human video | 5.0 | 0.0 | 2.5 | 0.0 | 1.9 |

### Data-efficiency scaling on Serve Bread (`§4.2`, `Fig. 5`)
- At $8\text{ min}$ of human video, HumanEgo reaches $57.5\%$ (vs. $37.5\%$ w/o auxiliary losses, and vs. $52.5\%$ for ACT at $30\text{ min}$ robot teleop — a $3.75\times$ collection-time reduction).
- At $30\text{ min}$ on Serve Bread: HumanEgo on human video reaches $95\%$, HumanEgo on robot teleop reaches $65\%$ ($+30\text{ pp}$ gap from data source alone), and ACT on robot teleop reaches $52.5\%$.

### Zero-shot cross-condition generalization (mean over Serve Bread & Downstack Cups, `§4.3`, `Fig. 7`)
- **In-distribution (Trossen WidowX AI):** $91.25\%$ (mean of $95.0\%$ and $87.5\%$).
- **Cross-Embodiment:** Franka $88.75\%$, UR10 $87.5\%$.
- **Cross-Setup:** Novel Camera $90\%$, Novel Height $86.25\%$, Novel Viewpoint $87.5\%$.
- **Cross-Environment:** Novel Lighting $91.25\%$, Novel Background $91.25\%$, Novel Objects $85\%$, Distractors $91.25\%$.

### Ablations on Water Flowers (`§4.4`, `Figs. 9–10`)
- **Representation study (30 min human data, `Fig. 9`):**
  - Visual Only: Human RGB $7.5\%$, + Kpts & Inpaint $20\%$, Robot RGB $32.5\%$.
  - Visual + Spatial: ICT only (no RGB branch) $75\%$, Human RGB + ICT $85\%$, HumanEgo Full (Inpainted RGB + Kpts + ICT) $95\%$ ($+62.5\text{ pp}$ over best visual-only).
- **Auxiliary training study (15 min human data, `Fig. 10`):**
  - No Aux $50\%$, + Object Motion ($\mathcal{L}_{\text{OM}}$) $67.5\%$ ($+17.5\text{ pp}$), + 2D Trace ($\mathcal{L}_{\text{2D}}$) $55\%$ ($+5\text{ pp}$), + Latent Consistency ($\mathcal{L}_{\text{LC}}$) $62.5\%$ ($+12.5\text{ pp}$), HumanEgo Full (All Aux) $75\%$ ($+25\text{ pp}$).

### Hand tracking & co-training studies on Serve Bread (`App. H.1–H.2`, `Figs. 14–16`)
- **Hand trackers (30 min data, `Fig. 14–15`):**
  - Aria-MPS (stereo SLAM + IMU): $95\%$ success, $95.2\%$ detection rate.
  - WiLoR (monocular RGB MANO): $45\%$ success, $86.9\%$ detection rate, $1.4\text{ cm}$ Procrustes error.
  - HaMeR (monocular RGB MANO): $32.5\%$ success, $92.4\%$ detection rate, $1.4\text{ cm}$ Procrustes error (higher midpoint jerk than WiLoR).
  - MediaPipe (monocular RGB + depth lift): $0\%$ success, $66.5\%$ detection rate, $2.2\text{ cm}$ Procrustes error.
- **Human-robot co-training mixture (30 min total budget, `Fig. 16`):**
  - $0\%$ human / $100\%$ robot: $65\%$.
  - $25\%$ human / $75\%$ robot: $72.5\%$.
  - $50\%$ human / $50\%$ robot: $77.5\%$.
  - $75\%$ human / $25\%$ robot: $90\%$.
  - $100\%$ human / $0\%$ robot: $95\%$.

---

## 7. Paper vs. released code differences
1. **Auxiliary losses in released 30-min configs:** The paper trains with $\mathcal{L}_{\text{OM}}, \mathcal{L}_{\text{2D}}, \mathcal{L}_{\text{LC}}$ enabled and shows in Fig. 5 that at 30 minutes of data the variants with and without auxiliary losses both converge to $95\%$ on Serve Bread (`§4.2`). Accordingly, the released 60-demo configs (`cfg/training/serve_bread/HumanEgo.yaml`, `water_flowers/HumanEgo.yaml`, and `hf:serve_bread/config.json`) disable the three auxiliary flags (`use_aux_*: false`) by default while keeping their weights (`w_foresight: 20.0`, `w_contrastive: 0.1`) in the config.
2. **2D trace head architecture:** Appendix F.1 describes the 2D trace head as emitting $K \times 3 \times 2$ coordinates through a "shallow deconvolution stack", whereas `FlowMatchingModel.py` (`head_2d_trace`, comment `# Replaces Deconv Heatmap`) implements it as a 2-layer Mish MLP (`384 → 256 → K * num_trace_targets * 2`) operating on mean-pooled context tokens.
3. **Object motion head implementation:** Rather than a separate auxiliary MLP, `FlowMatchingModel.py` implements $\mathcal{L}_{\text{OM}}$ (`use_aux_obj_dynamics`) by appending the $9\text{-D}$ object pose directly to each action-chunk token ($D_a = 20 \to 29$ for bimanual, $10 \to 19$ for single-hand) and weighting those $9$ velocity channels by $0.5(w_p, w_r)$ inside the flow-matching loss.
4. **Reference frame & region attention per task:** In the released configs, `serve_bread` uses `frame_mode: "camera_frame"`, `use_region_attn: true`, and `use_pre_norm: true`, whereas `water_flowers` uses `frame_mode: "anchor_frame"`, `use_region_attn: false`, and `use_pre_norm: false` (Post-Norm legacy mode).

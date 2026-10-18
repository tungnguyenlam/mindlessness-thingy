# Contrastive World Models: sourced fact sheet

Compiled 2026-10-19 from the arXiv HTML, PDF, and TeX source of `2609.22175v1` (*Contrastive World Models*, Bonnie Li, 2026). Every fact and number below names its primary source and section, equation, or figure.

Shorthand:
- `[CWM]` = arXiv `2609.22175v1` (*Contrastive World Models*, Bonnie Li, 27 Aug 2026), https://arxiv.org/html/2609.22175v1
- `[PlaNet]` = Hafner et al., 2019 (*Learning Latent Dynamics for Planning from Pixels*, arXiv:1811.04551)
- `[Dreamer]` = Hafner et al., 2020 (*Dream to Control: Learning Behaviors by Latent Imagination*, arXiv:1912.01603)
- `[CPC]` = van den Oord et al., 2018/2019 (*Representation Learning with Contrastive Predictive Coding*, arXiv:1807.03748)
- `[DIM]` = Hjelm et al., 2019 (*Learning Deep Representations by Mutual Information Estimation and Maximization*, arXiv:1808.06670)
- `[BYOL]` = Grill et al., 2020 (*Bootstrap Your Own Latent: A New Approach to Self-Supervised Learning*, arXiv:2006.07733)
- `[DBC]` = Zhang et al., 2021 (*Learning Invariant Representations for Reinforcement Learning without Reconstruction*, arXiv:2006.10742)

---

## 1. Identity

| Field | Value | Source |
| --- | --- | --- |
| Title | Contrastive World Models | `[CWM]` title |
| Author | Bonnie Li (Google DeepMind, commented in TeX source) | `[CWM]` header, `main.tex` |
| Date | 27 Aug 2026 (`v1`) | arXiv `2609.22175v1` |
| Core claim | Replaces pixel reconstruction in a Dreamer/RSSM world model with a Deep InfoMax lower bound that maximizes mutual information between state-action sequences $[s_t, a_{t:t+h}]$ and spatial patch features $e_{m,n}(o_{t+h})$ of future observations, removing the pixel decoder entirely | `[CWM]` Abstract, §1, §2.2 |

## 2. Motivation & related work context

| Fact | Details | Source |
| --- | --- | --- |
| Failure mode of pixel reconstruction | In visually complex environments, high-entropy background details dominate the pixel reconstruction objective $\ln p(o_t \mid s_t)$ and distract the latent state from task-relevant dynamics | `[CWM]` Abstract, §1, §3.2 |
| Prior contrastive Dreamer variant | Hafner et al. (2020) (`[Dreamer]`) evaluated a global contrastive variant of Dreamer and found it underperformed pixel reconstruction on most tasks in clean settings | `[CWM]` §1 |
| LeWorldModel (LeWM) comparison | Maes et al. (2026) introduced LeWM, a $\sim 15\text{M}$-parameter JEPA-based world model trained end-to-end from pixels with next-embedding prediction and a Gaussian regularizer across 4 low-distraction stationary-background tasks (2D maze, Reacher, Push-T, OGBench-Cube), without testing visual distractors | `[CWM]` §1 |

## 3. POMDP & Recurrent State Space Model (RSSM) formulation

| Component | Mathematical form / Description | Source |
| --- | --- | --- |
| POMDP variables | Discrete time step $t$, image observations $o_t$, hidden latent states $s_t$, continuous action vectors $a_t$, scalar rewards $r_t$ | `[CWM]` §2 |
| Generative world model factorization | Transition: $s_t \sim p(s_t \mid s_{t-1}, a_{t-1})$; Observation: $o_t \sim p(o_t \mid s_t)$; Reward: $r_t \sim p(r_t \mid s_t)$ | `[CWM]` §2.1 |
| Variational posterior (state encoder) | $q(s_{1:T} \mid o_{1:T}, a_{1:T}) = \prod_t q(s_t \mid s_{t-1}, a_{t-1}, o_t)$ | `[CWM]` §2.1 |
| Variational lower bound (ELBO) | $\ln p(o_{1:T}, r_{1:T} \mid a_{1:T}) \ge \mathbb{E}_q\left[\sum_t \left(\ln p(o_t \mid s_t) + \ln p(r_t \mid s_t) - \mathrm{KL}\left(q(s_t \mid s_{t-1}, a_{t-1}, o_t) \parallel p(s_t \mid s_{t-1}, a_{t-1})\right)\right)\right]$ | `[CWM]` §2.1 |
| Observation encoder $e$ | Maps high-dimensional image $o_t$ to low-dimensional embedding $z_t = e(o_t)$ and spatial patch features $e_{m,n}(o_t)$ | `[CWM]` §2.1, §2.2, Fig. 2 |
| Posterior update function $g$ | Combines encoding $z_t$ and predicted prior state features $\hat{s}_t$ to output posterior state features $s_t$ | `[CWM]` §2.1, Fig. 2 |
| Transition function $f$ | Concatenates posterior $s_t$ and action $a_t$ to predict Gaussian prior state features $\hat{s}_{t+1}$ (parameterized mean and variance) | `[CWM]` §2.1, Fig. 2 |
| Reward model $R$ | Maps posterior state feature $s_t$ to scalar reward $r_t$ via a Gaussian distribution with parameterized mean and unit variance ($1$) | `[CWM]` §2.1 |
| Pixel decoder $O$ (Dreamer only) | Reconstructs observation $o_t$ from posterior state features $s_t$; removed completely in Contrastive World Models | `[CWM]` Abstract, §2.1, Fig. 1, Fig. 2 |
| Reconstruction objective $J_{\text{REC}}$ | $J_{\text{REC}} = \mathbb{E}_q\left(\sum_t (J_O^t + J_R^t + J_D^t)\right)$ with $J_O^t = \ln O(o_t \mid s_t)$, $J_R^t = \ln R(r_t \mid s_t)$, $J_D^t = -\mathrm{KL}(q(s_{t+1} \mid s_t, a_t, o_{t+1}) \parallel f(\hat{s}_{t+1} \mid s_t, a_t))$ | `[CWM]` §2.1 |

## 4. Contrastive InfoMax representation objective

| Step / Equation | Formula / Details | Source |
| --- | --- | --- |
| Subtracting observation marginal (Eq. 1) | Subtracting $\ln p(o_t)$ (which is independent of $s_t$ and does not change the encoder optimum) and applying Bayes' rule gives $\mathbb{E}[\ln p(o_t \mid s_t)] \doteq \mathbb{E}[\ln p(o_t \mid s_t) - \ln p(o_t)] = \mathbb{E}\left[\ln \frac{p(o_t, s_t)}{p(o_t)p(s_t)}\right] = I(o_t; s_t)$ | `[CWM]` §2.2, Eq. 1 |
| Temporal mutual information target | Maximize mutual information between the current posterior state concatenated with the intervening action sequence $c_t = [s_t, a_{t:t+h}]$ and future observation $o_{t+h}$: $\max_\theta I([s_t, a_{t:t+h}]; o_{t+h})$ (Fig. 2 labels the action sequence as $a_{t:t+h-1}$) | `[CWM]` §2.2, Fig. 2 |
| Log-bilinear score function | $f_\theta(x_{t+h}, c_t) = \exp(c_t^\top W_\theta x_{t+h}) \propto \frac{p(x_{t+h} \mid c_t)}{p(x_{t+h})}$ | `[CWM]` §2.2 |
| Patch-level Deep InfoMax bound (Eq. 2) | $J_I^t = \frac{1}{M}\frac{1}{N} \sum_{m=1}^M \sum_{n=1}^N \ln \frac{\exp([s_t, a_{t:t+h}]^\top W_\theta e_{m,n}(o_{t+h}))}{\sum_{b \in B} \exp([s_t, a_{t:t+h}]^\top W_\theta e_{m,n}(o_b))}$ where $m, n$ index spatial patches ($M \times N$) of the encoder feature map and $b \in B$ indexes negative observations across the batch/sequence | `[CWM]` §2.2, Eq. 2 |
| Overall Contrastive World Model objective | $J_{\text{DIM}} = \mathbb{E}\left(\frac{1}{T}\sum_t (J_I^t + \lambda_1 J_D^t + \lambda_2 J_R^t)\right)$ where $\lambda_1, \lambda_2$ weight the KL transition loss and reward loss | `[CWM]` §2.2 |

## 5. Momentum Prediction baseline

| Item | Formula / Details | Source |
| --- | --- | --- |
| Target encoder update | Exponential moving average of online encoder parameters $\theta$: $\xi \leftarrow \tau \xi + (1 - \tau)\theta$ | `[CWM]` §3.1 |
| Per-step cosine loss | Projection head $\phi_\theta(s_t)$ predicts future target embedding: $J_{\text{MP}}^t = \cos\left(\phi_\theta(s_t), \mathrm{sg}(e_\xi(o_{t+h}))\right)$, avoiding collapse via predictor/stop-gradient asymmetry without negative samples | `[CWM]` §3.1 |
| Total Momentum Prediction objective | $J_{\text{MP}} = \mathbb{E}\left(\frac{1}{T}\sum_t (J_{\text{MP}}^t + \lambda_1 J_D^t + \lambda_2 J_R^t)\right)$ | `[CWM]` §3.1 |

## 6. Experimental setup & results

| Aspect | Value / Finding | Source |
| --- | --- | --- |
| Tasks | 3 DeepMind Control Suite (DMC) continuous control tasks: `finger-spin`, `cheetah-run`, `walker-walk` | `[CWM]` §3.1, Figs. 3–6 |
| Training budget & seeds | $1 \times 10^6$ environment steps per run; averaged over $3$ random seeds; identical RSSM backbone and actor-critic planner across all 3 methods | `[CWM]` §3, §3.1 |
| Visual complexity settings (3) | 1. **Default DMC**: stationary background. 2. **Simple Distractor**: colored balls moving and bouncing off frame edges. 3. **Natural Video**: full-color (RGB, not grayscale as in DBC) Kinetics dataset videos in the background | `[CWM]` §3, Fig. 3 |
| Default DMC results (Fig. 4) | All 3 methods reach comparable asymptotic reward (`finger-spin` $\approx 500\text{--}850$, `cheetah-run` $\approx 650\text{--}800$, `walker-walk` $\approx 800\text{--}950$ from curves) | `[CWM]` §3.2, Fig. 4 |
| Simple distractor results (Fig. 5) | InfoMax matches/exceeds Dreamer on 2 of 3 tasks (`cheetah-run` InfoMax $\approx 400$ vs Dreamer plateau $\approx 110$; `walker-walk` InfoMax $\approx 700$ vs Dreamer $\approx 500$; `finger-spin` Dreamer $\approx 600$ vs InfoMax $\approx 400$). Momentum Prediction collapses across all 3 tasks (stays near initial reward $< 60$) | `[CWM]` §3.2, Fig. 5 |
| Natural video results (Fig. 6) | InfoMax substantially outperforms both baselines on every task (`finger-spin` $\approx 390$ vs baselines $< 40$; `cheetah-run` $\approx 330\text{--}400$ vs baselines $\approx 40\text{--}60$; `walker-walk` $\approx 450\text{--}500$ vs Dreamer $\approx 120$ and Momentum $\approx 60$). Both Dreamer and Momentum Prediction fail to make task progress | `[CWM]` §3.2, Fig. 6 |
| Training efficiency | Removing the pixel decoder makes InfoMax consistently faster in wall-clock time per training step than Dreamer while using an equal number of parameters in the encoder and dynamics model | `[CWM]` §3.2 |
| Unreported numbers in `[CWM]` | Exact numerical values for encoder/RSSM dimensions, patch grid $M \times N$, horizon $h$, batch size $B$, loss weights $\lambda_1, \lambda_2$, EMA decay $\tau$, wall-clock step times, and tabular final returns (only learning curves in Figs. 4–6 are provided) | `[CWM]` §2–§3 |

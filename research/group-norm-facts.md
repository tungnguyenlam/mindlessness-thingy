# Group Normalization & Related Norms — Sourced Fact Sheet

Synthesized from the four Gemini Flash subagent reports (`GroupNorm Researcher`, `GroupNorm Note Drafter`, `Norms Comparison Analyst`, and `Normalization Fact-Checker`).

## 1. Primary Source: Wu & He (2018), *Group Normalization* (`groupnorm-paper`)
- **Citation**: Yuxin Wu, Kaiming He, "Group Normalization", ECCV 2018 (arXiv:1803.08494v3).
- **Formulation (§3.1)**:
  - Input feature tensor $x \in \mathbb{R}^{N \times C \times H \times W}$ indexed by $i = (i_N, i_C, i_H, i_W)$.
  - General normalization: $\hat{x}_i = \frac{x_i - \mu_i}{\sigma_i}$, with $\mu_i = \frac{1}{m}\sum_{k \in S_i} x_k$ and $\sigma_i = \sqrt{\frac{1}{m}\sum_{k \in S_i}(x_k - \mu_i)^2 + \epsilon}$.
  - GroupNorm index set (§3.1, Eq. 5):
    $$S_i = \left\{ k \;\middle|\; k_N = i_N, \; \left\lfloor \frac{k_C}{C/G} \right\rfloor = \left\lfloor \frac{i_C}{C/G} \rfloor \right\right\}$$
    where $G$ is the number of groups (default $G = 32$) and $C/G$ is the number of channels per group. Each group averages $m = (C/G) \cdot H \cdot W$ values from a single example $i_N$.
  - Per-channel affine transform (§3.1, Eq. 6 & Fig. 3): $y_i = \gamma_{i_C} \hat{x}_i + \beta_{i_C}$, where $\gamma, \beta \in \mathbb{R}^C$ are **per-channel** ($2C$ parameters total), not per-group.
  - Extreme cases (§3.1):
    - $G = 1 \implies S_i = \{k \mid k_N = i_N\}$: Layer Normalization over all $(C, H, W)$ of one sample.
    - $G = C \implies S_i = \{k \mid k_N = i_N, k_C = i_C\}$: Instance Normalization over $(H, W)$ of one sample and one channel.

## 2. Verified Benchmark Numbers (Wu & He 2018)

### Table 1: Normalization comparison on ImageNet (ResNet-50, 8 GPUs, 32 images/GPU)
- BatchNorm (BN): `23.6%` top-1 validation error
- GroupNorm (GN, $G=32$): `24.1%` (`+0.5%` vs BN)
- LayerNorm (LN, $G=1$): `25.3%` (`+1.7%` vs BN)
- InstanceNorm (IN, $G=C$): `28.4%` (`+4.8%` vs BN)
- WeightNorm (WN, Table 1 fn. 3): `28.2%` (`+4.6%` vs BN)

### Table 2: Batch-size sensitivity on ImageNet (ResNet-50, 8 GPUs)
| Batch size / GPU | BatchNorm val error (%) | GroupNorm ($G=32$) val error (%) | Gap (GN - BN) |
| --- | --- | --- | --- |
| 32 | 23.6 | 24.1 | +0.5 |
| 16 | 23.7 | 24.2 | +0.5 |
| 8 | 24.8 | 24.0 | -0.8 |
| 4 | 27.3 | 24.2 | -3.1 |
| 2 | 34.7 | 24.1 | -10.6 |

### Table 3: Group division ablation on ImageNet (ResNet-50, 32 images/GPU)
- **By group count $G$**:
  - $G = 64$: `24.6%`
  - $G = 32$: `24.1%` (best)
  - $G = 16$: `24.6%`
  - $G = 8$: `24.4%`
  - $G = 4$: `24.6%`
  - $G = 2$: `24.7%`
  - $G = 1$ (LayerNorm): `25.3%`
- **By channels per group $C/G$**:
  - $64$ ch/group: `24.4%`
  - $32$ ch/group: `24.5%`
  - $16$ ch/group: `24.2%`
  - $8$ ch/group: `24.3%`
  - $4$ ch/group: `24.8%`
  - $2$ ch/group: `25.6%`
  - $1$ ch/group (InstanceNorm): `28.4%`

### COCO Object Detection & Segmentation (§4.2, Tables 5–7)
- Mask R-CNN with ResNet-50 FPN (Table 6): Frozen BN baseline gets `38.6` box AP / `34.5` mask AP; GroupNorm backbone + head gets `40.3` box AP / `35.7` mask AP (`40.8` / `36.1` on the longer schedule).
- Training Mask R-CNN from scratch on COCO without ImageNet pretraining (Table 7): ResNet-50 with GroupNorm reaches `39.5` box AP vs `34.5` box AP for SyncBN.

## 3. Related Norms & Downstream Adoption
- **InstanceNorm** (`instancenorm-paper`, Ulyanov et al. 2016): normalizes $(H, W)$ per sample and channel ($G=C$). Strips per-channel contrast/style for image stylization, but hurts classification (`28.4%` error on ResNet-50).
- **WeightNorm** (`weightnorm-paper`, Salimans & Kingma 2016): reparameterizes weight vectors as $w = g \frac{v}{\|v\|_2}$. Batch-independent, but does not directly bound activation variance across deep residual stacks (`28.2%` error on ResNet-50, Wu & He Table 1 fn. 3).
- **Weight Standardization** (`weight-standardization-paper`, Qiao et al. 2019): standardizes each convolutional output filter's weights to mean 0 and variance 1 across $(C_{\text{in}}, K_h, K_w)$. Paired with GroupNorm (`GN + WS`), it closes the 0.5% large-batch gap with BatchNorm on ImageNet.
- **DDPM** (`ddpm-paper`, Ho et al. 2020 §4): uses GroupNorm throughout the U-Net residual and attention blocks so diffusion training and inference run identically at any batch size.
- **Big Transfer (BiT)** (`bit-paper`, Kolesnikov et al. 2020 §2.1, §3.3): replaces BatchNorm with GroupNorm + Weight Standardization across ResNet-V2 backbones up to ResNet-152x4 for reliable small-batch transfer.

## 4. Pitfalls & Uncertain / Contested Claims
1. **Channel divisibility**: $C$ must be divisible by $G$ (`C % G == 0`). Early stem layers with $C = 16$ or $C = 24$ cannot use $G = 32$ without reducing $G$.
2. **Large-batch regularization gap**: Plain GroupNorm has lower *training* error than BatchNorm on ResNet-50 (Wu & He Fig. 4), but 0.5% higher *validation* error at $N = 32$/GPU because it lacks the stochastic gradient noise of mini-batch sampling.
3. **Checkpoint incompatibility**: Swapping GroupNorm into a BatchNorm-pretrained checkpoint without fine-tuning breaks feature scales.
4. **Preceding convolution bias**: Any additive bias $b$ before mean-subtracting normalization cancels out in $x - \mu$, so `bias=False` should be used on the preceding conv layer.
5. **Contested claim — Internal Covariate Shift**: Ioffe & Szegedy (2015) attributed BatchNorm's success to reducing internal covariate shift, whereas Santurkar et al. (2018) (`santurkar-bn-paper`) showed that normalization primarily helps by smoothing the loss and gradient landscape.
6. **Uncertain claim — Semantic channel grouping**: Wu & He (2018 §1, §3) motivate channel groups by analogy to SIFT/HOG orientation histograms and neuroscience, but in standard CNNs channel ordering is arbitrary and adjacent channels are not explicitly constrained to share semantics; the practical gain comes from choosing an intermediate sample size $m = (C/G)HW$ that avoids both all-channel squashing ($G=1$) and per-channel mean erasure ($G=C$).

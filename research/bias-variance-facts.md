# Bias–variance and double descent: fact sheet

Checked 2026-10-20 against the arXiv PDFs (Belkin, Nakkiran) and abstracts (the rest).

## Belkin, Hsu, Ma, Mandal 2019 (`belkin-double-descent-paper`, arXiv:1812.11118)
- §2 "Neural networks", Fig. 2: random Fourier features on an MNIST subset (n = 10^4); peak at the interpolation threshold N = n; past it, test risk drops below the bottom of the U; the coefficient norm is largest at the threshold and falls as N grows.
- Fig. 3: random ReLU features fit to 10 points, N = 40 (norm ≈ 695) vs N = 4000 (norm ≈ 159).
- Fig. 4: two-layer networks, threshold at n·K (K classes).
- §3, Fig. 5: random forests (N_leaf^max, then N_tree); App. E: L2-boosting.
- For N > n they choose the minimum-ℓ2-norm ERM solution.
- §4 "Concluding thoughts": SGD from zero on a fixed-first-layer model converges to the min-norm solution; regularization and early stopping hide the peak; the peak is narrow in parameter space.

## Nakkiran et al. 2019 (`deep-double-descent-paper`, arXiv:1912.02292)
- §2 Def. 1: effective model complexity = largest n at which the procedure reaches ≈ 0 train error.
- §5, Fig. 4: model-wise DD, ResNet18 with layer widths [k, 2k, 4k, 8k]; CIFAR-10/100; peak strongest with label noise; Fig. 4a CIFAR-100 shows a peak without label noise.
- Fig. 5: data augmentation moves the threshold right.
- §6, Fig. 10: epoch-wise DD. §7, Fig. 11: sample-wise non-monotonicity (transformers, IWSLT'14).
- Fig. 1: ResNet18, CIFAR-10, 15% label noise, Adam, 4K epochs.

## Others (abstract-level claims only)
- `optimal-regularization-dd-paper` (arXiv:2003.01897): optimally tuned ℓ2 gives monotone test risk for isotropic linear regression; empirically mitigates DD in NNs.
- `rethinking-bias-variance-paper` (arXiv:2002.11328): bias falls monotonically with width, variance is unimodal.
- `neal-bias-variance-paper` (arXiv:1810.08591): bias and variance can both fall with width; separates optimization variance from sampling variance.
- `ridgeless-least-squares-paper` (arXiv:1903.08560): exact risk of min-norm least squares, linear and random-feature models; DD.
- `rethinking-generalization-paper` (arXiv:1611.03530): networks fit random labels.
- `esl-book`: §7.3 decomposition, k-NN error with σ²/k, least-squares variance ≈ σ² p/N; §3.4 ridge; §6.6.3 naive Bayes; §9.2 trees; §10.12 boosting regularization; §12.3 SVM kernels; §15.2 random forests.

## The in-browser lab (src/lib/fitlab.mjs)
Synthetic data only: f(x) = sin 3x + 0.3x on [-1, 1], stratified x, Gaussian label noise. The double-descent family is a linear model on Fourier features scaled by 1/k with a minimum-norm fit. Smooth random features (tanh, RFF) and random ReLU kinks were tried first and rejected: in one dimension their Gram matrices are numerically rank-deficient, so the peak smeared out and moved away from p = n.

# vla.cpp: sourced fact sheet

Compiled 2026-10-18 from the paper PDF/HTML (`arXiv:2606.08094v2`, revised 21 Sep 2026) and the released repository. Every number names its section, equation, table or figure.

Shorthand:
- `[P]` = *vla.cpp: A Unified Inference Runtime for Vision-Language-Action Models*, arXiv `2606.08094v2`, https://arxiv.org/abs/2606.08094 (PDF and HTML v2)
- `[R]` = repository https://github.com/VinRobotics/vla.cpp (README, accessed 2026-10-18)

Note: the repository is ahead of the paper. The paper evaluates eleven models on five backends (CUDA, Metal, CPU, SYCL, OpenVINO); the README's support matrix now lists more policies (Octo-Small, TurboVLA, ACT) and a Hexagon backend.

---

## 1. Identity

| Field | Value | Source |
| --- | --- | --- |
| Title | vla.cpp: A Unified Inference Runtime for Vision-Language-Action Models | `[P]` title |
| Authors | Khanh D. Nguyen, Hung T. Ho, Chinh T. Nguyen, Thanh Q. Duong, Linh D. Le, Duy M. H. Nguyen, Vien A. Ngo, An T. Le | `[P]` header; arXiv abs |
| Affiliations | VinRobotics; VinUniversity; TU Darmstadt; MPI-IS / University of Stuttgart / DFKI | `[P]` §I footnote |
| Dates | v1 6 Jun 2026; v2 21 Sep 2026 | arXiv abs |
| Code | https://github.com/VinRobotics/vla.cpp, Apache-2.0, built on llama.cpp | `[P]` §I; `[R]` license badge |
| Scope | Eleven VLA models, no PyTorch for model execution; client may be Python | `[P]` Abstract, §III-C |

## 2. Runtime design (paper §III)

| Item | Value | Source |
| --- | --- | --- |
| Three layers | Model adapters (policy graphs), hardware backends (operators), robot clients (sensing, replay) | `[P]` §III |
| Backends | CUDA, Metal, CPU (AVX/NEON), SYCL, OpenVINO | `[P]` §III-C, Fig. 2 |
| Protocol | ZeroMQ + Protocol Buffers, synchronous requests; requests carry images, token ids, state, optional noise and masks; responses carry chunks, dimensions, timings | `[P]` §III-C |
| Bundle | GGUF weights + architecture metadata + normalization statistics; vision weights in a companion file (`model.gguf`, `mmproj-model.gguf`) | `[P]` §III-C, Fig. 2 |
| Adding a policy | Adapter + converter + runtime registration; server/protocol/client unchanged | `[P]` §III-C |
| Inputs to a policy | Observation `o = (I_{1:V}, ℓ, s)`: V camera images, tokenized instruction, robot state | `[P]` §III-A |
| Output | Action chunk `A ∈ R^{H×d_a}`: H actions of d_a command dimensions | `[P]` §III-A |
| Execution | Client executes first S actions, 1 ≤ S ≤ H, before observing again | `[P]` §III-A |
| Latency model | `L_model(T) ≈ P + T·E` (P conditioning, E expert step); idealized speedup over recomputing conditioning `T(P+E)/(P+TE)` | `[P]` §III-B, Eq. 3 |
| Cache scope | Cached conditioning reused only within a request; each observation refreshes; graphs/buffers persist across requests | `[P]` §III-B |
| Validation tool | Prediction-check fixes weights, images, tokens, state, noise, masks, schedules, transforms; compares runtime actions A with reference Â; max absolute and relative RMS error; intermediate tensors localize discrepancies | `[P]` §III-E, Eq. 5 |

## 3. Action generation (paper §III-A)

| Item | Value | Source |
| --- | --- | --- |
| Iterative update (Euler) | `X^{k+1} = X^k + (τ_{k+1} − τ_k) v_θ(X^k, τ_k, C, s)`, k = 0…T−1; C = F_θ(o) | `[P]` Eq. 1 |
| Schedule conventions | Implemented SmolVLA and π0 integrate 1 → 0; GR00T-N1.7 integrates 0 → 1; Evo-1 uses uniform initial noise; reversing time requires a velocity sign change | `[P]` §III-A |
| Regression heads | BitVLA, OpenVLA-OFT, VLA-Adapter regress `A = R_θ(o)` directly | `[P]` §III-A |
| Observation reuse | π0 caches each layer's prefix keys/values for joint attention; SmolVLA alternates joint and cross attention with extra cross-attention projections; GR00T-style heads cache backbone feature projections in a separate action transformer | `[P]` §III-B |
| Cross-attention with cache | `Attn(Q, K_C, V_C; M) = softmax(Q K_Cᵀ / √d_k + M) V_C` | `[P]` Eq. 2 |

## 4. Ternary execution (paper §III-D, §IV-D)

| Item | Value | Source |
| --- | --- | --- |
| BitVLA weights | Scaled ternary `q ∈ {−1, 0, 1}`, packed four 2-bit codes per byte | `[P]` §III-D |
| Activation quantization | Per row: `α_m = max(‖x_m‖∞, 1e-5)/127`, `a_mj = clip[−128,127](round(x_mj/α_m))` | `[P]` Eq. 4 |
| Arithmetic | `y_mn = α_m β_g(n) Σ_j a_mj q_nj`; int32 accumulation, BF16 output, round nearest-even; packed tiles decoded in shared memory | `[P]` §III-D, Eq. 4 |
| Kernels | Baseline dp4a on CUDA cores; ours multi-row IMMA tensor-core path, adapting Ladder/BitBLAS/bitnet.cpp packed-weight techniques | `[P]` §III-D |
| Latency per executed action, S = 8 (incl. client processing + transport) | RTX 3060: 172.8 → 37.85 ms (4.57×); AGX Orin: 406.6 → 101.11 ms (4.02×) | `[P]` §IV-D, Fig. 1(c), Table III |
| Task success under the kernel | 100% (200/200 on RTX 3060 and AGX Orin in Table III) | `[P]` §IV-D, Table III |
| Packing effect | Model file 5.6 → 1.34 GiB; transient host allocation during loading 11.1 → 1.15 GiB; latency unchanged when arithmetic held fixed | `[P]` §IV-D |
| On the 8 GB Orin Nano | BitVLA completes 200/200 LIBERO-Object episodes; 2199 MiB peak process RSS; peak system memory 6504 MiB, +4533 MiB over the initial baseline; RTX 3060 device allocation 1312 MiB | `[P]` Abstract, §IV-D |

## 5. Evaluation setup (paper §IV-A)

| Item | Value | Source |
| --- | --- | --- |
| Benchmark | LIBERO-Object: ten language-conditioned manipulation tasks in simulation | `[P]` §IV-A |
| Eleven-model study | 100 episodes per model | `[P]` §IV-A, Table I |
| Device study | Seven models, 200 episodes per model, platform-specific software revisions | `[P]` §IV-A, Table III |
| Statistics | 95% Wilson intervals; episode-level binomial uncertainty only; success-rate comparisons descriptive | `[P]` §IV-A |
| Latency boundaries | Model execution, server prediction, client request–response cycle; amortized time L/S, throughput S/L | `[P]` §IV-A |
| Memory boundaries | GPU allocation, process RSS, total system memory; on Jetson CPU and GPU share memory | `[P]` §IV-A |

## 6. Task success (paper Table I, §IV-B)

100 episodes per model on LIBERO-Object; Ref. = published rate or authors' PyTorch reproduction (∗).

| Model | Input / S | Success [95% CI] | Ref. |
| --- | --- | --- | --- |
| SmolVLA | 512 / 1 | 96 [90.2, 98.4] | 96.0 |
| Evo-1 | 448 / 8 | 96 [90.2, 98.4] | 97.7 |
| π0 | 224 / 50 | 82 [73.3, 88.3] | 79.0∗ |
| π0.5 | 224 / 10 | 96 [90.2, 98.4] | 98.2 |
| GR00T-N1.5 | 224 / 16 | 95 [88.8, 97.8] | 95.0∗ |
| GR00T-N1.6 | 224 / 16 | 88 [80.2, 93.0] | 99.0∗ |
| GR00T-N1.7 | 256 / 16 | 99 [94.6, 99.8] | 99.0∗ |
| VLA-JEPA | 224 / 7 | 100 [96.3, 100] | 99.6 |
| VLA-Adapter | 224 / 8 | 96 [90.2, 98.4] | 99.2 |
| OpenVLA-OFT | 224 / 8 | 97 [91.5, 99.0] | 98.4 |
| BitVLA | 224 / 8 | 100 [96.3, 100] | 99.6 |

- Ten of eleven within 3.2 percentage points; GR00T-N1.6's 88 vs 99 gap unresolved (`[P]` §IV-B, §V).
- Reference sources: SmolVLA, Evo-1, VLA-JEPA, VLA-Adapter, OpenVLA-OFT, BitVLA model reports; π0.5 from LeRobot docs; π0 and GR00T-N1.5/1.6/1.7 from PyTorch reproductions (`[P]` §IV-B).
- Four suites (200 episodes/model/suite): BitVLA Spatial 94.5 [90.4, 96.9], Object 100 [98.1, 100], Goal 92.5 [88.0, 95.4], Long 83.5 [77.7, 88.0]; GR00T-N1.7 96.0 [92.3, 98.0], 98.0 [95.0, 99.2], 97.5 [94.3, 98.9], 89.0 [83.9, 92.6] (`[P]` Table II).
- SimplerEnv WidowX, GR00T-N1.6 at 252-pixel input: 80% put carrot on plate, 70% put spoon on towel (`[P]` §IV-B).

## 7. Latency and memory (paper §IV-C, §IV-D)

Server-side latency, RTX 3090, mean of 200 calls after warmup (ms); Compile = PyTorch default mode; ‡ eager fallback:

| Model | Ours | Eager | Compile | Speedup |
| --- | --- | --- | --- | --- |
| SmolVLA | 55.8 | 174.1 | 65.9 | 1.18× |
| π0 | 97.9 | 99.4 | 99.7 | 1.02× |
| Evo-1 | 142.3 | 161.6 | 142.5 | 1.00× |
| GR00T-N1.5 | 75.4 | 100.5 | 94.7 | 1.26× |
| GR00T-N1.6 | 61.2 | 76.0 | 61.1 | 1.00× |
| GR00T-N1.7 | 59.9 | 66.1 | 60.1‡ | 1.00× |
| BitVLA | 51.5 | 319.7 | 94.6 | 1.84× |

- Relative to eager: 1.02–6.21×; against the faster PyTorch configuration: even for four models, 1.18× / 1.26× / 1.84× for SmolVLA / GR00T-N1.5 / BitVLA (`[P]` §IV-C).
- RTX 5070: SmolVLA 74.11 ms vs 175.99 eager and 76.26 graph-captured; GR00T-N1.7 101.38 vs 101.67 eager (`[P]` §IV-C).
- RTX PRO Blackwell 1000, GR00T-N1.7: TensorRT 70.5 ms vs vla.cpp 130.2 ms (1.85× for TensorRT); success 98/100 vs 96/100 (`[P]` §IV-C).
- Device study, client inference per executed action (ms) / successes of 200 (`[P]` Table III; π0 S = 32 on RTX/AGX, 50 on Nano; † remote simulator):

| Model | S | RTX 3060 | AGX Orin | Orin Nano | Nano peak RSS (MiB) |
| --- | --- | --- | --- | --- | --- |
| SmolVLA | 4 | 28.16 / 181 | 65.41 / 181 | 141.81 / 176 | 2031 |
| BitVLA | 8 | 37.85 / 200 | 101.11 / 200 | 355.65 / 200 | 2199 |
| Evo-1 | 8 | 63.60 / 189 | 131.01 / 191 | 458.84 / 195 | 2135 |
| GR00T-N1.5 | 16 | 14.17 / 192 | 28.78 / 195 | 84.76 / 192† | 5975 |
| π0 | 32/50 | 9.74 / 175 | 27.90 / 171 | 39.10 / 161† | 6068 |
| GR00T-N1.6 | 16 | 10.29 / 173 | 26.70 / 180 | OOM | — |
| GR00T-N1.7 | 16 | 10.26 / 196 | 26.84 / 197 | OOM | — |

- CPU (i9-14900HX, eight threads) request latencies: SmolVLA 2141, GR00T-N1.7 2931, N1.6 3341, N1.5 4888, π0 7888, Evo-1 8966 ms; 1.4–6.1 GiB peak RSS (`[P]` §IV-B).
- Metal (M4) trials: SmolVLA 374 ms and 9/10; π0 1164 ms and 8/10; GR00T-N1.7 539 ms and 10/10 (`[P]` §IV-B).
- SYCL on Intel Arc A380 vs its Ryzen 5 host: SmolVLA 1920 → 630 ms, Evo-1 7695 → 1176 ms, VLA-Adapter 2994 → 517 ms; max action difference 2.9e-3 vs CPU (`[P]` §IV-B).

## 8. Quantization (paper Table V, §IV-D)

GR00T-N1.7, RTX 3060, 200 episodes per configuration, S = 16; speedup and e_rel on fixed inputs; error over 5280 action values vs BF16:

| Weights | File (MB) | Speedup | e_rel | Success |
| --- | --- | --- | --- | --- |
| BF16 | 6292.4 | 1.000 | 0 | 196/200 |
| Q8_0 | 5537.4 | 1.077 | 0.0043 | 197/200 |
| Q4_0 | 5134.8 | 1.081 | 0.0480 | 190/200 |
| Q8_0+V | 5160.0 | 1.131 | 0.0050 | 195/200 |
| Q4_0+V | 4556.0 | 1.144 | 0.0490 | 195/200 |

- Q4_0 vs BF16: −3.0 percentage points, approximate 95% interval [−7.1, +0.8]; quantizing vision (`+V`) keeps 195/200 at similar e_rel; fixed-input error alone does not predict task success (`[P]` §IV-D).

## 9. Numerical validation (paper §III-E, §IV-F)

- SmolVLA vision encoder maps patch coordinates to discrete indices selecting learned position embeddings; a different coordinate precision can cross an index boundary and select a different embedding.
- Matching the half-precision reference: position-embedding relative error 0.32 → 0.003; LIBERO-Object task 0 (soup container into a basket) success 2/10 → 9/10; maximum absolute action difference ≈ 1.97 after denormalization, concentrated on the gripper channel, large enough to reverse the command; matching index precision reduces it below 1e-2 (`[P]` §IV-F).
- GR00T-N1.6 uses interpolated position embeddings: 10/10 in both precision configurations, action difference ≈ 0.003 (`[P]` §IV-F).
- Metal: 32-bit vision and language towers reduce fixed-input action discrepancy 2.0e-3 → 8.3e-5, adding 33 ms and 672 MiB (`[P]` §IV-F).
- SmolVLA solver diagnostic (different configuration): max absolute action difference vs one Euler step rises from 0.26 at T = 1 to 1.05 at T = 8 (`[P]` §IV-F).

## 10. Solver steps and execution horizon (paper §IV-E, §IV-G)

GR00T-N1.7 solver sweep, RTX 3060, success runtime/PyTorch (%), 100 episodes per stack and setting; times vision / backbone-plus-head (ms); e_rel vs the T = 4 output:

| T | Success | Times (ms) | e_rel |
| --- | --- | --- | --- |
| 1 | 99/96 | 18.49 / 19.60 | 0.2290 |
| 2 | 95/98 | 18.83 / 25.79 | 0.0684 |
| 4 | 98/94 | 18.68 / 37.21 | 0 |
| 8 | 98/95 | 18.68 / 60.54 | 0.0321 |
| 16 | 95/97 | 18.86 / 107.50 | 0.0483 |

- Linear fit to backbone-plus-head: 13.9 + 5.8T ms; including vision ≈ 32.6 ms fixed work + 5.8 ms per solver step (`[P]` §IV-E).
- At T = 1 the maximum absolute action difference from the T = 4 output is 0.93 despite 99/100 successful episodes (`[P]` §IV-E).
- Cost shares: SmolVLA vision 38%, backbone 14% (T = 10); GR00T-N1.6 31% / 21% (T = 4); π0 21% / 54% (T = 10); combined 52%, 52%, 75%; direct-head BitVLA ≈ 99.5%; GR00T-N1.7 at T = 4 attributes 58% to vision + backbone, 42% to the expert (`[P]` §IV-E, §IV-G).
- SmolVLA execution-horizon sweep, LIBERO-Object, Orin Nano, H = 50, 50 episodes per setting (`[P]` Fig. 5):

| S | Median (ms) | P95 (ms) | S/L (Hz) | Success (%) |
| --- | --- | --- | --- | --- |
| 1 | 358.4 | 370.5 | 2.8 | 82 |
| 2 | 352.7 | 363.4 | 5.7 | 86 |
| 4 | 356.6 | 383.2 | 11.2 | 94 |
| 8 | 391.7 | 429.9 | 20.4 | 88 |
| 16 | 447.0 | 463.3 | 35.8 | 98 |
| 32 | 456.7 | 466.8 | 70.1 | 80 |
| 50 | 457.0 | 467.9 | 109.4 | 38 |

- Success peaks at 49/50 at S = 16, falls to 19/50 at S = 50 (full chunk); two-sided Fisher exact test p = 0.0078 for S = 16 vs S = 32 before multiple-comparison adjustment (`[P]` §IV-G).

## 11. Robot deployments (paper §IV-G)

UR10e + SmolVLA (fine-tuned on 80 demonstrations), S = 25 at 20 Hz, 20 episodes per backend:

| Backend | Round trip (ms) | Success [95% CI] | f_exec (Hz) |
| --- | --- | --- | --- |
| CUDA, RTX 5070 laptop | 111.4 | 15/20 [53.1, 88.8] | 17.7 |
| Metal, Mac Mini M4 | 582.0 | 12/20 [38.7, 78.1] | 12.8 |
| CPU, i9-14900HX | 2164.4 | 12/20 [38.7, 78.1] | 7.1 |
| CPU, Ryzen 7 6850HS | 3652.9 | 14/20 [48.1, 85.5] | 5.0 |

- Round-trip latency spans ~33×; effective rate `f_exec ≈ S / (L_rt + SΔt)` falls 17.7 → 5.0 Hz (`[P]` §IV-G, Eq. 6).
- All 80 rollouts grasp and carry the cup to the basket; the 27 failures occur at release; mean steps to grasp 335±26, 374±44, 329±41, 348±26 (CUDA, Metal, i9, Ryzen); wall time blocked on prediction 8% → 73% (`[P]` §IV-G).
- Same-machine engine comparison: 1.56× latency increase coincides with 111 fewer steps to first grasp (Welch t = −8.7, 27 degrees of freedom) (`[P]` §IV-G).
- ALOHA + GR00T-N1.6 on AGX Orin: ≈470 ms per predicted chunk, H = 8, S = 7; 18/20 and 17/20; mean completion ≈49 s and ≈28 s; 1.3 s replan period (`[P]` §IV-G).
- Delay injection on ALOHA (RTX 4070, GR00T-N1.7, ten episodes per condition): success 9/10 or 10/10 for delays 0, 150, 330, 530, 1000, 2000 ms; samples too small to resolve changes near 100% (`[P]` §IV-G, Table VIII).

## 12. Roofline (paper §IV-E, Fig. 3)

- Compute ceilings 25.6 (RTX 3060) and 21.3 (AGX Orin) TFLOP/s; bandwidth 360 and 204.8 GB/s; ridge points 71 and 104 FLOPs/byte (85 and 142 under the alternative estimates).
- Prefix intensity estimates 256–530 FLOPs/byte exceed the ridges; the expert estimate is ≈50.

## 13. Repository (current state)

| Item | Value | Source |
| --- | --- | --- |
| License | Apache-2.0 | `[R]` |
| Backends in the README | CPU, CUDA, Metal, SYCL, OpenVINO, Hexagon (Snapdragon CPU/GPU/NPU via OpenCL and Hexagon) | `[R]` support matrix |
| Models in the README | The paper's eleven plus Octo-Small, TurboVLA, ACT | `[R]` support matrix |
| Docs | `vla-cli`, `vla-server`, `vla-bench`; conversion `MODELS.md`; quantization `QUANTIZATION.md` (FoldQuant W8A8/W4A4); per-backend notes; `ARCHITECTURE.md`; learn-vla-cpp walkthrough | `[R]` docs table |
| Client note | The LeRobot fork's client does per-arch preprocessing; the wrong `--arch` "loads, runs and returns plausible, wrong actions" | `[R]` README, Rollout on a real robot |

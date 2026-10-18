# FlashMoE: sourced fact sheet

Compiled 2026-10-18 from the arXiv HTML and PDF of `2601.17063v1` (and cross-checked against `2601.17063v2`). Every number below names its primary source and section, equation, table or figure.

Shorthand:
- `[FM]` = arXiv `2601.17063v1` (*FlashMoE: Reducing SSD I/O Bottlenecks via ML-Based Cache Replacement for Mixture-of-Experts Inference on Edge Devices*), https://arxiv.org/html/2601.17063v1
- `[FM-v2]` = arXiv `2601.17063v2` (revised 5 Oct 2026), https://arxiv.org/html/2601.17063v2

---

## 1. Identity

| Field | Value | Source |
| --- | --- | --- |
| Title | FlashMoE: Reducing SSD I/O Bottlenecks via ML-Based Cache Replacement for Mixture-of-Experts Inference on Edge Devices | `[FM]` title |
| Authors | Byeongju Kim, Jungwan Lee, Donghyeon Han, Hoi-Jun Yoo, Sangyeob Kim | `[FM]` header |
| Affiliations | KAIST (Kim, Lee, Yoo); Chung-Ang University (Han); Yonsei University (S. Kim), Republic of Korea | `[FM-v2]` header |
| Dates | v1 submitted 22 Jan 2026; v2 revised 5 Oct 2026 | arXiv abs |

## 2. Motivation & MoE memory/routing statistics

| Fact | Value | Source |
| --- | --- | --- |
| Qwen3-30B-A3B parameter split | 30.3B total parameters, 3.3B sparsely activated per forward pass | `[FM]` §1 |
| Non-expert share of MoE model | Around 5–7% of expert layers (attention, norms, routing gates; always active) | `[FM]` §2.1 |
| Illustrated memory footprint (Qwen3-30B-A3B) | Total experts on SSD: 55 GB; non-expert in RAM/VRAM: < 2 GB; ML cache FFNs: < 5 MB; expert cache in 16 GB VRAM: up to 14 GB | `[FM]` Fig. 3(a) |
| Typical desktop DRAM | 16–64 GB (insufficient to hold all inactive experts of large MoE models alongside OS/apps) | `[FM]` §2.2 |
| Eviction Delay under LRU | Experts that should be evicted immediately stay in cache for an additional 4–5 steps | `[FM]` §2.3, Fig. 2 |
| Hit rate: Belady vs LRU | Belady optimal: 86%; LRU: ~73%, causing nearly 1.9× more I/O operations | `[FM]` §2.3 |
| Re-fetch rate within 5 steps of eviction | LRU: 34.2% of evicted experts are reused within 5 steps; Belady: 0.1% | `[FM]` §2.3 |
| Pairwise eviction comparison (Qwen3-30B-A3B) | LRU makes the better choice than LFU ~56% of the time (LFU is better ~44% of the time) | `[FM]` §2.3 |

## 3. System architecture & stages

| Component | Details | Source |
| --- | --- | --- |
| File-level decomposition | Non-expert weights and expert weights are stored separately; each expert is saved as an individual `.pt` file by layer and expert index (`Expert #m_n`) with its model class and ops for direct `torch.load` | `[FM]` §3.1 |
| Non-expert initialization | In the non-expert model, MLP computations are bypassed by setting hidden states to zero in the overridden `forward` function; only non-experts load at startup | `[FM]` §3.1 |
| Prefill batching of expert loads | Identifies all experts routed across the input token batch in a layer, loads each needed expert `.pt` file from SSD once per layer iteration, runs the expert MLP across its routed tokens, and accumulates outputs with indexed addition | `[FM]` §3.1, Fig. 3(b) |
| Per-layer VRAM expert cache capacity | $\text{cache\_size} = (\text{VRAM\_size} - \text{size}_{\text{non-expert}}) \times \frac{\text{total\_experts}}{\text{size}_{\text{expert}}}$ | `[FM]` §3.1, Eq. 1 |
| Share of decode latency from expert loading | Over 70% of total decoding time | `[FM]` §3.1, Fig. 5 |
| Per-operation latencies during decode | Attention & routing: ~1 ms; single expert load from SSD: ~3 ms; expert MLP compute: ~0.1 ms; ML cache FFN compute: 158 µs (~0.1 ms), overlapped asynchronously with SSD loading | `[FM]` §3.1, Fig. 5 |

## 4. ML-based cache replacement policy

| Item | Formula / Value | Source |
| --- | --- | --- |
| Recency update $r_t$ | Accessed at step $t$: $r_t = 1$ (Fig. 4 also shows 0-based raw step gap before $1/r_t$); not accessed: $r_t = r_{t-1} + 1$; unrouted experts start at $\infty$ | `[FM]` §3.2, Eqs. |
| Frequency update $f_t$ | Accessed at step $t$: $f_t = f_{t-1} + 1$; not accessed: $f_t = f_{t-1}$; starts at 0 | `[FM]` §3.2, Eqs. |
| Normalization | $\text{Recency}_{\text{norm}} = 1 / r_t \in [0, 1]$, $\text{Frequency}_{\text{norm}} = f_t / \max(f_t) \in [0, 1]$ | `[FM]` §3.2, Alg. 1 |
| FFN input | $\text{FFN Input} = [\text{Recency}_{\text{norm}} \parallel \text{Frequency}_{\text{norm}}]$ | `[FM]` §3.2, Alg. 1 |
| FFN target & eviction rule | Trained with `MSELoss` against Belady oracle next-use distances (normalized by $\max$, masked on evicted experts). At inference, `to_evict = cache.MaxDist(dist_scores)` evicts the cached expert with the highest predicted distance | `[FM]` §3.2, Alg. 1, Fig. 4, Tab. 1 |
| FFN architecture & size | 3 layers (`# Layer: 3`), hidden size 128, `SiLU` activation, ~113 KB per layer | `[FM]` §3.2, Tab. 1 |
| Training hyperparameters | Optimizer: `AdamW`, learning rate `1e-3`, learning rate decay `1e-2`, up to 200 epochs with early stopping | `[FM]` §3.2, Tab. 1, §4.1 |
| Training dataset & time | 512 samples from TriviaQA, up to 512 tokens each; on 1× A100 GPU with batch size 32 for OLMoE-1B-7B, routing trace extraction takes < 20 min and the full 4-stage pipeline completes in ~2 hours | `[FM]` §3.2 |

## 5. Evaluation setup & results

| Metric / Setting | Value | Source |
| --- | --- | --- |
| Desktop testbed (Table 2) | CPU: AMD Ryzen 9 9600X in v1 (corrected to Ryzen 5 9600X in v2; Zen 5, 6 cores, PCIe 5.0); GPU: NVIDIA RTX 5070 Ti (16 GB GDDR7, PCIe 5.0); Motherboard: Gigabyte X870 AORUS EAGLE WiFi7 (PCIe 5.0); SSD: SK hynix P51 NVMe SSD (PCIe 5.0, 7.4 GB/s read); RAM: 16 GB DDR5-6000MHz × 4 (all but ~1 GB locked); Ubuntu 24.04 LTS, Python 3.11, PyTorch 2.7, CUDA 12.9 | `[FM]` §4.1, Tab. 2; `[FM-v2]` Tab. 2 |
| Evaluated MoE models | OLMoE-1B-7B (64 experts/layer; cache sizes 12, 16, 20, 24 per layer = 3.4, 4.2, 5.0, 5.7 GB VRAM) and Qwen3-30B-A3B (128 experts/layer; cache sizes 12, 16, 20, 24 per layer = 8.8, 10.7, 12.6, 14.4 GB VRAM) | `[FM]` §4.2–4.4, Figs. 6–7 |
| Initial model loading speedup | 4× faster than `llama.cpp`; 6.8× faster than `Fiddler` and `DAOP` | `[FM]` §4.2 |
| Total model load + prefill speedup | 2.5× faster than `llama.cpp`; 4.1× faster than `Fiddler` and `DAOP` | `[FM]` §4.2, Fig. 7(a, d) |
| Prefill routed expert share vs prompt length | 32 tokens: 47%; 64 tokens: 58%; 128 tokens: 64%; 256 tokens: 67% (sublinear growth) | `[FM]` §4.2 |
| Cache hit-rate gains (OLMoE-1B-7B) | +21% over LRU (22% I/O reduction), +51% over LFU (35% I/O reduction), up to +28% over ARC, up to +21% over LeCaR | `[FM]` Abstract, §4.3, Fig. 6(a) |
| Decode throughput gain (ML policy vs LRU) | ~22% higher token/s on OLMoE-1B-7B; ~7% higher token/s on Qwen3-30B-A3B | `[FM]` §4.4, Fig. 7(b, e) |
| End-to-end decode speedup vs prior systems | Up to 2.6× speedup compared to existing MoE inference systems (Fiddler, DAOP, llama.cpp) | `[FM]` Abstract, Fig. 7(c, f) |
| v1 vs v2 errata | v2 fixes CPU name `Ryzen 9 9600X` → `Ryzen 5 9600X` in Table 2, fixes text reference `Fig. 7(a) and Fig. 7(b)` → `Fig. 7(a) and Fig. 7(d)` in §4.2, adds missing bibliography entries for OLMoE, llama.cpp, HF Transformers, ARC, LeCaR | `[FM]` vs `[FM-v2]` |

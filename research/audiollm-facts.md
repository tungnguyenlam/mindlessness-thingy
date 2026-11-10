# AudioLLM Sourced Facts

Primary source: `tungnguyenlam/audiollm` (`https://github.com/tungnguyenlam/audiollm`, source id `audiollm-repo`).

## 1. System Architecture & Acoustic Front-End
- **Core idea**: Encoder-free speech recognition on `LiquidAI/LFM2.5-230M-Base` (`audiollm/model.py`, `README.md`). Instead of attaching a 300M–600M pretrained speech encoder (such as Whisper or HuBERT), raw 16 kHz waveforms are converted to 80-bin HTK log-mel spectrograms, downsampled by a lightweight trainable projector (1.3M–6.95M parameters) directly into the 1,024-dimensional embedding space of `LFM2.5-230M-Base`, and decoded autoregressively with LoRA adapters.
- **Acoustic front-end (`audiollm/config.py`, `audiollm/features.py`)**:
  - Sampling rate: `SR = 16000` Hz (mono).
  - STFT: 25 ms Hann window (`N_FFT = 400`, producing $400/2 + 1 = 201$ frequency bins), 10 ms hop (`HOP = 160`, 100 Hz frame rate, 60% overlap between adjacent windows).
  - Mel filterbank: `N_MELS = 80` triangular filters on the HTK mel scale $m(f) = 2595 \log_{10}(1 + f / 700)$ spanning $[0, 8000]\text{ Hz}$, followed by $\log(\text{mel} + 10^{-6})$.
  - Global Mean-Variance Normalization (MVN): per-bin mean and standard deviation estimated once over `MVN_N = 2000` seeded training utterances (`SEED = 42`), applied before stacking or convolution (`audiollm/features.py`).
  - Maximum audio clip length in training: `MAX_SEC = 16.0` s (`audiollm/config.py`).
  - SpecAugment (`audiollm/features.py`, `audiollm/config.py`): 2 frequency masks of width up to 27 bins (`F=27`) and 2 time masks of width up to $p_S = 0.05$ of utterance frames (capped at 100 frames).

## 2. Audio Projectors & Scale-Matching Initialization
- **Projector variants (`audiollm/projectors/stack.py`, `audiollm/projectors/conv.py`, `audiollm/projectors/base.py`)**:
  - `linear` (`LinearAudioProjector`): stacks `STACK` consecutive 80-bin frames into a flat vector of width $80 \cdot \text{STACK}$ and applies `nn.Linear(80 * STACK, 1024)`. At `STACK = 16` (160 ms per token, 6.25 Hz), input width is $16 \times 80 = 1{,}280$ and parameter count is $1{,}280 \times 1{,}024 + 1{,}024 = 1{,}311{,}744$ (1.31M parameters).
  - `mlp` (`MLPAudioProjector`): `LayerNorm(80 * STACK) -> Linear(80 * STACK, 1024) -> GELU -> Linear(1024, 1024)` (2.36M parameters at `STACK = 16`).
  - `conv` (`ConvAudioProjector`, Mel-LLM style, `audiollm/projectors/conv.py`, citing arXiv:2606.10231): $\log_2(\text{STACK})$ strided 1D convolutional blocks (kernel 3, stride 2, padding 1, GELU) over the 100 Hz mel frame sequence, followed by `LayerNorm(1024) -> Linear(1024, 1024) -> GELU -> Linear(1024, 1024)`.
    - Channel progression: $80 \to 512$ on stage 0, then $512 \to 1{,}024$ on stage 1, and $1{,}024 \to 1{,}024$ on remaining stages.
    - At `STACK = 8` (3 stride-2 stages: $100 \to 50 \to 25 \to 12.5\text{ Hz}$, 80 ms per token, temporal receptive field $2 \cdot \text{STACK} - 1 = 15$ frames = 150 ms): parameter count is $6{,}954{,}496$ (6.95M parameters). At `STACK = 16` (4 stride-2 stages, 6.25 Hz, 31-frame receptive field): parameter count is $10{,}091{,}264$ (10.09M parameters).
    - **ROCm / MIOpen engineering workaround (`audiollm/projectors/conv.py`)**: Standard `nn.Conv1d` on dynamic audio sequence lengths triggers MIOpen exhaustive kernel search on AMD ROCm GPUs, stalling for $\ge 8\text{ s/step}$ (`WORKLOG.md`). ` _StridedConv1dAsLinear` replaces `Conv1d(k=3, s=2, p=1)` with an exact mathematically equivalent `F.pad(x, (0,0,1,1)) -> x.unfold(dimension=1, size=3, step=2) -> nn.Linear(3 * C_in, C_out)` routed entirely through hipBLAS GEMM kernels.
- **Scale-matching initialization (`PROJ_INIT = "match_emb"`, `audiollm/projectors/base.py`, `docs/worklog_archive/2026-10.md`)**:
  - `LFM2.5-230M-Base` input token embeddings have per-dimension standard deviation $\sigma_{\text{emb}} \approx 0.028$ and $\ell_2$ row norm $\approx 0.89$.
  - Default PyTorch `nn.Linear` initialization on unit-variance MVN inputs produces audio vectors with per-dim std $\approx 0.58$ and $\ell_2$ row norm $\approx 18.5$ ($20\times$ larger than text embeddings).
  - `match_emb` initializes the projector's final `nn.Linear(d_in, d_out)` weights from $\mathcal{N}(0, (\sigma_{\text{emb}} / \sqrt{d_{\text{in}}})^2)$ with zero bias, bringing initial projected audio vectors to row norm $\approx 0.83$.

## 3. Sequence Layout, Backbone & Training Dynamics
- **Sequence layout (`audiollm/model.py`)**:
  - `[BOS][audio_1 ... audio_T_a]["Transcription:"][target text][EOS]`
  - Cross-entropy loss is computed exclusively on `[target text][EOS]` (`labels = -100` on BOS, audio tokens, and prompt tokens). Moreover, `self.lm_head` is only evaluated on the text slice `hidden[:, prefix_len - 1 :]`, avoiding the $[B, T_{\text{audio}}, 65{,}536]$ logit materialization overhead (`audiollm/model.py`).
- **Backbone (`audiollm/backbone.py`, `audiollm/config.py`)**:
  - Base model: `LiquidAI/LFM2.5-230M-Base` (230M parameters frozen, $d = 1{,}024$, 14 layers: 8 `Lfm2ShortConv` at indices $0,1,3,5,7,9,11,13$ and 6 GQA layers at indices $2,4,6,8,10,12$ with $n_h = 16, n_{kv} = 8, d_h = 64$, SwiGLU FFN $d_{ff} = 4{,}608$, vocab $65{,}536$).
  - LoRA configuration (`USE_LORA = True`): rank $r = 64$, $\alpha = 128$ (scaling $\alpha / r = 2.0$), dropout $0.05$, `target_modules = "all-linear"` (`q_proj`, `k_proj`, `v_proj`, `out_proj`, `in_proj`, `w1`, `w2`, `w3`). Trainable LoRA parameters: $15{,}532{,}032$ (15.53M).
  - Total parameters (`conv` `STACK=8` + LoRA + frozen 230M base): $230.08\text{M} + 15.53\text{M} + 6.95\text{M} = 252.56\text{M}$ ($22.49\text{M}$ trainable, $8.9\%$ of total).
- **Breaking the 120% WER Text-Prior Regime (`docs/worklog_archive/2026-10.md`)**:
  - All 6 early `linear` (`STACK=16`) runs plateaued at val loss $3.45\text{–}3.61$ and WER $112\text{–}125\%$ with `wer == wer_shuffle` (identical WER when audio tokens are randomly permuted across time).
  - Diagnostic gradient telemetry (`audiollm/trainer.py`) revealed that LoRA gradients averaged $\sim 2.2$ while projector gradients averaged $\sim 0.18$; under shared global gradient clipping (`clip_grad_norm_(all_params, 1.0)`), LoRA updates dominated every step to memorize dataset text statistics while starving the projector.
  - Three combined fixes broke the text-prior wall (`docs/worklog_archive/2026-10.md`):
    1. Switching to `PROJECTOR="conv"` (`STACK=8`, 12.5 Hz, 6.95M params) with overlapping kernel-3 receptive fields.
    2. Separate gradient clipping (`GRAD_CLIP = 1.0` applied independently to `proj_params` and `lora_params`, `audiollm/trainer.py` lines 253–254) with `LR_PROJ = 1e-3`, `LR_LORA = 3e-4`.
    3. Training past a sharp alignment phase transition at step $\sim 3{,}000$, where `proj_grad_norm` jumped $5\times$ from $0.26$ to $1.3\text{–}2.3$ and loss plunged from $3.35$ to $2.03$.
- **Decoding guards (`audiollm/model.py`, `docs/worklog_archive/2026-10.md`)**:
  - Without decoding guards, a single hallucination loop emits 128 repeated n-grams on a 3-word utterance, inflating WER by $>2{,}000\%$ on that sample.
  - Duration-proportional token cap: $\text{max\_new\_tokens} = \min(\text{MAX\_NEW\_TOKENS}, \max(16, \lceil 6.0 \cdot \text{sec} \rceil + 10))$.
  - 4-gram repetition blocking (`NO_REPEAT_NGRAM = 4`): reduced 9-set mean WER on `mix544h_conv_stack8` from $121.7\%$ to $95.3\%$ ($-26.4$ points without retraining).

## 4. Scaling Training Diversity & Multi-Epoch Convergence (`WORKLOG.md`)
- **7-corpus training mixture (`3,179.4` unique hours, `1,783,428` utterances)**:
  - LibriSpeech `train-clean-100` (100.6 h, 28,539 utts) + `train-clean-360` (363.6 h, 104,014 utts) + `train-other-500` (496.9 h, 148,688 utts)
  - AMI IHM (79.9 h, 108,104 utts)
  - VoxPopuli EN (529.6 h, 176,974 utts)
  - TED-LIUM 3 (453.0 h, 268,022 utts)
  - GigaSpeech M (999.9 h, 899,586 utts)
  - SPGISpeech S (156.5 h, 49,501 utts)
- **Scaling progression (`WORKLOG.md`)**:
  - `ls100h` (100.6 h, 12.8k steps): LibriSpeech `test-clean` $84.00\%$, `test-other` $91.42\%$ (memorized train set: train loss $0.035$).
  - `mix544h` (544.1 h, 12.8k steps): `test-clean` $71.29\%$, `test-other` $85.30\%$, OpenASR 7-set mean $93.99\%$.
  - `cont19k` (544.1 h, +19.2k steps): `test-clean` $36.92\%$, `test-other` $66.18\%$, OpenASR 7-set mean $76.83\%$.
  - `B mix1040h` (1,040 h, +19.2k steps): `test-clean` $25.12\%$, `test-other` $49.42\%$, OpenASR 7-set mean $65.95\%$ (vs matched-compute 544 h control `C` at $31.80\% / 62.50\% / 73.38\%$).
  - `D mix2000h` (1,983 h, +19.2k steps): `test-clean` $19.99\%$, `test-other` $44.58\%$, OpenASR 7-set mean $50.83\%$, 9-set mean $59.24\%$.
  - `E2 mix3200h` (3,179.4 h, +19.2k steps = 0.35 epochs): `test-clean` $18.18\%$, `test-other` $41.90\%$, OpenASR 7-set mean $41.36\%$, 9-set mean $49.15\%$, 8-dev mean $39.85\%$.
  - **Convergence Stages A, B, C** (55,732 optimizer steps = 1 full pass over 1,783,428 utterances each, batch 32):
    - Stage A (`LR_PROJ=2e-4`, `LR_LORA=6e-5`): `test-clean` $14.37\%$, `test-other` $34.97\%$, OpenASR 7-set mean $34.11\%$, 9-set mean $41.85\%$, 8-dev mean $32.25\%$.
    - Stage B (`LR_PROJ=1e-4`, `LR_LORA=3e-5`): `test-clean` $12.23\%$, `test-other` $33.48\%$, OpenASR 7-set mean $32.26\%$, 9-set mean $40.13\%$, 8-dev mean $30.31\%$.
    - Stage C (`LR_PROJ=5e-5`, `LR_LORA=1.5e-5`): `test-clean` $11.87\%$, `test-other` $32.73\%$, SPGISpeech $24.07\%$, VoxPopuli $28.87\%$, TED-LIUM $33.19\%$, GigaSpeech $33.23\%$, AMI $35.93\%$, CommonVoice $49.94\%$, Earnings22 $67.85\%$, FLEURS $59.10\%$; OpenASR 7-set mean $31.42\%$, 9-set mean $39.26\%$, 8-dev mean $29.12\%$.

## 5. Implicit Acoustic Encoder & In-LLM Token Merging (`WORKLOG.md`, `audiollm/merging.py`, `audiollm/layer_merging.py`)
- **Implicit encoder depth profile (`scripts/probe_layer_redundancy.py`, `WORKLOG.md`, citing arXiv:2610.24239)**:
  - Mean-centered adjacent audio cosine similarity $\cos(\tilde{h}_i, \tilde{h}_{i+1})$ rises from $0.285$ at input (`projector_out`) to $0.354$ at layer 1 (after the first two conv blocks), $0.369$ at layer 2 (first GQA block), and $0.456\text{–}0.525$ across layers $9\text{–}13$ on `dev-clean` (and $0.194 \to 0.457$ on `dev-other`).
  - Fraction of adjacent pairs exceeding $\tau = 0.5$ increases from $15.6\%$ at input to $41.6\%$ at layer 9.
- **Effective token ratio across hybrid layers (`docs/in_llm_merging_plan.md`, `audiollm/layer_merging.py`)**:
  - Merging at layer $k \in \{0, \dots, 13\}$ leaves $k$ layers at full length $T_a$ and $14 - k$ layers at compressed length $R_k T_a$, giving effective token ratio:
    $$E = \frac{k + (14 - k) R_k}{14} \quad \Longleftrightarrow \quad R_k = \frac{14 E - k}{14 - k}$$
  - Because `LFM2.5-230M` layers 0 and 1 are gated short convolutions (`C C A C A ...`) and all 6 GQA attention layers sit at indices $k \in \{2, 4, 6, 8, 10, 12\}$, merging at $k = 2$ reduces sequence length before **100% of the attention layers** (6/6 GQA layers), matching $k = 0$'s attention KV-cache savings while giving the two initial conv blocks unmerged 12.5 Hz frames.
- **Full 8-dev training-free sweep results (`WORKLOG.md`)**:
  - Baseline (`none`, $E = 1.00$ on `E2`): 8-dev mean $39.68\%$, `dev-clean` $17.87\%$.
  - Global optimum: `affinity` at layer $k = 2$, $E = 0.93$ ($R_2 = 0.918$, $\tau = 0.70$, $M_{\max} = 2$): 8-dev mean **$39.35\%$** ($-0.33\%$ below unmerged baseline) and `dev-clean` **$16.61\%$** ($-1.26\%$ below unmerged baseline).
  - Content-adaptive `affinity` vs position-blind `uniform_matched` at $k = 0$ on Stage C (baseline $29.12\%$ 8-dev mean):
    - $E = 0.93$: `affinity` $29.21\%$ ($+0.09\%$) vs `uniform_matched` $34.37\%$ ($+5.25\%$).
    - $E = 0.87$: `affinity` $29.48\%$ ($+0.36\%$) vs `uniform_matched` $38.27\%$ ($+9.15\%$).
    - $E = 0.80$: `affinity` $31.26\%$ ($+2.14\%$) vs `uniform_matched` $42.84\%$ ($+13.72\%$, an $11.58$-point gap).

## 6. Cross-Backbone Projector Transfer, Tokenizer Grafting & Prompt-Triggered Error Correction (`WORKLOG.md`, `audiollm/vietnamese.py`)
- **Tokenizer fertility bottleneck (`WORKLOG.md`)**:
  - `LFM2.5-230M` (`GPT2TokenizerFast`, 65,536 vocab) was trained without Vietnamese BPE merges, splitting precomposed UTF-8 diacritics into byte tokens at **$3.23$ tokens/word** ($221\%$ overhead), whereas `Qwen3-0.6B-Base` uses $1.17$ tokens/word and `LFM3` uses $1.14$ tokens/word.
- **Cross-backbone projector transfer (`INIT_PROJ_FROM`, `WORKLOG.md`)**:
  - Because `LFM2.5-230M-Base` and `Qwen3-0.6B-Base` both use hidden dimension $d = 1{,}024$, the English-trained `E2` `ConvAudioProjector` transfers directly across model families (`match_emb` rescales the output layer to Qwen3's embedding std $\sigma_{\text{emb}} = 0.0256$).
  - On the matched 500 h Vietnamese multi-corpus experiment (19.2k steps, 2.58 epochs over 223,115 utterances), `Qwen3-0.6B-Base` reached $35.48\%$ GigaSpeech2-vi test WER ($11.64\%$ PhoAudiobook, $11.88\%$ LSVSC) vs $48.37\%$ for `LFM2.5-230M`.
- **Merge-closed `LFM3` tokenizer graft (`scripts/graft_lfm3_tokenizer.py`, `WORKLOG.md`)**:
  - Grafting `LFM3`'s tokenizer onto `LFM2.5-230M-Base` and pruning to a merge-closed English+Vietnamese vocabulary of $45{,}755$ tokens ($35{,}278$ exact string matches copied directly; $10{,}477$ new Vietnamese tokens initialized as the mean of their old `LFM2.5` sub-token embeddings, with 1,500-step embedding warmup) reduced Vietnamese fertility from $3.23 \to 1.14$ tokens/word ($-64.7\%$).
  - Training the grafted model with prompt-triggered ASR error correction (`CORRECTION_P = 0.2`, `audiollm/vietnamese.py` simulated tone/homophone/deletion noise) reached $16.33\%$ WER on the 300-utterance ZAC Vietnamese dev subset at 6,000 steps.

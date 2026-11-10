// GroupNorm batch-size & train-vs-eval scene: why BatchNorm degrades at small mini-batches and
// shifts between train and eval, while GroupNorm runs the exact same intra-sample formula at any N.
import { text, rect, circle, line, path, group, clamp, f1 } from './kit.mjs';

// Verified numbers from Wu & He (2018) Table 2: ResNet-50 on ImageNet top-1 validation error (%)
const BATCHES = [32, 16, 8, 4, 2];
const BN_ERR = [23.6, 23.7, 24.8, 27.3, 34.7];
const GN_ERR = [24.1, 24.2, 24.0, 24.2, 24.1];

export default {
  viewBox: [460, 246],
  beats: [
    {
      say: 'At N = 32 images per GPU, BatchNorm averages over a big batch: its batch μ and σ stay steady.',
      state: { idx: 0, bnMu: 0.05, bnSpread: 1.02, evalMode: 0, focusGn: 0 },
    },
    {
      say: 'Shrink the batch to N = 8: BatchNorm’s batch mean wobbles from step to step, and error ticks up.',
      state: { idx: 2, bnMu: 0.45, bnSpread: 1.24, evalMode: 0, focusGn: 0 },
    },
    {
      say: 'At N = 2 (typical in detection and segmentation), noisy batch stats push BatchNorm error to 34.7%.',
      state: { idx: 4, bnMu: -1.15, bnSpread: 1.68, evalMode: 0, focusGn: 0 },
    },
    {
      say: 'At eval, BatchNorm swaps batch stats for running averages, creating a train–eval mismatch.',
      state: { idx: 4, bnMu: -1.15, bnSpread: 1.68, evalMode: 1, focusGn: 0 },
    },
    {
      say: 'GroupNorm pools inside one image only: train and eval are identical, and error stays flat at 24.1%.',
      state: { idx: 4, bnMu: -1.15, bnSpread: 1.68, evalMode: 1, focusGn: 1 },
    },
  ],
  draw({ idx, bnMu, bnSpread, evalMode, focusGn }) {
    let out = '';
    const k = clamp(Math.round(idx), 0, 4);
    const curN = BATCHES[k];

    // Left panel: Train vs Eval statistics for BN (top) and GN (bottom)
    const LX = 10;
    const LW = 212;
    out += text(LX, 16, `Statistics at N = ${curN} / GPU`, 't tb');

    // BN card
    out += rect(LX, 26, LW, 94, focusGn > 0.5 ? 'faint' : 'ink', { rx: 4 });
    out += text(LX + 8, 42, 'BatchNorm', 'ts tb');
    out += text(LX + LW - 8, 42, evalMode > 0.5 ? 'eval: running avg' : 'train: batch stat', 'ts tm te');

    // Draw reference target center and BN current estimate bar
    const midX = LX + LW / 2;
    out += line(midX, 50, midX, 82, 'wire dash');
    const muX = midX + bnMu * 34;
    const hw = clamp(bnSpread * 28, 12, 68);
    // Ghost running average box during eval
    if (evalMode > 0.05) {
      out += group(
        rect(midX - 28, 56, 56, 18, 'cache', { rx: 3 }) +
          text(midX, 92, 'eval uses μ_run, σ_run (mismatch)', 'ts tc cache'),
        { opacity: evalMode },
      );
    }
    out += rect(muX - hw, 58, hw * 2, 14, 'act solid', { rx: 2, 'fill-opacity': evalMode > 0.5 ? 0.35 : 0.75 });
    out += circle(muX, 65, 3.5, 'ink solid');
    if (evalMode <= 0.05) {
      out += text(midX, 92, `batch μ = ${f1(bnMu)}, σ = ${f1(bnSpread)}`, 'ts tm tc');
    }
    out += text(LX + 8, 111, `pool: m = ${curN} × H × W`, 'ts tm');

    // GN card
    out += rect(LX, 130, LW, 94, focusGn > 0.5 ? 'ink hot' : 'faint', { rx: 4 });
    out += text(LX + 8, 146, 'GroupNorm (G = 32)', 'ts tb');
    out += text(LX + LW - 8, 146, 'train = eval', 'ts tm te act');
    out += line(midX, 154, midX, 186, 'wire dash');
    out += rect(midX - 28, 162, 56, 14, 'act solid', { rx: 2, 'fill-opacity': 0.85 });
    out += circle(midX, 169, 3.5, 'ink solid');
    out += text(midX, 196, 'exact group μ = 0.0, σ = 1.0', 'ts tm tc');
    out += text(LX + 8, 215, 'pool: m = (C/G) × H × W', 'ts tm');

    // Right panel: Wu & He (2018) Table 2 chart (ResNet-50 ImageNet val error %)
    const CX = 262;
    const CW = 184;
    const CY0 = 34;
    const CY1 = 194;
    const xOf = (i) => CX + (i / 4) * CW;
    const yOf = (err) => CY1 - ((err - 22) / (36 - 22)) * (CY1 - CY0);

    out += text(CX - 8, 16, 'ResNet-50 ImageNet error (%)', 't tb');
    for (const v of [24, 28, 32, 36]) {
      const y = yOf(v);
      out += line(CX, y, CX + CW, y, 'faint');
      out += text(CX - 6, y + 4, `${v}%`, 'ts tm te');
    }

    // X-axis batch size ticks
    BATCHES.forEach((b, i) => {
      const x = xOf(i);
      out += text(x, CY1 + 16, String(b), i === k ? 'ts tm tc tb' : 'ts tm tc');
    });
    out += text(CX + CW / 2, CY1 + 34, 'batch size N (images per GPU) →', 'ts tc');

    // Draw lines up to current index idx
    const poly = (arr) => {
      const pts = [];
      const top = Math.floor(idx);
      for (let i = 0; i <= top; i++) pts.push(`${xOf(i).toFixed(1)},${yOf(arr[i]).toFixed(1)}`);
      const frac = idx - top;
      if (frac > 0 && top < 4) {
        const xi = xOf(top + frac);
        const yi = yOf(arr[top] + (arr[top + 1] - arr[top]) * frac);
        pts.push(`${xi.toFixed(1)},${yi.toFixed(1)}`);
      }
      return `M${pts.join(' L')}`;
    };

    // BN curve (dark) and GN curve (activation colour)
    out += path(poly(BN_ERR), 'wire', { style: 'stroke: var(--ink); stroke-width: 2.2' });
    out += path(poly(GN_ERR), 'flow', { style: 'stroke-width: 2.6' });

    // Current points and readouts
    const curX = xOf(idx);
    const bnV = BN_ERR[k];
    const gnV = GN_ERR[k];
    out += circle(curX, yOf(BN_ERR[Math.floor(idx)] + (BN_ERR[Math.min(4, Math.ceil(idx))] - BN_ERR[Math.floor(idx)]) * (idx % 1)), 4, 'ink solid');
    out += circle(curX, yOf(GN_ERR[Math.floor(idx)] + (GN_ERR[Math.min(4, Math.ceil(idx))] - GN_ERR[Math.floor(idx)]) * (idx % 1)), 4, 'act solid');

    // Legend / live value callout at top of chart
    out += text(CX + 6, CY0 + 14, `BN: ${bnV.toFixed(1)}%`, 'ts tm tb');
    out += text(CX + 6, CY0 + 30, `GN: ${gnV.toFixed(1)}%`, 'ts tm tb act');
    if (k === 4) {
      out += text(CX + CW - 4, yOf(34.7) - 8, '−10.6% with GN', 'ts tm te tb act');
    }

    return out;
  },
};

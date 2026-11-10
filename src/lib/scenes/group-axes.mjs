// GroupNorm axes scene: how BatchNorm, LayerNorm, InstanceNorm and GroupNorm slice a 4D feature
// tensor (N, C, H, W), and why learned γ and β remain per-channel (2C parameters).
import { text, rect, line, group, rng, clamp, mean, std, f1 } from './kit.mjs';

export default {
  viewBox: [460, 264],
  setup() {
    const r = rng(19);
    const N = 3;
    const C = 6;
    const HW = 4; // 2x2 spatial grid per channel
    // Each channel has its own typical offset and scale, plus sample-level variation.
    const chMu = [1.8, 1.1, -0.9, -1.6, 0.7, 2.1];
    const chSd = [0.6, 0.9, 0.7, 0.5, 1.1, 0.8];
    const nOff = [0.4, -0.5, 0.2];
    const raw = Array.from({ length: N }, (_, n) =>
      Array.from({ length: C }, (_, c) =>
        Array.from({ length: HW }, () => chMu[c] + nOff[n] + chSd[c] * (r.next() - 0.5) * 2.2),
      ),
    );
    const normSet = (vals) => {
      const m = mean(vals);
      const s = std(vals) || 1;
      return { m, s };
    };
    // Precompute normalized channel averages for sample 0 under each mode for the right-hand bars.
    const rawMeans = raw[0].map((hw) => mean(hw));
    // BN: each channel c normalized across all N and HW
    const bnMeans = Array.from({ length: C }, (_, c) => {
      const all = raw.flatMap((s) => s[c]);
      const { m, s } = normSet(all);
      return mean(raw[0][c].map((v) => (v - m) / s));
    });
    // LN (G=1): all C and HW of sample 0 normalized together
    const lnStat = normSet(raw[0].flat());
    const lnMeans = raw[0].map((hw) => mean(hw.map((v) => (v - lnStat.m) / lnStat.s)));
    // IN (G=C): each channel of sample 0 normalized over its own HW
    const inMeans = raw[0].map(() => 0);
    // GN (G=2, 3 channels per group):
    const g0 = normSet(raw[0].slice(0, 3).flat());
    const g1 = normSet(raw[0].slice(3, 6).flat());
    const gnMeans = raw[0].map((hw, c) => {
      const st = c < 3 ? g0 : g1;
      return mean(hw.map((v) => (v - st.m) / st.s));
    });
    const gamma = [1.3, 0.8, 1.1, 0.9, 1.4, 0.7];
    const beta = [0.4, -0.3, 0.2, -0.4, 0.5, -0.2];
    const afMeans = gnMeans.map((u, c) => gamma[c] * u + beta[c]);
    return { N, C, raw, rawMeans, bnMeans, lnMeans, inMeans, gnMeans, afMeans, g0, g1 };
  },
  beats: [
    {
      say: 'A vision layer outputs N examples. Each example has C channels of H × W spatial grids.',
      state: { mode: 'raw', bars: [1.9, 1.2, -0.6, -1.3, 0.9, 2.2], affine: 0 },
    },
    {
      say: 'BatchNorm pools one channel across all N examples and H × W pixels. Small batches make it noisy.',
      state: { mode: 'bn', bars: [0.8, 0.6, 0.7, 0.9, 0.5, 0.7], affine: 0 },
    },
    {
      say: 'LayerNorm (G = 1) pools all C channels and H × W pixels of one example into one μ and σ.',
      state: { mode: 'ln', bars: [1.1, 0.6, -0.7, -1.2, 0.4, 1.3], affine: 0 },
    },
    {
      say: 'InstanceNorm (G = C) pools only one channel’s H × W pixels, zeroing out every channel’s mean.',
      state: { mode: 'in', bars: [0, 0, 0, 0, 0, 0], affine: 0 },
    },
    {
      say: 'GroupNorm splits one example’s C channels into G groups of C/G, normalizing each group over H × W.',
      state: { mode: 'gn', bars: [0.9, 0.3, -1.2, -1.1, 0.1, 1.0], affine: 0 },
    },
    {
      say: 'After group normalization, learned γ and β apply one scale and shift per channel (2C parameters).',
      state: { mode: 'gn', bars: [1.5, -0.1, -1.1, -1.4, 0.6, 0.5], affine: 1 },
    },
  ],
  draw({ mode, bars, affine }, ctx) {
    const { N, C } = ctx;
    let out = '';
    // Left side: N=3 examples stacked vertically, C=6 channels horizontally, each channel a 2x2 HxW grid
    const X0 = 56;
    const Y0 = 32;
    const CW = 34; // channel column pitch
    const NH = 54; // example row pitch
    const S = 11; // 2x2 cell size (total 22x22 per channel tile)

    out += text(X0, 16, 'channels C (G = 2 groups of C/G = 3) →', 'ts');
    for (let c = 0; c < C; c++) {
      out += text(X0 + c * CW + 11, 28, `c${c + 1}`, 'ts tm tc');
    }

    for (let n = 0; n < N; n++) {
      const ny = Y0 + n * NH;
      out += text(8, ny + 18, `n = ${n + 1}`, n === 0 ? 't tb' : 'ts');
      for (let c = 0; c < C; c++) {
        const cx = X0 + c * CW;
        // Determine if this (n, c) tile is in the active normalization pool
        let inPool = false;
        let groupB = false;
        if (mode === 'bn' && c === 0) inPool = true;
        if (mode === 'ln' && n === 0) inPool = true;
        if (mode === 'in' && n === 0 && c === 0) inPool = true;
        if (mode === 'gn' && n === 0) {
          inPool = true;
          groupB = c >= 3;
        }
        const role = !inPool ? 'faint' : groupB ? 'route' : 'act';
        for (let r = 0; r < 2; r++) {
          for (let k = 0; k < 2; k++) {
            const op = inPool ? 0.55 + 0.12 * ((r * 2 + k + c) % 3) : 0.25;
            out += rect(cx + k * S, ny + 4 + r * S, S - 1.5, S - 1.5, `${role} solid`, { rx: 1.5, 'fill-opacity': op });
          }
        }
      }
    }

    // Highlight bounding boxes for the pooled set S_i
    if (mode === 'bn') {
      out += rect(X0 - 3, Y0 + 1, 25, (N - 1) * NH + 26, 'ink hot', { style: 'fill: none', rx: 4 });
      out += text(X0, Y0 + N * NH + 8, 'BatchNorm: 1 channel × N × H × W', 'ts tb');
    } else if (mode === 'ln') {
      out += rect(X0 - 3, Y0 + 1, (C - 1) * CW + 25, 26, 'ink hot', { style: 'fill: none', rx: 4 });
      out += text(X0, Y0 + N * NH + 8, 'LayerNorm (G = 1): 1 example × C × H × W', 'ts tb');
    } else if (mode === 'in') {
      out += rect(X0 - 3, Y0 + 1, 25, 26, 'ink hot', { style: 'fill: none', rx: 4 });
      out += text(X0, Y0 + N * NH + 8, 'InstanceNorm (G = C): 1 channel × H × W', 'ts tb');
    } else if (mode === 'gn') {
      const gW = 2 * CW + 25;
      out += rect(X0 - 3, Y0 + 1, gW, 26, 'ink hot', { style: 'fill: none', rx: 4 });
      out += rect(X0 + 3 * CW - 3, Y0 + 1, gW, 26, 'route hot', { style: 'fill: none', rx: 4 });
      out += text(X0 + gW / 2 - 3, Y0 + 40, 'group 1 (μ₁, σ₁)', 'ts tc tb act');
      out += text(X0 + 3 * CW + gW / 2 - 3, Y0 + 40, 'group 2 (μ₂, σ₂)', 'ts tc tb route');
      out += text(X0, Y0 + N * NH + 8, 'GroupNorm: pools (C/G) × H × W per group', 'ts tb');
    } else {
      out += text(X0, Y0 + N * NH + 8, '4D activation tensor x of shape (N, C, H, W)', 'ts');
    }

    // Per-channel affine γ, β strip at bottom
    const ay = 224;
    let afGroup = text(8, ay + 14, 'γ, β:', 'ts tb wt');
    for (let c = 0; c < C; c++) {
      const cx = X0 + c * CW;
      afGroup += rect(cx - 1, ay, 24, 20, 'wt', { rx: 3 });
      afGroup += text(cx + 11, ay + 14, `c${c + 1}`, 'ts tm tc wt');
    }
    afGroup += text(X0, ay + 34, 'learned scale γ and shift β: 1 pair per channel (2C total)', 'ts wt');
    out += group(afGroup, { opacity: 0.25 + 0.75 * affine });

    // Right panel: Sample 1 channel means (shows why G=1, G=C, and G=2 differ)
    const RX = 290;
    const RY = 118;
    out += text(RX, 16, 'n = 1 channel means', 'ts tb');
    out += rect(RX, 26, 158, 152, 'faint', { rx: 4 });
    out += line(RX + 8, RY, RX + 150, RY, 'wire');
    out += text(RX + 148, RY - 4, '0', 'ts tm te');
    for (let c = 0; c < C; c++) {
      const bx = RX + 14 + c * 22;
      const v = bars[c] ?? 0;
      const h = clamp(v * 34, -68, 68);
      const cls = mode === 'gn' && c >= 3 ? 'route solid' : affine > 0.5 ? 'wt solid' : 'act solid';
      out += rect(bx, h >= 0 ? RY - h : RY, 14, Math.max(2, Math.abs(h)), cls, { rx: 1.5 });
      out += text(bx + 7, 170, `c${c + 1}`, 'ts tm tc');
    }
    const modeNote =
      mode === 'in'
        ? 'all channel means = 0'
        : mode === 'gn'
          ? 'relative scale preserved per group'
          : mode === 'ln'
            ? 'all C share 1 scale'
            : mode === 'bn'
              ? 'coupled across batch N'
              : 'unnormalized channel offsets';
    out += text(RX + 79, 194, modeNote, 'ts tc');

    return out;
  },
};

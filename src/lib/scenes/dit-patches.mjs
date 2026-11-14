import { arrow, bars, box, f1, lerp, line, path, rect, text } from './kit.mjs';

// 4x4 spatial target (a simple symmetric cross/ring pattern) and fixed noise offset
const CLEAN_GRID = [
  [0.12, 0.88, 0.88, 0.12],
  [0.88, 0.96, 0.96, 0.88],
  [0.88, 0.96, 0.96, 0.88],
  [0.12, 0.88, 0.88, 0.12],
];

const NOISE_GRID = [
  [0.84, -0.68, 0.36, -0.80],
  [-0.58, 0.48, -0.74, 0.66],
  [0.70, -0.46, 0.76, -0.60],
  [-0.76, 0.54, -0.64, 0.82],
];

function drawGrid(x, y, size, noiseAmt, fineAmt, role = 'act') {
  const out = [];
  const cell = size / 4;
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      const val = lerp(CLEAN_GRID[r][c], Math.max(0.08, Math.min(0.95, 0.5 + NOISE_GRID[r][c] * 0.55)), noiseAmt);
      out.push(rect(x + c * cell + 0.8, y + r * cell + 0.8, cell - 1.6, cell - 1.6, `${role} solid`, {
        rx: 1.5,
        'fill-opacity': Math.max(0.08, Math.min(0.95, val)),
      }));
    }
  }
  out.push(rect(x, y, size, size, 'wire', { rx: 3 }));
  // Outer 2x2 patch boundaries (T=4)
  const half = size / 2;
  out.push(line(x + half, y, x + half, y + size, 'wire dash'));
  out.push(line(x, y + half, x + size, y + half, 'wire dash'));
  // Fine 4x4 patch boundaries fade in when fineAmt > 0.1 (T=16)
  if (fineAmt > 0.08) {
    const sub = [size * 0.25, size * 0.75];
    for (const o of sub) {
      out.push(line(x + o, y, x + o, y + size, 'wire dash', { opacity: fineAmt }));
      out.push(line(x, y + o, x + size, y + o, 'wire dash', { opacity: fineAmt }));
    }
  }
  return out.join('');
}

const TOK4 = [
  [0.7, 0.4, 0.9, 0.5],
  [0.5, 0.9, 0.6, 0.8],
  [0.9, 0.6, 0.5, 0.7],
  [0.4, 0.8, 0.7, 0.6],
];

export default {
  viewBox: [460, 240],
  beats: [
    {
      say: 'Patchify cuts the latent grid into p×p patches and projects each into a token.',
      state: { noiseIn: 0.92, noiseOut: 0.82, fine: 0, adaln: 0.3, hot: 'patch' },
    },
    {
      say: 'Halving patch size p quadruples token count T = (I/p)² and block compute.',
      state: { noiseIn: 0.92, noiseOut: 0.82, fine: 1, adaln: 0.3, hot: 'dial' },
    },
    {
      say: 'Every DiT block keeps width d fixed while t and class c modulate via adaLN.',
      state: { noiseIn: 0.92, noiseOut: 0.55, fine: 0, adaln: 1, hot: 'dit' },
    },
    {
      say: 'A linear head maps tokens back to p×p patches, then unpatchify restores the clean grid.',
      state: { noiseIn: 0.92, noiseOut: 0.06, fine: 0, adaln: 0.8, hot: 'out' },
    },
  ],
  draw({ noiseIn, noiseOut, fine, adaln, hot }) {
    const out = [];
    const Tval = Math.round(lerp(4, 16, fine));
    const gflops = lerp(1, 4, fine);

    // ---- Top main pipeline (y = 26..126) ----
    // 1. Input noisy latent z_t (x = 12..80, y = 40..108, size = 68)
    out.push(text(46, 28, 'Latent z_t', 't tb tc'));
    out.push(drawGrid(12, 40, 68, noiseIn, fine, 'act'));
    out.push(text(46, 122, 'I × I × C', 'ts tc tm'));

    out.push(arrow(80, 74, 96, 74, 'wire'));

    // 2. Patchify + Tokens (x = 96..178, y = 28..116)
    const tokCls = hot === 'patch' ? 'act hot' : 'act';
    out.push(box(96, 28, 82, 26, 'Patchify', hot === 'patch' ? 'wt hot' : 'wt'));
    out.push(rect(96, 60, 82, 56, tokCls));
    out.push(text(137, 74, `Tokens (${Tval} × d)`, 'ts tb tc'));

    // Draw either 4 coarse token mini-cards or transition smoothly to 16 fine squares
    if (fine < 0.5) {
      const op = 1 - fine * 2;
      for (let i = 0; i < 4; i++) {
        const tx = 101 + i * 19;
        out.push(rect(tx, 80, 16, 28, 'act', { opacity: op }));
        out.push(bars(tx + 2, 102, TOK4[i], { w: 2.2, gap: 1, scale: 14, max: 16, cls: 'act solid' }));
      }
    } else {
      const op = (fine - 0.5) * 2;
      for (let r = 0; r < 2; r++) {
        for (let c = 0; c < 8; c++) {
          const sx = 102 + c * 9;
          const sy = 81 + r * 14;
          out.push(rect(sx, sy, 7, 11, 'act solid', { rx: 1, opacity: 0.75 * op }));
        }
      }
    }
    out.push(text(137, 129, '+ pos emb', 'ts tc'));

    out.push(arrow(178, 84, 194, 84, 'wire'));

    // 3. L DiT blocks (x = 194..294, y = 36..120, uniform width)
    const ditCls = hot === 'dit' ? 'wt hot' : 'wt';
    out.push(text(244, 28, 'fixed width d', 'ts tc'));
    out.push(rect(194, 36, 100, 82, ditCls));
    out.push(text(244, 54, 'L DiT blocks', 't tb tc'));
    out.push(rect(204, 62, 80, 20, 'op'));
    out.push(text(244, 76, 'Self-Attention', 'ts tc'));
    out.push(rect(204, 87, 80, 20, 'op'));
    out.push(text(244, 101, 'Feed-Forward', 'ts tc'));

    out.push(arrow(294, 84, 310, 84, 'wire'));

    // 4. Linear head (x = 310..372, y = 52..100)
    const headCls = hot === 'out' ? 'wt hot' : 'wt';
    out.push(box(310, 52, 62, 48, 'Head', headCls, 'd → p²C'));
    out.push(text(341, 114, 'unpatchify', 'ts tc'));

    out.push(arrow(372, 74, 386, 74, 'wire'));

    // 5. Output predicted/denoised grid (x = 386..454, y = 40..108)
    out.push(text(420, 28, 'Prediction x̂₀', 't tb tc'));
    out.push(drawGrid(386, 40, 68, noiseOut, fine, 'act'));
    out.push(text(420, 122, 'I × I × C', 'ts tc tm'));

    // ---- Bottom left: Patch-size compute dial (x = 12..178, y = 148..224) ----
    const dialCls = hot === 'dial' ? 'op hot' : 'op';
    out.push(rect(12, 148, 166, 74, dialCls));
    out.push(text(22, 166, 'Patch dial', 't tb'));
    out.push(text(168, 166, fine < 0.5 ? 'p=4 → T=4' : 'p=2 → T=16', 'ts tb te tm'));
    out.push(text(22, 186, 'FLOPs', 'ts'));
    out.push(rect(62, 177, 68, 10, 'faint', { rx: 2 }));
    out.push(rect(62, 177, 17 * gflops, 10, 'act solid', { rx: 2 }));
    out.push(text(168, 186, `${f1(gflops)}×`, 'ts tb te tm'));
    out.push(text(22, 209, 'Params stay almost flat', 'ts'));

    // ---- Bottom right: Conditioning via adaLN into DiT blocks (x = 194..454, y = 148..224) ----
    const adalnCls = hot === 'dit' ? 'act hot' : 'act';
    out.push(box(194, 158, 72, 48, 't, class c', adalnCls, 'd_c'));
    out.push(arrow(266, 182, 286, 182, 'wire'));
    out.push(box(286, 158, 78, 48, 'adaLN-Zero', adalnCls, 'γ, β, α'));

    // Wire from adaLN top up to bottom of DiT blocks (y = 118)
    if (adaln > 0.6) out.push(path('M325,158 L325,138 L244,138 L244,124', 'flow'));
    out.push(path('M325,158 L325,138 L244,138 L244,118', 'wire arrow'));

    // Right status pill (x = 376..452, y = 158..206)
    out.push(rect(376, 158, 76, 48, 'op'));
    out.push(text(414, 178, 'No U-Net', 't tb tc'));
    out.push(text(414, 194, 'no pooling', 'ts tc'));

    return out.join('');
  },
};

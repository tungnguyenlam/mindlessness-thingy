import { arrow, bars, clamp, f2, heat, lerp, line, path, rect, text } from './kit.mjs';

const TILE_A = [0.68, -0.44, 0.85, -0.36];
const W_MAT = [
  [0.85, 0.35, 0.65, 0.25],
  [0.45, 0.95, 0.2, 0.7],
  [0.6, 0.3, 0.8, 0.5],
  [0.25, 0.75, 0.4, 0.6],
];

// Simulate coarse FP8 quantization under either a giant global scale (outlier=64) or tight tile scale (max=0.85)
function quantA(v, tileMode) {
  const crushed = Math.abs(v) < 0.75 ? 0 : Math.sign(v) * 0.2;
  const tight = Math.round(v * 8) / 8;
  return lerp(crushed, tight, tileMode);
}

export default {
  viewBox: [460, 260],
  beats: [
    {
      say: 'One global scale stretches to fit the outlier in Tile B, crushing normal channels in Tile A toward zero.',
      state: { tileMode: 0, matStep: 0, promo: 0, hot: 'global' },
    },
    {
      say: 'Per-tile scaling gives each 1 × N_c group its own scale, keeping Tile A crisp and isolating the outlier.',
      state: { tileMode: 1, matStep: 0, promo: 0, hot: 'tile' },
    },
    {
      say: 'During GEMM, each activation tile and N_c × N_c weight block dequantize locally with s_A · s_W.',
      state: { tileMode: 1, matStep: 1, promo: 0.3, hot: 'gemm' },
    },
    {
      say: 'Partial sums are promoted to an FP32 accumulator every N_c elements to stop 14-bit rounding drift.',
      state: { tileMode: 1, matStep: 1, promo: 1, hot: 'fp32' },
    },
  ],
  draw({ tileMode, matStep, promo, hot }) {
    const out = [];
    const scaleGlobal = 64.0;
    const scaleA = lerp(scaleGlobal, 0.85, tileMode);
    const scaleB = 64.0;

    // ---- Top wrapper: Global scale boundary in Beat 0 ----
    if (tileMode < 0.85) {
      const gOp = clamp(1 - tileMode, 0, 1);
      out.push(rect(6, 4, 448, 122, 'route dash', { rx: 6, opacity: gOp }));
      out.push(rect(152, 0, 156, 15, 'op', { rx: 2, opacity: gOp }));
      out.push(text(230, 11, '1 global scale: max = 64.0', 'ts tb tc route', { opacity: gOp }));
    }

    // ---- Tile A (x = 12..220, y = 20..120) ----
    const tileACls = hot === 'tile' ? 'act hot' : hot === 'global' ? 'route' : 'act';
    out.push(rect(12, 20, 208, 100, tileACls));
    out.push(text(22, 35, 'Tile A (1 × N_c)', 'ts tb'));
    out.push(text(210, 35, `s_A=${f2(scaleA)}`, 'ts tb te tm'));

    // Ghost original bars behind quantized bars inside Tile A
    const qA = TILE_A.map((v) => quantA(v, tileMode));
    out.push(line(32, 76, 150, 76, 'faint'));
    out.push(bars(38, 76, TILE_A, { w: 18, gap: 8, scale: 26, max: 28, cls: 'faint solid' }));
    out.push(
      bars(42, 76, qA, {
        w: 14,
        gap: 12,
        scale: 26,
        max: 28,
        cls: tileMode < 0.5 ? 'route solid' : 'act solid',
      }),
    );
    out.push(text(162, 64, tileMode < 0.5 ? 'crushed' : 'tight fit', tileMode < 0.5 ? 'ts tb route' : 'ts tb act'));
    out.push(text(162, 78, tileMode < 0.5 ? 'to 0!' : 'in E4M3', 'ts'));
    out.push(text(22, 112, 'grey: FP32 truth · front: quantized', 'ts'));

    // ---- Tile B (x = 236..448, y = 20..120) ----
    const tileBCls = hot === 'global' ? 'route hot' : 'act';
    out.push(rect(236, 20, 212, 100, tileBCls));
    out.push(text(246, 35, 'Tile B (1 × N_c)', 'ts tb'));
    out.push(text(438, 35, `s_B=${f2(scaleB)}`, 'ts tb te tm'));

    const bBaseY = 86;
    out.push(line(250, bBaseY, 370, bBaseY, 'faint'));
    // Draw Tile B bars: normal bars tiny relative to outlier, outlier capped safely below header
    const bBars = [0.1, -0.06, 1.0, -0.09];
    for (let k = 0; k < 4; k++) {
      const bx = 256 + k * 28;
      const val = bBars[k];
      const bh = k === 2 ? 28 : Math.max(2, Math.abs(val) * 28);
      const by = val >= 0 ? bBaseY - bh : bBaseY;
      const bCls = k === 2 ? 'route solid' : 'act solid';
      out.push(rect(bx, by, 18, bh, bCls, { rx: 1.5 }));
    }
    out.push(text(321, 53, '64.0!', 'ts tb tc tm route'));
    out.push(text(380, 68, 'outlier', 'ts tb route'));
    out.push(text(380, 82, 'isolated', 'ts'));
    out.push(text(246, 112, 'damage stays inside Tile B', 'ts'));

    // ---- Bottom Row: Weight Block -> FP8 Matmul -> FP32 Accumulator ----
    // 1. Weight block (x = 12..148, y = 142..250)
    const wCls = hot === 'gemm' ? 'wt hot' : 'wt';
    out.push(rect(12, 142, 136, 108, wCls));
    out.push(text(80, 158, 'Weight (N_c × N_c)', 'ts tb tc'));
    out.push(heat(24, 168, W_MAT, { cell: 15, role: 'wt' }));
    out.push(text(118, 190, 'E4M3', 'ts tb tc tm'));
    out.push(text(118, 206, 'block', 'ts tc'));
    out.push(text(118, 220, 'scale', 'ts tc'));
    out.push(text(80, 242, '1 scale per N_c×N_c', 'ts tc'));

    // Arrows from Tile A & Weight into FP8 Matmul
    const actWire = 'M116,120 L116,132 L236,132 L236,142';
    if (matStep > 0.3) {
      out.push(path(actWire, 'flow', { opacity: matStep }));
      out.push(line(148, 196, 168, 196, 'flow', { opacity: matStep }));
    }
    out.push(path(actWire, 'wire arrow'));
    out.push(arrow(148, 196, 168, 196, 'wire'));

    // 2. FP8 Matmul with local rescaling (x = 168..304, y = 142..250)
    const mmCls = hot === 'gemm' ? 'op hot' : 'op';
    out.push(rect(168, 142, 136, 108, mmCls));
    out.push(text(236, 158, 'FP8 Tensor Core', 'ts tb tc'));
    out.push(text(236, 174, 'Q(x) · Q(W)', 'ts tc tm'));
    out.push(rect(180, 184, 112, 26, matStep > 0.4 ? 'act' : 'faint', { rx: 3 }));
    out.push(text(236, 201, '14-bit partial sum', 'ts tb tc'));
    out.push(text(236, 226, '× (s_A · s_W)', 'ts tb tc tm'));
    out.push(text(236, 242, 'rescale per N_c', 'ts tc'));

    // Arrow from Tensor Core to FP32 Accumulator
    if (promo > 0.5) {
      out.push(line(304, 196, 324, 196, 'flow', { opacity: promo }));
    }
    out.push(arrow(304, 196, 324, 196, 'wire'));

    // 3. FP32 Accumulator (x = 324..448, y = 142..250)
    const fpCls = hot === 'fp32' ? 'act hot' : promo > 0.5 ? 'act' : 'faint';
    out.push(rect(324, 142, 124, 108, fpCls));
    out.push(text(386, 158, 'FP32 CUDA Core', 'ts tb tc'));
    // Show running accumulated bars across chunks of N_c elements
    const accVec = [0.25, -0.35, 0.55, 0.9].map((v) => v * (0.2 + 0.8 * promo));
    out.push(line(338, 198, 434, 198, 'faint'));
    out.push(bars(346, 198, accVec, { w: 14, gap: 8, scale: 22, max: 24, cls: 'act solid' }));
    out.push(text(386, 228, 'promote every N_c', 'ts tb tc'));
    out.push(text(386, 242, '= 4 WGMMA steps', 'ts tc'));

    return out.join('');
  },
};

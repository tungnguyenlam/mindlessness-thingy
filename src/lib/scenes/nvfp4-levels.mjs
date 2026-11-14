import { bars, clamp, lerp, line, path, rect, text } from './kit.mjs';

const BLK0_TRUE = [0.58, -0.42, 0.85, -0.34];
const BLK1_TRUE = [0.95, -0.72, 0.45, -0.88];
const CODES0 = ['0101', '1011', '0111', '1010'];
const CODES1 = ['0111', '1110', '0100', '1111'];

function quantE2M1(v, pack) {
  // Snap onto a 4-level symmetric step ladder when pack -> 1
  const q = Math.round(v * 3) / 3;
  return lerp(v, q, pack);
}

export default {
  viewBox: [460, 256],
  beats: [
    {
      say: 'One FP32 scale captures the whole tensor’s overall magnitude before splitting into blocks.',
      state: { blkScale: 0, pack: 0, cost: 0, hot: 'tensor' },
    },
    {
      say: 'Each 16-value block computes its own FP8 scale so small blocks keep fine resolution.',
      state: { blkScale: 1, pack: 0, cost: 0, hot: 'block' },
    },
    {
      say: 'Rescaled values snap onto 4-bit E2M1 codes (1 sign, 2 exponent, 1 mantissa bit).',
      state: { blkScale: 1, pack: 1, cost: 0, hot: 'e2m1' },
    },
    {
      say: '16 × 4-bit values plus one 8-bit FP8 scale average 4.5 bits per element (~3.6× smaller than BF16).',
      state: { blkScale: 1, pack: 1, cost: 1, hot: 'bytes' },
    },
  ],
  draw({ blkScale, pack, cost, hot }) {
    const out = [];

    // ---- Top row: Weight tensor -> Level 1 FP32 tensor scale ----
    out.push(rect(12, 8, 268, 34, 'wt'));
    out.push(text(22, 23, 'Weight tensor (many blocks of 16)', 'ts tb'));
    out.push(text(22, 36, 'overall dynamic range anchored once', 'ts'));

    const tsCls = hot === 'tensor' ? 'op hot' : 'op';
    out.push(rect(292, 8, 156, 34, tsCls));
    out.push(text(370, 23, 'Level 1: FP32 scale', 'ts tb tc'));
    out.push(text(370, 36, '1 scalar / tensor', 'ts tc tm'));

    // Split wires down into Block 0 and Block 1
    out.push(path('M146,42 L146,50 L117,50 L117,58', 'wire'));
    out.push(path('M146,42 L146,50 L343,50 L343,58', 'wire'));

    // ---- Middle row: Block 0 & Block 1 (16 values each, 4 shown) ----
    const blocks = [
      { x: 12, title: 'Block 0 (small)', scaleTxt: 'FP8 s₀', vals: BLK0_TRUE, codes: CODES0 },
      { x: 238, title: 'Block 1 (large)', scaleTxt: 'FP8 s₁', vals: BLK1_TRUE, codes: CODES1 },
    ];

    for (const b of blocks) {
      const cardCls = hot === 'e2m1' ? 'wt hot' : 'wt';
      out.push(rect(b.x, 58, 210, 110, cardCls));
      out.push(text(b.x + 10, 74, b.title, 'ts tb'));

      // Level 2 FP8 scale pill
      const pillOp = 0.25 + 0.75 * clamp(blkScale, 0, 1);
      const pillCls = hot === 'block' ? 'op hot' : 'op';
      out.push(rect(b.x + 136, 63, 66, 17, pillCls, { rx: 2, opacity: pillOp }));
      out.push(text(b.x + 169, 75, b.scaleTxt, 'ts tb tc tm', { opacity: pillOp }));

      // Weights: BF16 ghost behind E2M1 quantized front
      const qVals = b.vals.map((v) => quantE2M1(v, pack));
      const baseY = 112;
      out.push(line(b.x + 16, baseY, b.x + 194, baseY, 'faint'));
      out.push(bars(b.x + 24, baseY, b.vals, { w: 28, gap: 16, scale: 22, max: 24, cls: 'faint solid' }));
      out.push(
        bars(b.x + 29, baseY, qVals, {
          w: 18,
          gap: 26,
          scale: 22,
          max: 24,
          cls: pack > 0.5 ? 'wt solid' : 'act solid',
        }),
      );

      // 4-bit E2M1 code boxes along bottom of each block
      for (let k = 0; k < 4; k++) {
        const nx = b.x + 20 + k * 44;
        const lbl = pack > 0.5 ? b.codes[k] : 'BF16';
        const nCls = pack > 0.5 ? (hot === 'e2m1' ? 'wt' : 'op') : 'faint';
        out.push(rect(nx, 144, 36, 16, nCls, { rx: 2 }));
        out.push(text(nx + 18, 155, lbl, 'ts tb tc tm'));
      }
    }

    // ---- Bottom bar: Exact bit budget per 16-value block ----
    const footCls = hot === 'bytes' ? 'op hot' : 'op';
    out.push(rect(12, 180, 436, 68, footCls));
    out.push(text(22, 196, 'Storage per 16-value block (to scale)', 'ts tb'));
    out.push(text(438, 196, '3.56× smaller', 'ts tb te', { opacity: 0.4 + 0.6 * cost }));

    const barX = 72;
    // Row 1: BF16 = 256 bits -> 192px (0.75 px/bit)
    out.push(text(22, 215, 'BF16', 'ts tb'));
    out.push(rect(barX, 204, 192, 12, 'faint', { rx: 2, 'stroke-dasharray': '4 2' }));
    out.push(text(barX + 200, 214, '256b (16.0 b/val)', 'ts tm'));

    // Row 2: NVFP4 = 64 bits E2M1 + 8 bits FP8 scale -> 54px when packed (exact 3.56x ratio)
    out.push(text(22, 235, 'NVFP4', 'ts tb'));
    const valW = Math.round(lerp(192, 48, pack));
    const scaleW = Math.round(6 * pack);
    out.push(rect(barX, 224, valW, 12, 'wt', { rx: 2 }));
    if (scaleW >= 2) {
      out.push(rect(barX + valW + 1, 224, scaleW, 12, 'op solid', { rx: 1 }));
    }
    const nvLabel = pack > 0.5
      ? '64b E2M1 + 8b FP8 = 4.5 b/val'
      : '256b (unpacked)';
    out.push(text(barX + valW + scaleW + 9, 234, nvLabel, 'ts tm'));

    return out.join('');
  },
};

import { arrow, bars, box, clamp, lerp, line, path, rect, text } from './kit.mjs';

const WORDS = ['1: The', '2: cat', '3: sat', '4: here', '5: now'];

// Per-token gated values y_t = B_t * h~_t (4 channels each)
const Y_TOKS = [
  [0.7, -0.3, 0.8, 0.2],
  [-0.4, 0.9, 0.3, -0.6],
  [0.85, 0.3, -0.5, 0.7],
  [0.2, 0.75, 0.6, -0.3],
  [-0.3, 0.6, 0.9, 0.55],
];

const B_GATES = [
  [0.9, 0.5, 0.8, 0.4],
  [0.6, 0.9, 0.5, 0.8],
  [0.85, 0.6, 0.9, 0.7],
  [0.5, 0.8, 0.7, 0.6],
  [0.75, 0.85, 0.95, 0.65],
];

const H_TILDE = [
  [0.8, -0.6, 1.0, 0.5],
  [-0.65, 1.0, 0.6, -0.75],
  [1.0, 0.5, -0.55, 1.0],
  [0.4, 0.95, 0.85, -0.5],
  [-0.4, 0.7, 0.95, 0.85],
];

const C_GATES = [
  [0.7, 0.8, 0.5, 0.9],
  [0.8, 0.6, 0.9, 0.5],
  [0.9, 0.7, 0.6, 0.85],
  [0.6, 0.9, 0.8, 0.7],
  [0.85, 0.9, 0.75, 0.8],
];

// Depthwise 3-tap kernel weights per channel
const KERNEL = [0.25, 0.45, 0.65];

function convAt(stepIdx) {
  return [0, 1, 2, 3].map((ch) => {
    let s = 0;
    for (let k = 0; k < 3; k++) {
      const ti = stepIdx - 2 + k;
      if (ti >= 0 && ti < Y_TOKS.length) s += KERNEL[k] * Y_TOKS[ti][ch];
    }
    return s;
  });
}

export default {
  viewBox: [460, 258],
  beats: [
    {
      say: 'At step 3 ("sat"), the k = 3 window holds only the last three tokens.',
      state: { step: 2, hot: 'win' },
    },
    {
      say: 'Linear in produces B, h̃, and C; B scales h̃ elementwise before the convolution.',
      state: { step: 2, hot: 'gateB' },
    },
    {
      say: 'Decode step 5 ("now") slides the 3-slot window forward and drops old tokens.',
      state: { step: 4, hot: 'conv' },
    },
    {
      say: 'C gates each channel output before Linear out—cache size stays 3 × d at any length.',
      state: { step: 4, hot: 'gateC' },
    },
  ],
  draw({ step, hot }) {
    const out = [];
    const cur = Math.round(clamp(step, 2, 4));
    const winStart = cur - 2; // 0..2

    // ---- Top sequence + sliding k=3 window cache (y = 12..88) ----
    out.push(text(12, 22, 'Sequence tokens (y = B ⊙ h̃)', 'ts tb'));
    out.push(text(448, 22, 'conv_L_cache = 3', 'ts tb te tm'));

    // Smooth sliding window frame wrapping 3 contiguous token cards
    const cardW = 80;
    const pitch = 89; // 12 + 4*89 + 80 = 448
    const winX = 12 + (step - 2) * pitch - 4;
    const winW = 2 * pitch + cardW + 8;
    const winHot = hot === 'win' || hot === 'conv' ? 'cache hot' : 'cache';
    out.push(rect(winX, 28, winW, 56, winHot, { rx: 5 }));

    for (let t = 0; t < 5; t++) {
      const tx = 12 + t * pitch;
      const inWin = t >= winStart && t <= cur;
      const evicted = t < winStart;
      const cls = t === cur ? 'act hot' : inWin ? 'act' : 'faint';
      out.push(rect(tx, 33, cardW, 46, cls, { opacity: evicted ? 0.45 : 1 }));
      out.push(text(tx + cardW / 2, 46, WORDS[t], 'ts tb tc', { opacity: evicted ? 0.55 : 1 }));
      out.push(line(tx + 12, 68, tx + cardW - 12, 68, 'faint', { opacity: evicted ? 0.4 : 1 }));
      out.push(bars(tx + 18, 68, Y_TOKS[t], { w: 8, gap: 3, scale: 9, max: 11, cls: inWin ? 'cache solid' : 'faint solid' }));
    }

    // ---- Middle token pipeline at current token `cur` (y = 98..214) ----
    const bVec = B_GATES[cur];
    const hVec = H_TILDE[cur];
    const cVec = C_GATES[cur];
    const zVec = convAt(cur);
    const czVec = zVec.map((z, ch) => cVec[ch] * z);

    // 1. Linear in (x = 12..68, y = 126..178)
    out.push(box(12, 126, 56, 52, 'Linear in', 'wt', 'd → 3d'));
    out.push(path('M68,142 L78,116', 'wire arrow'));
    out.push(arrow(68, 152, 78, 152, 'wire'));
    out.push(path('M68,162 L78,192', 'wire arrow'));

    // 2. Split B_t, h~_t, C_t (x = 78..136)
    const gateBHot = hot === 'gateB' ? 'act hot' : 'act';
    const gateCHot = hot === 'gateC' ? 'act hot' : 'act';

    // B_t
    out.push(rect(78, 98, 58, 34, gateBHot));
    out.push(text(85, 114, 'B_t', 'ts tb tm'));
    out.push(bars(104, 124, bVec, { w: 5, gap: 2, scale: 14, max: 15, cls: 'act solid' }));

    // h~_t
    out.push(rect(78, 136, 58, 34, gateBHot));
    out.push(text(85, 152, 'h̃_t', 'ts tb tm'));
    out.push(line(103, 156, 132, 156, 'faint'));
    out.push(bars(104, 156, hVec, { w: 5, gap: 2, scale: 9, max: 11, cls: 'act solid' }));

    // C_t
    out.push(rect(78, 178, 58, 34, gateCHot));
    out.push(text(85, 194, 'C_t', 'ts tb tm'));
    out.push(bars(104, 204, cVec, { w: 5, gap: 2, scale: 14, max: 15, cls: 'act solid' }));

    // 3. Input gate B ⊙ h~ (x = 150..202, y = 114..158)
    out.push(arrow(136, 115, 150, 128, 'wire'));
    out.push(arrow(136, 153, 150, 142, 'wire'));
    out.push(box(150, 114, 52, 44, 'B ⊙ h̃', hot === 'gateB' ? 'op hot' : 'op', 'y_t'));

    // 4. Depthwise Conv_3 reading the 3-slot window (x = 216..312, y = 102..172)
    out.push(arrow(202, 136, 216, 136, 'wire'));
    const convCls = hot === 'conv' ? 'cache hot' : 'cache';
    out.push(rect(216, 102, 96, 70, convCls));
    out.push(text(264, 117, 'Depthwise Conv₃', 'ts tb tc'));
    out.push(text(264, 130, 'per channel, 3 taps', 'ts tc'));
    out.push(line(226, 154, 302, 154, 'faint'));
    out.push(bars(237, 154, zVec, { w: 10, gap: 4, scale: 10, max: 13, cls: 'cache solid' }));
    out.push(text(264, 167, 'z_t', 'ts tc tm'));

    // Connect top window cache straight into Conv_3
    out.push(path(`M${Math.round(winX + winW / 2)},84 L${Math.round(winX + winW / 2)},94 L264,94 L264,102`, 'wire arrow'));

    // 5. Output gate C ⊙ z (x = 326..378, y = 132..174)
    out.push(arrow(312, 148, 326, 148, 'wire'));
    out.push(box(326, 132, 52, 42, 'C ⊙ z', hot === 'gateC' ? 'op hot' : 'op', 'gated'));
    // Route C_t bottom wire cleanly into bottom of C ⊙ z
    if (hot === 'gateC') out.push(path('M136,195 L352,195 L352,180', 'flow'));
    out.push(path('M136,195 L352,195 L352,174', 'wire arrow'));

    // 6. Linear out (x = 390..448, y = 128..178)
    out.push(arrow(378, 153, 390, 153, 'wire'));
    out.push(rect(390, 128, 58, 50, hot === 'gateC' ? 'wt hot' : 'wt'));
    out.push(text(419, 143, 'Out d→d', 'ts tb tc'));
    out.push(line(398, 162, 440, 162, 'faint'));
    out.push(bars(402, 162, czVec, { w: 6, gap: 2.5, scale: 11, max: 12, cls: 'act solid' }));

    // ---- Bottom comparison bar (y = 222..250) ----
    out.push(rect(12, 222, 436, 30, 'op'));
    out.push(text(22, 241, 'Window cache kept: k × d = 3 × d (constant)', 'ts tb'));
    out.push(text(438, 241, 'KV cache: T × d (grows)', 'ts te'));

    return out.join('');
  },
};

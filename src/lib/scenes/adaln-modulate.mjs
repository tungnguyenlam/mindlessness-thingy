import { arrow, bars, box, circle, f1, group, line, mean, path, rect, std, text } from './kit.mjs';

const H_RAW = [
  [1.4, -0.3, 1.8, 0.5, 1.1],
  [-0.5, 1.2, 0.4, -1.0, 0.8],
  [0.8, -0.8, 0.2, 1.4, -0.2],
];

const NORM = H_RAW.map((v) => {
  const m = mean(v);
  const s = std(v) || 1;
  return v.map((x) => (x - m) / s);
});

const G1 = [1.4, 0.5, 1.3, 0.7, 1.2];
const B1 = [0.6, -0.4, 0.3, 0.5, -0.3];
const A1 = [0.85, 0.65, 0.8, 0.7, 0.75];

const G2 = [0.6, 1.5, 0.7, 1.4, 0.8];
const B2 = [-0.5, 0.7, -0.4, -0.2, 0.6];
const A2 = [0.4, 0.55, 0.35, 0.5, 0.45];

// Deterministic toy sublayer (cross-token mixing + linear map) so modulation drives real downstream change.
const W_SUB = [
  [0.8, -0.5, 0.4, 0.6, -0.4],
  [-0.4, 0.9, 0.5, -0.5, 0.7],
  [0.5, 0.4, -0.8, 0.6, 0.2],
  [0.4, -0.6, 0.7, 0.8, -0.5],
  [-0.5, 0.5, 0.2, -0.4, 0.9],
];

function sublayer(modRows) {
  return modRows.map((row, i) => {
    const prev = modRows[(i + 2) % 3];
    const mixed = row.map((v, k) => 0.7 * v + 0.3 * prev[k]);
    return W_SUB[0].map((_, j) => {
      const s = mixed.reduce((acc, u, k) => acc + u * W_SUB[k][j], 0);
      return 1.35 * Math.tanh(s);
    });
  });
}

const ROW_Y = [98, 144, 190];
const ROW_H = 38;

export default {
  viewBox: [460, 272],
  beats: [
    {
      say: 'At zero init, γ = 1, β = 0, and α = 0, so the block passes h straight through.',
      state: {
        condTag: 't=0.8, cat',
        mlpSub: 'zero init',
        gamma: [1, 1, 1, 1, 1],
        beta: [0, 0, 0, 0, 0],
        alpha: [0, 0, 0, 0, 0],
        focus: 'init',
      },
    },
    {
      say: 'Condition c maps through an MLP to shared γ and β that scale and shift every token.',
      state: {
        condTag: 't=0.8, cat',
        mlpSub: 'd_c → 3d',
        gamma: G1,
        beta: B1,
        alpha: A1,
        focus: 'mod',
      },
    },
    {
      say: 'Change c and the same weights shift all tokens in lockstep—no token added.',
      state: {
        condTag: 't=0.2, dog',
        mlpSub: 'd_c → 3d',
        gamma: G2,
        beta: B2,
        alpha: A2,
        focus: 'cond',
      },
    },
    {
      say: 'Sequence length T stays fixed; α(c) gates how much the sublayer edits the residual.',
      state: {
        condTag: 't=0.2, dog',
        mlpSub: 'd_c → 3d',
        gamma: G2,
        beta: B2,
        alpha: A2,
        focus: 'gate',
      },
    },
  ],
  draw({ condTag, mlpSub, gamma, beta, alpha, focus }) {
    const out = [];

    // ---- Top conditioning branch (y = 14..68) ----
    const condCls = focus === 'cond' ? 'act hot' : 'act';
    out.push(box(12, 18, 78, 46, 'Condition c', condCls, condTag));
    out.push(arrow(90, 41, 104, 41, 'wire'));
    out.push(box(104, 18, 62, 46, 'MLP', 'wt', mlpSub));
    out.push(arrow(166, 41, 180, 41, 'wire'));

    // Top bus from MLP over γ and β straight into α(c)
    out.push(path('M135,18 L135,8 L349,8 L349,14', 'wire arrow'));

    // γ(c) vector card (x = 180..226, cx = 203)
    const modHot = focus === 'mod' ? 'act hot' : 'act';
    out.push(rect(180, 14, 46, 52, modHot));
    out.push(text(203, 26, 'γ(c)', 't tb tc'));
    out.push(line(185, 58, 221, 58, 'faint'));
    out.push(line(185, 44, 221, 44, 'dash')); // γ = 1 reference
    out.push(bars(187, 58, gamma, { w: 5, gap: 2, scale: 14, max: 24, cls: 'act solid' }));

    // β(c) vector card (x = 232..278, cx = 255)
    out.push(rect(232, 14, 46, 52, modHot));
    out.push(text(255, 26, 'β(c)', 't tb tc'));
    out.push(line(237, 47, 273, 47, 'faint'));
    out.push(bars(239, 47, beta, { w: 5, gap: 2, scale: 16, max: 14, cls: 'act solid' }));

    // α(c) vector card (x = 324..374, cx = 349)
    const gateHot = focus === 'init' || focus === 'gate' ? 'act hot' : 'act';
    const meanAlpha = mean(alpha);
    out.push(rect(324, 14, 50, 52, gateHot));
    out.push(text(349, 26, 'α(c)', 't tb tc'));
    out.push(line(329, 51, 369, 51, 'faint'));
    out.push(bars(333, 51, alpha, { w: 5, gap: 2, scale: 18, max: 18, cls: 'act solid' }));
    out.push(text(349, 62, `ᾱ=${f1(meanAlpha)}`, 'ts tc tm'));

    // Status pill at top right (x = 384..450)
    out.push(rect(384, 20, 64, 40, 'op'));
    out.push(text(416, 36, 'T = 3', 't tb tc tm'));
    out.push(text(416, 51, '0 added', 'ts tc'));

    // ---- Broadcast drops from γ, β into modulation stage (behind cards down all 3 rows) ----
    const modActive = focus === 'mod' || focus === 'cond';
    if (modActive) {
      out.push(line(194, 66, 194, 96, 'flow'));
      out.push(line(264, 66, 264, 96, 'flow'));
    }
    out.push(line(194, 66, 194, 96, 'wire arrow'));
    out.push(line(264, 66, 264, 96, 'wire arrow'));
    // Subtle shared rail passing behind the 3 modulated token cards
    out.push(line(194, 136, 194, 190, 'dash'));
    out.push(line(264, 136, 264, 190, 'dash'));

    // ---- Drop from α(c) into ×α gates on each row ----
    const gateActive = focus === 'init' || focus === 'gate';
    if (gateActive) out.push(line(349, 66, 349, 209, 'flow'));
    else out.push(line(349, 66, 349, 209, 'wire'));

    // Compute modulated vectors, sublayer outputs, and gated residual outputs
    const modRows = NORM.map((row) => row.map((x, k) => gamma[k] * x + beta[k]));
    const subRows = sublayer(modRows);
    const outRows = H_RAW.map((row, i) => row.map((x, k) => x + alpha[k] * subRows[i][k]));

    // ---- Column headers above token rows (y = 87) ----
    out.push(text(44, 87, 'input h', 'ts tc'));
    out.push(text(122, 87, 'Norm(h)', 'ts tc'));
    out.push(text(229, 87, 'γ⊙x̂ + β', 'ts tc'));
    out.push(text(411, 87, 'h + α·f', 'ts tc'));

    // Sublayer column block spanning all 3 rows (x = 288..330)
    out.push(rect(288, 98, 42, 130, 'wt'));
    out.push(text(309, 158, 'Sub-', 't tb tc'));
    out.push(text(309, 172, 'layer', 't tb tc'));
    out.push(text(309, 186, 'f(·)', 'ts tc tm'));

    // ---- Token rows ----
    for (let i = 0; i < 3; i++) {
      const y = ROW_Y[i];
      const cy = y + ROW_H / 2;
      const base = y + 22;

      // Col 1: input h (x = 12..76)
      out.push(rect(12, y, 64, ROW_H, 'act'));
      out.push(text(18, cy + 4, `x${i + 1}`, 'ts tm'));
      out.push(line(34, base, 70, base, 'faint'));
      out.push(bars(35, base, H_RAW[i], { w: 5, gap: 2, scale: 8, max: 13, cls: 'act solid' }));

      // Arrow Col 1 -> Col 2
      out.push(arrow(76, cy, 90, cy, 'wire'));

      // Col 2: Norm(h) (x = 90..154)
      out.push(rect(90, y, 64, ROW_H, 'op'));
      out.push(line(97, base, 147, base, 'faint'));
      out.push(bars(104, base, NORM[i], { w: 5, gap: 2, scale: 8, max: 13, cls: 'act solid' }));

      // Arrow Col 2 -> Col 3
      out.push(arrow(154, cy, 174, cy, 'wire'));

      // Col 3: Modulated γ⊙Norm(h)+β (x = 174..276)
      out.push(rect(174, y, 102, ROW_H, modHot));
      out.push(line(184, base, 266, base, 'faint'));
      out.push(bars(208, base, modRows[i], { w: 6, gap: 2.5, scale: 6, max: 14, cls: 'act solid' }));

      // Arrow Col 3 -> Sublayer
      out.push(arrow(276, cy, 288, cy, 'wire'));

      // Arrow Sublayer -> ×α gate -> Col 5
      out.push(line(330, cy, 341, cy, 'wire'));
      out.push(circle(349, cy, 8, gateHot));
      out.push(text(349, cy + 3.5, '×', 'ts tb tc'));
      out.push(arrow(357, cy, 372, cy, 'wire'));

      // Col 5: Output h + α·f (x = 372..448)
      const outCls = gateActive ? 'act hot' : 'act';
      out.push(rect(372, y, 76, ROW_H, outCls));
      out.push(line(380, base, 440, base, 'faint'));
      out.push(bars(392, base, outRows[i], { w: 6, gap: 2, scale: 7, max: 14, cls: 'act solid' }));
    }

    // ---- Residual skip connection from Col 1 bottom to Col 5 bottom ----
    out.push(path('M44,228 L44,250 L410,250 L410,228', 'wire arrow'));
    out.push(rect(164, 240, 128, 20, 'op'));
    out.push(text(228, 254, 'residual h (identity if α=0)', 'ts tc'));

    return out.join('');
  },
};

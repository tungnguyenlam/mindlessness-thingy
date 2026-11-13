// Multi-head attention: one query scores every key, softmax turns scores into weights, the output
// is a weighted mix of values; other heads weigh the same words differently; outputs are concatenated
// and W^O mixes them back to width d. Toy numbers from a seeded rng, chosen to show three patterns.
import { text, rect, circle, line, group, box, arrow, rng, clamp, softmax, matrix, f2, lerp } from './kit.mjs';

const WORDS = ['The', 'cat', 'sat', 'on', 'the', 'mat'];
const Q = 5; // the query is the last word
// Scores q·k/√d_h per head (toy): previous word, the subject, spread out.
const SCORES = [
  [-0.5, 0.2, -0.3, 0.1, 2.2, 0.4],
  [-0.2, 2.0, 0.6, -0.6, -0.4, 0.3],
  [0.5, 0.6, 0.8, 0.4, 0.5, 0.7],
];
const PATTERN = ['previous word', 'the subject', 'spread out'];
const DV = 4; // numbers per head output (d_h, toy)
const D = 6; // model width d (toy)

const cx = (i) => 112 + i * 50;
const rowY = (k) => 44 + k * 56;
const OX = 392; // head outputs, right column
const CY = 250; // concat baseline

function vbars(x, base, v, scale, cls, w = 9, gap = 3) {
  return v
    .map((u, i) => {
      const h = clamp(u * scale, -18, 18);
      return rect(x + i * (w + gap), h > 0 ? base - h : base, w, Math.max(0.8, Math.abs(h)), cls, { rx: 1 });
    })
    .join('');
}

export default {
  viewBox: [460, 290],
  setup() {
    const r = rng(7);
    const weights = SCORES.map((s) => softmax(s));
    const values = SCORES.map(() => matrix(r, WORDS.length, DV, 0.9));
    const outs = weights.map((w, k) => Array.from({ length: DV }, (_, c) => w.reduce((a, wj, j) => a + wj * values[k][j][c], 0)));
    const WO = matrix(r, 3 * DV, D, 0.55);
    const cat = outs.flat();
    const y = Array.from({ length: D }, (_, c) => cat.reduce((a, x, i) => a + x * WO[i][c], 0));
    return { weights, outs, y };
  },
  beats: [
    { say: 'The last word, “mat”, asks a question. Its query is scored against the key of every word up to it.', state: { soft: 0, s1: 0, h2: 0, s2: 0, cat: 0, mix: 0 } },
    { say: 'Softmax turns the scores into weights that are all positive and add up to 1.', state: { soft: 1, s1: 0, h2: 0, s2: 0, cat: 0, mix: 0 }, tween: 1200 },
    { say: 'The head’s output is a weighted mix of the words’ values. A heavy weight passes more of its value.', state: { soft: 1, s1: 1, h2: 0, s2: 0, cat: 0, mix: 0 }, tween: 1800, linear: true, ms: 4000 },
    { say: 'Other heads have their own projections, so they weigh the same words differently.', state: { soft: 1, s1: 1, h2: 1, s2: 0, cat: 0, mix: 0 }, tween: 1000, ms: 4000 },
    { say: 'Each head mixes its own values, so each output carries a different relationship.', state: { soft: 1, s1: 1, h2: 1, s2: 1, cat: 0, mix: 0 }, tween: 1800, linear: true },
    { say: 'The head outputs are laid side by side: n_h × d_h numbers for this one word.', state: { soft: 1, s1: 1, h2: 1, s2: 1, cat: 1, mix: 0 }, tween: 1400 },
    { say: 'W^O mixes them back to width d, the size of the word’s hidden state.', state: { soft: 1, s1: 1, h2: 1, s2: 1, cat: 1, mix: 1 }, tween: 1200, ms: 4200 },
  ],
  draw({ soft, s1, h2, s2, cat, mix }, { weights, outs, y }) {
    let out = '';
    // Words: keys come from every word, the query from the last one.
    out += text(8, 26, 'words', 'ts');
    WORDS.forEach((w, i) => {
      out += rect(cx(i) - 22, 10, 44, 24, i === Q ? 'act hot' : 'cache');
      out += text(cx(i), 26, w, 'ts tc');
    });
    out += text(OX, 26, 'q from “mat”', 'ts act');

    for (let k = 0; k < 3; k++) {
      const y0 = rowY(k);
      const base = y0 + 34;
      const sum = k === 0 ? s1 : s2;
      let g = text(8, y0 + 22, `head ${k + 1}`, 't tb') + text(8, y0 + 35, PATTERN[k], 'ts');
      g += line(cx(0) - 26, base, cx(WORDS.length - 1) + 26, base, 'wire', { opacity: 0.4 });
      WORDS.forEach((_, j) => {
        const wj = weights[k][j];
        const val = k === 0 ? lerp(SCORES[k][j] * 0.32, wj, soft) : wj;
        const h = clamp(val * 40, -14, 30);
        g += rect(cx(j) - 11, h > 0 ? base - h : base, 22, Math.max(0.8, Math.abs(h)), 'act solid', { rx: 1.5 });
        g += text(cx(j), base + 12, f2(wj), 'ts tc tm', { opacity: k === 0 ? soft : 1 });
        // A value travels to the head output, its size set by its weight.
        if (sum > 0.01 && sum < 0.98) g += circle(lerp(cx(j), OX + 6, sum), base - 8, 1.5 + 9 * wj, 'cache solid', { opacity: 0.75 });
      });
      // Head output: label before the mix, bars once values arrive.
      if (k === 0) g += text(OX, base - 14, soft < 0.5 ? 'q·k / √d_h' : 'softmax', 'ts tb', { opacity: 1 - s1 });
      const ox = lerp(OX, 70 + k * 50, cat);
      const oy = lerp(base, CY, cat);
      g += group(vbars(ox, oy, outs[k], 20 * clamp(sum, 0, 1), 'act solid'), {});
      g += text(lerp(OX + 22, 70 + k * 50 + 21, cat), lerp(base + 12, CY + 30, cat), `o${'₁₂₃'[k]}`, 'ts tc', { opacity: clamp(sum * 3 - 2, 0, 1) });
      out += group(g, { opacity: k === 0 ? 1 : h2 });
    }

    // Concatenate, then W^O.
    let b = text(8, CY + 4, 'concat', 't tb');
    b += arrow(222, CY, 234, CY) + box(236, CY - 14, 54, 28, 'W^O', 'wt');
    b += arrow(292, CY, 304, CY);
    b += vbars(310, CY, y, 14 * mix, 'act solid', 10, 3);
    b += text(346, CY + 30, 'output, width d', 'ts tc', { opacity: mix });
    out += group(b, { opacity: 0.15 + 0.85 * cat });
    return out;
  },
};

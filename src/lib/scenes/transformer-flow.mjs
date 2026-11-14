// Transformer block: a token's vector x moves down the residual stream while two sub-layers
// branch off, compute small updates (Δ_att across tokens, Δ_ffn per token alone), and add them back.
// Toy numbers from a seeded rng: width d = 5, FFN expansion d_ff = 10, three tokens.
import { text, rect, circle, line, group, box, arrow, rng, clamp, lerp, matrix, matvec, softmax, mean, std, along } from './kit.mjs';

const WORDS = ['The', 'cat', 'sat'];
const ATT_W = [0.16, 0.56, 0.28]; // attention weights from "sat" onto [The, cat, sat]
const D = 5;
const DFF = 10;

const normVec = (v) => {
  const m = mean(v);
  const s = std(v) || 1;
  return v.map((u) => (u - m) / s);
};

function vbars(x, base, v, scale, cls, w = 10, gap = 3) {
  return v
    .map((u, i) => {
      const h = clamp(u * scale, -14, 14);
      return rect(x + i * (w + gap), h > 0 ? base - h : base, w, Math.max(0.8, Math.abs(h)), cls, { rx: 1 });
    })
    .join('');
}

const SX = 56; // residual spine centre
const BX = 16; // stream vector x origin

export default {
  viewBox: [460, 316],
  setup() {
    const r = rng(13);
    const X = matrix(r, 3, D, 0.7);
    const WV = matrix(r, D, D, 0.55);
    const n1 = normVec(X[2]);
    const vals = X.map((tok) => matvec(normVec(tok), WV));
    const dAtt = Array.from({ length: D }, (_, c) => 0.65 * ATT_W.reduce((s, w, j) => s + w * vals[j][c], 0));
    const x1 = X[2].map((u, c) => u + dAtt[c]);

    const n2 = normVec(x1);
    const W1 = matrix(r, D, DFF, 0.6);
    const W2 = matrix(r, DFF, D, 0.4);
    const h = matvec(n2, W1).map((u) => Math.max(0, u + 0.35));
    const dFfn = matvec(h, W2).map((u) => 0.55 * u);
    const y = x1.map((u, c) => u + dFfn[c]);

    return { X, dAtt, x1, h, dFfn, y, n1, n2 };
  },
  beats: [
    { say: 'Every token enters the layer as a vector in the residual stream x. Watch “sat” travel down the left rail.', state: { att: 0, add1: 0, ffn: 0, add2: 0 }, from: { att: 0, add1: 0, ffn: 0, add2: 0 }, tween: 700 },
    { say: 'First, normalize a copy and run attention: “sat” pulls values from every token up to it into Δ_att.', state: { att: 1, add1: 0, ffn: 0, add2: 0 }, tween: 1500, linear: true, ms: 4200 },
    { say: 'Add Δ_att back onto the untouched stream x. The residual wire keeps the original signal intact.', state: { att: 1, add1: 1, ffn: 0, add2: 0 }, tween: 1300, ms: 4000 },
    { say: 'Next, normalize x₁ and run the feed-forward network: this token expands to d_ff and shrinks back alone.', state: { att: 1, add1: 1, ffn: 1, add2: 0 }, tween: 1500, linear: true, ms: 4200 },
    { say: 'Add Δ_ffn onto x₁. Each layer only edits the stream; the next layer receives y.', state: { att: 1, add1: 1, ffn: 1, add2: 1 }, tween: 1300, ms: 4400 },
  ],
  draw({ att, add1, ffn, add2 }, { X, dAtt, x1, h, dFfn, y }) {
    let out = '';

    // Left residual rail label.
    out += text(SX, 12, 'residual stream', 'ts tc tb');

    // Input vector x for "sat".
    out += rect(BX, 20, 80, 42, 'act');
    out += line(BX + 6, 42, BX + 74, 42, 'wire', { opacity: 0.35 });
    out += vbars(BX + 8, 42, X[2], 9, 'act solid');
    out += text(BX + 80 + 6, 33, 'x', 'tb tm');
    out += text(BX + 80 + 6, 46, 'T × d', 'ts tm');

    // Top-right: the three tokens in context; attention mixes them into "sat".
    const tx = (i) => 228 + i * 64;
    out += text(448, 22, 'mixes tokens', 'ts te act', { opacity: 0.35 + 0.65 * att });
    WORDS.forEach((w, i) => {
      out += rect(tx(i) - 22, 10, 44, 22, i === 2 ? 'act hot' : 'cache');
      out += text(tx(i), 25, w, 'ts tc');
      // Attention lines from each token down to the Attention box centre (252, 66).
      out += line(tx(i), 32, 252, 66, 'wire', { opacity: 0.15 + 0.75 * att, 'stroke-width': 0.8 + 2.4 * ATT_W[i] });
      if (att > 0.05 && att < 0.85) {
        const [px, py] = along([[tx(i), 32], [252, 66]], clamp(att / 0.8, 0, 1));
        out += circle(px, py, 2 + 5 * ATT_W[i], 'cache solid', { opacity: 0.9 });
      }
    });

    // Residual bypass 1: x -> +1.
    out += line(SX, 62, SX, 118, 'flow dash', { opacity: 0.4 + 0.6 * add1 });
    if (add1 > 0.02 && add1 < 0.98) out += circle(SX, lerp(62, 118, add1), 3.5, 'act solid');

    // Sub-layer 1: Norm -> Attention -> Δ_att -> +1.
    let s1 = '';
    s1 += line(96, 54, 114, 54, 'wire') + line(114, 54, 114, 80, 'wire') + arrow(114, 80, 128, 80);
    s1 += box(130, 66, 62, 28, 'Norm', 'op');
    s1 += arrow(192, 80, 206, 80);
    s1 += box(208, 66, 88, 28, 'Attention', att > 0.2 && add1 < 0.5 ? 'op hot' : 'op', 'mixes tokens');
    s1 += arrow(296, 80, 314, 80);
    // Δ_att bars.
    const d1Scale = 9 * clamp(att * 1.4 - 0.3, 0, 1);
    s1 += rect(316, 60, 78, 40, 'act', { opacity: 0.25 + 0.75 * clamp(att * 1.4 - 0.3, 0, 1) });
    s1 += line(322, 80, 388, 80, 'wire', { opacity: 0.35 });
    s1 += vbars(324, 80, dAtt, d1Scale, 'act solid');
    s1 += text(400, 78, 'Δ_att', 'ts tb tm');
    s1 += line(355, 100, 355, 128, 'wire') + arrow(355, 128, SX + 12, 128);
    if (add1 > 0.02 && add1 < 0.98) {
      const [px, py] = along([[355, 100], [355, 128], [SX + 12, 128]], add1);
      out += circle(px, py, 3.5, 'act solid');
    }
    out += group(s1, { opacity: 0.25 + 0.75 * att });

    // +1 circle and x1 stream.
    out += circle(SX, 128, 10, add1 > 0.3 && add1 < 0.95 ? 'op hot' : 'op') + text(SX, 132, '+', 'tb tc');
    const x1Morph = X[2].map((u, c) => lerp(u, x1[c], add1));
    const showX1 = 0.2 + 0.8 * clamp(add1 * 1.2, 0, 1);
    let b1 = rect(BX, 148, 80, 42, add1 > 0.85 ? 'act' : 'faint');
    b1 += line(BX + 6, 169, BX + 74, 169, 'wire', { opacity: 0.35 });
    b1 += vbars(BX + 8, 169, x1Morph, 9, 'act solid');
    b1 += text(BX + 80 + 6, 162, 'x₁ = x + Δ_att', 'ts tb tm');
    out += group(b1, { opacity: showX1 });

    // Residual bypass 2: x1 -> +2.
    out += line(SX, 190, SX, 238, 'flow dash', { opacity: 0.25 + 0.75 * add2 });
    if (add2 > 0.02 && add2 < 0.98) out += circle(SX, lerp(190, 238, add2), 3.5, 'act solid');

    // Sub-layer 2: Norm -> FFN (expand d -> d_ff -> d) -> Δ_ffn -> +2.
    let s2 = '';
    s2 += line(96, 174, 114, 174, 'wire') + line(114, 174, 114, 206, 'wire') + arrow(114, 206, 128, 206);
    s2 += box(130, 192, 62, 28, 'Norm', 'op');
    s2 += arrow(192, 206, 206, 206);
    s2 += rect(208, 180, 96, 48, ffn > 0.2 && add2 < 0.5 ? 'wt hot' : 'wt');
    s2 += text(256, 194, 'Feed-forward', 'ts tc tb');
    s2 += text(256, 206, 'd → d_ff → d', 'ts tc tm');
    // Expanded hidden bars inside FFN box.
    s2 += vbars(216, 223, h, 9 * clamp(ffn * 1.5, 0, 1), 'wt solid', 6, 2);
    s2 += text(448, 174, 'per token alone', 'ts te', { opacity: 0.35 + 0.65 * ffn });

    s2 += arrow(304, 206, 318, 206);
    const d2Scale = 9 * clamp(ffn * 1.4 - 0.3, 0, 1);
    s2 += rect(320, 186, 78, 40, 'act', { opacity: 0.25 + 0.75 * clamp(ffn * 1.4 - 0.3, 0, 1) });
    s2 += line(326, 206, 392, 206, 'wire', { opacity: 0.35 });
    s2 += vbars(328, 206, dFfn, d2Scale, 'act solid');
    s2 += text(404, 204, 'Δ_ffn', 'ts tb tm');
    s2 += line(359, 226, 359, 248, 'wire') + arrow(359, 248, SX + 12, 248);
    if (add2 > 0.02 && add2 < 0.98) {
      const [px, py] = along([[359, 226], [359, 248], [SX + 12, 248]], add2);
      out += circle(px, py, 3.5, 'act solid');
    }
    out += group(s2, { opacity: 0.2 + 0.8 * ffn });

    // +2 circle and final output y.
    out += circle(SX, 248, 10, add2 > 0.3 && add2 < 0.95 ? 'op hot' : 'op') + text(SX, 252, '+', 'tb tc');
    const yMorph = x1.map((u, c) => lerp(u, y[c], add2));
    const showY = 0.2 + 0.8 * clamp(add2 * 1.2, 0, 1);
    let b2 = rect(BX, 266, 80, 42, add2 > 0.85 ? 'act hot' : 'faint');
    b2 += line(BX + 6, 287, BX + 74, 287, 'wire', { opacity: 0.35 });
    b2 += vbars(BX + 8, 287, yMorph, 9, 'act solid');
    b2 += text(BX + 80 + 6, 282, 'y = x₁ + Δ_ffn', 'ts tb tm');
    b2 += text(BX + 80 + 6, 296, 'to next layer', 'ts');
    out += group(b2, { opacity: showY });

    return out;
  },
};

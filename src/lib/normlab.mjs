// The small lab behind <NormLab>: toy activations, the normalizations, and a toy residual stack run
// with and without a norm. Everything is seeded, so every load draws the same numbers (keep-place).
// The data is illustrative (random vectors, untrained random weights), not taken from any model.

export function rng(seed) {
  let s = seed >>> 0;
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const gauss = () => Math.sqrt(-2 * Math.log(1 - next())) * Math.cos(2 * Math.PI * next());
  return { next, gauss };
}

export const mean = (v) => v.reduce((a, b) => a + b, 0) / v.length;
export const std = (v) => {
  const m = mean(v);
  return Math.sqrt(mean(v.map((x) => (x - m) ** 2)));
};
export const rms = (v) => Math.sqrt(mean(v.map((x) => x * x)));
export const layerNorm = (v) => {
  const m = mean(v);
  const s = std(v) || 1;
  return v.map((x) => (x - m) / s);
};
export const rmsNorm = (v) => {
  const r = rms(v) || 1;
  return v.map((x) => x / r);
};

/** n numbers with mean exactly 0 and spread exactly 1, so normalizing lands exactly on them. */
export function standard(r, n) {
  return layerNorm(Array.from({ length: n }, r.gauss));
}

/** View "steps": three tokens with their own centre and spread, then LayerNorm one stage at a time. */
export function stepsData(d = 48) {
  const r = rng(7);
  const tokens = [
    { mu: 2.6, sigma: 0.7 },
    { mu: -0.4, sigma: 2.3 },
    { mu: -3.4, sigma: 1.1 },
  ].map(({ mu, sigma }) => standard(r, d).map((z) => mu + sigma * z));
  const gamma = Array.from({ length: d }, () => 1 + 0.45 * r.gauss());
  const beta = Array.from({ length: d }, () => 0.35 * r.gauss());
  const centred = tokens.map((v) => v.map((x) => x - mean(v)));
  const normed = tokens.map(layerNorm);
  const affine = normed.map((v) => v.map((x, i) => gamma[i] * x + beta[i]));
  return { tokens, centred, normed, affine, gamma, beta };
}

const matrix = (r, rows, cols, scale) => Array.from({ length: rows }, () => Array.from({ length: cols }, () => scale * r.gauss()));
const matvec = (v, W) => W[0].map((_, j) => v.reduce((a, x, i) => a + x * W[i][j], 0));
const softmax = (z) => {
  const m = Math.max(...z);
  const e = z.map((x) => Math.exp(x - m));
  const s = e.reduce((a, b) => a + b, 0);
  return e.map((x) => x / s);
};

/**
 * View "depth": a stack of L toy layers, x <- x + sublayer(input), on n tokens of width d.
 * none: the sub-layer reads x itself. pre: it reads LayerNorm(x). post: x <- LayerNorm(x + sublayer(x)).
 * Per layer: what the sub-layer reads (token 0), the stream size (RMS over tokens), and the attention
 * weights of token 0 over all tokens, softmax(q·k / √d) with q, k projected from the sub-layer input.
 */
export function depthData({ L = 16, n = 8, d = 32 } = {}) {
  const r = rng(11);
  const layers = Array.from({ length: L }, () => ({ W: matrix(r, d, d, 1 / Math.sqrt(d)), Wq: matrix(r, d, d, 1 / Math.sqrt(d)), Wk: matrix(r, d, d, 1 / Math.sqrt(d)) }));
  const x0 = Array.from({ length: n }, () => standard(r, d));
  const run = (kind) => {
    let x = x0.map((v) => v.slice());
    const out = [];
    for (const { W, Wq, Wk } of layers) {
      const h = kind === 'pre' ? x.map(layerNorm) : x;
      const q = matvec(h[0], Wq);
      const ks = h.map((v) => matvec(v, Wk));
      const attn = softmax(ks.map((k) => k.reduce((a, kk, i) => a + kk * q[i], 0) / Math.sqrt(d)));
      out.push({ reads: h[0].slice(), attn, size: mean(x.map(rms)) });
      const y = x.map((v, t) => v.map((a, i) => a + matvec(h[t], W)[i]));
      x = kind === 'post' ? y.map(layerNorm) : y;
    }
    return out;
  };
  return { L, n, d, none: run('none'), pre: run('pre'), post: run('post') };
}

/** View "axes": a batch of tokens × features, each feature with its own typical offset and scale. */
export function axesData(rows = 6, cols = 8) {
  const r = rng(5);
  const colMu = Array.from({ length: cols }, () => 1.2 * r.gauss());
  const colSigma = Array.from({ length: cols }, () => 0.5 + r.next());
  const rowMu = Array.from({ length: rows }, () => 0.9 * r.gauss() + 0.6);
  const rowScale = Array.from({ length: rows }, () => 0.6 + 1.2 * r.next());
  const raw = Array.from({ length: rows }, (_, i) => Array.from({ length: cols }, (_, j) => rowScale[i] * (colMu[j] + colSigma[j] * r.gauss()) + rowMu[i]));
  const byRow = raw.map(layerNorm);
  const byRms = raw.map(rmsNorm);
  const cols_ = (m) => m[0].map((_, j) => m.map((row) => row[j]));
  const byCol = cols_(cols_(raw).map(layerNorm));
  return { raw, byRow, byCol, byRms };
}

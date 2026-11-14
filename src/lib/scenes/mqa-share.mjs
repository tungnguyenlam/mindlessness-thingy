// Multi-query attention: all n_h query heads share one key head and one value head.
// Each query still computes its own attention weights over past tokens, while the KV cache
// shrinks by n_h: 2·d_h numbers per token instead of 2·n_h·d_h. Toy sizes: n_h = 8, 5 tokens.
import { text, rect, line, group, rng, clamp, lerp, matrix, dot, softmax } from './kit.mjs';

const NH = 8;
const WORDS = ['The', 'cat', 'sat', 'on', 'mat'];
const qx = (i) => 94 + i * 44;
const QY = 16;
const KY = 76;
const CX = 248; // shared K/V centre
const PY = 132; // per-head attention patterns
const GY = 212; // cache grid top
const CELL = 13;

export default {
  viewBox: [460, 294],
  setup() {
    const r = rng(19);
    const K = matrix(r, WORDS.length, 4, 0.9);
    const Qs = [
      [1.4, -0.3, 0.2, 0.1],  // focuses near "The" / "cat"
      [-0.2, 1.3, 0.8, -0.4], // focuses on "sat"
      [0.3, -0.4, 0.5, 1.4],  // focuses on "mat"
    ];
    // Tune keys slightly so the three example queries clearly peak on different tokens.
    K[1] = [1.5, 0.1, -0.2, 0.1];
    K[2] = [-0.2, 1.4, 1.1, -0.3];
    K[4] = [0.1, -0.2, 0.4, 1.6];
    const patterns = Qs.map((q) => softmax(K.map((k) => dot(q, k))));
    return { patterns };
  },
  beats: [
    { say: 'Multi-head attention gives every query head its own key and value head: 8 pairs for 8 queries.', state: { col: 0, pat: 0, T: 1 }, from: { col: 0, pat: 0, T: 1 }, tween: 700 },
    { say: 'Multi-query attention keeps all 8 query heads, but gives them a single key head and value head to share.', state: { col: 1, pat: 0, T: 1 }, tween: 1500, ms: 4200 },
    { say: 'Different query heads still attend to different words, even while reading the same shared keys.', state: { col: 1, pat: 1, T: 1 }, tween: 1100, ms: 4400 },
    { say: 'Each new token adds just one K and one V slice to the cache: n_h times smaller than MHA.', state: { col: 1, pat: 1, T: 5 }, tween: 2200, linear: true, ms: 4600 },
  ],
  draw({ col, pat, T }, { patterns }) {
    let out = '';

    // Row 1: 8 query heads.
    out += text(8, QY + 10, 'query', 'ts') + text(8, QY + 22, 'heads', 'ts');
    for (let i = 0; i < NH; i++) {
      const kx = lerp(qx(i), CX, col);
      out += line(qx(i), QY + 24, kx, KY, 'wire', { opacity: 0.65 });
      out += rect(qx(i) - 15, QY, 30, 24, 'act') + text(qx(i), QY + 16, `q${i + 1}`, 'ts tc');
    }

    // Row 2: K and V heads collapse into one shared K, V pair.
    out += text(8, KY + 11, 'key &', 'ts') + text(8, KY + 23, 'value', 'ts');
    for (let i = 0; i < NH; i++) {
      const x = lerp(qx(i), CX, col);
      out += group(rect(x - 16, KY, 32, 26, 'cache') + text(x, KY + 17, `kv${i + 1}`, 'ts tc'), { opacity: 1 - col });
    }
    const sharedBox =
      rect(CX - 46, KY, 42, 28, 'cache hot') +
      text(CX - 25, KY + 18, 'K (d_h)', 'ts tc tb') +
      rect(CX + 4, KY, 42, 28, 'cache hot') +
      text(CX + 25, KY + 18, 'V (d_h)', 'ts tc tb');
    out += group(sharedBox, { opacity: col });

    // Row 3: Distinct attention distributions from 3 query heads against the shared keys.
    let pOut = text(8, PY + 10, 'same K,', 'ts') + text(8, PY + 22, 'different', 'ts') + text(8, PY + 34, 'weights', 'ts');
    const wx = (j) => 126 + j * 44;
    WORDS.forEach((w, j) => (pOut += text(wx(j), PY - 4, w, 'ts tc')));
    const sampleHeads = [1, 3, 7];
    sampleHeads.forEach((hNum, rIdx) => {
      const ry = PY + rIdx * 18;
      pOut += text(88, ry + 11, `q${hNum}`, 'ts te act tb');
      patterns[rIdx].forEach((wt, j) => {
        pOut += rect(wx(j) - 18, ry + 2, 36, 12, 'faint', { rx: 2 });
        pOut += rect(wx(j) - 18, ry + 2, 36 * wt, 12, 'act solid', { rx: 2, 'fill-opacity': 0.85 });
      });
    });
    out += group(pOut, { opacity: pat });

    // Row 4: Cache footprint, token by token (1 K + 1 V vs MHA's 8 K + 8 V ghost).
    out += text(8, GY + 12, 'cache,', 'ts') + text(8, GY + 24, 'one row', 'ts') + text(8, GY + 36, 'per token', 'ts');
    const kx0 = 90;
    const vx0 = kx0 + NH * CELL + 8;
    out += text(kx0, GY - 6, 'K', 'ts tb cache') + text(vx0, GY - 6, 'V', 'ts tb cache');
    out += text(kx0, GY + WORDS.length * CELL + 13, 'faint outline: MHA (2·n_h·d_h per token)', 'ts faint');

    for (let t = 0; t < WORDS.length; t++) {
      const y = GY + t * CELL;
      const show = clamp(T - t, 0, 1);
      let row = '';
      for (const x0 of [kx0, vx0]) {
        row += rect(x0, y, NH * CELL, CELL - 1, 'faint', { rx: 1.5 });
        const filledCols = lerp(NH, 1, col);
        for (let c = 0; c < Math.ceil(filledCols - 0.001); c++) {
          row += rect(x0 + c * CELL + 0.5, y + 0.5, Math.min(1, filledCols - c) * CELL - 1, CELL - 2, 'cache solid', { rx: 1.5 });
        }
      }
      out += group(row, { opacity: show });
    }
    const sx = 324;
    const curCols = Math.round(lerp(NH, 1, col));
    out += text(sx, GY + 12, 'kept per token', 'ts');
    out += text(sx, GY + 26, `2 × ${curCols} × d_h`, 'ts tb tm');
    out += text(sx, GY + 44, `${Math.ceil(T - 0.001)} token${T > 1.1 ? 's' : ''} cached`, 'ts');
    out += text(sx, GY + 62, curCols === 1 ? `${NH}× smaller cache` : 'full MHA size', 'tb cache');

    return out;
  },
};

// Multi-head latent attention: each token's hidden state is squeezed into a small latent (plus one
// shared RoPE key) and only that is cached. Per-head keys and values could be rebuilt from it, but
// W^UK folds into the query, which reads the latents directly. Toy sizes: d = 8, d_c = 4, d_h^R = 1,
// n_h = 4, d_h = 2, so MHA would cache 2·n_h·d_h = 16 numbers per token against MLA's 5.
import { text, rect, line, group, box, arrow, rng, clamp, lerp, matrix, matvec, dot, softmax } from './kit.mjs';

const D = 8;
const DC = 4;
const NH = 4;
const TMAX = 5;
const CELL = 14;
const GX = 92; // cache grid origin
const GY = 168;
const MHA = 16; // 2·n_h·d_h at toy sizes

function hbars(x, base, v, scale, cls, w = 7, gap = 2) {
  return v
    .map((u, i) => {
      const h = clamp(u * scale, -20, 20);
      return rect(x + i * (w + gap), h > 0 ? base - h : base, w, Math.max(0.8, Math.abs(h)), cls, { rx: 1 });
    })
    .join('');
}
const shade = (u) => clamp(0.25 + 0.6 * Math.abs(u), 0.25, 1);

export default {
  viewBox: [460, 262],
  setup() {
    const r = rng(23);
    const H = matrix(r, TMAX, D, 0.8);
    const WD = matrix(r, D, DC, 0.45);
    const WR = matrix(r, D, 1, 0.45);
    const C = H.map((h) => matvec(h, WD));
    const KR = H.map((h) => matvec(h, WR)[0]);
    const qt = [0.9, -0.6, 0.7, 0.3]; // absorbed query W^UK^T q (toy)
    const w = softmax(C.map((c, t) => 1.6 * dot(qt, c) + 0.5 * KR[t]));
    return { H, C, KR, qt, w };
  },
  beats: [
    { say: 'A new token’s hidden state h_t is squeezed by W^DKV into a small latent c_t.', state: { sq: 1, T: 0, ex: 0, ab: 0, cmp: 0 }, from: { sq: 0, T: 0, ex: 0, ab: 0, cmp: 0 }, tween: 1400 },
    { say: 'Only the latent goes into the cache, with one small RoPE key that all heads share.', state: { sq: 1, T: 1, ex: 0, ab: 0, cmp: 0 }, tween: 1200 },
    { say: 'Every token adds one short row: d_c + d_h^R numbers, however many heads there are.', state: { sq: 1, T: 5, ex: 0, ab: 0, cmp: 0 }, tween: 2400, linear: true, ms: 4000 },
    { say: 'MHA would keep a key and a value for every head: 2·n_h·d_h numbers, the long faint row.', state: { sq: 1, T: 5, ex: 0, ab: 0, cmp: 1 }, tween: 1000, ms: 4200 },
    { say: 'Each head’s keys and values could be rebuilt from a latent with W^UK and W^UV.', state: { sq: 1, T: 5, ex: 1, ab: 0, cmp: 1 }, tween: 1000 },
    { say: 'They never have to be: W^UK folds into the query, which scores the cached latents directly.', state: { sq: 1, T: 5, ex: 1, ab: 1, cmp: 1 }, tween: 1400, ms: 4600 },
  ],
  draw({ sq, T, ex, ab, cmp }, { H, C, KR, qt, w }) {
    let out = '';
    const cur = clamp(Math.ceil(T - 0.001) - 1, 0, TMAX - 1);
    const tok = T < 1 ? 0 : cur;
    // Pipeline for the current token.
    out += text(8, 14, `token ${tok + 1}`, 'ts tb');
    out += hbars(10, 52, H[tok], 16, 'act solid');
    out += text(46, 84, 'h_t: d', 'ts tc tm');
    out += arrow(84, 44, 98, 44) + box(100, 30, 72, 28, 'W^DKV', 'wt', 'd → d_c');
    out += line(90, 44, 90, 104, 'wire') + arrow(90, 104, 98, 104) + box(100, 90, 72, 28, 'W^KR, RoPE', 'wt');
    // Latent and RoPE key appear as the squeeze runs, then fly to the cache.
    const lx = lerp(188, GX, T < 1 ? T : 0);
    const ly = lerp(44, GY, T < 1 ? T : 0);
    out += arrow(174, 44, 186, 44, 'wire') + arrow(174, 104, 186, 104, 'wire');
    const lat = C[tok].map((u, c) => rect(lx + c * CELL, ly - 7, CELL - 1, CELL - 1, 'cache solid', { rx: 1.5, 'fill-opacity': shade(u) })).join('');
    out += group(lat + text(188 + 2 * CELL, 70, 'c_t: d_c', 'ts tc tm', { opacity: T < 0.5 ? 1 : 0.6 }), { opacity: sq });
    out += rect(188, 97, CELL - 1, CELL - 1, 'cache solid', { rx: 1.5, 'fill-opacity': shade(KR[tok]) }) + text(206, 108, 'k^R_t', 'ts tm');

    // Rebuilt per-head keys and values (never needed once W^UK is absorbed).
    let e = arrow(246, 44, 258, 44) + box(260, 30, 86, 28, 'W^UK, W^UV', 'wt');
    for (let i = 0; i < NH; i++) {
      e += rect(358 + i * 25, 22, 22, 18, 'act') + text(369 + i * 25, 35, `k${'₁₂₃₄'[i]}`, 'ts tc');
      e += rect(358 + i * 25, 46, 22, 18, 'act') + text(369 + i * 25, 59, `v${'₁₂₃₄'[i]}`, 'ts tc');
    }
    e += line(346, 44, 356, 31, 'wire') + line(346, 44, 356, 55, 'wire');
    out += group(e, { opacity: ex * (1 - 0.8 * ab) });
    out += group(text(406, 84, 'never built:', 'ts tc tb') + text(406, 97, 'W^UK joins the query', 'ts tc'), { opacity: ab });

    // The cache: one row per token, latent cells then the RoPE key; MHA's row as a ghost.
    out += text(8, GY - 28, 'cache, one row per token', 'ts tb');
    out += text(GX, GY - 12, 'c (d_c)', 'ts cache') + text(GX + DC * CELL + 2, GY - 12, 'k^R', 'ts cache');
    out += text(GX + MHA * CELL, GY - 12, `MHA: ${MHA} per token`, 'ts te', { opacity: cmp });
    for (let t = 0; t < TMAX; t++) {
      const y = GY + t * CELL;
      out += rect(GX, y - 7, MHA * CELL, CELL - 1, 'faint', { opacity: cmp, rx: 1.5 });
      const show = clamp(T - t, 0, 1);
      if (t === 0 && T < 1) continue; // still flying in
      let row = C[t].map((u, c) => rect(GX + c * CELL, y - 7, CELL - 1, CELL - 1, 'cache solid', { rx: 1.5, 'fill-opacity': shade(u) })).join('');
      row += rect(GX + DC * CELL + 2, y - 7, CELL - 1, CELL - 1, 'cache solid', { rx: 1.5, 'fill-opacity': shade(KR[t]) });
      out += group(row, { opacity: show });
      // Absorbed query scores each row: weight bar on the right.
      out += group(rect(330, y - 5, 4 + 110 * w[t], CELL - 5, 'act solid', { rx: 1.5 }), { opacity: ab * show });
    }
    out += text(GX + 5 * CELL + 6, GY + TMAX * CELL + 10, 'MLA: 5 per token', 'ts tb cache', { opacity: cmp });
    // The absorbed query.
    let q = hbars(20, GY + 30, qt, 18, 'act solid');
    q += text(36, GY + 56, 'query', 'ts tc') + text(36, GY + 68, '× W^UK', 'ts tc tm');
    q += text(330, GY - 12, 'weights', 'ts');
    out += group(q, { opacity: ab });
    return out;
  },
};

// Grouped-query attention: key/value heads within a group are averaged into one (the GQA paper's
// mean-pool conversion), query heads re-wire to the shared head, and the cache rows shrink by
// n_h / n_g. Going to one group is MQA. Toy vectors from a seeded rng.
import { text, rect, line, group, rng, clamp, lerp, mean } from './kit.mjs';

const NH = 8;
const DV = 3;
const qx = (i) => 92 + i * 48;
const QY = 22;
const KY = 104;
const GX = 92; // cache grid origin
const GY = 196;
const CELL = 14;

// Centre and mean vector of the group that head i belongs to when there are `ng` groups.
function level(i, ng, vecs) {
  const size = NH / ng;
  const g0 = Math.floor(i / size) * size;
  const idx = Array.from({ length: size }, (_, k) => g0 + k);
  return { x: mean(idx.map(qx)), v: Array.from({ length: DV }, (_, c) => mean(idx.map((j) => vecs[j][c]))) };
}

export default {
  viewBox: [460, 296],
  setup() {
    const r = rng(11);
    const vecs = Array.from({ length: NH }, () => Array.from({ length: DV }, () => 0.15 + 0.85 * r.next()));
    const levels = [8, 4, 2, 1].map((ng) => Array.from({ length: NH }, (_, i) => level(i, ng, vecs)));
    return { levels };
  },
  beats: [
    { say: 'In multi-head attention every query head has its own key and value head. The cache keeps all 8.', state: { m1: 0, m2: 0, m3: 0, T: 3 } },
    { say: 'GQA averages the key and value heads inside each group. Pairs of heads merge into one.', state: { m1: 1, m2: 0, m3: 0, T: 3 }, tween: 1600, ms: 4000 },
    { say: 'Merge again: now four query heads read each shared head, and the cache row halves again.', state: { m1: 1, m2: 1, m3: 0, T: 3 }, tween: 1600, ms: 4000 },
    { say: 'Every new token adds one row to the cache. GQA’s rows are n_h / n_g times shorter.', state: { m1: 1, m2: 1, m3: 0, T: 6 }, tween: 1800, linear: true, ms: 4000 },
    { say: 'One shared head for all queries is MQA: the smallest cache, but quality can drop.', state: { m1: 1, m2: 1, m3: 1, T: 6 }, tween: 1600, ms: 4200 },
  ],
  draw({ m1, m2, m3, T }, { levels }) {
    let out = '';
    const L = [m1, m2, m3];
    // Position and vector of key/value slot i after the merges so far.
    const slot = (i) => {
      let x = levels[0][i].x;
      let v = levels[0][i].v;
      L.forEach((m, k) => {
        const nx = levels[k + 1][i];
        x = lerp(x, nx.x, m);
        v = v.map((u, c) => lerp(u, nx.v[c], m));
      });
      return { x, v };
    };
    const ngc = NH / 2 ** (m1 + m2 + m3); // continuous count of distinct KV heads
    const ng = Math.round(ngc);

    out += text(8, QY + 10, 'query', 'ts') + text(8, QY + 22, 'heads', 'ts');
    out += text(8, KY + 10, 'key and', 'ts') + text(8, KY + 22, 'value heads', 'ts');
    const slots = Array.from({ length: NH }, (_, i) => slot(i));
    slots.forEach((s, i) => (out += line(qx(i), QY + 26, s.x, KY, 'wire', { opacity: 0.7 })));
    for (let i = 0; i < NH; i++) out += rect(qx(i) - 15, QY, 30, 26, 'act') + text(qx(i), QY + 17, `q${i + 1}`, 'ts tc');
    slots.forEach((s) => {
      out += rect(s.x - 17, KY, 34, 30, 'cache', { 'fill-opacity': 0.55 });
      s.v.forEach((u, c) => (out += rect(s.x - 12 + c * 8, KY + 26 - u * 20, 6, u * 20, 'cache solid', { rx: 1 })));
    });
    const name = ng === NH ? 'MHA' : ng === 1 ? 'MQA' : 'GQA';
    out += text(260, KY + 54, `n_g = ${ng} key/value head${ng === 1 ? '' : 's'} · ${name}`, 'tb tc');
    out += text(260, KY + 70, ng === NH ? 'each query head has its own' : `${NH / ng} query heads share each one`, 'ts tc');

    // Cache after T tokens: one row per token, K cells then V cells; MHA's row as a ghost.
    out += text(8, GY + 10, 'cache,', 'ts') + text(8, GY + 22, 'one row', 'ts') + text(8, GY + 34, 'per token', 'ts');
    out += text(GX, GY - 6, 'K', 'ts tb cache') + text(GX + NH * CELL + 10, GY - 6, 'V', 'ts tb cache');
    const rows = Math.ceil(T - 0.001);
    for (let t = 0; t < 6; t++) {
      const y = GY + t * CELL;
      const show = clamp(T - t, 0, 1);
      let row = '';
      for (const x0 of [GX, GX + NH * CELL + 10]) {
        row += rect(x0, y, NH * CELL, CELL - 1, 'faint', { rx: 1.5 });
        for (let c = 0; c < Math.ceil(ngc - 0.001); c++) {
          row += rect(x0 + c * CELL + 0.5, y + 0.5, Math.min(1, ngc - c) * CELL - 1, CELL - 2, 'cache solid', { rx: 1.5 });
        }
      }
      out += group(row, { opacity: show });
    }
    const sx = 352;
    out += text(sx, GY + 8, 'numbers kept', 'ts');
    out += text(sx, GY + 22, `2 × ${ng} × d_h`, 'ts tm') + text(sx, GY + 35, 'per token', 'ts');
    out += text(sx, GY + 52, `${rows} tokens so far`, 'ts');
    out += text(sx, GY + 72, ng === NH ? 'full size' : `${NH / ng}× smaller than MHA`, 'tb');
    return out;
  },
};

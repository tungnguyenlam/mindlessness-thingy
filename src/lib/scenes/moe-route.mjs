// Mixture of experts: the router scores every expert for a token, keeps the top k, renormalises
// those scores into gates, and only the chosen experts run; their outputs are summed by gate. Over a
// few tokens every expert is stored but each token uses k of n, and the load drifts to favourites.
// Toy numbers: n = 8 experts, k = 2, five tokens; the routing is chosen to show one favourite.
import { text, rect, circle, line, group, box, rng, clamp, span, softmax, along, f2 } from './kit.mjs';

const WORDS = ['The', 'cat', 'sat', 'on', 'it'];
const N = 8;
const PICKS = [
  [2, 5],
  [2, 0],
  [6, 2],
  [2, 4],
  [1, 5],
];
const ex = (i) => 92 + i * 46;
const tx = (i) => 126 + i * 52;
const RX = 230; // router and sum centre
const BASE = 124; // score baseline
const EY = 134; // expert boxes
const SY = 198; // sum
const LY = 272; // load baseline

export default {
  viewBox: [460, 280],
  setup() {
    const r = rng(5);
    const scores = PICKS.map(([a, b]) => {
      const s = Array.from({ length: N }, () => 0.35 * r.gauss());
      s[a] = 1.5 + 0.2 * r.next();
      s[b] = 1.0 + 0.2 * r.next();
      return s;
    });
    const gates = PICKS.map((pk, t) => softmax(pk.map((i) => scores[t][i])));
    return { scores, gates };
  },
  beats: [
    { say: 'A token arrives. The router, one small linear layer, scores all 8 experts for it.', state: { p: 0.2, imb: 0 }, from: { p: 0, imb: 0 }, tween: 900 },
    { say: 'Keep the top 2. A softmax over just those gives two gates that add up to 1; the other six get 0.', state: { p: 0.46, imb: 0 }, tween: 1000, ms: 4200 },
    { say: 'Only the two chosen experts run. Their outputs, scaled by their gates, are added together.', state: { p: 0.97, imb: 0 }, tween: 1800, linear: true },
    { say: 'Each token picks its own pair. All 8 experts are stored, but each token runs only 2.', state: { p: 4.97, imb: 0 }, tween: 7000, linear: true, ms: 7600 },
    { say: 'Left alone, the router keeps choosing a favourite. Balancing methods exist to spread this load.', state: { p: 4.97, imb: 1 }, tween: 600, ms: 4200 },
  ],
  draw({ p, imb }, { scores, gates }) {
    let out = '';
    const t = clamp(Math.floor(p), 0, WORDS.length - 1);
    const f = p - t;
    const topk = span(f, 0.3, 0.45);
    const flow = span(f, 0.5, 0.95);
    const pk = PICKS[t];

    // Tokens and the router.
    WORDS.forEach((w, i) => {
      out += rect(tx(i) - 22, 6, 44, 22, i === t ? 'act hot' : 'act', { opacity: i < t ? 0.45 : 1 });
      out += text(tx(i), 21, w, 'ts tc', { opacity: i < t ? 0.45 : 1 });
    });
    out += line(tx(t), 28, RX, 36, 'wire arrow');
    out += box(RX - 50, 38, 100, 22, 'router', 'route');

    // Scores, then top-k gates.
    out += text(8, BASE - 8, 'scores', 'ts');
    out += line(ex(0) - 22, BASE, ex(N - 1) + 22, BASE, 'wire', { opacity: 0.4 });
    for (let i = 0; i < N; i++) {
      const on = pk.includes(i);
      const h = clamp(scores[t][i] * 24, -8, 38);
      out += rect(ex(i) - 9, h > 0 ? BASE - h : BASE, 18, Math.max(1, Math.abs(h)), 'route solid', { rx: 1.5, opacity: on ? 1 : 1 - 0.8 * topk });
      if (on) out += text(ex(i), BASE - Math.max(h, 0) - 4, `g = ${f2(gates[t][pk.indexOf(i)])}`, 'ts tc tb', { opacity: topk });
    }

    // Experts: stored weights; the chosen ones fill while they run.
    out += text(8, EY + 17, 'experts', 'ts');
    for (let i = 0; i < N; i++) {
      const on = pk.includes(i);
      const dim = on ? 1 : 1 - 0.6 * topk;
      out += rect(ex(i) - 19, EY, 38, 26, on && topk > 0.5 ? 'wt hot' : 'wt', { opacity: dim });
      if (on) out += rect(ex(i) - 19, EY, 38, 26, 'wt solid', { 'fill-opacity': 0.45 * span(flow, 0.3, 0.6), opacity: 1 });
      out += text(ex(i), EY + 17, `E${i + 1}`, 'ts tc', { opacity: dim });
    }

    // The token travels to its experts and their outputs meet at the sum.
    out += circle(RX, SY, 11, 'op') + text(RX, SY + 4, '+', 'tb tc');
    pk.forEach((i, j) => {
      out += line(ex(i), EY + 26, RX, SY - 11, 'wire', { opacity: topk });
      if (flow > 0 && flow < 1) {
        const [x, y] = along([[RX, 66], [ex(i), EY], [ex(i), EY + 26], [RX, SY]], flow);
        out += circle(x, y, 2.5 + 5 * gates[t][j], 'act solid');
      }
    });
    out += text(RX + 20, SY + 4, 'y = g·E(x) + g·E(x), 2 of 8 run', 'ts', { opacity: span(flow, 0.85, 1) });

    // Load: tokens sent to each expert so far.
    out += text(8, LY - 22, 'tokens', 'ts') + text(8, LY - 10, 'per expert', 'ts');
    const load = Array(N).fill(0);
    PICKS.forEach((pr, s) => pr.forEach((i) => (load[i] += s < t ? 1 : s === t ? flow : 0)));
    for (let i = 0; i < N; i++) {
      const fav = i === 2 && imb > 0.5;
      out += rect(ex(i) - 9, LY - load[i] * 9, 18, Math.max(0.8, load[i] * 9), fav ? 'route solid hot' : 'route solid', { rx: 1.5, 'fill-opacity': 0.75 });
      out += text(ex(i), LY - load[i] * 9 - 4, String(Math.round(load[i])), 'ts tc tm', { opacity: load[i] > 0.5 ? 1 : 0 });
    }
    out += group(text(ex(2) + 14, LY - 40, 'a favourite', 'ts tb'), { opacity: imb });
    return out;
  },
};

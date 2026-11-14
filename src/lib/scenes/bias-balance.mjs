// Auxiliary-loss-free load balancing: each expert keeps a bias b_i nudged after every batch
// (down if overloaded, up if underloaded). Selection ranks by s + b, while the output gate uses
// affinity s alone, so load balances around c̄ without adding gradients to the main loss.
// Toy numbers: 8 routed experts, top-2 selection.
import { text, rect, line, group, clamp, lerp, f2 } from './kit.mjs';

const N = 8;
const ex = (i) => 104 + i * 44;

// Toy token affinities s_i for one token: E3 (index 2) is naturally favoured, E5 (4) is second, E7 (6) is third.
const AFF = [0.34, 0.28, 0.86, 0.18, 0.72, 0.24, 0.64, 0.22];
// Bias adjustments after balancing: overloaded (> 1.0) get -γ; underloaded (< 1.0) get +γ.
const BIAS = [0.08, 0.10, -0.34, 0.18, -0.06, 0.12, 0.16, -0.08];
// Batch loads before vs after bias balancing (average = 1.00 across 8 experts).
const LOAD_UNBAL = [0.65, 0.55, 2.35, 0.35, 1.55, 0.45, 0.70, 1.40];
const LOAD_BAL = [0.96, 0.94, 1.06, 0.95, 1.03, 0.98, 1.05, 1.03];

const SBASE = 84;
const BBASE = 158;
const LBASE = 270;

export default {
  viewBox: [460, 292],
  beats: [
    {
      say: 'Without balancing, favourite experts (E3, E5) take most of the batch while others sit idle.',
      state: { bias: 0, pick: 0, bal: 0 },
      from: { bias: 0, pick: 0, bal: 0 },
      tween: 700,
    },
    {
      say: 'After each batch, nudge b_i by γ: down for overloaded experts, up for underloaded ones.',
      state: { bias: 1, pick: 0, bal: 0 },
      tween: 1200,
      ms: 4200,
    },
    {
      say: 'Selection ranks by s + b, so E7 overtakes E3 for top-2 — while the output gate still reads s alone.',
      state: { bias: 1, pick: 1, bal: 0 },
      tween: 1100,
      ms: 4600,
    },
    {
      say: 'Over steps, every expert’s token count settles onto the average c̄ with zero auxiliary loss.',
      state: { bias: 1, pick: 1, bal: 1 },
      tween: 1800,
      linear: true,
      ms: 4400,
    },
  ],
  draw({ bias, pick, bal }) {
    let out = '';

    // Legend / top-row header.
    out += text(8, 22, 'routing', 'ts') + text(8, 34, 'scores', 'ts');
    out += rect(100, 12, 10, 10, 'act solid', { rx: 1.5 }) + text(114, 21, 'affinity s (used for gate g)', 'ts');
    out += rect(278, 12, 10, 10, 'route solid', { rx: 1.5 }) + text(292, 21, 's + b (used to pick top-2)', 'ts');
    out += line(ex(0) - 20, SBASE, ex(N - 1) + 20, SBASE, 'wire', { opacity: 0.4 });

    // Determine current s + b values and which 2 are selected.
    const sb = AFF.map((s, i) => s + bias * BIAS[i]);
    const top2 = [...sb.keys()].sort((a, b) => sb[b] - sb[a]).slice(0, 2);

    for (let i = 0; i < N; i++) {
      const sH = AFF[i] * 50;
      const sbH = clamp(sb[i], 0.04, 1.1) * 50;
      const isTop = top2.includes(i);
      // Affinity s bar (left) and biased selection score s + b bar (right).
      out += rect(ex(i) - 11, SBASE - sH, 9, sH, 'act solid', { rx: 1.5, 'fill-opacity': 0.85 });
      out += rect(ex(i) + 1, SBASE - sbH, 9, sbH, isTop && pick > 0.5 ? 'route solid hot' : 'route solid', {
        rx: 1.5,
        opacity: 0.25 + 0.75 * bias,
      });
      out += text(ex(i), SBASE + 13, `E${i + 1}`, isTop && pick > 0.5 ? 'ts tc tb' : 'ts tc');
      if (isTop && pick > 0.5) {
        out += text(ex(i), SBASE - Math.max(sH, sbH) - 4, `g=${f2(AFF[i])}`, 'ts tc tb act', { opacity: pick });
      }
    }

    // Middle: stored per-expert bias b_i.
    out += text(8, BBASE - 6, 'stored', 'ts') + text(8, BBASE + 6, 'bias b_i', 'ts');
    out += line(ex(0) - 20, BBASE, ex(N - 1) + 20, BBASE, 'wire', { opacity: 0.5 });
    for (let i = 0; i < N; i++) {
      const bi = bias * BIAS[i];
      const h = bi * 66;
      const neg = bi < 0;
      out += rect(ex(i) - 8, neg ? BBASE : BBASE - h, 16, Math.max(0.8, Math.abs(h)), neg ? 'route' : 'route solid', {
        rx: 1.5,
        opacity: 0.2 + 0.8 * bias,
      });
      if (bias > 0.5 && Math.abs(BIAS[i]) >= 0.05) {
        const lbl = BIAS[i] < 0 ? '−γ' : '+γ';
        out += text(ex(i), neg ? BBASE + Math.abs(h) + 11 : BBASE - h - 4, lbl, 'ts tc tb route', { opacity: bias });
      }
    }

    // Bottom: batch token load c_i vs target average c̄.
    out += text(8, LBASE - 30, 'batch', 'ts') + text(8, LBASE - 18, 'load c_i', 'ts');
    const avgY = LBASE - 26; // load = 1.0
    out += line(ex(0) - 20, LBASE, ex(N - 1) + 20, LBASE, 'wire', { opacity: 0.4 });
    out += line(ex(0) - 20, avgY, ex(N - 1) + 20, avgY, 'wire dash', { opacity: 0.8 });
    out += text(ex(N - 1) + 24, avgY + 4, 'c̄', 'ts tb');

    for (let i = 0; i < N; i++) {
      const c = lerp(LOAD_UNBAL[i], LOAD_BAL[i], bal);
      const h = c * 26;
      const hot = c > 1.5;
      out += rect(ex(i) - 9, LBASE - h, 18, h, hot ? 'route solid hot' : 'route solid', { rx: 1.5, 'fill-opacity': 0.8 });
      out += text(ex(i), LBASE + 13, `E${i + 1}`, 'ts tc');
    }

    return out;
  },
};

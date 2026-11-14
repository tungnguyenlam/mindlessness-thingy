// Flow matching: pair noise x_0 with data x_1 along a straight line x_t = (1-t)x_0 + t*x_1;
// the conditional velocity x_1 - x_0 is constant. Averaged over many pairs, the network learns
// a marginal velocity field v_θ(x_t, t) that transports fresh noise to data in a few Euler steps.
import { text, rect, circle, line, arrow, group, rng, clamp, lerp } from './kit.mjs';

const NP = 12; // training pairs
const NS = 8; // test noise particles for ODE sampling
const SIGMA2 = 34 * 34;
const X_NOISE = 74;
const X_DATA = 386;
const Y_MID = 136;

// Marginal velocity field at (px, py, t): kernel-weighted average of pair velocities (x1 - x0).
function field(px, py, t, pairs) {
  let vx = 0;
  let vy = 0;
  let wsum = 0;
  for (const p of pairs) {
    const xt = lerp(p.x0, p.x1, t);
    const yt = lerp(p.y0, p.y1, t);
    const d2 = (px - xt) ** 2 + (py - yt) ** 2;
    const w = Math.exp(-d2 / (2 * SIGMA2)) + 1e-4;
    vx += w * (p.x1 - p.x0);
    vy += w * (p.y1 - p.y0);
    wsum += w;
  }
  return [vx / wsum, vy / wsum];
}

export default {
  viewBox: [460, 274],
  setup() {
    const r = rng(31);
    const pairs = Array.from({ length: NP }, (_, i) => {
      const upper = i % 2 === 0;
      return {
        x0: X_NOISE + 22 * r.gauss(),
        y0: Y_MID + 44 * r.gauss(),
        x1: X_DATA + 14 * r.gauss(),
        y1: (upper ? 72 : 200) + 14 * r.gauss(),
      };
    });
    // Override pair 0 so the featured straight path is unobstructed and easy to follow.
    pairs[0] = { x0: 66, y0: 112, x1: 382, y1: 70 };

    // Grid of marginal velocity arrows evaluated at the t corresponding to each column.
    const grid = [];
    for (let gx = 135; gx <= 325; gx += 46) {
      const tCol = clamp((gx - X_NOISE) / (X_DATA - X_NOISE), 0.15, 0.85);
      for (let gy = 58; gy <= 214; gy += 39) {
        const [vx, vy] = field(gx, gy, tCol, pairs);
        const len = Math.hypot(vx, vy) || 1;
        const s = 22 / len;
        grid.push({ x: gx, y: gy, dx: vx * s, dy: vy * s });
      }
    }

    // Integrate NS fresh noise samples in 4 Euler steps using the learned marginal field.
    const steps = 4;
    const h = 1 / steps;
    const trajs = Array.from({ length: NS }, (_, i) => {
      let x = X_NOISE + 18 * r.gauss();
      let y = Y_MID + (i < NS / 2 ? -34 : 34) + 18 * r.gauss();
      const pts = [[x, y]];
      for (let k = 0; k < steps; k++) {
        const [vx, vy] = field(x, y, k * h, pairs);
        x += h * vx;
        y += h * vy;
        pts.push([x, y]);
      }
      return pts;
    });

    return { pairs, grid, trajs };
  },
  beats: [
    { say: 'Pair each noise point x₀ on the left with a data point x₁ on the right.', state: { t: 0, all: 0, vec: 0, ode: 0, s: 0 }, from: { t: 0, all: 0, vec: 0, ode: 0, s: 0 }, tween: 700 },
    { say: 'Join them with a straight line x_t = (1 − t)x₀ + t x₁. The target velocity x₁ − x₀ never turns.', state: { t: 0.48, all: 0, vec: 0, ode: 0, s: 0 }, tween: 1800, linear: true, ms: 4200 },
    { say: 'Across many pairs, lines cross. The network sees only (x_t, t) and learns the average velocity field.', state: { t: 0.48, all: 1, vec: 1, ode: 0, s: 0 }, tween: 1300, ms: 4200 },
    { say: 'To sample, draw fresh noise at t = 0 and step forward along that velocity field in a few Euler steps.', state: { t: 0.48, all: 0.2, vec: 1, ode: 1, s: 1 }, from: { t: 0.48, all: 0.2, vec: 1, ode: 1, s: 0 }, tween: 2600, linear: true, ms: 4600 },
  ],
  draw({ t, all, vec, ode, s }, { pairs, grid, trajs }) {
    let out = '';

    // Region frame & labels.
    out += rect(12, 26, 436, 216, 'faint', { rx: 6 });
    out += text(X_NOISE, 18, 'noise  x₀ (t = 0)', 'ts tc tb act');
    out += text(230, 18, ode > 0.5 ? 'ODE integration (4 Euler steps)' : 'conditional straight paths', 'ts tc');
    out += text(X_DATA, 18, 'data  x₁ (t = 1)', 'ts tc tb cache');

    // Background training points and all conditional lines.
    pairs.forEach((p, i) => {
      if (i > 0) {
        out += line(p.x0, p.y0, p.x1, p.y1, 'wire', { opacity: 0.45 * all });
        out += circle(p.x0, p.y0, 3.5, 'act', { opacity: 0.55 * (1 - 0.5 * ode) });
        out += circle(p.x1, p.y1, 3.8, 'cache solid', { opacity: 0.65 });
      }
    });

    // Marginal velocity field arrows.
    if (vec > 0.02) {
      let vf = '';
      for (const g of grid) vf += arrow(g.x - g.dx * 0.45, g.y - g.dy * 0.45, g.x + g.dx * 0.45, g.y + g.dy * 0.45, 'wire');
      out += group(vf, { opacity: 0.62 * vec });
    }

    // Featured training pair (x0 -> x1) with moving x_t and constant velocity arrow u_t.
    const p0 = pairs[0];
    const xt = lerp(p0.x0, p0.x1, t);
    const yt = lerp(p0.y0, p0.y1, t);
    const dx = (p0.x1 - p0.x0) * 0.19;
    const dy = (p0.y1 - p0.y0) * 0.19;
    let feat = '';
    feat += line(p0.x0, p0.y0, p0.x1, p0.y1, 'wire dash');
    feat += circle(p0.x0, p0.y0, 5, 'act') + text(p0.x0 - 10, p0.y0 + 4, 'x₀', 'ts te tb act');
    feat += circle(p0.x1, p0.y1, 5, 'cache solid') + text(p0.x1 + 10, p0.y1 + 4, 'x₁', 'ts tb cache');
    if (t > 0.02) {
      feat += line(p0.x0, p0.y0, xt, yt, 'flow');
      feat += arrow(xt, yt, xt + dx, yt + dy, 'flow');
      feat += text(xt + dx * 0.6, yt + dy + 15, 'u_t = x₁ − x₀', 'ts tb act');
      feat += circle(xt, yt, 5.5, 'act solid hot');
      feat += text(xt, yt - 11, 'x_t', 'ts tc tb');
    }
    out += group(feat, { opacity: 1 - ode });

    // ODE sampling trajectories (4 Euler steps).
    if (ode > 0.02) {
      const steps = 4;
      const prog = s * steps;
      const k = Math.min(steps - 1, Math.floor(prog));
      const frac = prog - k;
      let oOut = '';
      for (const pts of trajs) {
        // Completed segments + current segment.
        for (let i = 0; i < k; i++) {
          oOut += line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], 'flow', { opacity: 0.7 });
          oOut += circle(pts[i][0], pts[i][1], 2.5, 'act', { opacity: 0.7 });
        }
        const cx = lerp(pts[k][0], pts[k + 1][0], frac);
        const cy = lerp(pts[k][1], pts[k + 1][1], frac);
        if (s > 0.01) oOut += line(pts[k][0], pts[k][1], cx, cy, 'flow');
        oOut += circle(cx, cy, 4.8, s > 0.96 ? 'cache solid hot' : 'act solid hot');
      }
      out += group(oOut, { opacity: ode });
    }

    // Bottom time progress bar.
    const tShow = ode > 0.5 ? s : t;
    out += text(16, 263, 'time t', 'ts tb');
    out += rect(68, 255, 320, 7, 'faint', { rx: 3.5 });
    out += rect(68, 255, 320 * clamp(tShow, 0, 1), 7, 'act solid', { rx: 3.5 });
    out += text(398, 263, `t = ${tShow.toFixed(2)}`, 'ts tm tb');

    return out;
  },
};

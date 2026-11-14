import { arrow, bars, box, circle, lerp, line, path, rect, text } from './kit.mjs';

const X_BARS = [0.9, -0.5, 1.1, 0.4, -0.8, 0.7, -0.3, 1.0];
const Z_BARS = [1.0, -0.7];
const Y_BARS = [0.8, -0.3, 1.2, 0.5, -0.6, 0.9, -0.4, 0.9];

export default {
  viewBox: [460, 250],
  beats: [
    {
      say: 'In plain MoE, every routed expert loads d×m weights and all-to-all ships full d-vectors.',
      state: { comp: 0, split: 0, up: 0, hot: 'plain' },
    },
    {
      say: 'W↓ shrinks each token to latent width ℓ = d/4, cutting traffic and expert loads 4×.',
      state: { comp: 1, split: 0, up: 0.3, hot: 'down' },
    },
    {
      say: 'LatentMoE spends that 4× budget on 4× more finer experts (N′ = 4N, K′ = 4K).',
      state: { comp: 1, split: 1, up: 0.5, hot: 'experts' },
    },
    {
      say: 'W↑ runs once after summing the expert outputs, then adds Shared(x) at full width d.',
      state: { comp: 1, split: 1, up: 1, hot: 'up' },
    },
  ],
  draw({ comp, split, up, hot }) {
    const out = [];

    // ---- Left column: Token x, Router, Shared expert (x = 10..86) ----
    out.push(box(10, 14, 76, 40, 'Router', 'route', 'width d'));
    out.push(rect(10, 72, 76, 62, 'act'));
    out.push(text(48, 86, 'Token x', 't tb tc'));
    out.push(line(18, 114, 78, 114, 'faint'));
    out.push(bars(20, 114, X_BARS, { w: 5, gap: 2, scale: 11, max: 14, cls: 'act solid' }));
    out.push(text(48, 128, 'width d', 'ts tc tm'));

    out.push(box(10, 152, 76, 42, 'Shared(x)', 'wt', 'width d'));
    out.push(arrow(48, 72, 48, 54, 'wire'));
    out.push(arrow(48, 134, 48, 152, 'wire'));

    // Router gate line over top to expert pool (y = 34 -> 266)
    out.push(path('M86,34 L268,34 L268,60', 'wire arrow'));
    out.push(rect(144, 24, 68, 18, 'op'));
    out.push(text(178, 36, split > 0.5 ? 'top-K′ gates' : 'top-K gates', 'ts tc'));

    // ---- W↓ Down-projection (x = 98..148, y = 78..128) ----
    out.push(arrow(86, 103, 98, 103, 'wire'));
    if (comp > 0.08) {
      const wDownCls = hot === 'down' ? 'wt hot' : 'wt';
      out.push(rect(98, 78, 50, 50, wDownCls, { opacity: comp }));
      out.push(text(123, 99, 'W↓', 't tb tc', { opacity: comp }));
      out.push(text(123, 115, 'd → ℓ', 'ts tc tm', { opacity: comp }));
    } else {
      out.push(rect(98, 88, 50, 30, 'faint', { 'stroke-dasharray': '3 3' }));
      out.push(text(123, 107, 'identity', 'ts tc'));
    }

    // ---- All-to-all vector slice indicator (x = 156..202) ----
    out.push(arrow(148, 103, 158, 103, 'wire'));
    const barCount = Math.round(lerp(8, 2, comp));
    const vecW = barCount * 4 + 8;
    const vx = 180 - vecW / 2;
    out.push(rect(158, 72, 44, 62, comp > 0.5 && hot === 'down' ? 'act hot' : 'act'));
    out.push(text(180, 86, comp > 0.5 ? 'z (ℓ)' : 'x (d)', 'ts tb tc tm'));
    out.push(line(164, 114, 196, 114, 'faint'));
    out.push(bars(vx + 3, 114, comp > 0.5 ? Z_BARS : X_BARS, { w: 2.5, gap: 1.5, scale: 11, max: 13, cls: 'act solid' }));
    out.push(text(180, 128, comp > 0.5 ? '1/4 size' : 'full d', 'ts tc'));

    // ---- Routed experts grid (x = 214..322, y = 60..146) ----
    out.push(arrow(202, 103, 214, 103, 'wire'));
    const poolCls = hot === 'experts' ? 'op hot' : 'op';
    out.push(rect(214, 60, 108, 86, poolCls));
    out.push(text(268, 74, split > 0.5 ? 'N′=4N  (K′=4K)' : 'N experts  (K)', 'ts tb tc'));

    if (split < 0.5) {
      // 4 wide expert bars (shrink visually as comp 0 -> 1)
      const ew = lerp(92, 34, comp);
      const active = [true, false, true, false];
      for (let i = 0; i < 4; i++) {
        const ex = 268 - ew / 2;
        const ey = 80 + i * 15;
        out.push(rect(ex, ey, ew, 12, active[i] ? 'route' : 'faint', { rx: 2 }));
        if (ew > 50) out.push(text(268, ey + 9.5, `E${i + 1} (d×m)`, 'ts tc'));
        else out.push(text(268, ey + 9.5, `E${i + 1}`, 'ts tc'));
      }
    } else {
      // 16 narrow experts (4x4 grid, 8 active lit up in route)
      const activeIdx = new Set([0, 2, 5, 7, 8, 10, 13, 14]);
      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 4; c++) {
          const idx = r * 4 + c;
          const ex = 221 + c * 24;
          const ey = 81 + r * 15;
          out.push(rect(ex, ey, 21, 12, activeIdx.has(idx) ? 'route' : 'faint', { rx: 2, opacity: (split - 0.5) * 2 }));
        }
      }
    }

    // ---- W↑ Up-projection + Add + Output y (x = 334..450) ----
    out.push(arrow(322, 103, 334, 103, 'wire'));
    if (comp > 0.08) {
      const wUpCls = hot === 'up' ? 'wt hot' : 'wt';
      out.push(rect(334, 78, 46, 50, wUpCls, { opacity: comp }));
      out.push(text(357, 99, 'W↑', 't tb tc', { opacity: comp }));
      out.push(text(357, 115, 'ℓ → d', 'ts tc tm', { opacity: comp }));
    } else {
      out.push(rect(334, 88, 46, 30, 'faint', { 'stroke-dasharray': '3 3' }));
      out.push(text(357, 107, 'sum', 'ts tc'));
    }

    // Add node + Shared(x) path along bottom (y = 173) up to Output y
    out.push(line(380, 103, 392, 103, 'wire'));
    out.push(circle(400, 103, 8, hot === 'up' ? 'op hot' : 'op'));
    out.push(text(400, 107, '+', 't tb tc'));
    out.push(path('M86,173 L400,173 L400,111', hot === 'up' ? 'flow' : 'wire arrow'));
    if (hot === 'up') out.push(path('M86,173 L400,173 L400,111', 'wire arrow'));

    out.push(arrow(408, 103, 418, 103, 'wire'));
    out.push(rect(418, 72, 34, 62, hot === 'up' ? 'act hot' : 'act'));
    out.push(text(435, 86, 'y', 't tb tc'));
    out.push(line(421, 114, 449, 114, 'faint'));
    out.push(bars(423, 114, Y_BARS, { w: 2, gap: 1.2, scale: 10, max: 14, cls: 'act solid' }));
    out.push(text(435, 128, 'd', 'ts tc tm'));

    // ---- Bottom summary bar (y = 206..242) ----
    out.push(rect(10, 206, 442, 34, 'op'));
    const matText = comp > 0.5 ? 'Expert matrix: ℓ×m  (4× smaller)' : 'Expert matrix: d×m  (full width)';
    const actText = split > 0.5 ? 'All-to-all budget: 4K × (d/4) = K·d' : comp > 0.5 ? 'Payload per expert: 1/4' : 'All-to-all: K × d floats';
    out.push(text(22, 227, matText, 'ts tb'));
    out.push(text(440, 227, actText, 'ts tb te'));

    return out.join('');
  },
};

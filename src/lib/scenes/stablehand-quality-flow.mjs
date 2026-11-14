import { clamp, lerp, line, path, rect, circle, text } from './kit.mjs';

const FRAMES = [
  { t: 1, q: 0.90, x1: 126, obs: 128, eps: 96 },
  { t: 2, q: 0.88, x1: 116, obs: 114, eps: 140 },
  { t: 3, q: 0.86, x1: 106, obs: 108, eps: 82 },
  { t: 4, q: 0.08, x1: 100, obs: 68, eps: 142 },
  { t: 5, q: 0.05, x1: 96, obs: 148, eps: 74 },
  { t: 6, q: 0.09, x1: 100, obs: 68, eps: 136 },
  { t: 7, q: 0.87, x1: 110, obs: 112, eps: 88 },
  { t: 8, q: 0.91, x1: 120, obs: 118, eps: 142 },
];

const fx = (i) => 68 + i * 51.5;

function curve(pts) {
  return pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
}

export default {
  viewBox: [460, 268],
  beats: [
    {
      say: 'Quality network scores each frame q̃: trusted outside (0.9), near zero behind occlusions.',
      state: { tau: 0, showFlow: 0, qOn: 1, phase: 0 },
    },
    {
      say: 'At τ = 0, x₀ mixes q̃·ȳ + (1−q̃)·ε: visible frames stay pinned, occluded ones start from noise.',
      state: { tau: 0, showFlow: 1, qOn: 1, phase: 1 },
    },
    {
      say: 'At τ = 0.5, velocity scales as (1−q̃): occluded frames travel fast to bridge the gap.',
      state: { tau: 0.5, showFlow: 1, qOn: 1, phase: 2 },
    },
    {
      say: 'At τ = 1.0 (20 Euler steps), clean motion locks onto trusted ȳ and fills the hidden gap.',
      state: { tau: 1, showFlow: 1, qOn: 1, phase: 3 },
    },
  ],
  draw({ tau, showFlow, phase }) {
    const out = [];
    const tClamped = clamp(tau, 0, 1);

    // ---- Top bar ----
    out.push(text(28, 20, 'Per-frame quality schedule α(τ, q̃)', 't tb'));
    const pillTxt =
      phase === 0
        ? 'Score noisy obs ȳ'
        : `τ = ${tClamped.toFixed(2)} · step ${Math.round(tClamped * 20)}/20`;
    out.push(rect(306, 7, 140, 18, phase === 3 ? 'act hot' : 'op', { rx: 3 }));
    out.push(text(376, 19, pillTxt, 'ts tb tc tm'));

    // ---- Trajectory plot (y = 34..158) ----
    out.push(rect(28, 34, 418, 124, 'op', { 'fill-opacity': 0.2 }));

    // Occlusion band spanning frames t = 4, 5, 6 (i = 3..5)
    const occX = fx(3) - 26;
    const occW = fx(5) - fx(3) + 52;
    out.push(
      rect(occX, 35, occW, 122, 'wire dash', {
        rx: 0,
        'fill-opacity': 0.04,
      }),
    );
    out.push(text(occX + occW / 2, 48, 'occluded behind object', 'ts tb tc'));

    // Noisy observation trajectory ȳ
    const obsPts = FRAMES.map((f, i) => [fx(i), f.obs]);
    out.push(
      path(curve(obsPts), 'wire dash', {
        style: 'fill:none;stroke-width:1.6',
      }),
    );
    out.push(text(426, 134, 'obs ȳ', 'ts te'));

    // Flow trajectory x_τ (per-coordinate mix starting from q̃·ȳ + (1−q̃)·ε)
    if (showFlow > 0.05) {
      const flowPts = FRAMES.map((f, i) => {
        const x0 = f.q * f.obs + (1 - f.q) * f.eps;
        return [fx(i), lerp(x0, f.x1, tClamped)];
      });
      out.push(
        path(curve(flowPts), 'flow', {
          opacity: showFlow,
          style: 'fill:none;stroke-width:2.5',
        }),
      );
      for (let i = 0; i < FRAMES.length; i++) {
        const [px, py] = flowPts[i];
        const isLow = FRAMES[i].q < 0.2;
        out.push(
          circle(px, py, isLow ? 4 : 3.2, isLow ? 'act solid' : 'cache solid', {
            opacity: showFlow,
          }),
        );
      }
      out.push(text(42, 74, 'flow x_τ', 'ts tb', { opacity: showFlow }));
    }

    // ---- Quality bar strip q̃_t (y = 166..204) ----
    out.push(text(28, 188, 'q̃_t', 'ts tb tm'));
    const qBase = 196;
    out.push(line(52, qBase, 444, qBase, 'faint'));
    for (let i = 0; i < FRAMES.length; i++) {
      const f = FRAMES[i];
      const cx = fx(i);
      const bh = Math.max(2, Math.round(f.q * 24));
      const isLow = f.q < 0.2;
      out.push(
        rect(cx - 12, qBase - bh, 24, bh, isLow ? 'op' : 'cache', {
          rx: 1.5,
        }),
      );
      out.push(
        text(cx, qBase + 10, f.q.toFixed(1), 'ts tc tm', {
          opacity: isLow ? 0.75 : 1,
        }),
      );
    }

    // ---- Bottom two-regime schedule summary (y = 216..260) ----
    const alphaHi = (1 - (1 - tClamped) * (1 - 0.9)) * 100;
    const alphaLo = (1 - (1 - tClamped) * (1 - 0.08)) * 100;

    // Left box: visible frame regime
    out.push(rect(28, 216, 202, 44, phase === 1 ? 'cache hot' : 'op'));
    out.push(text(38, 232, 'Visible part (q̃ ≈ 0.9)', 'ts tb'));
    out.push(text(38, 249, `α=${Math.round(alphaHi)}% · speed 0.1×`, 'ts tm'));
    out.push(rect(168, 238, 52, 8, 'faint', { rx: 2 }));
    out.push(rect(168, 238, Math.round((alphaHi / 100) * 52), 8, 'cache solid', { rx: 2 }));

    // Right box: occluded frame regime
    out.push(rect(244, 216, 202, 44, phase === 2 ? 'act hot' : 'op'));
    out.push(text(254, 232, 'Occluded part (q̃ ≈ 0.1)', 'ts tb'));
    out.push(text(254, 249, `α=${Math.round(alphaLo)}% · speed 0.9×`, 'ts tm'));
    out.push(rect(384, 238, 52, 8, 'faint', { rx: 2 }));
    out.push(rect(384, 238, Math.round((alphaLo / 100) * 52), 8, 'act solid', { rx: 2 }));

    return out.join('');
  },
};

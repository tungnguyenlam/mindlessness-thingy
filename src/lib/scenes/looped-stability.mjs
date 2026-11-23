// Why looped transformers need state stabilization:
// Naive overwriting pushes activation norms out of scale; a per-token gate keeps norms bounded.
import { text, rect, line, path, bars, clamp, lerp } from './kit.mjs';

const P0 = [0.4, -0.3, 0.5, -0.2];
const NAIVE = [
  [0.4, -0.3, 0.5, -0.2],
  [0.7, -0.6, 0.85, -0.45],
  [1.15, -1.0, 1.35, -0.8],
  [1.7, -1.5, 1.9, -1.25],
];
const GATED = [
  [0.4, -0.3, 0.5, -0.2],
  [0.52, -0.22, 0.65, -0.05],
  [0.64, -0.1, 0.78, 0.15],
  [0.72, 0.05, 0.84, 0.32],
];

function lerpVec(a, b, t) {
  return a.map((v, i) => lerp(v, b[i], clamp(t, 0, 1)));
}

function sampleSeries(series, k) {
  const idx = clamp(k, 0, series.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.min(series.length - 1, lo + 1);
  return lerpVec(series[lo], series[hi], idx - lo);
}

export default {
  viewBox: [468, 224],
  beats: [
    {
      say: 'Pass 0: both models start with the same normalized hidden state from the prelude.',
      state: { k: 0 },
      ms: 3000,
    },
    {
      say: 'Pass 1: naive looping adds full updates; a gated loop writes conservatively first.',
      state: { k: 1 },
      tween: 1000,
      ms: 3200,
    },
    {
      say: 'Pass 2: naive norms keep growing toward saturation, while gated norms stay inside bounds.',
      state: { k: 2 },
      tween: 1000,
      ms: 3400,
    },
    {
      say: 'Pass 3: naive states blow past the trained scale; gated states refine direction without exploding.',
      state: { k: 3 },
      tween: 1000,
      ms: 3800,
    },
  ],
  draw({ k }) {
    let out = '';

    // Left panel: Naive loop
    out += rect(10, 10, 218, 204, 'faint', { rx: 6 });
    out += text(119, 29, 'Un-gated loop (unstable)', 't tc tb');
    out += text(119, 43, 'h ← R(h) directly', 'ts tc tm');

    // Safe scale band
    out += rect(28, 76, 182, 84, 'op', { rx: 3, 'fill-opacity': 0.06, 'stroke-dasharray': '3,3' });
    out += text(206, 87, 'trained scale', 'ts te');
    out += line(28, 118, 210, 118, 'wire', { opacity: 0.45 });

    const vNaive = sampleSeries(NAIVE, k);
    out += bars(62, 118, vNaive, {
      w: 20,
      gap: 8,
      scale: 24,
      cls: 'act solid',
      max: 52,
    });
    const normNaive = Math.sqrt(vNaive.reduce((s, x) => s + x * x, 0)).toFixed(2);
    out += text(119, 198, `‖h‖ = ${normNaive} (grows each pass)`, 'ts tc tm');

    // Right panel: Gated / stabilized loop
    out += rect(240, 10, 218, 204, 'faint', { rx: 6 });
    out += text(349, 29, 'Gated / message loop', 't tc tb');
    out += text(349, 43, 'h ← (1 − g)·h_in + g·R(h)', 'ts tc tm');

    out += rect(258, 76, 182, 84, 'op', { rx: 3, 'fill-opacity': 0.06, 'stroke-dasharray': '3,3' });
    out += text(436, 87, 'trained scale', 'ts te');
    out += line(258, 118, 440, 118, 'wire', { opacity: 0.45 });

    const vGated = sampleSeries(GATED, k);
    out += bars(292, 118, vGated, {
      w: 20,
      gap: 8,
      scale: 24,
      cls: 'act solid',
      max: 52,
    });
    const normGated = Math.sqrt(vGated.reduce((s, x) => s + x * x, 0)).toFixed(2);
    out += text(349, 198, `‖h‖ = ${normGated} (bounded · pass ${Math.round(k)})`, 'ts tc tm');

    return out;
  },
};

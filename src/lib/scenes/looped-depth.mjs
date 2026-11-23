// Looped transformer depth: one shared block of weights runs K times, refining the hidden state
// without storing K separate layers of weights.
import { text, rect, circle, line, path, bars, along, lerp, clamp } from './kit.mjs';

const H0 = [0.3, -0.5, 0.7, -0.2, 0.4, -0.6];
const H1 = [0.55, -0.35, 0.85, 0.15, 0.25, -0.4];
const H2 = [0.8, -0.15, 0.95, 0.45, -0.1, -0.2];
const H3 = [0.95, 0.1, 1.0, 0.7, -0.35, 0.05];

function lerpVec(a, b, t) {
  return a.map((v, i) => lerp(v, b[i], clamp(t, 0, 1)));
}

function sampleState(pass) {
  if (pass <= 1) return lerpVec(H0, H1, clamp(pass, 0, 1));
  if (pass <= 2) return lerpVec(H1, H2, clamp(pass - 1, 0, 1));
  return lerpVec(H2, H3, clamp(pass - 2, 0, 1));
}

export default {
  viewBox: [468, 256],
  beats: [
    {
      say: 'A standard stack stores 3× weights for 3 layers. A looped model stores 1 shared core.',
      state: { pass: 0, dot: 0, outLit: 0 },
      ms: 3600,
    },
    {
      say: 'Pass 1: the token enters Shared Core R and produces an initial hidden state h(1).',
      state: { pass: 1, dot: 0, outLit: 0 },
      tween: 1100,
      ms: 3400,
    },
    {
      say: 'Pass 2: h(1) loops back through the same weights W_R, refining the vector to h(2).',
      state: { pass: 2, dot: 1, outLit: 0 },
      from: { pass: 1, dot: 0, outLit: 0 },
      tween: 1400,
      ms: 3600,
    },
    {
      say: 'Pass 3: another pass sharpens h(3)—3× effective depth from 1× core weights, then Output.',
      state: { pass: 3, dot: 1, outLit: 1 },
      from: { pass: 2, dot: 0, outLit: 0 },
      tween: 1400,
      ms: 4000,
    },
  ],
  draw({ pass, dot, outLit }) {
    let out = '';

    // ---- Left: Standard flat stack ----
    out += rect(10, 10, 166, 236, 'faint', { rx: 6 });
    out += text(93, 28, 'Standard stack', 't tc tb');
    out += text(93, 42, '1 pass per layer', 'ts tc');

    const stdBoxes = [
      { y: 184, label: 'Layer 1', sub: 'W₁' },
      { y: 132, label: 'Layer 2', sub: 'W₂' },
      { y: 80, label: 'Layer 3', sub: 'W₃' },
    ];
    stdBoxes.forEach((b, i) => {
      out += rect(36, b.y, 114, 34, 'wt');
      out += text(93, b.y + 15, b.label, 't tc');
      out += text(93, b.y + 27, b.sub, 'ts tc tm');
      if (i < 2) {
        out += line(93, b.y, 93, b.y - 18, 'wire arrow');
      }
    });
    out += line(93, 80, 93, 56, 'wire arrow');
    out += text(93, 236, 'weights: 3× · depth: 3', 'ts tc tm');

    // ---- Right: Looped stack ----
    out += rect(188, 10, 270, 236, 'faint', { rx: 6 });
    out += text(323, 28, 'Looped transformer', 't tc tb');
    out += text(323, 42, 'shared core × K passes', 'ts tc');

    // Prelude (bottom)
    out += rect(206, 186, 114, 30, 'op');
    out += text(263, 205, 'Prelude (once)', 't tc');

    // Shared Core (middle)
    const coreHot = pass >= 0.5 ? 'wt hot' : 'wt';
    out += rect(206, 116, 114, 46, coreHot);
    out += text(263, 136, 'Shared Core R', 't tc tb');
    out += text(263, 151, 'weights W_R (1×)', 'ts tc tm');

    // Output (top)
    const outCls = outLit > 0.5 ? 'act hot' : 'op';
    out += rect(206, 58, 114, 30, outCls);
    out += text(263, 77, 'Output (once)', 't tc');

    // Upward wires
    out += line(263, 186, 263, 162, 'wire arrow');
    out += line(263, 116, 263, 88, outLit > 0.5 ? 'flow arrow' : 'wire arrow');

    // Loop-back wire around Shared Core (right of core)
    const loopPts = [
      [320, 126],
      [348, 126],
      [348, 152],
      [320, 152],
    ];
    const loopPath = `M${loopPts[0][0]},${loopPts[0][1]} L${loopPts[1][0]},${loopPts[1][1]} L${loopPts[2][0]},${loopPts[2][1]} L${loopPts[3][0]},${loopPts[3][1]}`;
    out += path(loopPath, pass > 1.05 ? 'flow arrow' : 'wire arrow', { opacity: pass > 0.5 ? 1 : 0.4 });
    out += rect(330, 131, 36, 16, 'route solid', { rx: 3 });
    out += text(348, 142, 'gate', 'ts tc');

    // Moving dot along loop when looping (pass > 1)
    if (pass > 1.05 && dot > 0.02 && dot < 0.98) {
      const [dx, dy] = along(loopPts, clamp(dot, 0, 1));
      out += circle(dx, dy, 4.5, 'act solid');
    }

    // Live hidden state vector bars on the far right (always visible)
    const vec = sampleState(pass);
    const vx = 376;
    const vy = 104;
    out += rect(vx - 6, vy - 24, 74, 96, 'act', { rx: 4, 'fill-opacity': 0.08 });
    out += text(vx + 31, vy - 10, `state h(${Math.round(pass)})`, 'ts tc tb act');
    out += line(vx, vy + 32, vx + 62, vy + 32, 'wire', { opacity: 0.4 });
    out += bars(vx + 3, vy + 32, vec, { w: 7, gap: 3, scale: 26, cls: 'act solid', max: 28 });

    // Counters at bottom
    const effDepth = Math.round(clamp(pass, 0, 3));
    const depthLabel = effDepth === 0 ? 'weights: 1× · pass: 0 of 3' : `weights: 1× · pass: ${effDepth} of 3`;
    out += text(323, 236, depthLabel, 'ts tc tm tb');

    return out;
  },
};

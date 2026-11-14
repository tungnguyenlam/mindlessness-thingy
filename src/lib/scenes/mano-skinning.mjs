import { arrow, bars, clamp, circle, group, lerp, line, n, path, rect, text } from './kit.mjs';

function rotPt(px, py, ox, oy, rad) {
  const dx = px - ox;
  const dy = py - oy;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return [ox + dx * c - dy * s, oy + dx * s + dy * c];
}

function fingerGeometry(shapeAmt, bpAmt, bendAmt) {
  // Rest bone lengths & thickness scale with shape β
  const len0 = 56 * (1 + 0.09 * shapeAmt);
  const len1 = 48 * (1 + 0.16 * shapeAmt);
  const len2 = 46 * (1 + 0.15 * shapeAmt);
  const halfH = 11 * (1 + 0.16 * shapeAmt);

  const x0 = 228;
  const y0 = 104;
  const j1xRest = x0 + len0;
  const j2xRest = j1xRest + len1;
  const tipXRest = j2xRest + len2;

  const th1 = bendAmt * (36 * Math.PI) / 180;
  const th2 = bendAmt * (34 * Math.PI) / 180;

  // Compute LBS-skinned mesh for top and bottom contours, with and without pose blend shapes B_P(θ)
  const samples = 30;
  const topPts = [];
  const botPts = [];
  const topPinchPts = [];
  const botPinchPts = [];

  // Joint positions after rotating bones
  const j0 = [x0, y0];
  const j1 = [j1xRest, y0];
  const j2 = rotPt(j2xRest, y0, j1[0], j1[1], th1);
  const [j2pX, j2pY] = j2;
  const tipTemp = rotPt(tipXRest, y0, j1[0], j1[1], th1);
  const tip = rotPt(tipTemp[0], tipTemp[1], j2pX, j2pY, th2);

  const xformBone0 = (rx, ry) => [rx, ry];
  const xformBone1 = (rx, ry) => rotPt(rx, ry, j1[0], j1[1], th1);
  const xformBone2 = (rx, ry) => {
    const p1 = rotPt(rx, ry, j1[0], j1[1], th1);
    return rotPt(p1[0], p1[1], j2pX, j2pY, th2);
  };

  const lbs = (rx, ry, w0, w1, w2) => {
    const p0 = xformBone0(rx, ry);
    const p1 = xformBone1(rx, ry);
    const p2 = xformBone2(rx, ry);
    return [w0 * p0[0] + w1 * p1[0] + w2 * p2[0], w0 * p0[1] + w1 * p1[1] + w2 * p2[1]];
  };

  for (let i = 0; i <= samples; i++) {
    const u = i / samples;
    const rx = lerp(x0, tipXRest, u);
    const taper = rx > j2xRest ? 1 - 0.28 * ((rx - j2xRest) / len2) : 1;
    const hBase = halfH * taper;

    // Smooth blend weights around J1 and J2 over +/-14 px
    const s1 = clamp((rx - (j1xRest - 14)) / 28, 0, 1);
    const s2 = clamp((rx - (j2xRest - 14)) / 28, 0, 1);
    const w2 = s2;
    const w1 = s1 * (1 - s2);
    const w0 = 1 - w1 - w2;

    // Dorsal/knuckle bump correction B_P(theta) restoring volume near joints
    const d1 = Math.exp(-(((rx - j1xRest) / 10) ** 2));
    const d2 = Math.exp(-(((rx - j2xRest) / 9) ** 2));
    const bpTop = bpAmt * (6.4 * d1 + 5.0 * d2);
    const bpBot = bpAmt * (1.8 * d1 + 1.5 * d2);

    topPinchPts.push(lbs(rx, y0 - hBase, w0, w1, w2));
    botPinchPts.push(lbs(rx, y0 + hBase, w0, w1, w2));
    topPts.push(lbs(rx, y0 - hBase - bpTop, w0, w1, w2));
    botPts.push(lbs(rx, y0 + hBase + bpBot, w0, w1, w2));
  }

  const toClosed = (top, bot) => {
    const fwd = top.map(([x, y], idx) => `${idx === 0 ? 'M' : 'L'}${n(x)},${n(y)}`).join(' ');
    const rev = [...bot].reverse().map(([x, y]) => `L${n(x)},${n(y)}`).join(' ');
    return `${fwd} ${rev} Z`;
  };

  return {
    meshPath: toClosed(topPts, botPts),
    pinchPath: toClosed(topPinchPts, botPinchPts),
    joints: [j0, j1, j2, tip],
    bpPts: [
      [j1xRest, y0 - halfH],
      [j2xRest, y0 - halfH],
    ],
  };
}

export default {
  viewBox: [460, 252],
  beats: [
    {
      say: 'Start from a fixed rest template mesh T̄ and neutral joints J(0), with β = 0 and θ = 0.',
      state: { shape: 0, bp: 0, bend: 0, stage: 0 },
    },
    {
      say: 'Shape β adds offsets B_S(β) to scale palm and finger proportions, shifting the regressed joints J(β).',
      state: { shape: 1, bp: 0, bend: 0, stage: 1 },
    },
    {
      say: 'Pose offsets B_P(θ) pre-bulge the vertices around each knuckle so linear skinning will not pinch.',
      state: { shape: 1, bp: 1, bend: 0, stage: 2 },
    },
    {
      say: 'Blend skinning W rotates by θ around J(β): B_P(θ) keeps the knuckle full where plain LBS collapses.',
      state: { shape: 1, bp: 1, bend: 1, stage: 3 },
    },
  ],
  draw({ shape, bp, bend, stage }) {
    const out = [];
    const st = Math.round(clamp(stage, 0, 3));

    // =========================================================================
    // LEFT PIPELINE: β, θ → T̄ + B_S(β) + B_P(θ) → W(..., J(β), θ, W)
    // =========================================================================
    const bCls = st === 1 ? 'act hot' : 'act';
    const tCls = st >= 2 ? 'act hot' : 'act';
    out.push(rect(12, 10, 86, 46, bCls));
    out.push(text(55, 24, 'Shape β', 'ts tb tc'));
    const betaVals = [0.2 + 0.65 * shape, 0.2 - 0.1 * shape, 0.2 + 0.5 * shape, 0.2 + 0.3 * shape];
    out.push(bars(28, 46, betaVals, { w: 10, gap: 4, scale: 14, cls: 'act solid' }));

    out.push(rect(106, 10, 86, 46, tCls));
    out.push(text(149, 24, 'Pose θ (45+3)', 'ts tb tc'));
    const thetaVals = [0.15 + 0.7 * Math.max(bp, bend), 0.15 + 0.55 * Math.max(bp, bend), 0.15 + 0.4 * bend, 0.15 + 0.6 * bend];
    out.push(bars(122, 46, thetaVals, { w: 10, gap: 4, scale: 14, cls: 'act solid' }));

    const s1Cls = st <= 1 ? 'wt hot' : 'wt';
    out.push(rect(12, 74, 180, 44, s1Cls));
    out.push(text(102, 92, '1. Template + shape', 'ts tb tc'));
    out.push(text(102, 108, 'T̄ + B_S(β) → joints J(β)', 'ts tc tm'));

    const s2Cls = st === 2 ? 'wt hot' : 'wt';
    out.push(rect(12, 134, 180, 42, s2Cls));
    out.push(text(102, 151, '2. Pose corrections', 'ts tb tc'));
    out.push(text(102, 166, '+ B_P(θ) around knuckles', 'ts tc tm'));

    const s3Cls = st === 3 ? 'wt hot' : 'wt';
    out.push(rect(12, 192, 180, 48, s3Cls));
    out.push(text(102, 210, '3. Linear blend skinning', 'ts tb tc'));
    out.push(text(102, 226, 'W(..., J(β), θ, W)', 'ts tc tm'));

    out.push(arrow(55, 56, 55, 72, 'wire'));
    out.push(arrow(102, 118, 102, 132, 'wire'));
    out.push(arrow(102, 176, 102, 190, 'wire'));
    out.push(path('M192,34 L199,34 L199,216', 'wire'));
    out.push(arrow(199, 155, 193, 155, 'wire'));
    out.push(arrow(199, 216, 193, 216, 'wire'));

    // =========================================================================
    // RIGHT PANEL: 2D Finger Mesh & Joint Regressor Geometry (x = 208..448)
    // =========================================================================
    out.push(rect(208, 10, 240, 230, 'op'));
    const headers = [
      'Rest template mesh T̄',
      'Shape B_S(β) scales mesh & J(β)',
      'B_P(θ) pre-bulges knuckle mesh',
      'Skinning W(..., θ): smooth bend',
    ];
    out.push(text(328, 28, headers[st], 'ts tb tc'));

    const restG = fingerGeometry(0, 0, 0);
    const curG = fingerGeometry(shape, bp, bend);

    // Ghost rest template T̄ contour when β or θ moves
    if (shape > 0.05 || bend > 0.05 || bp > 0.05) {
      out.push(path(restG.meshPath, 'wire dash', { opacity: 0.45 }));
      out.push(text(250, 86, 'T̄', 'ts tc tm', { opacity: 0.6 }));
    }

    // In Beat 3, show plain LBS (without B_P) as a dashed comparison curve
    if (bend > 0.2) {
      out.push(path(curG.pinchPath, 'ink wire dash', { opacity: 0.65 }));
    }

    // Current deformed MANO surface mesh
    out.push(path(curG.meshPath, 'act', { 'fill-opacity': 0.36 }));

    // Bone chain & regressed joints J(β)
    const [j0, j1, j2, tip] = curG.joints;
    out.push(line(j0[0], j0[1], j1[0], j1[1], 'ink wire'));
    out.push(line(j1[0], j1[1], j2[0], j2[1], 'ink wire'));
    out.push(line(j2[0], j2[1], tip[0], tip[1], 'ink wire'));

    out.push(circle(j0[0], j0[1], 3.2, 'ink solid'));
    out.push(circle(j1[0], j1[1], 3.8, st === 1 ? 'wt solid' : 'ink solid'));
    out.push(circle(j2[0], j2[1], 3.8, st === 1 ? 'wt solid' : 'ink solid'));
    out.push(circle(tip[0], tip[1], 2.8, 'ink solid'));

    // J(β) labels kept comfortably outside the finger contour
    out.push(text(j1[0] - 8, j1[1] + 24, 'J₁(β)', 'ts tc tm'));
    out.push(text(j2[0] - 25 * bend - 8, j2[1] + 22, 'J₂(β)', 'ts tc tm'));

    // Beat 2: explicit upward B_P(θ) displacement vectors at knuckles
    if (bp > 0.1 && bend < 0.4) {
      const op = clamp(bp, 0, 1) * (1 - clamp(bend / 0.4, 0, 1));
      const [b1, b2] = curG.bpPts;
      out.push(
        group(
          arrow(b1[0], b1[1] + 2, b1[0], b1[1] - 15, 'wt') +
            arrow(b2[0], b2[1] + 2, b2[0], b2[1] - 14, 'wt') +
            text((b1[0] + b2[0]) / 2, b1[1] - 22, '+ B_P(θ) bulge', 'ts tb tc'),
          { opacity: op },
        ),
      );
    }

    // Beat 3: call out plain LBS pinch vs B_P bulge recovery
    if (bend > 0.6) {
      const op = clamp((bend - 0.6) / 0.4, 0, 1);
      out.push(
        group(
          text(344, 62, 'plain LBS pinches', 'ts tc') +
            arrow(340, 67, j1[0] + 8, j1[1] - 9, 'wire'),
          { opacity: op },
        ),
      );
    }

    // Bottom status note inside right panel
    out.push(rect(218, 206, 220, 26, 'faint', { rx: 3 }));
    const footText = [
      'Neutral vertex mesh T̄ (15 joints + global)',
      'Joint regressor J(β) moves with shape',
      'Pre-offsets keep joint volume under bend',
      '45 pose + β shape params → mesh M(β, θ)',
    ][st];
    out.push(text(328, 223, footText, 'ts tc'));

    return out.join('');
  },
};

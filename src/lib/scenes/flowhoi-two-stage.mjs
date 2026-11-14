import { clamp, lerp, line, path, rect, text } from './kit.mjs';

function buildCurve(pts) {
  return pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
}

export default {
  viewBox: [460, 266],
  beats: [
    {
      say: 'Stage 1 denoises 50 pre-grasp hand frames on a static object up to t_g = 49.',
      state: { stage: 0, tau1: 1, tau2: 0, maskOn: 0, attn: 0, refine: 0, clampPin: 1 },
      from: { stage: 0, tau1: 0.05, tau2: 0, maskOn: 0, attn: 0, refine: 0, clampPin: 1 },
      tween: 1200,
    },
    {
      say: 'For τ < 0.9, Stage 2 overwrites prefix 0..49 with Stage 1 x^g and clamps t_g.',
      state: { stage: 1, tau1: 1, tau2: 0.45, maskOn: 1, attn: 0, refine: 0, clampPin: 1 },
    },
    {
      say: 'Bidirectional self-attention carries contact at t_g across frames 50..199 as noise drops.',
      state: { stage: 1, tau1: 1, tau2: 0.85, maskOn: 1, attn: 1, refine: 0, clampPin: 1 },
    },
    {
      say: 'For τ ≥ 0.9, the mask lifts (only t_g stays clamped) to smooth velocities across t_g.',
      state: { stage: 2, tau1: 1, tau2: 1, maskOn: 0, attn: 0, refine: 1, clampPin: 1 },
    },
  ],
  draw({ stage, tau1, tau2, maskOn, attn, refine, clampPin }) {
    const out = [];
    const x0 = 26;
    const xTg = 131; // 26 + 0.25 * 420 (frame 49 / 200)
    const xEnd = 446;

    // ---- Top status bar ----
    const headTxt =
      stage === 0
        ? 'Stage 1: static-object grasp prefix'
        : stage === 1
          ? 'Stage 2: subsequence soft inpainting'
          : 'Stage 2: unmasked full-clip refinement';
    out.push(text(x0, 21, headTxt, 't tb'));

    let pillTxt = `τ₁=${tau1.toFixed(2)} · 50 steps`;
    if (stage === 1) pillTxt = `τ₂=${tau2.toFixed(2)} · M active`;
    if (stage === 2) pillTxt = `τ₂=${tau2.toFixed(2)} · M lifted`;
    out.push(rect(310, 8, 136, 18, stage === 2 ? 'act hot' : 'op', { rx: 3 }));
    out.push(text(378, 20, pillTxt, 'ts tb tc tm'));

    // ---- Mask / stage strip over frames 0..199 (y = 36..54) ----
    if (stage === 0) {
      out.push(rect(x0, 36, xTg - x0, 18, 'act hot', { rx: 2 }));
      out.push(text((x0 + xTg) / 2, 48, '0..49 · 108-D', 'ts tb tc tm'));
      out.push(rect(xTg + 2, 36, xEnd - xTg - 2, 18, 'wire dash', { rx: 2, fill: 'none' }));
      out.push(text((xTg + xEnd) / 2, 48, '50..199 · generated in Stage 2', 'ts tc'));
    } else {
      const preCls = maskOn > 0.3 ? 'cache hot' : 'op';
      const preLbl = maskOn > 0.3 ? 'M=0 · paste x^g' : '0..49 · unmasked';
      out.push(rect(x0, 36, xTg - x0, 18, preCls, { rx: 2 }));
      out.push(text((x0 + xTg) / 2, 48, preLbl, 'ts tb tc'));

      const postCls = refine > 0.5 ? 'act hot' : 'act';
      const postLbl =
        refine > 0.5
          ? '50..199 · smooth full 200 × 117-D clip'
          : 'M=1 · denoise 117-D via 3DGS + T5';
      out.push(rect(xTg + 2, 36, xEnd - xTg - 2, 18, postCls, { rx: 2 }));
      out.push(text((xTg + xEnd) / 2, 48, postLbl, 'ts tb tc'));
    }

    // ---- Trajectory plot (y = 62..196) ----
    out.push(rect(x0, 62, xEnd - x0, 134, 'op', { 'fill-opacity': 0.2 }));
    const yBase = 170;
    out.push(line(32, yBase, 440, yBase, 'faint'));
    out.push(text(34, 184, 'static O₀', 'ts'));

    // Mask tint behind prefix 0..49 during Stage 2 soft inpainting
    if (maskOn > 0.1) {
      out.push(
        rect(x0 + 1, 63, xTg - x0 - 1, 132, 'cache solid', {
          rx: 0,
          'fill-opacity': 0.1 * maskOn,
          stroke: 'none',
        }),
      );
    }

    // Sample deterministic curves for hands H_t and object O_t
    const prePts = [];
    const postHandPts = [];
    const postObjPts = [];

    const nAmp1 = (1 - clamp(tau1, 0, 1)) * 16;
    const nAmp2 = stage === 0 ? 0 : (1 - clamp(tau2, 0, 1)) * 22;
    const kink = stage === 0 ? 0 : (1 - clamp(refine, 0, 1)) * 10;

    for (let i = 0; i <= 14; i++) {
      const u = i / 14;
      const x = lerp(x0 + 4, xTg, u);
      const cleanY = lerp(88, 154, Math.sin((u * Math.PI) / 2) ** 1.15);
      const jitter = i === 14 ? 0 : Math.sin(i * 2.7) * nAmp1;
      prePts.push([x, cleanY + jitter]);
    }

    if (stage >= 1) {
      for (let i = 0; i <= 30; i++) {
        const u = i / 30;
        const x = lerp(xTg, xEnd - 4, u);
        // Smooth ease-in lift off the table after t_g (zero kink once mask lifts)
        const lift = Math.sin(u * Math.PI * 0.85) ** 1.25 * 44 + u * 12;
        const cleanObjY = yBase - lift;
        const boundaryOffset = i === 0 ? 0 : Math.exp(-u * 12) * kink;
        const jitterObj = i === 0 ? 0 : Math.cos(i * 2.3) * nAmp2 * 0.65;
        const jitterHand = i === 0 ? 0 : Math.sin(i * 2.9 + 1.1) * nAmp2;

        postObjPts.push([x, clamp(cleanObjY + jitterObj, 88, 174)]);
        postHandPts.push([x, clamp(cleanObjY - 16 + boundaryOffset + jitterHand, 86, 166)]);
      }

      // Object pose curve O_t (flat on prefix, lifted on 50..199)
      out.push(line(x0 + 4, yBase, xTg, yBase, 'cache', { 'stroke-width': 2.5 }));
      out.push(
        path(buildCurve(postObjPts), 'cache', {
          style: 'fill:none;stroke-width:2.5',
        }),
      );
      out.push(text(350, 162, 'object pose O_t', 'ts tb'));

      // Manipulation hand curve H^l, H^r
      out.push(
        path(buildCurve(postHandPts), 'flow', {
          style: 'fill:none;stroke-width:2.4',
        }),
      );
      out.push(text(350, 79, 'hands H^l, H^r', 'ts tb'));
    } else {
      // Static object segment during Stage 1 + faint future hint
      out.push(line(x0 + 4, yBase, xTg, yBase, 'cache', { 'stroke-width': 2.5 }));
      out.push(text(286, 126, 'waiting for Stage 2 + 3DGS', 'ts tc'));
    }

    // Prefix hand curve H^l, H^r (always visible; locked x^g after Stage 1)
    out.push(
      path(buildCurve(prePts), 'flow', {
        style: 'fill:none;stroke-width:2.4',
      }),
    );
    if (stage === 0) {
      out.push(text(74, 82, 'x^g (hands)', 'ts tb tc'));
    }

    // Hard-clamped transition frame line & pin at t_g = 49 (drawn behind attn pill)
    out.push(line(xTg, 64, xTg, 180, clampPin ? 'flow' : 'wire dash'));
    out.push(rect(xTg - 23, 180, 46, 14, 'cache hot', { rx: 2 }));
    out.push(text(xTg, 190, 't_g=49', 'ts tb tc tm'));

    // Bidirectional self-attention arcs across t_g during Beat 2
    if (attn > 0.1) {
      const aOp = attn * 0.85;
      out.push(
        path('M90,124 Q131,84 176,124', 'wire arrow', {
          opacity: aOp,
          style: 'fill:none',
        }),
      );
      out.push(
        path('M176,128 Q131,92 90,128', 'wire arrow', {
          opacity: aOp,
          style: 'fill:none',
        }),
      );
      out.push(rect(83, 70, 96, 15, 'op', { rx: 2, opacity: attn }));
      out.push(text(131, 81, 'bidir self-attn', 'ts tb tc', { opacity: attn }));
    }

    // ---- Bottom two-stage pipeline strip (y = 208..254) ----
    const s1Cls = stage === 0 ? 'act hot' : 'op';
    const s2Cls = stage >= 1 ? 'act hot' : 'op';

    out.push(rect(x0, 208, 156, 46, s1Cls));
    out.push(text(x0 + 78, 226, 'Stage 1 · Grasping DiT', 'ts tb tc'));
    out.push(text(x0 + 78, 241, 'd=256 · BPS, T5(T_g), x_init', 'ts tc'));

    out.push(line(182, 231, 208, 231, 'wire arrow'));
    out.push(text(195, 224, 'x^g', 'ts tb tc tm'));

    out.push(rect(210, 208, 236, 46, s2Cls));
    out.push(text(328, 226, 'Stage 2 · Manipulation DiT', 'ts tb tc'));
    out.push(text(328, 241, 'd=512 · 3DGS + T5(T) → 200 × 117-D', 'ts tc'));

    return out.join('');
  },
};

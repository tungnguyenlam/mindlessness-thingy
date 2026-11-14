import { arrow, bars, clamp, circle, group, lerp, line, path, rect, text } from './kit.mjs';

export default {
  viewBox: [460, 252],
  beats: [
    {
      say: 'Start with a hand grasping object E as seen from Camera pose 1 (Aria smart glasses).',
      state: { cam: 0, local: 0, pack: 0, st: 0 },
    },
    {
      say: 'Move to Camera pose 2 (head turns or robot mount): raw camera coordinates jump across the frame.',
      state: { cam: 1, local: 0, pack: 0, st: 1 },
    },
    {
      say: 'Express both hands in entity E’s local frame (^E T_H = T_E⁻¹ T_H): camera motion cancels out identically.',
      state: { cam: 1, local: 1, pack: 0, st: 2 },
    },
    {
      say: 'Pack type τ, ^REF T_E, local hand poses ^E T_LH and ^E T_RH, and aperture g into a 29-D ICT_k token.',
      state: { cam: 1, local: 1, pack: 1, st: 3 },
    },
  ],
  draw({ cam, local, pack, st }) {
    const out = [];
    const s = Math.round(clamp(st, 0, 3));
    const camT = clamp(cam, 0, 1);
    const locT = clamp(local, 0, 1);
    const pkT = clamp(pack, 0, 1);

    // =========================================================================
    // LEFT ARENA: World hand LH + object E + moving camera (x=12..246, y=10..188)
    // =========================================================================
    out.push(rect(12, 10, 234, 178, 'op'));
    out.push(
      text(
        129,
        26,
        locT < 0.5 ? 'Camera frame vs moving viewpoint' : 'Entity-local frame (T_E⁻¹ T_H)',
        'ts tb tc',
      ),
    );

    // Physical object E (fixed mug/block at center-right of arena)
    const ex = 172;
    const ey = 104;
    out.push(rect(ex - 16, ey - 20, 32, 40, 'wt', { rx: 4 }));
    out.push(circle(ex, ey, 3.2, 'ink solid'));
    out.push(text(ex + 24, ey - 12, 'E', 'ts tb tm'));

    // Physical gripper LH hovering cleanly above-left of E
    const hx = 122;
    const hy = 72;
    // Simple parallel-jaw schematic
    out.push(line(hx - 14, hy - 8, hx, hy, 'ink wire', { 'stroke-width': 2.2 }));
    out.push(line(hx, hy - 7, hx + 10, hy - 7, 'ink wire', { 'stroke-width': 1.8 }));
    out.push(line(hx, hy + 7, hx + 10, hy + 7, 'ink wire', { 'stroke-width': 1.8 }));
    out.push(circle(hx, hy, 3.2, 'ink solid'));
    out.push(text(hx - 14, hy - 14, 'hand LH', 'ts tc'));

    // Camera moving smoothly from Aria view (38, 62) to Robot mount (48, 152)
    const cx = lerp(38, 48, camT);
    const cy = lerp(64, 152, camT);
    const lookAng = Math.atan2(ey - cy, ex - cx);
    const coneDx1 = 36 * Math.cos(lookAng - 0.34);
    const coneDy1 = 36 * Math.sin(lookAng - 0.34);
    const coneDx2 = 36 * Math.cos(lookAng + 0.34);
    const coneDy2 = 36 * Math.sin(lookAng + 0.34);
    out.push(
      path(
        `M${cx.toFixed(1)},${cy.toFixed(1)} L${(cx + coneDx1).toFixed(1)},${(cy + coneDy1).toFixed(1)} M${cx.toFixed(1)},${cy.toFixed(1)} L${(cx + coneDx2).toFixed(1)},${(cy + coneDy2).toFixed(1)}`,
        'wire dash',
        { opacity: 0.65 },
      ),
    );
    out.push(rect(cx - 10, cy - 8, 20, 16, 'act', { rx: 3 }));
    out.push(text(cx, cy + 20, camT < 0.5 ? 'cam 1' : 'cam 2', 'ts tb tc'));

    // Camera-frame measurement dashed rays (fade down once entity-local takes over)
    if (1 - locT > 0.05) {
      out.push(
        group(
          arrow(cx + 10, cy - 2, ex - 18, ey - 2, 'wire dash') +
            arrow(cx + 10, cy - 4, hx - 10, hy + 3, 'wire dash') +
            text(lerp(cx, ex, 0.45), lerp(cy, ey, 0.45) + 14, '^cam T_E', 'ts tc tm'),
          { opacity: 1 - locT * 0.72 },
        ),
      );
    }

    // Entity-local coordinate axes anchored at E + invariant vector ^E T_LH
    if (locT > 0.05) {
      out.push(
        group(
          arrow(ex, ey, ex + 26, ey, 'wt') +
            arrow(ex, ey, ex, ey - 28, 'wt') +
            arrow(ex - 2, ey - 2, hx + 6, hy + 4, 'act') +
            text(160, 144, '^E T_LH = const', 'ts tb tc tm'),
          { opacity: locT },
        ),
      );
    }

    // =========================================================================
    // RIGHT PANEL: Camera vs Local Bars (x=254..448, y=10..188)
    // =========================================================================
    // Card 1: Raw Camera coordinates (shift with camT)
    out.push(rect(254, 10, 194, 82, s === 1 ? 'op hot' : 'op'));
    out.push(text(351, 27, 'Camera frame ^cam T_LH', 'ts tb tc tm'));
    const rawVals = [lerp(0.32, 0.92, camT), lerp(0.84, 0.24, camT), lerp(0.28, 0.78, camT), lerp(0.68, 0.18, camT)];
    out.push(bars(272, 74, rawVals, { w: 18, gap: 8, scale: 34, cls: 'faint solid' }));
    out.push(text(406, 56, camT > 0.5 ? 'shifted!' : 'pose 1', 'ts tb tc'));
    out.push(text(351, 86, 'breaks under viewpoint change', 'ts tc'));

    // Card 2: Entity-local coordinates (LOCKED!)
    out.push(rect(254, 100, 194, 88, s === 2 ? 'act hot' : 'act'));
    out.push(text(351, 117, 'Entity frame ^E T_LH', 'ts tb tc tm'));
    const localVals = [0.64, 0.42, 0.76, 0.52];
    out.push(bars(272, 166, localVals, { w: 18, gap: 8, scale: 34, cls: 'act solid' }));
    out.push(text(406, 148, 'exact lock', 'ts tb tc'));
    out.push(text(351, 180, 'viewpoint-invariant T_E⁻¹ T_LH', 'ts tc'));

    // =========================================================================
    // BOTTOM STRIP: 29-D ICT_k Token Breakdown (x=12..448, y=196..244)
    // =========================================================================
    out.push(rect(12, 196, 436, 48, s === 3 ? 'op hot' : 'op'));
    out.push(text(230, 211, 'Interaction-Centric Token  ICT_k ∈ ℝ²⁹  (20-D single-arm)', 'ts tb tc'));

    const segs = [
      { x: 22, w: 20, lbl: 'τ', cls: 'op' },
      { x: 45, w: 120, lbl: '^REF T_E (9)', cls: 'cache' },
      { x: 168, w: 120, lbl: '^E T_LH (9)', cls: 'act' },
      { x: 291, w: 120, lbl: '^E T_RH (9)', cls: 'act' },
      { x: 414, w: 22, lbl: 'g', cls: 'op' },
    ];
    for (const seg of segs) {
      out.push(
        rect(seg.x, 217, seg.w, 20, seg.cls, {
          rx: 2,
          opacity: lerp(0.55, 1, pkT),
        }),
      );
      out.push(text(seg.x + seg.w / 2, 231, seg.lbl, 'ts tb tc tm'));
    }

    return out.join('');
  },
};

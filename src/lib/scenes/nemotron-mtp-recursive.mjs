import { line, path, rect, text } from './kit.mjs';

export default {
  viewBox: [460, 248],
  beats: [
    {
      say: 'Super 3.5 VL keeps one MTP head (Attn + MoE) and reuses the main LM head.',
      state: { phase: 0, recur: 0, drafts: 1, accept: 0 },
    },
    {
      say: 'Instead of multiple heads, the single head loops recursively, mixing earlier MTP steps.',
      state: { phase: 1, recur: 1, drafts: 7, accept: 0 },
    },
    {
      say: 'SFT, RL, and vision shift the backbone, leaving the warm-up head at 3.787 / 7 accepted.',
      state: { phase: 2, recur: 1, drafts: 7, accept: 3.787 },
    },
    {
      say: 'Post-training MTP boosting re-fits only the draft head, raising acceptance to 4.612 / 7.',
      state: { phase: 3, recur: 1, drafts: 7, accept: 4.612 },
    },
  ],
  draw({ phase, recur, drafts, accept }) {
    const out = [];

    // ---- Top header ----
    out.push(text(16, 20, 'Recursive single-head MTP + boosting', 't tb'));
    const pills = ['1 head · Attn+MoE', 'k recursive steps', 'Backbone shifted', 'Boosted on final'];
    out.push(rect(316, 7, 128, 18, phase === 3 ? 'cache hot' : 'op', { rx: 3 }));
    out.push(text(380, 19, pills[phase] || pills[0], 'ts tb tc tm'));

    // ---- Main architecture boxes (y = 68..120) ----
    const bbCls = phase === 2 ? 'act hot' : 'op';
    out.push(rect(16, 68, 104, 52, bbCls));
    out.push(text(68, 89, '88L Backbone', 't tb tc'));
    out.push(
      text(68, 104, phase >= 2 ? 'SFT + RL + VL' : 'hidden h_t', 'ts tc'),
    );

    out.push(line(120, 94, 154, 94, 'wire arrow'));
    out.push(text(137, 86, 'h_t', 'ts tc tm'));

    const mtpCls = phase === 0 || phase === 1 || phase === 3 ? 'wt hot' : 'wt';
    out.push(rect(156, 68, 126, 52, mtpCls));
    out.push(text(219, 89, '1× MTP Head', 't tb tc'));
    out.push(text(219, 104, '1 Attn + 1 MoE', 'ts tc tm'));

    out.push(line(282, 94, 318, 94, 'wire arrow'));
    out.push(text(300, 86, 's_k', 'ts tc tm'));

    out.push(rect(320, 68, 124, 52, 'wt'));
    out.push(text(382, 89, 'Shared LM Head', 't tb tc'));
    out.push(text(382, 104, 'main vocab proj', 'ts tc'));

    // ---- Recursive self-loop over 1× MTP Head ----
    if (recur > 0.1) {
      const op = recur;
      const loopPath = 'M254,68 L254,44 L184,44 L184,68';
      out.push(path(loopPath, phase === 1 ? 'flow' : 'wire', { opacity: op, style: 'fill:none' }));
      out.push(path(loopPath, 'wire arrow', { opacity: op, style: 'fill:none' }));
      out.push(rect(162, 36, 114, 15, 'op', { rx: 2, opacity: op }));
      out.push(text(219, 47, 'mix earlier steps', 'ts tb tc', { opacity: op }));
    }

    // ---- Super 3 vs 3.5 VL callout card (left-mid, y = 136..174) ----
    out.push(rect(16, 136, 266, 38, 'op'));
    out.push(text(149, 151, 'Super 3 used 2 separate MTP layers', 'ts tc'));
    out.push(text(149, 166, '3.5 VL keeps 1 head and loops it', 'ts tb tc'));

    // ---- 7 Draft tokens under Shared LM Head (y = 138..162) ----
    out.push(line(382, 120, 382, 136, 'wire arrow'));
    const shownCount = Math.round(drafts);
    for (let i = 0; i < 7; i++) {
      const dx = 315 + i * 19;
      let cls = 'op';
      let fillOp = 0.25;
      if (i < shownCount) {
        if (accept > 0) {
          if (i < Math.floor(accept)) {
            cls = 'cache solid';
            fillOp = 0.9;
          } else if (i === Math.floor(accept)) {
            cls = 'cache solid';
            fillOp = 0.45;
          } else {
            cls = 'wire dash';
            fillOp = 0.1;
          }
        } else {
          cls = 'act';
          fillOp = 0.85;
        }
      }
      out.push(rect(dx, 138, 16, 20, cls, { rx: 2, 'fill-opacity': cls === 'wire dash' ? 0 : fillOp }));
      out.push(text(dx + 8, 152, `d${i + 1}`, 'ts tc tm', { opacity: i < shownCount ? 1 : 0.35 }));
    }

    const acceptLabel =
      accept > 0
        ? `accepted: ${accept.toFixed(3)} / 7 (T=1)`
        : drafts > 1
          ? '7 draft steps from 1 head'
          : '1 draft token per pass';
    out.push(
      text(381, 173, acceptLabel, phase === 3 ? 'ts tb tc tm' : 'ts tc tm'),
    );

    // ---- Bottom 3-stage training timeline (y = 192..236) ----
    out.push(rect(16, 192, 134, 44, phase <= 1 ? 'wt hot' : 'op'));
    out.push(text(83, 210, '1. Warm-up (100B)', 'ts tb tc'));
    out.push(text(83, 224, 'backbone frozen', 'ts tc'));

    out.push(line(150, 214, 164, 214, 'wire arrow'));

    out.push(rect(166, 192, 134, 44, phase === 2 ? 'act hot' : 'op'));
    out.push(text(233, 210, '2. Post-train + VL', 'ts tb tc'));
    out.push(text(233, 224, 'backbone shifts', 'ts tc'));

    out.push(line(300, 214, 314, 214, 'wire arrow'));

    out.push(rect(316, 192, 128, 44, phase === 3 ? 'cache hot' : 'op'));
    out.push(text(380, 210, '3. MTP Boost', 'ts tb tc'));
    out.push(text(380, 224, 're-fit → 4.612', 'ts tc tm'));

    return out.join('');
  },
};

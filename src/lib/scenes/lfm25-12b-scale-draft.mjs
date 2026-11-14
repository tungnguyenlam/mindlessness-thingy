import { clamp, lerp, line, rect, text } from './kit.mjs';

export default {
  viewBox: [460, 260],
  beats: [
    {
      say: 'LFM2.5-350M sets the 16-layer hybrid template: 10 gated convs and 6 GQA layers with 8 KV heads.',
      state: { widen: 0, post: 0, dspark: 0, hot: 'start' },
    },
    {
      say: '1.2B-Instruct doubles hidden width (2,048) and Q heads (32) while keeping 8 KV heads (4:1 sharing).',
      state: { widen: 1, post: 0, dspark: 0, hot: 'widen' },
    },
    {
      say: '28T pretraining tokens feed SFT, preference alignment, and multi-stage RL for chat and tool use.',
      state: { widen: 1, post: 1, dspark: 0, hot: 'post' },
    },
    {
      say: 'An optional 296M DSpark drafter verifies candidate tokens in parallel for ~2.1× faster SGLang decode.',
      state: { widen: 1, post: 1, dspark: 1, hot: 'dspark' },
    },
  ],
  draw({ widen, post, dspark, hot }) {
    const out = [];
    const wAmt = clamp(widen, 0, 1);
    const pAmt = clamp(post, 0, 1);
    const sAmt = clamp(dspark, 0, 1);

    // ---- Row 1: Width scaling (350M -> 1.17B) with pinned 8 KV heads ----
    out.push(rect(12, 8, 436, 78, hot === 'widen' ? 'wt hot' : 'op'));
    out.push(text(22, 24, 'Same 16-layer stack (10C + 6A): double width, keep 8 KV heads', 'ts tb'));

    const d = lerp(1024, 2048, wAmt);
    const ffn = lerp(4608, 8192, wAmt);
    const isWide = wAmt >= 0.5;
    const qHeads = isWide ? 32 : 16;
    const group = isWide ? 4 : 2;
    const paramsStr = isWide ? '1.17B (3.3×)' : '350M';

    // Left gauges: d, FFN, total params
    out.push(text(22, 44, 'd', 'ts tb tm'));
    out.push(rect(52, 34, 96, 11, 'op', { rx: 2 }));
    out.push(rect(52, 34, (96 * d) / 2048, 11, 'wt solid', { rx: 2, 'fill-opacity': 0.85 }));
    out.push(text(154, 43, `${Math.round(d)}`, 'ts tb tm'));

    out.push(text(22, 61, 'FFN', 'ts tb tm'));
    out.push(rect(52, 51, 96, 11, 'op', { rx: 2 }));
    out.push(rect(52, 51, (96 * ffn) / 8192, 11, 'wt solid', { rx: 2, 'fill-opacity': 0.85 }));
    out.push(text(154, 60, `${Math.round(ffn)}`, 'ts tb tm'));

    out.push(text(22, 77, `params: ${paramsStr}`, 'ts tb tm'));

    // Divider line
    out.push(line(212, 32, 212, 78, 'faint'));

    // Right: GQA Q -> 8 KV head sharing
    out.push(text(224, 39, `GQA: ${qHeads} Q → 8 KV (${group}:1 group)`, 'ts tb tm'));

    for (let g = 0; g < 8; g++) {
      const gx = 224 + g * 27;
      if (!isWide) {
        for (let k = 0; k < 2; k++) {
          const qx = gx + 1 + k * 12;
          out.push(rect(qx, 44, 9, 8, 'op', { rx: 1.5 }));
          out.push(line(qx + 4.5, 52, gx + 11.5, 62, 'wire'));
        }
      } else {
        for (let k = 0; k < 4; k++) {
          const qx = gx + 0.5 + k * 5.8;
          out.push(rect(qx, 44, 4.5, 8, 'act solid', { rx: 1, 'fill-opacity': 0.8 }));
          out.push(line(qx + 2.2, 52, gx + 11.5, 62, 'wire'));
        }
      }
      out.push(rect(gx + 1, 62, 21, 16, hot === 'widen' ? 'cache hot' : 'cache', { rx: 2 }));
      out.push(text(gx + 11.5, 73, 'KV', 'ts tc tm'));
    }

    // ---- Row 2: Instruct post-training recipe ----
    out.push(rect(12, 96, 436, 56, hot === 'post' ? 'act hot' : 'op'));
    out.push(text(22, 112, '28T pretraining → Instruct chat & tool-use alignment', 'ts tb'));

    const postStages = [
      { x: 22, w: 90, label: '28T pretrain', cls: 'op', op: 0.45 + 0.55 * pAmt },
      { x: 128, w: 60, label: 'SFT', cls: pAmt > 0.5 ? 'act' : 'op', op: 0.35 + 0.65 * pAmt },
      { x: 204, w: 100, label: 'Pref. align', cls: pAmt > 0.5 ? 'act' : 'op', op: 0.35 + 0.65 * pAmt },
      { x: 320, w: 118, label: 'Multi-stage RL', cls: pAmt > 0.5 ? 'act hot' : 'op', op: 0.35 + 0.65 * pAmt },
    ];

    for (let i = 0; i < postStages.length; i++) {
      const s = postStages[i];
      out.push(rect(s.x, 120, s.w, 22, s.cls, { rx: 3, opacity: s.op }));
      out.push(text(s.x + s.w / 2, 134, s.label, 'ts tb tc', { opacity: s.op }));
      if (i < postStages.length - 1) {
        const ax1 = s.x + s.w + 1;
        const ax2 = postStages[i + 1].x - 2;
        if (pAmt > 0.1) out.push(line(ax1, 131, ax2 - 4, 131, 'flow', { opacity: pAmt }));
        out.push(line(ax1, 131, ax2, 131, 'wire arrow', { opacity: 0.35 + 0.65 * pAmt }));
      }
    }

    // ---- Row 3: Optional 296M DSpark speculative drafter ----
    const dOp = 0.35 + 0.65 * sAmt;
    out.push(rect(12, 162, 436, 86, hot === 'dspark' ? 'act hot' : 'op'));
    out.push(text(22, 178, 'Speculative decoding: 296M DSpark drafter', 'ts tb'));
    out.push(text(438, 178, '~2.1× identical output', 'ts tb te', { opacity: dOp }));

    // Draft box
    out.push(rect(22, 192, 138, 44, sAmt > 0.5 ? 'act hot' : 'op', { rx: 3, opacity: dOp }));
    out.push(text(91, 210, 'DSpark (296M)', 'ts tb tc', { opacity: dOp }));
    out.push(text(91, 225, 'proposes draft tokens', 'ts tc', { opacity: dOp }));

    // Arrow 1
    if (sAmt > 0.1) out.push(line(161, 214, 182, 214, 'flow', { opacity: sAmt }));
    out.push(line(161, 214, 187, 214, 'wire arrow', { opacity: dOp }));

    // Verifier box
    out.push(rect(189, 192, 154, 44, sAmt > 0.5 ? 'wt hot' : 'op', { rx: 3, opacity: dOp }));
    out.push(text(266, 210, '1.17B verifier pass', 'ts tb tc', { opacity: dOp }));
    out.push(text(266, 225, 'checks batch in 1 step', 'ts tc', { opacity: dOp }));

    // Arrow 2
    if (sAmt > 0.1) out.push(line(344, 214, 360, 214, 'flow', { opacity: sAmt }));
    out.push(line(344, 214, 364, 214, 'wire arrow', { opacity: dOp }));

    // Result box
    out.push(rect(366, 192, 72, 44, sAmt > 0.5 ? 'act' : 'op', { rx: 3, opacity: dOp }));
    out.push(text(402, 210, 'SGLang', 'ts tb tc', { opacity: dOp }));
    out.push(text(402, 225, '~2.1×', 'ts tb tc tm', { opacity: dOp }));

    return out.join('');
  },
};

import { clamp, lerp, line, path, rect, text } from './kit.mjs';

const LAYERS = [
  { id: 'C1', conv: true },
  { id: 'C2', conv: true },
  { id: '*3', conv: false },
  { id: 'C4', conv: true },
  { id: 'C5', conv: true },
  { id: '*6', conv: false },
  { id: 'C7', conv: true },
  { id: '*8', conv: false },
];

export default {
  viewBox: [460, 264],
  beats: [
    {
      say: 'Most layers are gated convs (C), holding just the last k tokens in a tiny window.',
      state: { ctx: 0, anchor: 0, compare: 0, hot: 'conv' },
    },
    {
      say: 'Sparse GQA layers (*) sit interleaved to carry global recall across the sequence.',
      state: { ctx: 0, anchor: 1, compare: 0, hot: 'anchor' },
    },
    {
      say: 'As context T grows 4×, conv windows stay fixed at k tokens while only GQA KV grows.',
      state: { ctx: 1, anchor: 1, compare: 0, hot: 'grow' },
    },
    {
      say: 'Because conv windows cost almost nothing, hybrid stacks save cache at every T.',
      state: { ctx: 1, anchor: 1, compare: 1, hot: 'save' },
    },
  ],
  draw({ ctx, anchor, compare, hot }) {
    const out = [];
    const tShown = Math.round(lerp(4, 16, clamp(ctx, 0, 1)));

    // ---- Top bar: Stack description & Context dial ----
    out.push(text(12, 20, 'Toy 8-mixer slice: 5 conv (C) + 3 GQA (*)', 'ts tb'));
    out.push(rect(368, 7, 80, 18, hot === 'grow' ? 'act hot' : 'op', { rx: 3 }));
    out.push(text(408, 19, `Context T=${tShown}`, 'ts tb tc tm'));

    // ---- Global recall arc into anchor *3 (visible once anchor > 0.1) ----
    if (anchor > 0.1) {
      const arcOp = anchor * (hot === 'anchor' ? 1 : 0.45);
      const arcCls = hot === 'anchor' ? 'flow' : 'wire';
      out.push(path('M36,48 L36,34 L146,34 L146,48', arcCls, { opacity: arcOp }));
      out.push(path('M36,48 L36,34 L146,34 L146,48', 'wire arrow', { opacity: arcOp }));
      out.push(rect(48, 26, 86, 15, 'op', { rx: 2, opacity: arcOp }));
      out.push(text(91, 37, 'global recall', 'ts tb tc', { opacity: arcOp }));
    }

    // ---- 8 Mixer columns (x = 12 + i * 55, w = 48) ----
    const baseY = 166;
    const kvH = Math.round(lerp(18, 60, ctx));
    const winH = 16;

    for (let i = 0; i < LAYERS.length; i++) {
      const L = LAYERS[i];
      const cx = 12 + i * 55;
      const midX = cx + 24;

      if (i > 0) {
        out.push(line(cx - 7, 65, cx, 65, 'wire'));
      }

      // Layer box (y = 48..82)
      let boxCls = L.conv ? 'op' : 'act';
      if (L.conv && hot === 'conv') boxCls = 'op hot';
      if (!L.conv && (hot === 'anchor' || hot === 'grow')) boxCls = 'act hot';
      out.push(rect(cx, 48, 48, 34, boxCls));
      out.push(text(midX, 63, L.id, 't tb tc tm'));
      out.push(text(midX, 76, L.conv ? 'conv' : 'GQA', 'ts tc'));

      // Baseline for per-layer cache bar
      out.push(line(cx + 4, baseY, cx + 44, baseY, 'faint'));

      if (L.conv) {
        // Optional counterfactual ghost KV bar in Beat 3
        if (compare > 0.15) {
          out.push(
            rect(cx + 6, baseY - kvH, 36, kvH, 'wire dash', {
              rx: 2,
              opacity: compare * 0.7,
            }),
          );
        }
        // Rolling k=3 conv window tray (never grows with T)
        const trayCls = hot === 'conv' || hot === 'grow' ? 'cache hot' : 'cache';
        out.push(rect(cx + 5, baseY - winH, 38, winH, trayCls, { rx: 2 }));
        // 3 individual kernel slots inside the tray
        for (let s = 0; s < 3; s++) {
          const sx = cx + 7 + s * 12;
          const active = 0.45 + 0.25 * s;
          out.push(
            rect(sx, baseY - 12, 10, 8, 'cache solid', {
              rx: 1,
              'fill-opacity': active,
            }),
          );
        }
        out.push(text(midX, baseY - 21, 'k=3', 'ts tc tm'));
        out.push(text(midX, baseY + 12, 'fixed', 'ts tc'));
      } else {
        // GQA attention layer: KV cache grows linearly with T
        const kvCls = hot === 'grow' || hot === 'anchor' ? 'cache hot' : 'cache';
        out.push(rect(cx + 6, baseY - kvH, 36, kvH, kvCls, { rx: 2 }));
        const ticks = Math.max(1, Math.floor(kvH / 11));
        for (let k = 1; k < ticks; k++) {
          const ty = baseY - (kvH * k) / ticks;
          out.push(line(cx + 8, ty, cx + 40, ty, 'faint', { opacity: 0.45 }));
        }
        out.push(text(midX, baseY - kvH / 2 + 4, 'KV', 'ts tb tc tm'));
        out.push(text(midX, baseY + 12, '∝ T', 'ts tb tc tm'));
      }
    }

    // ---- Bottom comparison panel (y = 192..254) ----
    const panelCls = hot === 'save' ? 'op hot' : 'op';
    out.push(rect(12, 192, 436, 62, panelCls));
    out.push(text(22, 206, 'Total sequence cache (conv windows + KV)', 'ts tb'));
    out.push(text(438, 206, 'wins at every T', 'ts te'));

    const barX = 76;
    const allW = Math.round(lerp(80, 272, ctx));
    const convFloorW = 10;
    const hybridKvW = Math.round(lerp(30, 102, ctx));

    // Row 1: All-attention baseline (8 layers of KV)
    out.push(text(22, 223, 'All-Attn', 'ts tb'));
    out.push(
      rect(barX, 213, allW, 12, compare > 0.3 ? 'ink wire dash' : 'faint', {
        rx: 2,
        'stroke-dasharray': '4 2',
        fill: 'none',
      }),
    );
    out.push(text(barX + allW + 8, 223, `8 × KV(${tShown})`, 'ts tm'));

    // Row 2: Hybrid stack (tiny 5×win(3) + 3×KV(T))
    out.push(text(22, 241, 'Hybrid', 'ts tb'));
    out.push(rect(barX, 231, convFloorW, 12, 'op solid', { rx: 1.5 }));
    out.push(rect(barX + convFloorW + 2, 231, hybridKvW, 12, 'cache', { rx: 2 }));
    if (hybridKvW >= 36) {
      out.push(text(barX + convFloorW + 2 + hybridKvW / 2, 241, '3×KV', 'ts tb tc'));
    }
    out.push(
      text(barX + convFloorW + 2 + hybridKvW + 8, 241, `5×win(3) + 3×KV(${tShown})`, 'ts tm'),
    );

    return out.join('');
  },
};

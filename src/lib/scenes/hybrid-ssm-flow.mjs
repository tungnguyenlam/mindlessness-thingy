import { clamp, lerp, line, path, rect, text } from './kit.mjs';

const LAYERS = [
  { id: 'M1', ssm: true },
  { id: 'M2', ssm: true },
  { id: '*3', ssm: false },
  { id: 'M4', ssm: true },
  { id: 'M5', ssm: true },
  { id: 'M6', ssm: true },
  { id: '*7', ssm: false },
  { id: 'M8', ssm: true },
];

export default {
  viewBox: [460, 256],
  beats: [
    {
      say: 'Most layers are Mamba-2 (M), folding past tokens into a constant-size state h_t.',
      state: { ctx: 0, anchor: 0, compare: 0, hot: 'ssm' },
    },
    {
      say: 'Sparse attention anchors (*) keep narrow KV caches for exact distant recall.',
      state: { ctx: 0, anchor: 1, compare: 0, hot: 'anchor' },
    },
    {
      say: 'As context T grows 4×, Mamba states stay flat while only the anchor KV caches grow.',
      state: { ctx: 1, anchor: 1, compare: 0, hot: 'grow' },
    },
    {
      say: 'Mamba starts with a flat state floor, then wins as T grows past an all-attention stack.',
      state: { ctx: 1, anchor: 1, compare: 1, hot: 'save' },
    },
  ],
  draw({ ctx, anchor, compare, hot }) {
    const out = [];
    const tShown = Math.round(lerp(4, 16, clamp(ctx, 0, 1)));

    // ---- Top bar: Stack description & Context dial ----
    out.push(text(12, 20, 'Toy 8-mixer stack: 6 Mamba-2 (M) + 2 anchors (*)', 'ts tb'));
    out.push(rect(368, 7, 80, 18, hot === 'grow' ? 'act hot' : 'op', { rx: 3 }));
    out.push(text(408, 19, `Context T=${tShown}`, 'ts tb tc tm'));

    // ---- Direct lookback arc into anchor *3 (visible once anchor > 0.1) ----
    if (anchor > 0.1) {
      const arcOp = anchor * (hot === 'anchor' ? 1 : 0.45);
      const arcCls = hot === 'anchor' ? 'flow' : 'wire';
      out.push(path('M36,48 L36,34 L146,34 L146,48', arcCls, { opacity: arcOp }));
      out.push(path('M36,48 L36,34 L146,34 L146,48', 'wire arrow', { opacity: arcOp }));
      out.push(rect(52, 26, 80, 15, 'op', { rx: 2, opacity: arcOp }));
      out.push(text(92, 37, 'exact recall', 'ts tb tc', { opacity: arcOp }));
    }

    // ---- 8 Mixer columns (x = 12 + i * 55, w = 48) ----
    const baseY = 162;
    const kvH = Math.round(lerp(16, 56, ctx));
    const ssmH = 18;

    for (let i = 0; i < LAYERS.length; i++) {
      const L = LAYERS[i];
      const cx = 12 + i * 55;
      const midX = cx + 24;

      // Connector wire from previous layer
      if (i > 0) {
        out.push(line(cx - 7, 65, cx, 65, 'wire'));
      }

      // Layer box (y = 48..82)
      let boxCls = L.ssm ? 'op' : 'act';
      if (L.ssm && hot === 'ssm') boxCls = 'op hot';
      if (!L.ssm && (hot === 'anchor' || hot === 'grow')) boxCls = 'act hot';
      out.push(rect(cx, 48, 48, 34, boxCls));
      out.push(text(midX, 63, L.id, 't tb tc tm'));
      out.push(text(midX, 76, L.ssm ? 'SSM' : 'GQA', 'ts tc'));

      // Baseline for per-layer cache bar
      out.push(line(cx + 4, baseY, cx + 44, baseY, 'faint'));

      if (L.ssm) {
        // Optional counterfactual ghost KV bar in Beat 3
        if (compare > 0.15) {
          out.push(
            rect(cx + 6, baseY - kvH, 36, kvH, 'wire dash', {
              rx: 2,
              opacity: compare * 0.7,
            }),
          );
        }
        // Constant-size Mamba state h_t (never grows with T)
        const stateCls = hot === 'ssm' ? 'cache hot' : 'cache';
        out.push(rect(cx + 6, baseY - ssmH, 36, ssmH, stateCls, { rx: 2 }));
        out.push(text(midX, baseY - 5, 'h_t', 'ts tb tc tm'));
        out.push(text(midX, baseY + 12, 'const', 'ts tc'));
      } else {
        // Attention anchor KV cache: grows linearly with T
        const kvCls = hot === 'grow' ? 'cache hot' : 'cache';
        out.push(rect(cx + 6, baseY - kvH, 36, kvH, kvCls, { rx: 2 }));
        // Token slot divider ticks to show per-token storage
        const ticks = Math.max(1, Math.floor(kvH / 11));
        for (let k = 1; k < ticks; k++) {
          const ty = baseY - (kvH * k) / ticks;
          out.push(line(cx + 8, ty, cx + 40, ty, 'faint', { opacity: 0.45 }));
        }
        out.push(text(midX, baseY - kvH / 2 + 4, 'KV', 'ts tb tc tm'));
        out.push(text(midX, baseY + 12, '∝ T', 'ts tb tc tm'));
      }
    }

    // ---- Bottom comparison bars (y = 186..246) ----
    const panelCls = hot === 'save' ? 'op hot' : 'op';
    out.push(rect(12, 186, 436, 60, panelCls));
    out.push(text(22, 200, 'Total sequence cache (state + KV)', 'ts tb'));
    out.push(text(438, 200, 'short T ≈ tie · long T wins', 'ts te'));

    const barX = 76;
    const allW = Math.round(lerp(66, 264, ctx));
    const ssmFloorW = 52;
    const hybridKvW = Math.round(lerp(18, 66, ctx));

    // Row 1: All-attention baseline (8 layers of KV)
    out.push(text(22, 217, 'All-Attn', 'ts tb'));
    out.push(
      rect(barX, 207, allW, 12, compare > 0.3 ? 'route' : 'faint', {
        rx: 2,
        'stroke-dasharray': '4 2',
      }),
    );
    out.push(text(barX + allW + 8, 217, `8 × KV(${tShown})`, 'ts tm'));

    // Row 2: Hybrid stack (constant SSM floor + 2 narrow KV anchors)
    out.push(text(22, 234, 'Hybrid', 'ts tb'));
    out.push(rect(barX, 224, ssmFloorW, 12, 'cache', { rx: 2 }));
    out.push(text(barX + ssmFloorW / 2, 234, 'SSM', 'ts tb tc'));
    out.push(rect(barX + ssmFloorW + 2, 224, hybridKvW, 12, 'cache', { rx: 2 }));
    if (hybridKvW >= 34) {
      out.push(text(barX + ssmFloorW + 2 + hybridKvW / 2, 234, '2×KV', 'ts tb tc'));
    }
    out.push(text(barX + ssmFloorW + hybridKvW + 10, 234, `floor + 2 × KV(${tShown})`, 'ts tm'));

    return out.join('');
  },
};

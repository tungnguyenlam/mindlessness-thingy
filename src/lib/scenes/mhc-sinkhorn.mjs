import { arrow, bars, box, circle, f1, heat, line, path, rect, text } from './kit.mjs';

const X_IN = [
  [1.0, -0.5, 0.8, 0.3],
  [-0.4, 0.9, 0.4, -0.7],
  [0.6, 0.3, -0.8, 0.9],
  [0.3, -0.6, 0.5, 0.6],
];

const C_WEIGHTS = [0.85, 0.55, 0.75, 0.6];
const F_OUT = [0.45, -0.35, 0.5, -0.25];

function sinkhorn(mat, steps) {
  let m = mat.map((r) => r.slice());
  for (let s = 0; s < steps; s++) {
    for (let j = 0; j < 4; j++) {
      let cs = 0;
      for (let i = 0; i < 4; i++) cs += m[i][j];
      for (let i = 0; i < 4; i++) m[i][j] /= cs || 1;
    }
    for (let i = 0; i < 4; i++) {
      const rs = m[i].reduce((a, b) => a + b, 0);
      for (let j = 0; j < 4; j++) m[i][j] /= rs || 1;
    }
  }
  return m;
}

function gainPower(B, layers = 6) {
  let v = [1, 1, 1, 1];
  for (let l = 0; l < layers; l++) {
    v = B.map((row) => row.reduce((acc, w, j) => acc + w * v[j], 0));
  }
  return v.reduce((a, b) => a + b, 0) / 4;
}

const B_RAW = [
  [1.35, 0.1, -0.45, 0.15],
  [0.25, 1.4, 0.35, 0.05],
  [-0.3, 0.4, 1.25, 0.25],
  [0.05, -0.25, 0.3, 1.2],
];

const B_IDENT = [
  [1, 0, 0, 0],
  [0, 1, 0, 0],
  [0, 0, 1, 0],
  [0, 0, 0, 1],
];

const B_UNC = B_RAW.map((row) => row.map((v) => 0.22 * Math.exp(v)));
const B_DS = sinkhorn(B_UNC, 16);

export default {
  viewBox: [460, 266],
  beats: [
    {
      say: 'mHC keeps 4 residual copies while Layer F still reads and returns width d.',
      state: { unc: 0, ds: 0, fMix: 0.4, hot: 'layer' },
    },
    {
      say: 'An unconstrained 4×4 map B lets row and col sums drift, exploding norm over depth.',
      state: { unc: 1, ds: 0, fMix: 0.4, hot: 'unc' },
    },
    {
      say: 'Sinkhorn-Knopp rescales rows and cols to 1, locking B onto doubly stochastic matrices.',
      state: { unc: 0, ds: 1, fMix: 0.4, hot: 'ds' },
    },
    {
      say: 'Doubly stochastic B conserves signal norm across layers while adding C·F back to X′.',
      state: { unc: 0, ds: 1, fMix: 1, hot: 'out' },
    },
  ],
  draw({ unc, ds, fMix, hot }) {
    const out = [];

    const identW = Math.max(0, 1 - unc - ds);
    const B = B_IDENT.map((row, i) =>
      row.map((_, j) => identW * B_IDENT[i][j] + unc * B_UNC[i][j] + ds * B_DS[i][j]),
    );

    const rowSums = B.map((row) => row.reduce((a, b) => a + b, 0));
    const colSums = [0, 1, 2, 3].map((j) => B.reduce((a, row) => a + row[j], 0));
    const g6 = gainPower(B, 6);

    const X_OUT = X_IN.map((_, i) =>
      [0, 1, 2, 3].map((k) => {
        const bx = B[i].reduce((acc, w, j) => acc + w * X_IN[j][k], 0);
        return bx + fMix * C_WEIGHTS[i] * F_OUT[k];
      }),
    );

    // ---- Left column: Residual X_l (4 lanes, x = 10..80, y = 26..158) ----
    out.push(text(45, 18, 'X_l  (4 × d)', 't tb tc'));
    for (let i = 0; i < 4; i++) {
      const ly = 26 + i * 33;
      out.push(rect(10, ly, 70, 27, 'act'));
      out.push(text(16, ly + 17, `s${i + 1}`, 'ts tm'));
      out.push(line(32, ly + 16, 74, ly + 16, 'faint'));
      out.push(bars(34, ly + 16, X_IN[i], { w: 7, gap: 2, scale: 9, max: 11, cls: 'act solid' }));
    }

    // ---- Top center: Layer F path at width d (y = 14..64) ----
    const layerHot = hot === 'layer' ? 'wt hot' : 'wt';
    out.push(arrow(80, 39, 98, 39, 'wire'));
    out.push(box(98, 19, 46, 38, 'A_l', layerHot, '4 → 1'));
    out.push(arrow(144, 38, 164, 38, 'wire'));
    out.push(box(164, 14, 92, 46, 'Layer F', layerHot, 'width d'));
    out.push(arrow(256, 38, 276, 38, 'wire'));
    out.push(box(276, 19, 46, 38, 'C_l', hot === 'out' ? 'wt hot' : 'wt', '1 → 4'));

    // Route from C_l down to + node at (352, 92)
    if (hot === 'out') out.push(path('M322,38 L352,38 L352,80', 'flow'));
    out.push(path('M322,38 L352,38 L352,84', 'wire arrow'));

    // ---- Bottom center: 4x4 Residual map B_l + Sinkhorn sums + Depth gain (x = 98..328, y = 72..212) ----
    const bHot = hot === 'unc' || hot === 'ds' ? 'op hot' : 'op';
    out.push(rect(98, 72, 230, 138, bHot));
    const bTag = unc > 0.5 ? 'unconstrained' : ds > 0.5 ? 'Sinkhorn' : 'identity init';
    out.push(text(108, 88, 'B_l (4×4)', 't tb'));
    out.push(text(318, 88, bTag, 'ts tb te'));

    // 4x4 heatmap grid (cell = 22 -> 88x88 at x = 108..196, y = 102..190)
    const heatNorm = B.map((row) => row.map((v) => Math.min(1, v / 0.9)));
    out.push(heat(108, 102, heatNorm, { cell: 22, role: unc > 0.5 ? 'route' : 'wt' }));
    out.push(rect(108, 102, 88, 88, 'wire', { rx: 2 }));

    // Row sums to the right of grid (x = 204)
    out.push(text(203, 98, 'row ∑', 'ts'));
    for (let i = 0; i < 4; i++) {
      const ok = Math.abs(rowSums[i] - 1) < 0.06;
      out.push(text(204, 117 + i * 22, f1(rowSums[i]), ok ? 'ts tm' : 'ts tb tm route'));
    }

    // Col sums below grid (y = 203, cell pitch 22 -> zero collision!)
    out.push(text(100, 203, '∑', 'ts'));
    for (let j = 0; j < 4; j++) {
      const ok = Math.abs(colSums[j] - 1) < 0.06;
      out.push(text(119 + j * 22, 203, f1(colSums[j]), ok ? 'ts tc tm' : 'ts tb tc tm route'));
    }

    // Right pane inside B_l card: 6-layer gain meter (x = 244..322)
    out.push(line(240, 98, 240, 202, 'faint'));
    out.push(text(284, 108, '6-layer gain', 'ts tc'));
    out.push(rect(274, 116, 20, 60, 'faint', { rx: 2 }));
    const barH = Math.min(58, Math.max(4, g6 * 15));
    const barCls = unc > 0.5 ? 'route solid' : 'wt solid';
    out.push(rect(274, 176 - barH, 20, barH, barCls, { rx: 2 }));
    out.push(line(268, 161, 300, 161, 'wire dash'));
    out.push(text(264, 164, '1×', 'ts te tm'));
    out.push(text(284, 191, `${f1(g6)}×`, unc > 0.5 ? 'ts tb tc tm route' : 'ts tb tc tm'));
    out.push(text(284, 203, unc > 0.5 ? 'exploding!' : 'norm = 1', 'ts tc'));

    // Connect X_l into B_l and B_l into + node
    out.push(arrow(80, 138, 98, 138, 'wire'));
    out.push(path('M328,138 L352,138 L352,100', 'wire arrow'));

    // + node (352, 92) -> Output X_{l+1} (x = 380..450)
    out.push(circle(352, 92, 8, hot === 'out' ? 'op hot' : 'op'));
    out.push(text(352, 96, '+', 't tb tc'));
    out.push(arrow(360, 92, 380, 92, 'wire'));

    // ---- Right column: X_{l+1} (4 lanes, x = 380..450, y = 26..158) ----
    out.push(text(415, 18, 'X′ (4 × d)', 't tb tc'));
    const outCls = hot === 'out' ? 'act hot' : 'act';
    for (let i = 0; i < 4; i++) {
      const ly = 26 + i * 33;
      out.push(rect(380, ly, 70, 27, outCls));
      out.push(text(386, ly + 17, `s${i + 1}`, 'ts tm'));
      out.push(line(402, ly + 16, 444, ly + 16, 'faint'));
      out.push(bars(404, ly + 16, X_OUT[i], { w: 7, gap: 2, scale: 10, max: 11, cls: 'act solid' }));
    }

    // ---- Bottom summary bar (y = 222..254) ----
    out.push(rect(10, 222, 440, 32, 'op'));
    out.push(text(22, 242, 'Layer F runs at single width d', 'ts tb'));
    out.push(text(438, 242, ds > 0.5 ? 'B ∈ Birkhoff → ||B|| ≤ 1' : unc > 0.5 ? 'B unconstrained → ||B|| > 1' : 'n_hc = 4 parallel lanes', 'ts tb te'));

    return out.join('');
  },
};

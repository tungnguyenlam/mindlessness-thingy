import { arrow, bars, box, clamp, f1, heat, lerp, line, path, rect, text } from './kit.mjs';

const TOKENS = ['The', 'fox', 'ran', 'home'];
const DECAY = 0.68;

// Toy 4-dim injected vectors B*x_t per token
const BX = [
  [0.9, -0.3, 0.5, 0.2],
  [-0.4, 0.9, 0.3, -0.5],
  [0.6, 0.2, 0.9, 0.4],
  [-0.2, 0.7, -0.4, 0.95],
];

// Exact recurrent states h_t = DECAY * h_{t-1} + B*x_t
const STATES = [];
for (let t = 0; t < 4; t++) {
  const prev = t === 0 ? [0, 0, 0, 0] : STATES[t - 1];
  STATES.push(prev.map((v, k) => DECAY * v + BX[t][k]));
}

// 4x4 causal SSM decay matrix M[row=t][col=s] = DECAY^(t - s) for s <= t
const M_FULL = Array.from({ length: 4 }, (_, t) =>
  Array.from({ length: 4 }, (_, s) => (s <= t ? Math.pow(DECAY, t - s) : 0)),
);

function interpVec(arrOfVecs, idxFloat) {
  const i0 = Math.floor(clamp(idxFloat, 0, arrOfVecs.length - 1));
  const i1 = Math.min(arrOfVecs.length - 1, i0 + 1);
  const u = clamp(idxFloat - i0, 0, 1);
  return arrOfVecs[0].map((_, k) => lerp(arrOfVecs[i0][k], arrOfVecs[i1][k], u));
}

export default {
  viewBox: [460, 256],
  beats: [
    {
      say: 'At step 1, B injects token x_1 into the fixed-size recurrent state h_1.',
      state: { step: 0, dual: 0, hot: 'inject' },
    },
    {
      say: 'Each new token fades h_{t-1} by A and overwrites the same state in place.',
      state: { step: 2, dual: 0, hot: 'state' },
    },
    {
      say: 'By step 4, h_t still holds just n × d_s numbers while a KV cache would have grown 4×.',
      state: { step: 3, dual: 0, hot: 'mem' },
    },
    {
      say: 'Unrolling the scan forms one lower-triangular matrix Y = M X for parallel training.',
      state: { step: 3, dual: 1, hot: 'dual' },
    },
  ],
  draw({ step, dual, hot }) {
    const out = [];
    const curStep = Math.round(clamp(step, 0, 3));
    const hCur = interpVec(STATES, step);

    // ---- Divider between Decode (left) and Training Dual (right) ----
    out.push(line(238, 12, 238, 244, 'faint'));

    // =========================================================================
    // LEFT PANEL: Recurrent decode (x = 10..228)
    // =========================================================================
    out.push(text(119, 20, 'Decode: fixed recurrent state', 't tb tc'));

    // 4 sequence tokens across top (y = 30..56)
    for (let t = 0; t < 4; t++) {
      const tx = 14 + t * 54;
      const isCur = t === curStep && dual < 0.5;
      const seen = t <= step + 0.2;
      const cls = isCur ? 'act hot' : seen ? 'act' : 'faint';
      out.push(rect(tx, 30, 48, 24, cls));
      out.push(text(tx + 24, 46, `${t + 1}: ${TOKENS[t]}`, 'ts tb tc'));
    }

    // Arrow from active token down into B*x_t -> State h_t
    const tokCx = 14 + curStep * 54 + 24;
    out.push(arrow(tokCx, 54, 118, 72, 'wire'));

    // Recurrent State h_t box (cache role! x = 22..216, y = 74..134)
    const stateCls = hot === 'state' || hot === 'inject' ? 'cache hot' : 'cache';
    out.push(rect(22, 74, 194, 60, stateCls));
    out.push(text(32, 91, `State h_${curStep + 1}  (n × d_s)`, 't tb'));
    out.push(text(206, 91, 'fixed size', 'ts te'));
    out.push(line(32, 114, 126, 114, 'faint'));
    out.push(bars(36, 114, hCur, { w: 16, gap: 5, scale: 12, max: 18, cls: 'cache solid' }));
    out.push(text(136, 108, 'A·h_{t-1}', 'ts tm'));
    out.push(text(136, 122, '+ B·x_t', 'ts tm'));

    // Output y_t readout below h_t (y = 148..178)
    out.push(arrow(119, 134, 119, 148, 'wire'));
    out.push(box(52, 148, 134, 28, `y_${curStep + 1} = Cᵀ h_${curStep + 1}`, 'act'));

    // Memory comparison bar at bottom-left (y = 190..242)
    const memCls = hot === 'mem' ? 'op hot' : 'op';
    out.push(rect(14, 188, 212, 54, memCls));
    out.push(text(24, 204, 'Memory per layer', 'ts tb'));
    // SSM state bar: always 1 slot
    out.push(text(24, 220, 'SSM h', 'ts'));
    out.push(rect(66, 211, 24, 10, 'cache solid', { rx: 2 }));
    out.push(text(98, 220, '1 slot (constant)', 'ts'));
    // KV cache bar: grows with step+1
    out.push(text(24, 235, 'KV', 'ts'));
    out.push(rect(66, 226, 24 * (step + 1), 10, 'faint', { rx: 2, 'stroke-dasharray': '3 2' }));
    out.push(text(184, 235, `${Math.round(step + 1)}×`, 'ts tb tc tm'));

    // =========================================================================
    // RIGHT PANEL: State space duality (x = 248..450)
    // =========================================================================
    out.push(text(349, 20, 'Train: matrix dual  Y = M X', 't tb tc'));

    // Build visible M matrix up to current step (or full batch when dual -> 1)
    const M_VIS = M_FULL.map((row, t) =>
      row.map((v, s) => {
        if (s > t) return 0;
        const rowVis = dual > 0.2 ? 1 : t <= step + 0.05 ? 1 : 0.06;
        return v * rowVis;
      }),
    );

    const matCls = hot === 'dual' ? 'op hot' : 'op';
    out.push(rect(252, 30, 196, 148, matCls));
    out.push(text(262, 46, 'Lower-triangular M', 'ts tb'));
    out.push(text(438, 46, dual > 0.5 ? '1 matmul' : 'row scan', 'ts tb te'));

    // Column labels x1..x4 above M grid
    const gx = 282;
    const gy = 68;
    const cell = 21;
    for (let s = 0; s < 4; s++) {
      out.push(text(gx + s * cell + 10.5, 62, `x${s + 1}`, 'ts tc tm'));
      out.push(text(276, gy + s * cell + 14, `y${s + 1}`, 'ts te tm'));
    }

    out.push(heat(gx, gy, M_VIS, { cell, role: dual > 0.5 ? 'wt' : 'act' }));
    out.push(rect(gx, gy, cell * 4, cell * 4, 'wire', { rx: 2 }));

    // Right legend inside M card
    out.push(text(376, 92, 'A^(t−s)', 'ts tm'));
    out.push(text(376, 108, 'decay', 'ts'));
    out.push(text(376, 128, 'M_{t,s}=0', 'ts tm'));
    out.push(text(376, 142, 'for s > t', 'ts'));

    // Equivalence readout at bottom-right (y = 188..242)
    out.push(rect(252, 188, 196, 54, dual > 0.5 ? 'wt hot' : 'op'));
    out.push(text(350, 207, 'Same exact function:', 'ts tb tc'));
    out.push(text(350, 223, 'Scan  h_t = A h_{t−1} + B x_t', 'ts tc tm'));
    out.push(text(350, 236, 'Batch  Y = M X  (parallel)', 'ts tb tc tm'));

    return out.join('');
  },
};

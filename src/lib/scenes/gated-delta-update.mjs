// Gated DeltaNet: one fixed d_v × d_k state matrix S that tokens write into and queries read from
// (o = S q). Plain linear attention adds v kᵀ, so a second value for the same key blends with the
// first. The delta rule reads the old value S k first and writes only the difference, so the key
// now returns the new value and other keys are untouched. The gate α shrinks the whole state.
// Toy unit-norm keys (orthogonal) and small values; d_k = 4, d_v = 3.
import { text, rect, line, path, group, clamp, f1 } from './kit.mjs';

const KA = [0.6, 0.8, 0, 0];
const KB = [0, 0, 0.8, -0.6];
const VA = [1.0, -0.5, 0.5];
const VA2 = [-0.5, 1.0, 0.0];
const VB = [0.5, 0.5, -1.0];
const DK = 4;
const DV = 3;

const outer = (v, k, w) => v.map((vi) => k.map((kj) => w * vi * kj));
const add = (...ms) => ms[0].map((row, i) => row.map((_, j) => ms.reduce((s, m) => s + m[i][j], 0)));
const mv = (S, q) => S.map((row) => row.reduce((s, x, j) => s + x * q[j], 0));

const TOKENS = {
  none: null,
  A: { k: KA, v: VA, name: 'k_A', vname: 'v_A' },
  B: { k: KB, v: VB, name: 'k_B', vname: 'v_B' },
  A2: { k: KA, v: VA2, name: 'k_A', vname: 'v_A′ (new)' },
};

// Grid geometry
const GX = 168;
const GY = 46;
const C = 38;

function vecCells(x, y, v, vertical, cls) {
  return v
    .map((u, i) => {
      const cx = vertical ? x : x + i * 30;
      const cy = vertical ? y + i * 26 : y;
      return rect(cx, cy, 28, 24, `${cls} solid`, { 'fill-opacity': clamp(Math.abs(u) / 1.2, 0.06, 0.85) }) + text(cx + 14, cy + 16, f1(u), 'ts tc tm');
    })
    .join('');
}

export default {
  viewBox: [460, 280],
  beats: [
    { say: 'The memory is one small matrix S. It starts empty and never grows, however long the text.', state: { wA: 0, wB: 0, lin: 0, del: 0, alpha: 1, tok: 'none', read: 'A', eq: 'S₀ = 0' } },
    { say: 'A token writes its value v under its key k: S gains v kᵀ. Reading with q = k_A returns v_A.', state: { wA: 1, wB: 0, lin: 0, del: 0, alpha: 1, tok: 'A', read: 'A', eq: 'S ← S + v kᵀ' }, tween: 1400, ms: 4200 },
    { say: 'A second token writes under a different key. Reading k_B returns v_B; v_A is still intact.', state: { wA: 1, wB: 1, lin: 0, del: 0, alpha: 1, tok: 'B', read: 'B', eq: 'S ← S + v kᵀ' }, tween: 1400, ms: 4200 },
    { say: 'Now a new value for key A. Plain linear attention just adds it, so k_A returns a blend of old and new.', state: { wA: 1, wB: 1, lin: 1, del: 0, alpha: 1, tok: 'A2', read: 'A', eq: 'linear attention: S ← S + v kᵀ' }, tween: 1400, ms: 4800 },
    { say: 'The delta rule first reads the old value S k, then writes only the difference. k_A now returns the new value.', state: { wA: 1, wB: 1, lin: 0, del: 1, alpha: 1, tok: 'A2', read: 'A', eq: 'delta rule: S ← S + β (v − S k) kᵀ' }, tween: 1600, ms: 5000 },
    { say: 'Key B was not touched by that edit. The delta rule changes one key at a time.', state: { wA: 1, wB: 1, lin: 0, del: 1, alpha: 1, tok: 'A2', read: 'B', eq: 'delta rule: S ← S + β (v − S k) kᵀ' }, tween: 900, ms: 4000 },
    { say: 'The gate α multiplies the whole state first. α near 0 clears every memory at once; α near 1 keeps them.', state: { wA: 1, wB: 1, lin: 0, del: 1, alpha: 0.35, tok: 'A2', read: 'B', eq: 'gated: S ← α S, then the delta step' }, tween: 1800, ms: 5000 },
  ],
  draw({ wA, wB, lin, del, alpha, tok, read, eq }) {
    const S = add(outer(VA, KA, wA), outer(VB, KB, wB), outer(VA2, KA, lin), outer(VA2.map((x, i) => x - VA[i]), KA, del)).map((r) => r.map((x) => alpha * x));
    let out = '';

    // Incoming token
    const t = TOKENS[tok];
    out += text(14, 24, 'incoming token', 'tb');
    if (t) {
      out += text(14, 52, `key ${t.name}`, 'ts');
      out += vecCells(14, 58, t.k, false, 'act');
      out += text(14, 104, `value ${t.vname}`, 'ts');
      out += vecCells(14, 110, t.v, true, 'act');
      out += line(126, 150, GX - 8, 150, 'wire arrow');
      out += text(142, 144, 'write', 'ts tc');
    } else {
      out += text(14, 52, 'none yet', 'ts');
    }

    // State matrix
    out += text(GX + (DK * C) / 2, 24, 'state S: d_v × d_k', 'tb tc');
    out += text(GX + (DK * C) / 2, 38, 'columns: key · rows: value', 'ts tc');
    for (let i = 0; i < DV; i++)
      for (let j = 0; j < DK; j++) {
        const x = S[i][j];
        const keyCol = (read === 'A' ? KA : KB)[j] !== 0;
        out += rect(GX + j * C + 1, GY + i * C + 1, C - 2, C - 2, `cache solid`, { 'fill-opacity': clamp(Math.abs(x) / 1.1, 0.05, 0.9) });
        if (keyCol) out += rect(GX + j * C + 1, GY + i * C + 1, C - 2, C - 2, 'hot', { fill: 'none' });
        out += text(GX + j * C + C / 2, GY + i * C + C / 2 + 4, f1(x), 'tm tc');
      }
    out += text(GX + (DK * C) / 2, GY + DV * C + 16, `outlined: the columns key ${read === 'A' ? 'A' : 'B'} reads`, 'ts tc');
    out += group(text(GX + (DK * C) / 2, GY + DV * C + 32, `whole state scaled by α = ${alpha.toFixed(2)}`, 'ts tc tb'), { opacity: alpha < 0.99 ? 1 : 0 });

    // Readout
    const q = read === 'A' ? KA : KB;
    const o = mv(S, q);
    const target = read === 'A' ? (lin > 0.5 || del > 0.5 ? VA2 : VA) : VB;
    const RX = 344;
    out += text(RX + 54, 24, `read with q = k_${read}`, 'tb tc');
    out += text(RX + 54, 38, 'o = S q (dashed: latest v)', 'ts tc');
    const mid = RX + 36;
    const SC = 32;
    out += line(mid, GY, mid, GY + DV * C, 'wire');
    for (let i = 0; i < DV; i++) {
      const y = GY + i * C + 8;
      const tw = target[i] * SC;
      const x0 = tw > 0 ? mid : mid + tw;
      out += path(`M${x0},${y - 3} h${Math.abs(tw)} v26 h${-Math.abs(tw)} Z`, 'wire', { 'stroke-dasharray': '3 2', opacity: wA });
      const w = clamp(o[i], -1.6, 1.6) * SC;
      out += rect(w > 0 ? mid : mid + w, y, Math.abs(w), 20, 'act solid', { rx: 1 });
      out += text(456, y + 14, f1(o[i]), 'ts tm te');
    }
    const err = Math.hypot(...o.map((x, i) => x - target[i]));
    out += group(text(RX + 54, GY + DV * C + 16, err < 0.05 ? 'matches the latest value' : alpha < 0.99 ? `faded: ${alpha.toFixed(2)} × v_${read}` : `off by ${err.toFixed(2)}: a blend`, `ts tc ${err < 0.05 ? '' : 'tb'}`), { opacity: wA });

    // Equation strip
    out += rect(14, 214, 432, 52, 'faint');
    out += text(230, 236, eq, 'tm tc tb');
    out += text(230, 256, 'toy keys are unit length and orthogonal, so S k returns what was stored under k', 'ts tc');
    return out;
  },
};

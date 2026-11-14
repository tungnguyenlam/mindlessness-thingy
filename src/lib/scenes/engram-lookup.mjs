import { arrow, bars, box, f2, lerp, line, path, rect, text } from './kit.mjs';

const TOKENS = ['1: in', '2: New', '3: York', '4: City'];
const E_CLEAN = [0.85, -0.45, 0.95, 0.55, -0.35, 0.75];
const E_COLLIDE = [-0.75, 0.65, -0.4, 0.85, 0.5, -0.8];

export default {
  viewBox: [460, 256],
  beats: [
    {
      say: 'Compress token ids and group the last n − 1..n tokens into suffix n-grams.',
      state: { lookup: 0, alpha: 0.5, collide: 0, hot: 'ngram' },
    },
    {
      say: 'K hash heads jump in O(1) to prime-sized static tables E and concatenate vector e_t.',
      state: { lookup: 1, alpha: 0.6, collide: 0, hot: 'table' },
    },
    {
      say: 'When h_t matches e_t in context, gate α_t stays near 1 and injects the memory.',
      state: { lookup: 1, alpha: 0.92, collide: 0, hot: 'gate' },
    },
    {
      say: 'When a hash slot collides or misfires, h_t disagrees and α_t drops toward zero.',
      state: { lookup: 1, alpha: 0.07, collide: 1, hot: 'drop' },
    },
  ],
  draw({ lookup, alpha, collide, hot }) {
    const out = [];

    // ---- Top row: Tokens (left) & Hidden state h_t (right) ----
    out.push(text(12, 18, 'Compressed tokens  x′ = P(x)', 'ts tb'));
    for (let i = 0; i < 4; i++) {
      const tx = 12 + i * 74;
      const inSuffix = i >= 2;
      const cls = inSuffix && hot === 'ngram' ? 'act hot' : inSuffix ? 'act' : 'faint';
      out.push(rect(tx, 24, 68, 28, cls));
      out.push(text(tx + 34, 42, TOKENS[i], 'ts tb tc'));
    }

    // Top-right: Hidden state h_t from backbone (x = 322..448, y = 14..54)
    const hCls = hot === 'gate' || hot === 'drop' ? 'act hot' : lookup > 0.5 ? 'act' : 'faint';
    out.push(box(322, 14, 126, 40, 'Hidden state h_t', hCls, 'knows full prompt'));

    // Bracket suffix ("3: York", "4: City") down into Hash heads
    const busCls = hot === 'ngram' ? 'flow' : 'wire';
    out.push(path('M194,52 L194,57 L268,57 L268,52', busCls));
    out.push(path('M231,57 L231,66 L52,66 L52,82', busCls));
    out.push(path('M231,57 L231,66 L52,66 L52,82', 'wire arrow'));
    out.push(rect(78, 57, 130, 18, hot === 'ngram' ? 'op hot' : 'op'));
    out.push(text(143, 69, 'g = (york, city)', 'ts tb tc tm'));

    // ---- Middle Row: Hash heads -> Static Tables E -> e_t -> Gate -> Output ----
    // 1. Hash heads (x = 12..92, y = 82..172)
    out.push(rect(12, 82, 80, 90, hot === 'ngram' ? 'op hot' : 'op'));
    out.push(text(52, 97, 'Hash φ_k', 'ts tb tc'));
    out.push(text(52, 109, 'mul-XOR', 'ts tc'));
    const slots = [1, 3, 2]; // chosen row indices in tables 0, 1, 2
    for (let k = 0; k < 3; k++) {
      const py = 117 + k * 17;
      out.push(rect(20, py, 64, 13, 'faint', { rx: 2 }));
      out.push(text(52, py + 10, `φ_${k + 1} → r${slots[k] + 1}`, 'ts tc tm'));
    }

    // Arrows from Hash heads to Tables
    out.push(arrow(92, 127, 104, 127, 'wire'));

    // 2. Three Static Tables E1..E3 (x = 104..218, y = 78..176)
    const tabCls = hot === 'table' ? 'wt hot' : 'wt';
    out.push(rect(104, 78, 114, 98, tabCls));
    out.push(text(161, 93, 'Static tables E', 'ts tb tc'));
    for (let k = 0; k < 3; k++) {
      const cx = 114 + k * 34;
      out.push(text(cx + 13, 106, `E${k + 1}`, 'ts tc tm'));
      for (let r = 0; r < 4; r++) {
        const ry = 111 + r * 13;
        const isHit = r === slots[k] && lookup > 0.4;
        const isCollideHit = isHit && k === 1 && collide > 0.5;
        const cellCls = isCollideHit ? 'route' : isHit ? 'wt solid' : 'faint';
        out.push(rect(cx, ry, 26, 10, cellCls, { rx: 1.5 }));
      }
    }
    if (collide > 0.5) {
      out.push(text(161, 171, 'collision in E2!', 'ts tb tc route', { opacity: collide }));
    } else {
      out.push(text(161, 171, 'O(1) prefetch', 'ts tc'));
    }

    // 3. Concatenated memory e_t (x = 230..300, y = 88..164)
    out.push(arrow(218, 127, 230, 127, 'wire'));
    const eVec = E_CLEAN.map((v, idx) => lerp(v, E_COLLIDE[idx], collide) * lookup);
    out.push(rect(230, 88, 70, 76, lookup > 0.5 ? 'act' : 'faint'));
    out.push(text(265, 104, 'Memory e_t', 'ts tb tc'));
    out.push(line(238, 134, 292, 134, 'faint'));
    out.push(bars(240, 134, eVec, { w: 6, gap: 2.5, scale: 14, max: 18, cls: collide > 0.5 ? 'route solid' : 'wt solid' }));
    out.push(text(265, 156, 'K·d_mem', 'ts tc tm'));

    // 4. Context-aware Gate alpha_t (x = 316..448, y = 78..146)
    out.push(arrow(300, 114, 316, 114, 'wire'));
    out.push(arrow(385, 54, 385, 78, 'wire'));

    const gateCls = hot === 'gate' || hot === 'drop' ? 'op hot' : lookup > 0.5 ? 'op' : 'faint';
    out.push(rect(316, 78, 132, 68, gateCls));
    out.push(text(382, 95, 'Context gate α_t', 'ts tb tc'));
    out.push(text(382, 109, 'σ(h_t · W_K e_t)', 'ts tc tm'));
    // Meter bar for alpha_t (0..1)
    out.push(rect(328, 117, 108, 10, 'faint', { rx: 2 }));
    if (lookup > 0.2) {
      out.push(rect(328, 117, 108 * alpha, 10, collide > 0.5 ? 'route solid' : 'act solid', { rx: 2, opacity: lookup }));
    }
    const gateLabel = lookup < 0.5
      ? 'waiting for e_t'
      : `α_t = ${f2(alpha)}  (${alpha > 0.5 ? 'keep' : 'drop!'})`;
    const gateLabelCls = lookup >= 0.5 && collide > 0.5 ? 'ts tb tc tm route' : 'ts tb tc tm';
    out.push(text(382, 140, gateLabel, gateLabelCls));

    // 5. Output Y_t = alpha_t * e_t + Conv (x = 316..448, y = 160..210)
    out.push(arrow(382, 146, 382, 160, 'wire'));
    const yVec = eVec.map((v) => v * alpha);
    out.push(rect(316, 160, 132, 50, hot === 'gate' ? 'act hot' : lookup > 0.5 ? 'act' : 'faint'));
    out.push(text(350, 182, 'Output', 'ts tb tc'));
    out.push(text(350, 195, 'α_t·e_t', 'ts tc tm'));
    out.push(line(382, 186, 440, 186, 'faint'));
    out.push(bars(384, 186, yVec, { w: 6, gap: 2.5, scale: 14, max: 16, cls: 'act solid' }));

    // ---- Bottom summary bar (y = 220..248) ----
    out.push(rect(12, 220, 436, 28, 'op'));
    out.push(text(22, 238, 'Static tables in parameters/RAM (never grows with T)', 'ts tb'));
    out.push(text(438, 238, 'O(1) lookup', 'ts tb te'));

    return out.join('');
  },
};

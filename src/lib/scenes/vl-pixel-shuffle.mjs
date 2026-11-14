import { arrow, clamp, lerp, line, rect, text } from './kit.mjs';

export default {
  viewBox: [460, 250],
  beats: [
    {
      say: 'The encoder outputs a 4×4 grid of 16 patch vectors (width d), costing 16×16 attention pairs.',
      state: { merge: 0, proj: 0, attn: 0, hot: 'grid' },
    },
    {
      say: 'Pixel shuffle groups every 2×2 patches and stacks them along width (4d) with no learned weights.',
      state: { merge: 1, proj: 0, attn: 0, hot: 'shuffle' },
    },
    {
      say: 'A small learned MLP projector maps each concatenated 4d token into language-model width d_L.',
      state: { merge: 1, proj: 1, attn: 0, hot: 'mlp' },
    },
    {
      say: 'Reducing tokens by n_merge cuts quadratic self-attention pairs by n_merge² (4× tokens → 16× fewer pairs).',
      state: { merge: 1, proj: 1, attn: 1, hot: 'save' },
    },
  ],
  draw({ merge, proj, attn, hot }) {
    const out = [];
    const m = clamp(merge, 0, 1);
    const a = clamp(attn, 0, 1);

    // ---- 1. Left Card: 4x4 Encoder Patch Grid (x = 12..152, y = 16..204) ----
    const gridCls = hot === 'grid' ? 'act hot' : 'act';
    out.push(rect(12, 16, 140, 188, gridCls));
    out.push(text(82, 33, 'Vision patches', 'ts tb tc'));

    const gx = 26;
    const gy = 44;
    const cell = 25;
    const gap = 3;
    const step = cell + gap;
    // Draw 16 patches grouped visually into 4 quadrants (TL=0, TR=1, BL=2, BR=3)
    const quadOp = [1.0, 0.72, 0.72, 0.45];
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        const q = (r >= 2 ? 2 : 0) + (c >= 2 ? 1 : 0);
        const px = gx + c * step;
        const py = gy + r * step;
        out.push(rect(px, py, cell, cell, 'act', { rx: 2, opacity: m > 0.3 ? quadOp[q] : 0.85 }));
      }
    }
    // 2x2 Quadrant grouping brackets when merge -> 1
    if (m > 0.15) {
      for (let qr = 0; qr < 2; qr++) {
        for (let qc = 0; qc < 2; qc++) {
          const qx = gx + qc * 2 * step - 2;
          const qy = gy + qr * 2 * step - 2;
          out.push(
            rect(qx, qy, 2 * step + 1, 2 * step + 1, 'ink', {
              fill: 'none',
              rx: 3,
              opacity: m * 0.75,
            }),
          );
          out.push(
            text(qx + step, qy + step + 3, `q${qr * 2 + qc + 1}`, 'ts tb tc', {
              opacity: m,
            }),
          );
        }
      }
    }
    out.push(text(82, 174, '4×4 grid: T = 16 × d', 'ts tb tc tm'));
    out.push(text(82, 190, 'before merging', 'ts tc'));

    // Arrow from Vision patches to Pixel shuffle
    if (m > 0.3 && hot === 'shuffle') {
      out.push(line(152, 68, 170, 68, 'flow', { opacity: m }));
    }
    out.push(arrow(152, 68, 170, 68, 'wire'));

    // ---- 2. Middle-Top: Pixel shuffle (x = 170..304, y = 16..118) ----
    const shufCls = hot === 'shuffle' ? 'op hot' : 'op';
    out.push(rect(170, 16, 134, 102, shufCls));
    out.push(text(237, 32, '1. Pixel shuffle', 'ts tb tc'));
    out.push(text(237, 45, 'rearrange 2×2 → width', 'ts tc'));

    for (let q = 0; q < 4; q++) {
      const ry = 53 + q * 12;
      out.push(text(182, ry + 8, `q${q + 1}`, 'ts tm'));
      // 4 concatenated patch slices expand to show 4*d width
      const sliceW = Math.round(lerp(5, 19, m));
      const sliceGap = 2;
      for (let k = 0; k < 4; k++) {
        const sx = 200 + k * (sliceW + sliceGap);
        out.push(rect(sx, ry, sliceW, 9, 'act', { rx: 1.5, opacity: quadOp[q] }));
      }
    }
    out.push(text(237, 112, m > 0.5 ? 'T′ = 4 × (4·d)' : 'waiting to merge...', 'ts tb tc tm'));

    // Arrow from Pixel shuffle down to MLP projector
    if (proj > 0.3 && hot === 'mlp') {
      out.push(line(237, 118, 237, 134, 'flow', { opacity: proj }));
    }
    out.push(arrow(237, 118, 237, 134, 'wire'));

    // ---- 3. Middle-Bottom: MLP projector (x = 170..304, y = 134..204) ----
    const mlpCls = hot === 'mlp' ? 'wt hot' : proj > 0.3 ? 'wt' : 'faint';
    out.push(rect(170, 134, 134, 70, mlpCls));
    out.push(text(237, 150, '2. MLP projector', 'ts tb tc'));
    out.push(text(237, 163, '4·d → d_L (learned)', 'ts tc tm'));
    for (let q = 0; q < 4; q++) {
      const ox = 186 + q * 27;
      out.push(rect(ox, 172, 22, 11, proj > 0.5 ? 'act' : 'faint', { rx: 2 }));
    }
    out.push(text(237, 197, 'T′ = 4 tokens × d_L', 'ts tb tc tm'));

    // Arrow from MLP projector to Attention cost card
    if (a > 0.5 && hot === 'save') {
      out.push(line(304, 169, 322, 169, 'flow', { opacity: a }));
    }
    out.push(arrow(304, 169, 322, 169, 'wire'));

    // ---- 4. Right Card: Quadratic Attention Cost (x = 322..448, y = 16..204) ----
    const attnCls = hot === 'save' ? 'op hot' : 'op';
    out.push(rect(322, 16, 126, 188, attnCls));
    out.push(text(385, 33, 'LM Attention pairs', 'ts tb tc'));

    const mx = 341;
    const my = 46;
    const fullS = 88; // 16 x 5.5px
    const mergedS = 22; // 4 x 5.5px
    // Background ghost for full 16x16 attention matrix
    out.push(rect(mx, my, fullS, fullS, 'faint', { rx: 2, 'stroke-dasharray': '3 2' }));
    for (let k = 1; k < 4; k++) {
      const off = k * 22;
      out.push(line(mx + off, my, mx + off, my + fullS, 'faint', { opacity: 0.45 }));
      out.push(line(mx, my + off, mx + fullS, my + off, 'faint', { opacity: 0.45 }));
    }

    // Active attention area shrinking smoothly from 88x88 (256) to 22x22 (16)
    const curS = lerp(fullS, mergedS, a);
    out.push(rect(mx, my, curS, curS, 'act', { rx: 2 }));
    for (let k = 1; k < 4; k++) {
      const off = (curS * k) / 4;
      out.push(line(mx + off, my, mx + off, my + curS, 'act', { opacity: 0.5 }));
      out.push(line(mx, my + off, mx + curS, my + off, 'act', { opacity: 0.5 }));
    }

    out.push(
      text(385, 155, a > 0.5 ? '4 × 4 = 16 pairs' : '16 × 16 = 256 pairs', 'ts tb tc tm'),
    );
    out.push(
      text(
        385,
        172,
        a > 0.5 ? '16× fewer pairs!' : 'without merging',
        a > 0.5 ? 'ts tb tc act' : 'ts tc',
      ),
    );
    out.push(text(385, 190, '4× smaller KV too', 'ts tc', { opacity: 0.35 + 0.65 * a }));

    // ---- Bottom summary bar (y = 216..242) ----
    out.push(rect(12, 214, 436, 26, 'op'));
    out.push(text(22, 231, 'Tokens: T → T / n_merge', 'ts tb tm'));
    out.push(text(438, 231, 'Attention pairs: ÷ n_merge²', 'ts tb te tm'));

    return out.join('');
  },
};

import { arrow, clamp, group, lerp, rect, text } from './kit.mjs';

export default {
  viewBox: [460, 252],
  beats: [
    {
      say: 'Each request turns images, prompt, and state into a large prefix P and a small action suffix X^k.',
      state: { naive: 0.3, reuse: 0.1, step: 0, st: 0 },
    },
    {
      say: 'Without reuse, all T = 4 Euler steps recompute the heavy observation prefix P from scratch.',
      state: { naive: 1, reuse: 0.15, step: 1, st: 1 },
    },
    {
      say: 'Observation reuse computes prefix P once into cache, then steps only the light suffix head E.',
      state: { naive: 0.35, reuse: 1, step: 1, st: 2 },
    },
    {
      say: 'After T steps produce H actions, the robot runs the first S actions and discards the temporary cache.',
      state: { naive: 0.35, reuse: 1, step: 1, st: 3 },
    },
  ],
  draw({ naive, reuse, step, st }) {
    const out = [];
    const s = Math.round(clamp(st, 0, 3));
    const nOp = clamp(naive, 0.25, 1);
    const rOp = clamp(reuse, 0.1, 1);

    // =========================================================================
    // TOP ARCHITECTURE STRIP (y = 10..56)
    // =========================================================================
    out.push(rect(12, 10, 124, 46, s === 0 ? 'act hot' : 'act'));
    out.push(text(74, 28, 'Observation o', 'ts tb tc'));
    out.push(text(74, 44, 'images · text · state', 'ts tc'));

    out.push(arrow(136, 33, 148, 33, 'wire'));

    const pCls = s === 2 ? 'cache hot' : s >= 2 ? 'cache' : 'wt';
    out.push(rect(150, 10, 152, 46, pCls));
    out.push(text(226, 28, s >= 2 ? 'Cached prefix P' : 'Prefix work P', 'ts tb tc'));
    out.push(text(226, 44, 'K, V / cross-attn feats', 'ts tc'));

    out.push(arrow(302, 33, 314, 33, 'wire'));

    out.push(rect(316, 10, 132, 46, s === 3 ? 'act hot' : 'act'));
    out.push(text(382, 28, 'Action suffix X^k', 'ts tb tc'));
    out.push(text(382, 44, 'H × d_a (T steps)', 'ts tc tm'));

    // =========================================================================
    // ROW 1: WITHOUT REUSE T × (P + E) (y = 66..126)
    // =========================================================================
    const row1Inner = [];
    row1Inner.push(rect(12, 66, 436, 58, s === 1 ? 'op hot' : 'op'));
    row1Inner.push(text(22, 82, 'Without reuse: T × (P + E) — recomputes observation on every step', 'ts tb'));

    const pW = 56;
    const eW = 16;
    for (let k = 0; k < 4; k++) {
      const bx = 22 + k * (pW + eW + 6);
      const showK = clamp(step * 4 - k * 0.7, 0.25, 1);
      row1Inner.push(
        group(
          rect(bx, 91, pW, 24, 'wt', { rx: 2 }) +
            text(bx + pW / 2, 107, 'P', 'ts tb tc tm') +
            rect(bx + pW + 2, 91, eW, 24, 'act', { rx: 2 }) +
            text(bx + pW + 2 + eW / 2, 107, 'E', 'ts tc tm'),
          { opacity: showK },
        ),
      );
    }
    row1Inner.push(text(350, 107, '4× prefix work', 'ts tb'));
    out.push(group(row1Inner.join(''), { opacity: nOp }));

    // =========================================================================
    // ROW 2: WITH OBSERVATION REUSE P + T × E (y = 132..204)
    // =========================================================================
    const row2Inner = [];
    row2Inner.push(rect(12, 132, 436, 72, s >= 2 ? 'op hot' : 'op'));
    row2Inner.push(text(22, 148, 'With observation reuse: P + T × E — prefix computed once per request', 'ts tb'));

    // Cached single P block
    row2Inner.push(rect(22, 158, pW, 28, 'cache hot', { rx: 2 }));
    row2Inner.push(text(22 + pW / 2, 176, 'P (1×)', 'ts tb tc tm'));

    // Arrow into suffix steps
    row2Inner.push(arrow(80, 172, 90, 172, 'wire'));

    // 4 tight E blocks
    for (let k = 0; k < 4; k++) {
      const ex = 92 + k * (eW + 3);
      const showE = clamp(reuse * 1.2 - k * 0.15, 0.2, 1);
      row2Inner.push(
        group(
          rect(ex, 158, eW, 28, 'act', { rx: 2 }) +
            text(ex + eW / 2, 176, `E${k + 1}`, 'ts tb tc tm'),
          { opacity: showE },
        ),
      );
    }

    // Dashed skipped span showing saved 3×P time
    const savedX = 172;
    const savedW = 148;
    row2Inner.push(rect(savedX, 158, savedW, 28, 'wire dash', { rx: 2, fill: 'none', opacity: 0.7 }));
    row2Inner.push(text(savedX + savedW / 2, 176, '3× prefix P skipped', 'ts tc'));

    // Executed chunk horizon S <= H summary on right (x = 330..438)
    const execFrac = s === 3 ? 0.45 : 0;
    row2Inner.push(rect(330, 156, 108, 36, s === 3 ? 'act hot' : 'faint', { rx: 3 }));
    row2Inner.push(text(384, 171, s === 3 ? 'Run S of H steps' : 'Chunk H × d_a', 'ts tb tc'));
    // Horizon bar showing S executed vs (H-S) discarded
    for (let j = 0; j < 6; j++) {
      const hx = 342 + j * 14;
      const isExec = j < 3 && s === 3;
      row2Inner.push(
        rect(hx, 178, 11, 8, isExec ? 'act solid' : 'faint', {
          rx: 1,
          'fill-opacity': lerp(0.25, 0.85, isExec ? 1 : execFrac * 0.2),
        }),
      );
    }

    out.push(group(row2Inner.join(''), { opacity: rOp }));

    // =========================================================================
    // FOOTER SUMMARY BAR (y = 212..242)
    // =========================================================================
    out.push(rect(12, 212, 436, 30, 'faint', { rx: 3 }));
    const foot = [
      'Prefix P depends only on observation o; suffix E depends on noisy chunk X^k',
      'Total latency without reuse = T·(P + E), paying vision + VLM P times',
      'Prefix cache cuts cost to P + T·E (up to T× speedup as steps T grow)',
      'Action chunk A ∈ R^{H×d_a}: robot runs S steps, then requests fresh o',
    ][s];
    out.push(text(230, 231, foot, 'ts tc'));

    return out.join('');
  },
};

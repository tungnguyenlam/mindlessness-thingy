import { clamp, rect, text } from './kit.mjs';

export default {
  viewBox: [460, 252],
  beats: [
    {
      say: 'All C_E = 3 VRAM slots are full when token t misses on E7. E1 is a recurring staple (paused); E9 was routed once.',
      state: { step: 0, ml: 0, hot: 'start' },
    },
    {
      say: 'LRU looks only at largest gap r_t, so it evicts recurring hot expert E1 while keeping one-shot E9.',
      state: { step: 1, ml: 0, hot: 'lru' },
    },
    {
      say: 'FlashMoE feeds [1/r_t, f_t/max(f_t)] into its tiny FFN, spots low-frequency E9 as furthest next use, and evicts E9.',
      state: { step: 1, ml: 1, hot: 'ml' },
    },
    {
      say: 'At step t + 1, routing returns to E1: LRU stalls on an SSD re-fetch while FlashMoE hits in VRAM.',
      state: { step: 2, ml: 1, hot: 'hit' },
    },
  ],
  draw({ step, ml, hot }) {
    const out = [];
    const s = Math.round(clamp(step, 0, 2));
    const useMl = ml > 0.5;

    // ---- Top event bar (y = 8..44) ----
    out.push(rect(12, 8, 436, 34, 'op'));
    out.push(
      text(
        22,
        29,
        s < 2
          ? 'Step t: E7 misses in full VRAM cache (E1 needed next)'
          : 'Step t + 1: Next token routes back to E1',
        'ts tb',
      ),
    );
    out.push(rect(376, 15, 64, 20, s < 2 ? 'route' : 'act', { rx: 3 }));
    out.push(text(408, 29, s < 2 ? 'miss E7' : 'need E1', 'ts tb tc tm'));

    // =========================================================================
    // LEFT PANEL: LRU (Recency only, x = 12..224)
    // =========================================================================
    const lCls = hot === 'lru' ? 'op hot' : 'op';
    out.push(rect(12, 50, 212, 194, lCls));
    out.push(text(118, 67, 'LRU (recency r_t only)', 'ts tb tc'));

    const lruRows =
      s === 0
        ? [
            { id: 'E1', tag: 'staple · r=5', cls: 'cache' },
            { id: 'E4', tag: 'warm · r=2', cls: 'cache' },
            { id: 'E9', tag: '1-shot · r=1', cls: 'cache' },
          ]
        : [
            { id: 'E7', tag: s >= 2 ? 'loaded (E1 gone!)' : 'replaced E1!', cls: 'route' },
            { id: 'E4', tag: 'warm · r=3', cls: 'cache' },
            { id: 'E9', tag: '1-shot · stays', cls: 'cache' },
          ];

    for (let k = 0; k < 3; k++) {
      const ry = 76 + k * 32;
      const row = lruRows[k];
      out.push(rect(22, ry, 192, 26, row.cls, { rx: 3 }));
      out.push(text(32, ry + 17, row.id, 'ts tb tm'));
      out.push(text(204, ry + 17, row.tag, 'ts te tm'));
    }

    // Outcome footer inside LRU panel (y = 178..234)
    const lFootCls = s >= 2 ? 'route hot' : hot === 'lru' ? 'route' : 'faint';
    out.push(rect(22, 178, 192, 56, lFootCls, { rx: 3 }));
    if (s === 0) {
      out.push(text(118, 202, 'Oldest slot = E1 (r=5)', 'ts tc tm'));
      out.push(text(118, 220, 'ignores routing history f_t', 'ts tc'));
    } else if (s === 1) {
      out.push(text(118, 202, 'Evicts hot staple E1!', 'ts tb tc'));
      out.push(text(118, 220, 'wastes slot on 1-shot E9', 'ts tc'));
    } else {
      out.push(text(118, 202, 'MISS on E1 → SSD stall!', 'ts tb tc'));
      out.push(text(118, 220, 're-fetches E1 from disk', 'ts tc'));
    }

    // =========================================================================
    // RIGHT PANEL: FlashMoE ml_cache FFN (x = 236..448)
    // =========================================================================
    const rCls = hot === 'ml' || hot === 'hit' ? 'wt hot' : 'wt';
    out.push(rect(236, 50, 212, 194, rCls));
    out.push(text(342, 67, 'FlashMoE (ml_cache FFN)', 'ts tb tc'));

    const mlRows =
      s === 0 || !useMl
        ? [
            { id: 'E1', tag: 'staple · r=5, hi f', cls: 'cache' },
            { id: 'E4', tag: 'warm · r=2, mid f', cls: 'cache' },
            { id: 'E9', tag: '1-shot · r=1, lo f', cls: 'cache' },
          ]
        : [
            { id: 'E1', tag: s >= 2 ? 'HIT in VRAM!' : 'kept (high f_t)', cls: s >= 2 ? 'cache hot' : 'cache' },
            { id: 'E4', tag: 'warm · r=3', cls: 'cache' },
            { id: 'E7', tag: 'replaced E9!', cls: 'act' },
          ];

    for (let k = 0; k < 3; k++) {
      const ry = 76 + k * 32;
      const row = mlRows[k];
      out.push(rect(246, ry, 192, 26, row.cls, { rx: 3 }));
      out.push(text(256, ry + 17, row.id, 'ts tb tm'));
      out.push(text(428, ry + 17, row.tag, 'ts te tm'));
    }

    // Outcome footer inside FlashMoE panel (y = 178..234)
    const rFootCls = s >= 2 && useMl ? 'cache hot' : useMl ? 'act' : 'faint';
    out.push(rect(246, 178, 192, 56, rFootCls, { rx: 3 }));
    if (!useMl) {
      out.push(text(342, 202, 'Scores [1/r_t, f_t/max(f)]', 'ts tc tm'));
      out.push(text(342, 220, 'predicts next-use distance', 'ts tc'));
    } else if (s === 1) {
      out.push(text(342, 202, 'Evicts 1-shot E9 (MaxDist)', 'ts tb tc'));
      out.push(text(342, 220, 'preserves staple E1 in VRAM', 'ts tc'));
    } else {
      out.push(text(342, 202, 'HIT on E1 in VRAM!', 'ts tb tc'));
      out.push(text(342, 220, 'zero SSD I/O stall', 'ts tc'));
    }

    return out.join('');
  },
};

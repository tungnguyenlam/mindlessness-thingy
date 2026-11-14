import { arrow, clamp, circle, group, heat, line, rect, text } from './kit.mjs';

export default {
  viewBox: [460, 256],
  beats: [
    {
      say: 'Observation o_{t+h} contains both the controllable robot and a moving background distractor.',
      state: { dim: 0, nce: 0, ball: 0, stage: 0 },
    },
    {
      say: 'Dreamer pixel decoder O spends most of its capacity reconstructing bright background pixels.',
      state: { dim: 0, nce: 0, ball: 1, stage: 1 },
    },
    {
      say: 'Contrastive World Model drops decoder O and pairs state-action [s_t, a_{t:t+h}] with M × N local patches.',
      state: { dim: 1, nce: 0.4, ball: 1, stage: 2 },
    },
    {
      say: 'Patch InfoNCE J_I^t maximizes [s_t, a_{t:t+h}]ᵀ W_θ e_{m,n}(o_{t+h}) over negative frames o_b in the batch.',
      state: { dim: 1, nce: 1, ball: 1, stage: 3 },
    },
  ],
  draw({ dim, nce, ball, stage }) {
    const out = [];
    const st = Math.round(clamp(stage, 0, 3));
    const recOp = 1 - clamp(dim, 0, 1);
    const dimOp = clamp(dim, 0, 1);

    // =========================================================================
    // LEFT PANEL: Future observation o_{t+h} as 4x4 spatial patches (x=12..210)
    // =========================================================================
    out.push(rect(12, 10, 198, 236, 'op'));
    out.push(
      text(
        111,
        28,
        dimOp < 0.5 ? 'Future frame o_{t+h} (pixels)' : 'Patches e_{m,n}(o_{t+h}) (M×N)',
        'ts tb tc',
      ),
    );

    const gx = 55;
    const gy = 38;
    const cell = 28; // 4x4 grid = 112x112 (x=55..167, y=38..150)

    // Patch attention / reconstruction highlight matrix
    // Agent occupies (1,1), (2,1), (2,2); background distractor ball moves near (0,3) -> (1,3)
    const patchScores = [
      [0.14, 0.14, 0.16, 0.25],
      [0.14, 0.85, 0.55, 0.22],
      [0.16, 0.90, 0.90, 0.18],
      [0.14, 0.16, 0.14, 0.14],
    ];
    const reconHeat = [
      [0.52, 0.52, 0.55, 0.95],
      [0.52, 0.65, 0.58, 0.88],
      [0.52, 0.65, 0.65, 0.55],
      [0.52, 0.52, 0.52, 0.52],
    ];

    // Grid background: pixel-loss tint in Dreamer, InfoMax patch affinity in CWM
    if (recOp > 0.02) {
      out.push(group(heat(gx, gy, reconHeat, { cell, role: 'op' }), { opacity: recOp * 0.85 }));
    }
    if (dimOp > 0.02) {
      out.push(group(heat(gx, gy, patchScores, { cell, role: 'act' }), { opacity: dimOp }));
    }

    // Crisp 4x4 patch grid lines
    for (let k = 0; k <= 4; k++) {
      out.push(line(gx + k * cell, gy, gx + k * cell, gy + 4 * cell, 'wire', { opacity: 0.45 }));
      out.push(line(gx, gy + k * cell, gx + 4 * cell, gy + k * cell, 'wire', { opacity: 0.45 }));
    }

    // Controllable robot limb inside patches (1,1) -> (2,1) -> (2,2)
    out.push(line(gx + 40, gy + 42, gx + 40, gy + 70, 'ink wire', { 'stroke-width': 3 }));
    out.push(line(gx + 40, gy + 70, gx + 70, gy + 70, 'ink wire', { 'stroke-width': 3 }));
    out.push(circle(gx + 40, gy + 42, 4, 'ink solid'));
    out.push(circle(gx + 40, gy + 70, 4, 'ink solid'));
    out.push(circle(gx + 70, gy + 70, 4, 'ink solid'));
    out.push(text(gx + 52, gy + 94, 'agent (control)', 'ts tc'));

    // Moving background distractor ball in top-right corner
    const bx = gx + 96 - 10 * ball;
    const by = gy + 14 + 22 * ball;
    out.push(circle(bx, by, 7, 'wt solid', { 'fill-opacity': 0.85 }));
    out.push(text(gx + 84, gy + 12, 'distractor', 'ts te'));

    // Context vector box at bottom-left (y=166..234)
    const cCls = st >= 2 ? 'act hot' : 'act';
    out.push(rect(18, 166, 186, 32, cCls));
    out.push(text(111, 180, 'c_t = [s_t, a_{t:t+h}]', 'ts tb tc tm'));
    out.push(text(111, 193, 'posterior state + future actions', 'ts tc'));

    out.push(rect(18, 206, 186, 28, 'wt'));
    out.push(text(111, 224, 'RSSM encoder e & f, R shared', 'ts tc'));

    // =========================================================================
    // RIGHT PANEL: Cross-fade Dreamer Decoder O -> Patch Deep InfoMax J_I^t
    // =========================================================================
    out.push(rect(224, 10, 224, 236, 'op'));

    // --- DREAMER PIXEL RECONSTRUCTION VIEW (Beats 0-1) ---
    if (recOp > 0.02) {
      const g = [];
      g.push(text(336, 28, 'Dreamer: pixel decoder O(o_t | s_t)', 'ts tb tc'));

      g.push(rect(238, 42, 196, 34, st === 1 ? 'wt hot' : 'wt'));
      g.push(text(336, 57, 'Pixel decoder O', 'ts tb tc'));
      g.push(text(336, 70, 'd_s → H × W × 3 RGB pixels', 'ts tc tm'));

      g.push(arrow(336, 76, 336, 94, 'wire'));

      g.push(rect(238, 96, 196, 82, 'op'));
      g.push(text(336, 114, 'Pixel log-likelihood J_O^t', 'ts tb tc'));
      g.push(text(248, 134, 'Background pixels', 'ts'));
      g.push(rect(248, 140, 142, 10, 'wt solid', { rx: 2 }));
      g.push(text(396, 149, 'high', 'ts tm'));

      g.push(text(248, 162, 'Agent limb pixels', 'ts'));
      g.push(rect(248, 168, 36, 8, 'act solid', { rx: 2 }));

      g.push(rect(238, 190, 196, 44, st === 1 ? 'op hot' : 'faint'));
      g.push(text(336, 209, 'Wastes latent bits on', 'ts tb tc'));
      g.push(text(336, 224, 'moving background distractors', 'ts tc'));

      out.push(group(g.join(''), { opacity: recOp }));
    }

    // --- CWM PATCH INFOMAX VIEW (Beats 2-3) ---
    if (dimOp > 0.02) {
      const g = [];
      g.push(text(336, 28, 'CWM: Patch InfoNCE (no decoder)', 'ts tb tc'));

      // Bilinear score card
      g.push(rect(236, 40, 200, 38, st === 2 ? 'wt hot' : 'wt'));
      g.push(text(336, 56, 'Bilinear matrix W_θ', 'ts tb tc'));
      g.push(text(336, 70, 'c_tᵀ W_θ e_{m,n}(o_b)', 'ts tc tm'));

      // Positive vs Negative candidates (InfoNCE)
      g.push(rect(236, 90, 200, 100, st === 3 ? 'op hot' : 'op'));
      g.push(text(336, 106, 'InfoNCE scores per patch (m,n)', 'ts tb tc'));

      const rows = [
        { label: '+ o_{t+h} (pos)', w: 78, cls: 'act solid' },
        { label: '− o_{b1} (neg)', w: 18, cls: 'faint solid' },
        { label: '− o_{b2} (neg)', w: 13, cls: 'faint solid' },
        { label: '− o_{b3} (neg)', w: 22, cls: 'faint solid' },
      ];
      rows.forEach((r, idx) => {
        const ry = 114 + idx * 18;
        g.push(text(244, ry + 11, r.label, 'ts tm'));
        const barW = lerpW(32, r.w, nce);
        g.push(rect(348, ry + 2, barW, 10, r.cls, { rx: 2 }));
      });

      g.push(rect(236, 200, 200, 36, st === 3 ? 'act hot' : 'faint'));
      g.push(text(336, 215, 'Avg over M × N local patches', 'ts tb tc'));
      g.push(text(336, 229, 'ignores unpredictable distractors', 'ts tc'));

      out.push(group(g.join(''), { opacity: dimOp }));
    }

    // Connection arrow between left frame/context and right objective
    out.push(arrow(210, 128, 222, 128, dimOp > 0.5 ? 'act' : 'wire'));

    return out.join('');
  },
};

function lerpW(a, b, t) {
  return a + (b - a) * clamp(t, 0, 1);
}

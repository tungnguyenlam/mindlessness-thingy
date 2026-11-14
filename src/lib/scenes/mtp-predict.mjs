// Multi-token prediction: one shared trunk state h_t feeds n heads predicting t+1, t+2, ..., t+n.
// During training, all n heads sum their cross-entropy losses for a denser learning signal;
// at inference, the extra heads draft future tokens that one trunk pass verifies in parallel.
import { text, rect, line, arrow, group, box, clamp, lerp } from './kit.mjs';

const PROMPT = ['The', 'cat', 'sat'];
const PREDS = ['on', 'the', 'mat'];
const HX = [96, 230, 364];

export default {
  viewBox: [460, 286],
  beats: [
    {
      say: 'Standard next-token training runs one head on h_t: one prediction (t+1) and one loss per step.',
      state: { n: 1, spec: 0, ver: 0 },
      from: { n: 1, spec: 0, ver: 0 },
      tween: 700,
    },
    {
      say: 'Multi-token prediction adds heads for t+2 and t+3 on the same h_t, summing n losses at every position.',
      state: { n: 3, spec: 0, ver: 0 },
      tween: 1200,
      ms: 4200,
    },
    {
      say: 'At inference, those heads draft future tokens in parallel from a single trunk forward pass.',
      state: { n: 3, spec: 1, ver: 0 },
      tween: 1000,
      ms: 4000,
    },
    {
      say: 'One batched verification pass checks all drafts at once, accepting matching tokens without extra trunk steps.',
      state: { n: 3, spec: 1, ver: 1 },
      tween: 1300,
      ms: 4600,
    },
  ],
  draw({ n, spec, ver }) {
    let out = '';

    // Prompt tokens -> Shared trunk -> Hidden state h_t.
    out += text(16, 28, 'context', 'ts');
    PROMPT.forEach((w, i) => {
      const px = 76 + i * 54;
      out += rect(px - 22, 10, 44, 24, i === 2 ? 'act hot' : 'act');
      out += text(px, 26, w, i === 2 ? 'ts tc tb' : 'ts tc');
    });
    out += line(184, 34, 184, 50, 'wire arrow');
    out += box(112, 52, 132, 28, 'Shared trunk', 'wt', 'transformer layers');
    out += arrow(244, 66, 270, 66);
    out += box(272, 52, 86, 28, 'State h_t', 'act', 'width d');

    // Mode tag top-right.
    out += rect(372, 10, 74, 22, spec > 0.5 ? 'cache' : 'route', { rx: 4 });
    out += text(409, 25, spec > 0.5 ? 'inference' : 'training', 'ts tc tb');

    // Fan-out from h_t to the 3 prediction heads.
    HX.forEach((cx, k) => {
      const on = clamp(n - k, 0, 1);
      const isMain = k === 0;
      const op = isMain ? 1 : 0.18 + 0.82 * on;

      // Wire from h_t bottom (315, 80) to head top (cx, 110).
      let g = line(315, 80, cx, 110, on > 0.5 ? 'flow' : 'wire', { opacity: on > 0.5 ? 0.85 : 0.4 });
      // Head box.
      g += box(cx - 54, 112, 108, 28, `Head ${k + 1} (t+${k + 1})`, on > 0.5 ? 'wt hot' : 'wt', 'd → V');
      // Arrow down to predicted token.
      g += line(cx, 140, cx, 156, 'wire arrow');
      g += rect(cx - 42, 158, 84, 26, on > 0.5 ? 'act' : 'faint');
      g += text(cx, 175, `“${PREDS[k]}”`, 'ts tc tb');

      // Verification badge in inference beat.
      if (spec > 0.5 && ver > 0.2) {
        const ok = k < 2;
        const badge = ok ? '✓ accept' : '✗ → “rug”';
        const cls = ok ? 'cache' : 'route';
        g += group(
          rect(cx - 38, 187, 76, 17, cls, { rx: 3 }) + text(cx, 199, badge, 'ts tc tb'),
          { opacity: ver }
        );
      }

      out += group(g, { opacity: op });
    });

    // Bottom panel: Training loss sum vs Speculative verification speedup.
    const BY = 214;
    out += rect(16, BY, 428, 60, 'faint', { rx: 6 });
    if (spec < 0.5) {
      const terms = n > 1.5 ? 'L = L₁(t+1) + L₂(t+2) + L₃(t+3)' : 'L = L₁(t+1)';
      const desc =
        n > 1.5
          ? '3 loss signals per token · shared unembedding, computed one head at a time'
          : '1 loss signal per token · future tokens ignored until their turn';
      out += text(30, BY + 24, terms, 'tb tm act');
      out += text(30, BY + 45, desc, 'ts');
    } else {
      const status = ver > 0.5 ? '3 tokens emitted from 1 trunk verify pass  (“on”, “the”, “rug”)' : '3 draft tokens queued for 1 parallel trunk verification pass';
      out += text(30, BY + 24, ver > 0.5 ? 'self-speculative step: +3 tokens' : 'self-speculative draft: 3 candidates', 'tb tm cache');
      out += text(30, BY + 45, status, 'ts');
    }

    return out;
  },
};

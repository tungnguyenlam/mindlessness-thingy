import { clamp, lerp, line, rect, text } from './kit.mjs';

export default {
  viewBox: [460, 248],
  beats: [
    {
      say: 'Super 3 scales Nano from 52 to 88 layers and 6/128 to 22/512 experts, keeping 32Q / 2KV heads.',
      state: { active: 0, sBar: 1, lBar: 0.25, mBar: 0.2, bBar: 1 },
    },
    {
      say: 'LatentMoE projects routed experts into a 1,024-D bottleneck (4× smaller) while shared expert stays 4,096.',
      state: { active: 1, sBar: 1, lBar: 1, mBar: 0.2, bBar: 1 },
    },
    {
      say: 'Two shared-weight MTP layers let one recursive head draft tokens (3.45 accepted at draft 7).',
      state: { active: 2, sBar: 1, lBar: 1, mBar: 1, bBar: 1 },
    },
    {
      say: 'Pretraining switches from BF16 to NVFP4, keeping the last 15%, latent, MTP, and attention in BF16/MXFP8.',
      state: { active: 3, sBar: 1, lBar: 1, mBar: 1, bBar: 0.25 },
    },
  ],
  draw({ active, sBar, lBar, mBar, bBar }) {
    const out = [];

    // ---- Top bar ----
    out.push(text(16, 20, 'What Super 3 changes over Nano 3', 't tb'));
    const badges = ['Delta 1/4 · Scale', 'Delta 2/4 · LatentMoE', 'Delta 3/4 · MTP', 'Delta 4/4 · NVFP4'];
    out.push(rect(294, 7, 150, 18, 'op', { rx: 3 }));
    out.push(text(369, 19, badges[active] || badges[0], 'ts tb tc tm'));

    // ---- Column headers ----
    out.push(text(99, 42, 'Nemotron 3 Nano', 'ts tb tc'));
    out.push(text(326, 42, 'Nemotron 3 Super', 'ts tb tc'));

    const rows = [
      {
        cls: 'act',
        leftTop: '52L · d=2,688 · 6/128 exp',
        leftSub: '31.6B tot / 3.2B act · 32Q/2KV',
        rightTop: '88L · d=4,096 · 22/512 exp',
        rightSub: '120.6B / 12.7B act · same 32Q/2KV',
        barFrac: lerp(0.25, 0.92, clamp(sBar, 0, 1)),
        barCls: 'act solid',
      },
      {
        cls: 'wt',
        leftTop: 'Standard MoE',
        leftSub: 'routed width = d (2,688)',
        rightTop: 'LatentMoE: 4,096 → 1,024 (4×)',
        rightSub: 'router + shared expert stay 4,096',
        barFrac: lerp(0.92, 0.25, clamp(lBar, 0, 1)),
        barCls: 'wt solid',
      },
      {
        cls: 'cache',
        leftTop: 'No MTP layers',
        leftSub: '1 next-token head only',
        rightTop: '2 shared-weight MTP layers',
        rightSub: '3.45 avg accepted @ draft 7',
        barFrac: lerp(0.18, 0.72, clamp(mBar, 0, 1)),
        barCls: 'cache solid',
      },
      {
        cls: 'act',
        leftTop: 'BF16 training',
        leftSub: '16-bit weights & activations',
        rightTop: 'NVFP4 + BF16 / MXFP8 kept',
        rightSub: 'E2M1×16 + E4M3; last 15%, attn BF16',
        barFrac: clamp(bBar, 0.2, 1),
        barCls: 'act solid',
      },
    ];

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const y = 50 + i * 48;
      const isHot = active === i;
      const op = isHot ? 1 : 0.62;

      out.push(rect(16, y, 166, 43, 'op', { opacity: op }));
      out.push(text(99, y + 16, r.leftTop, 'ts tb tc', { opacity: op }));
      out.push(text(99, y + 30, r.leftSub, 'ts tc', { opacity: op }));

      if (isHot) out.push(line(182, y + 21, 200, y + 21, 'flow'));
      out.push(line(182, y + 21, 206, y + 21, 'wire arrow', { opacity: op }));

      out.push(rect(208, y, 236, 43, isHot ? `${r.cls} hot` : r.cls, { opacity: op }));
      out.push(text(326, y + 15, r.rightTop, 'ts tb tc', { opacity: op }));
      out.push(text(326, y + 28, r.rightSub, 'ts tc', { opacity: op }));

      // Subtle animated gauge bar showing the directional change (scale up, width 4x down, draft up, bits 4x down)
      out.push(rect(218, y + 35, 216, 3, 'faint', { rx: 1.5, opacity: op * 0.6 }));
      out.push(
        rect(218, y + 35, Math.max(8, Math.round(216 * r.barFrac)), 3, r.barCls, {
          rx: 1.5,
          opacity: op,
        }),
      );
    }

    return out.join('');
  },
};

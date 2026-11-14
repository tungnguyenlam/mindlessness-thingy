import { clamp, lerp, line, rect, text } from './kit.mjs';

const TEACHER = ['C', 'C', 'A', 'C', 'C', 'A', 'C', 'C', 'A', 'C', 'A', 'C', 'A', 'C', 'A', 'C'];
const DROPPED = new Set([4, 7]);

export default {
  viewBox: [460, 260],
  beats: [
    {
      say: 'Start from the 350M teacher: 16 layers with 10 gated convolutions and 6 GQA attention layers.',
      state: { cut: 0, narrow: 0, distill: 0, hot: 'start' },
    },
    {
      say: 'LFM2.5-230M drops only two convolution layers, keeping all 6 GQA layers (KV cache count stays 6).',
      state: { cut: 1, narrow: 0, distill: 0, hot: 'drop' },
    },
    {
      say: 'SwiGLU FFN width shrinks 44% from 4,608 to 2,560 while hidden size and heads stay unchanged.',
      state: { cut: 1, narrow: 1, distill: 0, hot: 'ffn' },
    },
    {
      say: 'After 19T pretraining tokens, SFT distillation from 350M, DPO, and multi-domain RL finish the model.',
      state: { cut: 1, narrow: 1, distill: 1, hot: 'distill' },
    },
  ],
  draw({ cut, narrow, distill, hot }) {
    const out = [];
    const cutAmt = clamp(cut, 0, 1);
    const narAmt = clamp(narrow, 0, 1);
    const disAmt = clamp(distill, 0, 1);

    // ---- Row 1: 16L -> 14L layer pruning ----
    out.push(rect(12, 8, 436, 74, hot === 'drop' ? 'act hot' : 'op'));
    const hdr = cutAmt > 0.5 ? 'Student stack: 14 layers (8C + 6A)' : 'Teacher stack: 16 layers (10C + 6A)';
    out.push(text(22, 24, hdr, 'ts tb'));
    out.push(
      text(438, 24, cutAmt > 0.5 ? '2 conv dropped · 6 GQA kept' : '16 total mixers', 'ts te', {
        opacity: 0.75 + 0.25 * cutAmt,
      }),
    );

    const tileW = 22;
    const gap = 4;
    const startX = 24;
    for (let i = 0; i < TEACHER.length; i++) {
      const kind = TEACHER[i];
      const tx = startX + i * (tileW + gap);
      const isDrop = DROPPED.has(i);

      if (isDrop) {
        const op = 1 - 0.72 * cutAmt;
        const cls = cutAmt > 0.4 ? 'wire dash' : 'op';
        out.push(rect(tx, 34, tileW, 24, cls, { rx: 3, opacity: op }));
        out.push(text(tx + tileW / 2, 50, kind, 'ts tb tc tm', { opacity: op }));
        if (cutAmt > 0.4) {
          out.push(line(tx + 4, 38, tx + tileW - 4, 54, 'ink', { opacity: cutAmt * 0.85 }));
          out.push(line(tx + tileW - 4, 38, tx + 4, 54, 'ink', { opacity: cutAmt * 0.85 }));
        }
      } else {
        const isAttn = kind === 'A';
        const cls = isAttn ? (hot === 'drop' ? 'cache hot' : 'cache') : 'op';
        out.push(rect(tx, 34, tileW, 24, cls, { rx: 3 }));
        out.push(text(tx + tileW / 2, 50, kind, 'ts tb tc tm'));
      }
    }

    out.push(text(22, 74, 'same d=1024 · 16Q / 8KV heads', 'ts'));
    out.push(text(438, 74, 'C = gated conv · A = GQA (KV)', 'ts te'));

    // ---- Row 2: FFN width & parameter shrink ----
    const ffn = lerp(4608, 2560, narAmt);
    const params = lerp(350, 230, narAmt);

    out.push(rect(12, 92, 264, 64, hot === 'ffn' ? 'wt hot' : 'op'));
    out.push(text(22, 108, 'SwiGLU FFN width', 'ts tb'));
    out.push(text(266, 108, `${Math.round(ffn)}`, 'ts tb te tm'));

    const ffnTrackW = 244;
    const ffnW = (ffnTrackW * ffn) / 4608;
    out.push(rect(22, 118, ffnTrackW, 13, 'op', { rx: 2 }));
    out.push(rect(22, 118, ffnW, 13, 'wt solid', { rx: 2, 'fill-opacity': 0.85 }));
    out.push(
      text(
        22,
        147,
        narAmt > 0.5 ? 'narrowed 4,608 → 2,560 (−44%)' : 'teacher width: 4,608 (after auto-adjust)',
        'ts',
      ),
    );

    out.push(rect(286, 92, 162, 64, hot === 'ffn' ? 'wt hot' : 'op'));
    out.push(text(296, 108, 'Total params', 'ts tb'));
    out.push(text(438, 108, `${Math.round(params)}M`, 'ts tb te tm'));
    const pTrackW = 142;
    const pW = (pTrackW * params) / 350;
    out.push(rect(296, 118, pTrackW, 13, 'op', { rx: 2 }));
    out.push(rect(296, 118, pW, 13, 'wt solid', { rx: 2, 'fill-opacity': 0.85 }));
    out.push(text(296, 147, narAmt > 0.5 ? '350M → 230M (−34%)' : '350M baseline', 'ts'));

    // ---- Row 3: 19T pretraining + distillation + post-training ----
    out.push(rect(12, 166, 436, 84, hot === 'distill' ? 'act hot' : 'op'));
    out.push(text(22, 182, '19T pretraining (32K ctx) → teacher-distilled post-training', 'ts tb'));

    const stages = [
      { x: 22, w: 86, label: '19T pretrain', sub: '32K ctx ext', cls: 'op', active: 0.4 + 0.6 * disAmt },
      {
        x: 124,
        w: 108,
        label: 'SFT + distill',
        sub: 'from 350M',
        cls: disAmt > 0.5 ? 'act hot' : 'op',
        active: 0.3 + 0.7 * disAmt,
      },
      {
        x: 248,
        w: 76,
        label: 'DPO',
        sub: 'align',
        cls: disAmt > 0.5 ? 'act' : 'op',
        active: 0.3 + 0.7 * disAmt,
      },
      {
        x: 340,
        w: 98,
        label: 'Multi-domain',
        sub: 'RL stage',
        cls: disAmt > 0.5 ? 'act hot' : 'op',
        active: 0.3 + 0.7 * disAmt,
      },
    ];

    for (let i = 0; i < stages.length; i++) {
      const s = stages[i];
      out.push(rect(s.x, 194, s.w, 44, s.cls, { rx: 3, opacity: s.active }));
      out.push(text(s.x + s.w / 2, 212, s.label, 'ts tb tc', { opacity: s.active }));
      out.push(text(s.x + s.w / 2, 227, s.sub, 'ts tc', { opacity: s.active }));

      if (i < stages.length - 1) {
        const ax1 = s.x + s.w + 1;
        const ax2 = stages[i + 1].x - 2;
        if (disAmt > 0.1) {
          out.push(line(ax1, 216, ax2 - 4, 216, 'flow', { opacity: disAmt }));
        }
        out.push(line(ax1, 216, ax2, 216, 'wire arrow', { opacity: 0.35 + 0.65 * disAmt }));
      }
    }

    return out.join('');
  },
};

import { clamp, lerp, line, rect, text } from './kit.mjs';

const BENCHMARKS = [
  { name: 'IFBench', base: 18.2, next: 40.69 },
  { name: 'CaseReport', base: 11.67, next: 32.45 },
  { name: 'BFCLv3', base: 22.95, next: 44.11 },
];

export default {
  viewBox: [460, 250],
  beats: [
    {
      say: 'LFM2.5-350M keeps the exact LFM2 hybrid block: 10 gated conv layers and 6 GQA layers.',
      state: { pre: 0, rl: 0, gain: 0, hot: 'arch' },
    },
    {
      say: 'Instead of changing weights layout, pretraining expands nearly 3× from 10T to 28T tokens.',
      state: { pre: 1, rl: 0, gain: 0, hot: 'pre' },
    },
    {
      say: 'Multi-stage reinforcement learning then sharpens instruction following, extraction, and tool calling.',
      state: { pre: 1, rl: 1, gain: 1, hot: 'rl' },
    },
    {
      say: 'Without growing the 350M footprint, IFBench, CaseReportBench, and BFCLv3 each jump over 20 points.',
      state: { pre: 1, rl: 1, gain: 1, hot: 'gains' },
    },
  ],
  draw({ pre, rl, gain, hot }) {
    const out = [];
    const tokens = lerp(10, 28, clamp(pre, 0, 1));

    // ---- Top strip: Same 350M architecture ----
    out.push(rect(12, 8, 436, 28, hot === 'arch' ? 'wt hot' : 'wt'));
    out.push(text(22, 26, 'Same 350M block: 10 conv + 6 GQA · d=1024', 'ts tb'));
    out.push(rect(326, 12, 114, 20, 'op', { rx: 3 }));
    out.push(text(383, 25, 'layout unchanged', 'ts tc'));

    // ---- Row 2: Training pipeline (10T -> 28T pretrain + RL) ----
    // Pretraining box (x = 12..248, w = 236)
    out.push(rect(12, 46, 236, 62, hot === 'pre' ? 'act hot' : 'op'));
    out.push(text(22, 62, '1. Pretraining tokens', 'ts tb'));
    const tokLabel = pre > 0.7 ? `${Math.round(tokens)}T (2.8×)` : `${Math.round(tokens)}T`;
    out.push(text(238, 62, tokLabel, 'ts tb te tm'));

    const trackX = 22;
    const trackW = 216;
    const baseTickX = trackX + (trackW * 10) / 28;
    const fillW = (trackW * tokens) / 28;

    out.push(rect(trackX, 72, trackW, 12, 'op', { rx: 2 }));
    out.push(rect(trackX, 72, fillW, 12, 'act solid', { rx: 2, 'fill-opacity': 0.85 }));
    out.push(line(baseTickX, 70, baseTickX, 87, 'ink dash', { 'stroke-dasharray': '2 2' }));
    out.push(text(baseTickX, 99, '10T (LFM2)', 'ts tc tm'));
    out.push(text(trackX + trackW, 99, '28T', 'ts te tm', { opacity: pre > 0.5 ? 1 : 0.4 }));

    // Arrow from pretraining to post-training
    if (rl > 0.05) {
      out.push(line(249, 77, 267, 77, 'flow', { opacity: rl }));
    }
    out.push(line(249, 77, 272, 77, 'wire arrow', { opacity: 0.4 + 0.6 * rl }));

    // Post-training box (x = 274..448, w = 174)
    out.push(rect(274, 46, 174, 62, hot === 'rl' ? 'act hot' : 'op'));
    out.push(text(284, 62, '2. Post-training', 'ts tb'));
    out.push(rect(284, 72, 46, 22, 'op', { rx: 3 }));
    out.push(text(307, 87, 'SFT', 'ts tc'));
    out.push(text(337, 87, '+', 'ts tb tc', { opacity: 0.35 + 0.65 * rl }));
    out.push(
      rect(344, 72, 94, 22, rl > 0.5 ? 'act hot' : 'op', {
        rx: 3,
        opacity: 0.3 + 0.7 * rl,
      }),
    );
    out.push(
      text(391, 87, 'Multi-stage RL', 'ts tb tc', {
        opacity: 0.3 + 0.7 * rl,
      }),
    );

    // ---- Row 3: Benchmark jumps ----
    out.push(rect(12, 120, 436, 120, hot === 'gains' ? 'act hot' : 'op'));
    out.push(text(22, 137, 'On-device extraction & tool benchmarks', 'ts tb'));

    // Mini legend top-right
    out.push(rect(322, 128, 8, 8, 'op solid', { rx: 1, 'fill-opacity': 0.25 }));
    out.push(text(334, 136, 'LFM2', 'ts'));
    out.push(rect(376, 128, 8, 8, 'act solid', { rx: 1, 'fill-opacity': 0.85 }));
    out.push(text(388, 136, 'LFM2.5', 'ts'));

    const barX = 114;
    const maxW = 205; // 50 pts = 205px

    for (let i = 0; i < BENCHMARKS.length; i++) {
      const b = BENCHMARKS[i];
      const ry = 152 + i * 28;
      const cur = lerp(b.base, b.next, clamp(gain, 0, 1));
      const baseW = (b.base / 50) * maxW;
      const curW = (cur / 50) * maxW;
      const delta = cur - b.base;

      out.push(text(22, ry + 12, b.name, 'ts tb'));
      out.push(rect(barX, ry, maxW, 15, 'op', { rx: 2 }));
      // LFM2 baseline portion
      out.push(rect(barX, ry, baseW, 15, 'op solid', { rx: 2, 'fill-opacity': 0.22 }));
      // LFM2.5 extension on top of LFM2
      if (curW > baseW + 0.5) {
        out.push(rect(barX + baseW, ry, curW - baseW, 15, 'act solid', { rx: 1, 'fill-opacity': 0.88 }));
      }
      out.push(line(barX + baseW, ry - 1, barX + baseW, ry + 16, 'ink dash', { 'stroke-dasharray': '2 2' }));

      out.push(text(barX + maxW + 10, ry + 12, cur.toFixed(2), 'ts tb tm'));
      if (delta >= 0.5) {
        out.push(text(438, ry + 12, `(+${delta.toFixed(1)})`, 'ts tb te tm'));
      }
    }

    return out.join('');
  },
};

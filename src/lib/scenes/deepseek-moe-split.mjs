// DeepSeekMoE: (1) fine-grained segmentation splits N coarse experts into mN narrower experts
// while activating mK of them, keeping parameters and compute fixed while multiplying combinations;
// (2) shared experts run for every token so routed experts do not waste capacity relearning common facts.
// Toy numbers: 4 coarse -> 16 fine (m = 4), then 2 shared + 14 routed (2 active).
import { text, rect, line, group, clamp, lerp } from './kit.mjs';

const WORDS = ['The', 'cat', 'sat'];
const N_FINE = 16;
const EY = 94;
const EH = 38;

// Active indices per beat/token:
// - coarse: group 1 (slots 4..7) active
// - fine split: 4 scattered slots [1, 5, 10, 14] active
// - shared + routed per token: shared [0, 1] ALWAYS active + routed pair per token
const ROUTED_PICKS = [
  [4, 11],
  [2, 13],
  [6, 9],
];

export default {
  viewBox: [460, 286],
  beats: [
    {
      say: 'Standard MoE holds a few wide experts (4 here) and routes each token to top-1: only 4 choices exist.',
      state: { split: 0, sh: 0, tok: 0 },
      from: { split: 0, sh: 0, tok: 0 },
      tween: 700,
    },
    {
      say: 'Fine-grained MoE slices each expert into 4 narrower pieces (16 total) and activates 4: same FLOPs, 1,820 mixes.',
      state: { split: 1, sh: 0, tok: 0 },
      tween: 1300,
      ms: 4400,
    },
    {
      say: 'Shared experts handle common facts: S1–S2 run on every token, leaving the router to split the rest.',
      state: { split: 1, sh: 1, tok: 0 },
      tween: 1300,
      ms: 4200,
    },
    {
      say: 'Every token runs the same S1–S2 and picks its own routed pair, so specialists stop duplicating common facts.',
      state: { split: 1, sh: 1, tok: 2.0 },
      tween: 3400,
      linear: true,
      ms: 4600,
    },
  ],
  draw({ split, sh, tok }) {
    let out = '';

    // Token strip at top.
    const tIdx = clamp(Math.round(tok), 0, WORDS.length - 1);
    const tx = (i) => 176 + i * 56;
    out += text(16, 26, 'token', 'ts');
    WORDS.forEach((w, i) => {
      const cur = i === tIdx;
      out += rect(tx(i) - 22, 10, 44, 22, cur ? 'act hot' : 'act', { opacity: cur ? 1 : 0.45 });
      out += text(tx(i), 25, w, cur ? 'ts tc tb' : 'ts tc', { opacity: cur ? 1 : 0.55 });
    });

    // Router box (points to routed lane).
    const routerX = lerp(230, 272, sh);
    out += line(tx(tIdx), 32, routerX, 46, 'wire arrow');
    out += rect(routerX - 48, 46, 96, 22, 'route') + text(routerX, 61, sh > 0.5 ? 'router (top-2)' : split > 0.5 ? 'router (top-4)' : 'router (top-1)', 'ts tc tb');

    // Shared bypass arrow when sh > 0 (routed cleanly above the router along the left side).
    if (sh > 0.05) {
      out += line(tx(0) - 24, 21, 46, 21, 'flow', { opacity: sh });
      out += line(46, 21, 46, 76, 'flow arrow', { opacity: sh });
      out += text(54, 52, 'always on', 'ts tb cache', { opacity: sh });
    }

    // Group labels above expert slots.
    if (split < 0.5) {
      for (let g = 0; g < 4; g++) out += text(92 + g * 100, EY - 8, `Expert ${g + 1}`, 'ts tc');
    } else if (sh < 0.5) {
      out += text(230, EY - 8, '16 fine-grained experts (width d_e / 4 each)', 'ts tc');
    } else {
      out += text(46, EY - 8, 'shared (2)', 'ts tc tb cache');
      out += text(272, EY - 8, 'routed specialists (14)', 'ts tc tb route');
    }

    // Active set for current beat.
    const finePicks = [1, 5, 10, 14];
    const routedPicks = ROUTED_PICKS[tIdx];

    // Draw the 16 slices.
    for (let i = 0; i < N_FINE; i++) {
      const g = Math.floor(i / 4);
      const j = i % 4;
      const xCoarse = 48 + g * 100 + j * 22;
      const xSplit = 42 + g * 100 + j * 23;
      const xShared = i < 2 ? 22 + i * 26 : 96 + (i - 2) * 25;
      const x = lerp(lerp(xCoarse, xSplit, split), xShared, sh);
      const w = lerp(lerp(22, 19, split), i < 2 ? 22 : 21, sh);

      const isShared = sh > 0.5 && i < 2;
      const isActive =
        sh > 0.5 ? isShared || routedPicks.includes(i) : split > 0.5 ? finePicks.includes(i) : g === 1;

      const cls = isShared ? 'cache hot' : isActive ? 'wt hot' : 'wt';
      const fillOp = !isActive ? 0.32 : 1;
      out += rect(x, EY, w, EH, cls, { rx: split < 0.3 ? 1 : 3, opacity: fillOp });
      if (isActive && !isShared) out += rect(x, EY, w, EH, 'wt solid', { 'fill-opacity': 0.35, rx: 3 });

      if (split > 0.5) {
        const lbl = sh > 0.5 ? (i < 2 ? `S${i + 1}` : `R${i - 1}`) : `${i + 1}`;
        out += text(x + w / 2, EY + 23, lbl, isActive ? 'ts tc tb' : 'ts tc', { opacity: isActive ? 1 : 0.65 });
      }
    }
    // Coarse outlines so the 4 unsplit experts look like 4 solid blocks in Beat 0.
    if (split < 0.7) {
      for (let g = 0; g < 4; g++) {
        out += rect(48 + g * 100, EY, 88, EH, g === 1 ? 'wt hot' : 'wt', { opacity: (1 - split) * (g === 1 ? 1 : 0.45) });
        out += text(92 + g * 100, EY + 23, g === 1 ? 'd → d_e (active)' : 'd → d_e', 'ts tc', { opacity: (1 - split) * (g === 1 ? 1 : 0.6) });
      }
    }

    // Bottom: Active compute budget & combination count.
    const BY = 176;
    out += rect(16, BY, 428, 92, 'faint', { rx: 6 });

    // Left: Active compute per token (always 4 quarters = 1 * d_e!).
    out += text(30, BY + 22, 'active FFN width per token', 'ts tb');
    const barW = 172;
    const bx0 = 30;
    const by0 = BY + 34;
    if (sh > 0.5) {
      out += rect(bx0, by0, barW * 0.5, 18, 'cache', { rx: 2 });
      out += rect(bx0 + barW * 0.5 + 2, by0, barW * 0.5 - 2, 18, 'wt', { rx: 2 });
      out += text(bx0 + barW * 0.25, by0 + 13, '2 shared', 'ts tc tb');
      out += text(bx0 + barW * 0.75, by0 + 13, '2 routed', 'ts tc tb');
    } else if (split > 0.5) {
      for (let k = 0; k < 4; k++) out += rect(bx0 + k * 43.5, by0, 41, 18, 'wt solid', { rx: 2 });
    } else {
      out += rect(bx0, by0, barW, 18, 'wt solid', { rx: 2 });
    }
    out += text(bx0, BY + 72, '1 × d_e  (same FLOPs)', 'ts tm');

    // Divider.
    out += line(232, BY + 14, 232, BY + 78, 'wire', { opacity: 0.4 });

    // Right: Distinct combinations.
    out += text(248, BY + 22, 'routing combinations', 'ts tb');
    const combos = sh > 0.5 ? 'C(14, 2) = 91 + shared' : split > 0.5 ? 'C(16, 4) = 1,820' : 'C(4, 1) = 4';
    const note =
      sh > 0.5
        ? 'shared lane absorbs common facts'
        : split > 0.5
          ? '455× more mixes at zero extra cost'
          : 'coarse experts bundle unrelated skills';
    out += text(248, BY + 48, combos, 'tb tm act');
    out += text(248, BY + 72, note, 'ts');

    return out;
  },
};

// DeepSeek Sparse Attention (DSA): a cheap lightning indexer scores every cached token
// without softmax, keeps only the top-k keys per query, and runs full attention (softmax +
// value mixing) on those k survivors alone. Toy sizes: 10 cached tokens, k = 3 selected.
import { text, rect, line, group, clamp, softmax, f2 } from './kit.mjs';

const N = 10;
const K = 3;
const TOKENS = ['The', 'old', 'oak', 'held', 'a', 'tiny', 'red', 'fox', 'by', 'Pip'];
// Indexer scores I_{t,s} for query "Pip": peaks on "oak" (2), "fox" (7), "held" (3) -> top-3 = [2, 3, 7].
const IDX_SCORES = [0.18, 0.12, 0.88, 0.64, 0.08, 0.28, 0.34, 0.94, 0.22, 0.38];
const TOP3 = [2, 3, 7];
const CUTOFF = 0.50;

const sx = (i) => 104 + i * 35;
const IBASE = 126;

export default {
  viewBox: [460, 276],
  setup() {
    const topWeights = softmax(TOP3.map((i) => IDX_SCORES[i] * 2.4));
    return { topWeights };
  },
  beats: [
    {
      say: 'A query token faces all cached latents. Full attention would run softmax over all 10.',
      state: { idx: 0, sel: 0, att: 0 },
      from: { idx: 0, sel: 0, att: 0 },
      tween: 700,
    },
    {
      say: 'First, the small lightning indexer scores every past token cheaply with ReLU dot products.',
      state: { idx: 1, sel: 0, att: 0 },
      tween: 1200,
      ms: 4200,
    },
    {
      say: 'Keep only the top k keys (3 here) and drop the rest before full attention begins.',
      state: { idx: 1, sel: 1, att: 0 },
      tween: 1100,
      ms: 4200,
    },
    {
      say: 'Full MLA softmax and value mixing run on those 3 latents alone: O(L·k) core attention.',
      state: { idx: 1, sel: 1, att: 1 },
      tween: 1200,
      ms: 4600,
    },
  ],
  draw({ idx, sel, att }, { topWeights }) {
    let out = '';

    // Row 1: Query on left + 10 cached latent tokens.
    out += rect(10, 12, 68, 26, 'act hot') + text(44, 29, 'query h_t', 'ts tc tb');
    out += text(44, 49, '“Pip”', 'ts tc act');

    for (let i = 0; i < N; i++) {
      const keep = TOP3.includes(i);
      const dim = sel > 0.5 && !keep ? 0.25 : 1;
      out += rect(sx(i) - 15, 12, 30, 26, keep && sel > 0.5 ? 'cache hot' : 'cache', { opacity: dim });
      out += text(sx(i), 29, TOKENS[i], 'ts tc', { opacity: dim });
    }

    // Row 2: Lightning indexer scores I_{t,s}.
    out += text(8, IBASE - 36, 'lightning', 'ts') + text(8, IBASE - 24, 'indexer', 'ts') + text(8, IBASE - 12, 'I_{t,s}', 'ts tm');
    out += line(sx(0) - 18, IBASE, sx(N - 1) + 18, IBASE, 'wire', { opacity: 0.45 });

    // Top-k threshold dashed line.
    const cutY = IBASE - CUTOFF * 54;
    out += group(
      line(sx(0) - 18, cutY, sx(N - 1) + 18, cutY, 'wire dash') + text(sx(N - 1) + 20, cutY + 3, 'top-k', 'ts route tb'),
      { opacity: sel }
    );

    for (let i = 0; i < N; i++) {
      const keep = TOP3.includes(i);
      const h = IDX_SCORES[i] * 54 * idx;
      const op = sel > 0.5 ? (keep ? 1 : 0.22) : idx;
      out += rect(sx(i) - 9, IBASE - h, 18, Math.max(0.8, h), keep && sel > 0.5 ? 'route solid hot' : 'route solid', {
        rx: 1.5,
        opacity: op,
      });
      out += text(sx(i), IBASE + 12, `c${i + 1}`, 'ts tc tm', { opacity: op });
    }

    // Row 3: Selected top-k latents -> Fine-grained softmax weights.
    const KY = 166;
    let sOut = '';
    sOut += text(8, KY + 14, 'selected', 'ts') + text(8, KY + 26, 'latents (k)', 'ts');
    TOP3.forEach((tokIdx, j) => {
      const tx = 126 + j * 88;
      sOut += line(sx(tokIdx), IBASE + 16, tx, KY, 'wire', { opacity: 0.75 });
      sOut += rect(tx - 34, KY, 68, 26, 'cache hot');
      sOut += text(tx, KY + 17, `“${TOKENS[tokIdx]}”`, 'ts tc tb');

      // Softmax weights in Stage 2.
      const w = topWeights[j];
      let aG = line(tx, KY + 26, tx, KY + 42, 'wire arrow');
      aG += rect(tx - 32, KY + 44, 64, 16, 'faint', { rx: 2 });
      aG += rect(tx - 32, KY + 44, 64 * w, 16, 'act solid', { rx: 2, 'fill-opacity': 0.85 });
      aG += text(tx, KY + 73, `w = ${f2(w)}`, 'ts tc tm tb act');
      sOut += group(aG, { opacity: att });
    });
    out += group(sOut, { opacity: sel });

    // Summary pill on bottom-right when Stage 2 runs.
    let sum = rect(356, 166, 94, 72, 'faint', { rx: 5 });
    sum += text(403, 186, 'attention', 'ts tc tb');
    sum += text(403, 202, `${K} of ${N} keys`, 'ts tc tb act');
    sum += text(403, 218, 'O(L · k)', 'ts tc tm cache');
    sum += text(403, 232, 'core work', 'ts tc');
    out += group(sum, { opacity: att });

    return out;
  },
};

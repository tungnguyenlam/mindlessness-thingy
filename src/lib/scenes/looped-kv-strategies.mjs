// Three KV-cache strategies across loop passes:
// 1. Per-loop (Inkling 2 Mini): stores a separate KV cache row for every pass (K × memory).
// 2. Last-loop overwrite (Dory 1.0-4B): overwrites the single KV row on each pass (1 × memory).
// 3. Global share + sliding window (GLM-5.4): reuses pass 1's sparse KV and adds only a local window.
import { text, rect, path, group, clamp } from './kit.mjs';

function kvRow(x, y, w, h, fillRatio, cls, label) {
  let s = rect(x, y, w, h, 'faint', { rx: 2 });
  if (fillRatio > 0.02) {
    s += rect(x, y, w * clamp(fillRatio, 0, 1), h, `${cls} solid`, { rx: 2, 'fill-opacity': 0.85 });
  }
  if (label) {
    s += text(x - 4, y + h - 4, label, 'ts te tm');
  }
  return s;
}

export default {
  viewBox: [468, 248],
  beats: [
    {
      say: 'Pass 1: all three models write the first pass’s keys and values into the KV cache.',
      state: { p1: 1, p2: 0, p3: 0, ow: 0 },
      from: { p1: 0, p2: 0, p3: 0, ow: 0 },
      tween: 900,
      ms: 3400,
    },
    {
      say: 'Pass 2: Inkling keeps a second full cache; Dory overwrites row 1; GLM-5.4 adds only a window.',
      state: { p1: 1, p2: 1, p3: 0, ow: 1 },
      tween: 1100,
      ms: 3800,
    },
    {
      say: 'Pass 3: Per-loop grows to K×; Last-loop stays 1×; Hybrid stays 1× plus a small window.',
      state: { p1: 1, p2: 1, p3: 1, ow: 2 },
      tween: 1100,
      ms: 4200,
    },
  ],
  draw({ p1, p2, p3, ow }) {
    let out = '';

    const cols = [
      { x: 10, w: 142, title: 'Per-loop KV', sub: 'Inkling 2 Mini' },
      { x: 163, w: 142, title: 'Last-loop KV', sub: 'Dory 1.0-4B' },
      { x: 316, w: 142, title: 'Share + window', sub: 'GLM-5.4' },
    ];

    cols.forEach((c) => {
      out += rect(c.x, 10, c.w, 228, 'faint', { rx: 6 });
      out += text(c.x + c.w / 2, 29, c.title, 't tc tb');
      out += text(c.x + c.w / 2, 43, c.sub, 'ts tc');
    });

    // ---- Col 1: Per-loop (Inkling 2 Mini) ----
    const x1 = cols[0].x + 28;
    const rw = 102;
    out += kvRow(x1, 70, rw, 18, p1, 'cache', 'p1');
    out += kvRow(x1, 98, rw, 18, p2, 'cache', 'p2');
    out += kvRow(x1, 126, rw, 18, p3, 'cache', 'p3');
    const c1Scale = 1 + (p2 > 0.5 ? 1 : 0) + (p3 > 0.5 ? 1 : 0);
    out += text(cols[0].x + cols[0].w / 2, 182, 'every pass keeps', 'ts tc');
    out += text(cols[0].x + cols[0].w / 2, 196, 'its own KV cache', 'ts tc');
    out += text(cols[0].x + cols[0].w / 2, 222, `KV memory: ${c1Scale}×`, 'ts tc tm tb');

    // ---- Col 2: Last-loop overwrite (Dory 1.0-4B) ----
    const x2 = cols[1].x + 28;
    // Sweep fill ratio from 0 -> 1 during each overwrite tween (0->1, 1->2)
    const owFrac = ow <= 0.01 ? p1 : ow % 1 === 0 ? 1 : ow % 1;
    out += kvRow(x2, 70, rw, 18, owFrac, 'cache', `p${1 + Math.round(ow)}`);
    out += rect(x2, 98, rw, 18, 'faint', { rx: 2, opacity: 0.35, 'stroke-dasharray': '3,3' });
    out += rect(x2, 126, rw, 18, 'faint', { rx: 2, opacity: 0.35, 'stroke-dasharray': '3,3' });
    out += text(x2 + rw / 2, 111, 'overwritten in place', 'ts tc');
    out += text(cols[1].x + cols[1].w / 2, 182, 'each loop overwrites', 'ts tc');
    out += text(cols[1].x + cols[1].w / 2, 196, 'the previous KV', 'ts tc');
    out += text(cols[1].x + cols[1].w / 2, 222, 'KV memory: 1×', 'ts tc tm tb');

    // ---- Col 3: Share + sliding window (GLM-5.4) ----
    const x3 = cols[2].x + 28;
    out += kvRow(x3, 70, rw, 18, p1, 'cache', 'p1');
    // Pass 2: reuse arrow cleanly separated from the right-aligned window bar
    out += group(
      path(`M${x3 + 16},88 L${x3 + 16},118 L${x3 + rw - 36},118`, 'flow arrow', { 'stroke-dasharray': '3,2' }) +
        text(x3 + 22, 108, 'reuse', 'ts'),
      { opacity: p2 }
    );
    out += group(kvRow(x3 + rw - 30, 109, 30, 18, p2, 'cache', ''), { opacity: p2 });
    out += group(text(x3 + rw - 15, 139, 'window', 'ts tc tm'), { opacity: p2 });
    out += text(cols[2].x + cols[2].w / 2, 182, 'reuses pass-1 KV +', 'ts tc');
    out += text(cols[2].x + cols[2].w / 2, 196, 'adds local window W', 'ts tc');
    out += text(cols[2].x + cols[2].w / 2, 222, p2 > 0.5 ? 'KV memory: 1× + W' : 'KV memory: 1×', 'ts tc tm tb');

    return out;
  },
};

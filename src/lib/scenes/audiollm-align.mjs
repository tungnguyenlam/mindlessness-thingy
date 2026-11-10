// Scene: encoder-free log-mel projection, scale-matching init, implicit conv encoding,
// and layer-k=2 affinity token merging in AudioLLM (LFM2.5-230M).

import { text, rect, circle, line, path, group, box, arrow, heat, lerp, f2, n } from './kit.mjs';

const LAYER_COS = [
  { tag: 'in', kind: 'P', cos: 0.285 },
  { tag: 'L0', kind: 'C', cos: 0.312 },
  { tag: 'L1', kind: 'C', cos: 0.354 },
  { tag: 'L2', kind: 'A', cos: 0.369 },
  { tag: 'L5', kind: 'C', cos: 0.431 },
  { tag: 'L9', kind: 'C', cos: 0.489 },
  { tag: 'L12', kind: 'A', cos: 0.525 },
];

const TOKENS = [
  { id: 'a0', cos: 0.82 },
  { id: 'a1', cos: 0.34 },
  { id: 'a2', cos: 0.76 },
  { id: 'a3', cos: 0.28 },
  { id: 'a4', cos: 0.31 },
  { id: 'a5', cos: 0.42 },
  { id: 'a6', cos: 0.79 },
  { id: 'a7', cos: 0.0 },
];

const MERGED = [
  { ids: [0, 1], label: 'ā01', hot: true },
  { ids: [2, 3], label: 'ā23', hot: true },
  { ids: [4], label: 'a4', hot: false },
  { ids: [5], label: 'a5', hot: false },
  { ids: [6, 7], label: 'ā67', hot: true },
];

export default {
  viewBox: [460, 290],
  setup() {
    // 5 mel bands × 15 frames (150 ms receptive field)
    const mel = Array.from({ length: 5 }, (_, b) =>
      Array.from({ length: 15 }, (__, i) => {
        const env = Math.sin((i / 14) * Math.PI);
        return Math.max(0.12, env * (0.42 + 0.52 * Math.sin(i * 0.5 + b * 1.1)));
      }),
    );
    return { mel };
  },
  beats: [
    {
      say: '100 Hz log-mel frames pass through three kernel-3 stride-2 conv stages (15-frame window) into 12.5 Hz tokens.',
      state: { rf: 1, match: 1, curve: 0.85, merge: 0.75 },
    },
    {
      say: 'Default init makes audio vectors 20× louder than text embeddings (18.5 vs 0.89); match_emb + split grad clip aligns them.',
      state: { rf: 0.7, match: 1, curve: 0.85, merge: 0.75 },
    },
    {
      say: 'Short-conv layers L0–L1 act as an implicit encoder: adjacent audio cosine similarity climbs from 0.29 to 0.53.',
      state: { rf: 0.7, match: 0.85, curve: 1, merge: 0.85 },
    },
    {
      say: 'Merging at layer k = 2 (cos ≥ 0.70) compresses steady spans before all 6 GQA layers, reaching 39.35% dev WER.',
      state: { rf: 0.7, match: 0.85, curve: 1, merge: 1 },
    },
  ],
  draw(s, { mel }) {
    let out = '';

    // --- LEFT COLUMN (x: 8..220): Mel spectrogram -> 12.5 Hz tokens -> k=2 Affinity Merge -> Norm bars ---
    out += text(8, 13, '1. 100 Hz log-mel → 12.5 Hz tokens', 'ts tb');
    out += heat(8, 19, mel, { cell: 10, role: 'act' });
    // 15-frame receptive field outline (15 * 10 = 150 px)
    out += rect(8, 18, 150, 52, 'wt', { 'fill-opacity': 0, 'stroke-width': 1.5, opacity: s.rf });
    out += text(164, 39, '15 frames', 'ts tm');
    out += text(164, 53, '(150 ms RF)', 'ts tm');

    // Section 2 header ABOVE both token rows so arrows between rows have an unobstructed gap
    out += text(8, 84, '2. Affinity merge at k = 2 (cos ≥ 0.70)', 'ts tb');

    // 8 projected audio tokens at y = 90..112
    const tokY = 90;
    const tokW = 24;
    const tokGap = 3;
    const centers = [];
    TOKENS.forEach((tk, i) => {
      const tx = 8 + i * (tokW + tokGap);
      centers.push(tx + tokW / 2);
      const steady = tk.cos >= 0.7 || (i > 0 && TOKENS[i - 1].cos >= 0.7);
      out += box(tx, tokY, tokW, 21, tk.id, steady ? 'act' : 'wt');
    });

    // Layer k=2 Affinity Merge at y = 136..158 (25px clean gap for arrows!)
    const mY = 136;
    const mW = 39;
    const mGap = 4.5;
    let mergeSvg = '';
    MERGED.forEach((g, gi) => {
      const gx = 8 + gi * (mW + mGap);
      const gc = gx + mW / 2;
      for (const idx of g.ids) {
        mergeSvg += arrow(centers[idx], tokY + 21, gc, mY - 1, 'wire');
      }
      mergeSvg += box(gx, mY, mW, 22, g.label, g.hot ? 'route' : 'act');
    });
    out += group(mergeSvg, { opacity: s.merge });

    // Scale-matching init & gradient balance card (y: 168..280)
    out += rect(8, 168, 212, 112, 'op');
    out += text(15, 184, 'Scale-matching init & grad clip', 'ts tb');

    out += text(15, 204, 'Default ‖a‖₂', 'ts tm');
    out += rect(92, 194, 120, 13, 'route solid', { 'fill-opacity': 0.32 });
    out += text(96, 204, '18.5 (20× text)', 'ts tm');

    const matchW = lerp(68, 20, s.match);
    out += text(15, 226, 'match_emb', 'ts tm');
    out += rect(92, 216, matchW, 13, 'act solid', { 'fill-opacity': 0.45 });
    out += text(92 + matchW + 4, 226, '0.83 ≈ text 0.89', 'ts tm');

    const gradW = lerp(24, 116, s.match);
    out += text(15, 248, 'Proj ‖∇‖₂', 'ts tm');
    out += rect(92, 238, gradW, 13, 'wt solid', { 'fill-opacity': 0.42 });
    out += text(96, 248, '0.26 → 1.85 (5×)', 'ts tm');

    out += text(15, 270, 'Split clip: 120% → 11.87% WER', 'ts tm');

    // --- RIGHT COLUMN (x: 234..452): Implicit Encoder Cosine Similarity by Layer ---
    const rx = 234;
    out += text(rx, 13, '3. Implicit encoder: cos(h_i, h_{i+1})', 'ts tb');

    const px = rx + 30;
    const py = 22;
    const pw = 188;
    const ph = 144;
    out += rect(px, py, pw, ph, 'op');

    [0.2, 0.35, 0.5].forEach((v) => {
      const gy = py + ph - ((v - 0.15) / 0.42) * ph;
      out += line(px, gy, px + pw, gy, 'wire dash');
      out += text(px - 4, gy + 3, f2(v), 'ts tm te');
    });

    const pts = LAYER_COS.map((d, i) => {
      const x = px + 14 + (i / (LAYER_COS.length - 1)) * (pw - 28);
      const y = py + ph - ((d.cos - 0.15) / 0.42) * ph;
      return { ...d, x, y };
    });

    // k = 2 vertical marker (index 3 = L2)
    const k2x = pts[3].x;
    out += line(k2x, py + 4, k2x, py + ph - 4, 'route dash', { opacity: s.merge });
    out += text(k2x, py + 13, 'merge k = 2', 'ts tm tc');

    // Polyline across layers
    const dPath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${n(p.x)},${n(p.y)}`).join(' ');
    out += path(dPath, 'flow', { opacity: s.curve });

    pts.forEach((p) => {
      const role = p.kind === 'A' ? 'route solid' : p.kind === 'C' ? 'act solid' : 'wt solid';
      out += circle(p.x, p.y, 3.5, role);
      out += text(p.x, py + ph + 13, p.tag, 'ts tm tc');
    });

    // Bottom-right summary card (y: 188..280)
    out += rect(rx, 188, 218, 92, 'op');
    out += text(rx + 8, 205, 'Why merge at layer k = 2?', 'ts tb');
    out += text(rx + 8, 225, '• L0, L1: short convs (3-tok cache)', 'ts');
    out += text(rx + 8, 245, '• GQA at L2, L4, L6, L8, L10, L12', 'ts');
    out += text(rx + 8, 265, '• E = 0.93 (k=2): 39.35% dev WER', 'ts tm');

    return out;
  },
};

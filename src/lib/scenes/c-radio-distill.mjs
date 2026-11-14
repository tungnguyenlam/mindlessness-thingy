import { arrow, bars, clamp, group, lerp, line, rect, text } from './kit.mjs';

const TARGET_VEC = [0.82, -0.5, 0.9, -0.35];
const INIT_VEC = [0.2, 0.45, -0.3, 0.65];

export default {
  viewBox: [460, 250],
  beats: [
    {
      say: 'Three frozen teachers watch the same image for language alignment, dense spatial features, and masks.',
      state: { align: 0, drop: 0, hot: 'teachers' },
    },
    {
      say: 'Small 2-layer MLP adaptor heads h_i map the student’s output into each teacher’s feature space.',
      state: { align: 0.55, drop: 0, hot: 'adaptors' },
    },
    {
      say: 'Cosine and smooth-L1 losses pull the student to match all three (SAM has no summary term).',
      state: { align: 1, drop: 0, hot: 'loss' },
    },
    {
      say: 'After training, discard the teachers and adaptor heads — only one fast backbone ships for inference.',
      state: { align: 1, drop: 1, hot: 'deploy' },
    },
  ],
  draw({ align, drop, hot }) {
    const out = [];
    const tOp = clamp(1 - drop * 0.78, 0.22, 1);

    // ---- 1. Left Column: Unlabeled Image + 3 Teachers (x = 12..154) ----
    out.push(rect(12, 12, 142, 30, 'act'));
    out.push(text(83, 25, 'Unlabeled image x', 'ts tb tc'));
    out.push(text(83, 37, 'same pixels to all 3', 'ts tc'));

    const teachers = [
      { y: 50, title: 'CLIP / SigLIP2', sub: 'summary + spatial' },
      { y: 98, title: 'DINOv2 / v3', sub: 'summary + spatial' },
      { y: 146, title: 'SAM / SAM3', sub: 'spatial only' },
    ];
    let tGroup = '';
    for (const t of teachers) {
      const cls = hot === 'teachers' ? 'wt hot' : drop > 0.5 ? 'faint dash' : 'wt';
      tGroup += rect(12, t.y, 142, 42, cls);
      tGroup += text(83, t.y + 17, t.title, 'ts tb tc');
      tGroup += text(83, t.y + 32, t.sub, 'ts tc tm');
      tGroup += arrow(154, t.y + 21, 174, t.y + 21, 'wire');
    }
    out.push(group(tGroup, { opacity: tOp }));
    if (drop > 0.5) {
      out.push(rect(34, 108, 98, 20, 'op', { rx: 3, opacity: drop }));
      out.push(text(83, 121, 'discarded!', 'ts tb tc', { opacity: drop }));
    }

    // ---- 2. Middle Column: Adaptor heads & Losses (top) + Student (bottom) ----
    // Top: Adaptors + Feature match bars (x = 174..310, y = 12..126)
    const adpCls = hot === 'adaptors' || hot === 'loss' ? 'op hot' : drop > 0.5 ? 'faint dash' : 'op';
    const curVec = INIT_VEC.map((v, k) => lerp(v, TARGET_VEC[k], align));
    let aGroup = '';
    aGroup += rect(174, 12, 136, 114, adpCls);
    aGroup += text(242, 28, 'Adaptors h_i & loss', 'ts tb tc');
    aGroup += text(242, 42, 'α·L_cos + β·L_sL1', 'ts tc tm');
    aGroup += line(188, 76, 296, 76, 'faint');
    aGroup += bars(198, 76, TARGET_VEC, { w: 18, gap: 6, scale: 18, max: 20, cls: 'faint solid' });
    aGroup += bars(202, 76, curVec, { w: 12, gap: 12, scale: 18, max: 20, cls: 'act solid' });
    aGroup += text(
      242,
      112,
      align > 0.8 ? 'features aligned!' : 'matching teachers...',
      align > 0.8 ? 'ts tb tc act' : 'ts tc',
    );
    aGroup += arrow(242, 140, 242, 126, 'wire');
    out.push(group(aGroup, { opacity: tOp }));
    if (drop > 0.5) {
      out.push(rect(198, 56, 88, 20, 'op', { rx: 3, opacity: drop }));
      out.push(text(242, 69, 'dropped!', 'ts tb tc', { opacity: drop }));
    }

    // Student Backbone (x = 174..310, y = 140..204) -> NEVER dropped!
    const stCls = hot === 'deploy' ? 'wt hot' : 'wt';
    out.push(rect(174, 140, 136, 64, stCls));
    out.push(text(242, 158, 'Student backbone', 'ts tb tc'));
    out.push(text(242, 173, 'single ViT f(x)', 'ts tc tm'));
    out.push(text(242, 192, drop > 0.5 ? 'kept at inference' : 'trained jointly', 'ts tb tc wt'));

    // Arrow right from Student -> Final Features
    if (drop > 0.4) {
      out.push(line(310, 172, 328, 172, 'flow', { opacity: drop }));
    }
    out.push(arrow(310, 172, 328, 172, 'wire'));

    // ---- 3. Right Column: Deployed Patch + Summary Output (x = 328..448) ----
    const outCls = hot === 'deploy' ? 'act hot' : 'act';
    out.push(rect(328, 12, 120, 192, outCls));
    out.push(text(388, 30, 'Deployed output', 'ts tb tc'));
    out.push(text(388, 44, '1 backbone, 3 skills', 'ts tc'));

    // Summary vector box
    out.push(rect(340, 56, 96, 42, 'op'));
    out.push(text(388, 73, 'Summary vec', 'ts tb tc'));
    out.push(text(388, 88, 'CLIP + DINO', 'ts tc tm'));

    // Patch grid T x d
    out.push(rect(340, 108, 96, 84, 'act'));
    out.push(text(388, 124, 'Patches T × d', 'ts tb tc tm'));
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 4; c++) {
        out.push(rect(352 + c * 19, 133 + r * 18, 15, 14, 'act', { rx: 2 }));
      }
    }
    out.push(text(388, 184, '→ VL connector', 'ts tb tc'));

    // ---- Bottom summary bar (y = 216..242) ----
    out.push(rect(12, 214, 436, 26, 'op'));
    out.push(
      text(
        22,
        231,
        drop > 0.5 ? 'Inference: 1 student backbone (teachers discarded)' : 'Training: 3 teachers supervise 1 student',
        'ts tb',
      ),
    );
    out.push(text(438, 231, drop > 0.5 ? '1× cost' : '0 labels', 'ts tb te tm'));

    return out.join('');
  },
};

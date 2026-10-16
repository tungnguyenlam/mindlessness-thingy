// Props of <MaskGrid>, <ShapeFlow> and <Timeline>, checked in the fast pass so mistakes surface
// per turn instead of at build: unknown links and paths (no-dangling), numbers typed into picture
// labels (sourced-numbers) and shapes that won't lay out (diagram-geometry).
import { findComponents } from '../lib/mdx-props.mjs';
import { textWidth } from '../../src/lib/diagram/geometry.mjs';

const NUMBER = /(?<![A-Za-z_\d.\-^])\d[\d,.]*(?![A-Za-z_\d])/;
const KINDS = ['full', 'causal', 'window', 'topk'];

export default function vizProps({ notes, bySlug }, { error, warn }) {
  for (const n of notes) {
    for (const use of findComponents(n.text, ['MaskGrid', 'ShapeFlow', 'Timeline'])) {
      const at = `line ${use.line + n.bodyLine - 1}: <${use.name}>`;
      const e = (rule, msg, fix, code) => error(rule, n.file, `${at} ${msg}`, fix, { code });
      if (use.error) {
        e('diagram-geometry', use.error, 'write props as literals', 'unparsable');
        continue;
      }
      const p = use.props;
      if (use.name === 'MaskGrid') {
        if (!Array.isArray(p.masks) || !p.masks.length) e('diagram-geometry', 'needs masks={[...]}', "e.g. [{ label: 'Causal', kind: 'causal' }]", 'no-masks');
        if (p.n != null && (p.n < 4 || p.n > 24)) e('diagram-geometry', `n = ${p.n} won't fit`, 'use 4 to 24 tokens', 'mask-size');
        for (const m of p.masks ?? []) {
          if (!KINDS.includes(m.kind)) e('diagram-geometry', `mask "${m.label}" has kind "${m.kind}"`, `use ${KINDS.join(', ')}`, 'mask-kind');
          if (m.kind === 'window' && !(m.window >= 1)) e('diagram-geometry', `window mask "${m.label}" needs window >= 1`, 'set window', 'mask-param');
          if (m.kind === 'topk' && !(m.k >= 1)) e('diagram-geometry', `topk mask "${m.label}" needs k >= 1`, 'set k', 'mask-param');
          if (NUMBER.test(m.label ?? '')) warn('sourced-numbers', n.file, `${at} mask label "${m.label}" contains a number`, 'use a symbol (k, w) in the label and cite the value in prose');
          if (textWidth(m.label, 'label') > 260) warn('diagram-geometry', n.file, `${at} mask label "${m.label}" is long for a tab`, 'shorten it');
        }
      }
      if (use.name === 'ShapeFlow') {
        if (!Array.isArray(p.steps) || !p.steps.length || p.steps.length > 8) e('diagram-geometry', 'needs 1 to 8 steps', 'split a longer flow in two', 'steps');
        for (const s of p.steps ?? []) {
          if (!Array.isArray(s.shape) || !s.shape.length) e('diagram-geometry', `step "${s.label}" needs shape: ['d', ...]`, 'list the dimensions as symbols', 'shape');
          if (s.link && !bySlug.has(s.link)) e('no-dangling', `step "${s.label}" links to unknown note "${s.link}"`, `create it with pnpm run new concept ${s.link} "Title"`, 'link');
          for (const t of [s.label, s.op, ...(s.shape ?? [])]) if (t && NUMBER.test(String(t))) warn('sourced-numbers', n.file, `${at} "${t}" contains a number`, 'use symbols (d, d_c, n_h) in shapes; values go in <Spec>/<ModelSpec>');
        }
      }
      if (use.name === 'Timeline') {
        const path = bySlug.get(p.path);
        if (!path || path.data.kind !== 'path') e('no-dangling', `path "${p.path}" is not a path note`, 'pass the slug of a path note: path="deepseek-lineage"', 'path');
      }
    }
  }
}

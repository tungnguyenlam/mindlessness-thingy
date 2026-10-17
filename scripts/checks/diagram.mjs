// Diagram geometry (AGENTS.md rule diagram-geometry): lint every <ArchDiagram> with the same
// layout code the component renders with, so overlaps, edges through blocks and overflowing
// labels are caught in the fast check instead of in a screenshot.
import { lintDiagram } from '../../src/lib/diagram/geometry.mjs';
import { findComponents } from '../lib/mdx-props.mjs';

export default function diagram({ notes, bySlug }, { error, warn }) {
  for (const n of notes) {
    for (const use of findComponents(n.text, ['ArchDiagram'])) {
      const line = use.line + n.bodyLine - 1;
      if (use.error) {
        error('diagram-geometry', n.file, `line ${line}: <ArchDiagram> ${use.error}`, 'write props as literals (strings, numbers, arrays, objects) so the diagram can be checked', { code: 'unparsable' });
        continue;
      }
      for (const p of lintDiagram(use.props)) {
        (p.level === 'error' ? error : warn)(p.rule, n.file, `line ${line}: ${p.msg}`, p.fix, { code: p.code });
      }
      for (const b of use.props.blocks ?? []) {
        // Concept diagrams teach sizes: a tensor box says its shape in symbols (AGENTS.md#diagram-style).
        // System notes also draw pipelines (training stages) where a shape means nothing, so only concepts.
        if (n.data.kind === 'concept' && (b.role === 'activation' || b.role === 'cache') && !b.sub) warn('diagram-geometry', n.file, `line ${line}: ${b.role} block "${b.id}" ("${b.label}") has no shape`, "add sub: 'T × d' (symbols: T, d, n_h, d_h, d_c ...) so the reader sees the tensor's size", { code: 'no-shape' });
        if (b.link && !bySlug.has(b.link)) error('no-dangling', n.file, `line ${line}: diagram block "${b.id}" links to unknown note "${b.link}"`, `create it with pnpm run new concept ${b.link} "Title"`, { code: 'diagram-link' });
      }
    }
  }
}

// Visual-first (PRINCIPLES.md#visual-first): show the idea before explaining it.
// Structure rules for written concept and system notes. Problems carry a code so scripts/baseline.json
// can grandfather notes written before a rule existed; anything new is an error.
import { maskComponents } from '../lib/mdx-props.mjs';

const VISUALS = ['ArchDiagram', 'ModelDiagram', 'LayerStrip', 'Compare', 'Calc', 'Stepper', 'Figure'];
const TABLES = ['Spec', 'ModelSpec'];
const ALL = [...VISUALS, ...TABLES];
const MARK = '\u0000VISUAL\u0000';
const FIRST_VISUAL_WITHIN = 120; // words of prose before the first visual
const MAX_RUN = 400; // words between visuals: error
const WARN_RUN = 250; // ...warning
const SECTION_NEEDS_VISUAL = 150; // a ## section with more prose than this needs its own visual
const LONG_PARAGRAPH = 90;
const MAX_CALLOUTS = 2;

const words = (s) =>
  s
    .replace(/\$\$[\s\S]*?\$\$/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\[\[([^\]|]+)\|?([^\]]*)\]\]/g, (_, a, b) => b || a)
    .split(/\s+/)
    .filter((w) => /[a-z]/i.test(w)).length;

export default function visual({ notes }, { error, warn }) {
  for (const n of notes) {
    const d = n.data;
    if (d.status === 'stub' || d.kind === 'path') continue;
    const lineAt = (text, idx) => text.slice(0, idx).split('\n').length + n.bodyLine - 1;
    const hasVisual = new RegExp(`<(${VISUALS.join('|')})\\b`).test(n.text);
    if (!hasVisual) {
      error('visual-first', n.file, `${d.status} ${d.kind} note has no visual`, 'add one before more prose: <ArchDiagram> for structure, <Calc> for how it scales, <Stepper> for a procedure; system notes: <ModelDiagram>, <LayerStrip> (see templates/notes/)');
    }
    if (d.kind === 'system') {
      if (!/<(Spec|ModelSpec)\b/.test(n.text)) warn('visual-first', n.file, 'system note has no numbers table', 'add model data and <ModelSpec model="..." /> (docs/workflow.md)');
      if (!/<(ArchDiagram|ModelDiagram)\b/.test(n.text)) warn('visual-first', n.file, 'system note has no diagram of the overall block', 'use <ModelDiagram model="..." /> (generated from model data) or an <ArchDiagram>');
    }

    const masked = maskComponents(n.text, ALL, MARK).replace(/```[\s\S]*?```/g, (m) => m.replace(/[^\n]/g, ' '));
    const chunks = masked.split(MARK);

    // 1. The first picture comes early.
    if (hasVisual && words(chunks[0]) > FIRST_VISUAL_WITHIN) {
      error('visual-first', n.file, `${words(chunks[0])} words before the first visual`, `open with the problem in two or three sentences, then show the picture (within ${FIRST_VISUAL_WITHIN} words)`, { code: 'late-first-visual' });
    }

    // 2. No walls of text between visuals.
    let at = 0;
    for (const c of chunks) {
      const w = words(c);
      if (w > MAX_RUN) error('visual-first', n.file, `${w} words of prose without a visual (from line ${lineAt(masked, at)})`, 'split the idea and show the key step as a diagram, stepper, calculator or comparison', { code: 'wall-of-text' });
      else if (w > WARN_RUN) warn('visual-first', n.file, `${w} words of prose without a visual (from line ${lineAt(masked, at)})`, 'consider showing the key step');
      at += c.length + MARK.length;
    }

    // 3. Each substantial section has its own visual or table.
    const sections = masked.split(/^(?=## )/m);
    let pos = 0;
    for (const s of sections) {
      const title = s.match(/^## (.+)/)?.[1];
      if (title && !s.includes(MARK) && words(s) > SECTION_NEEDS_VISUAL) {
        error('visual-first', n.file, `section "${title}" (line ${lineAt(masked, pos)}) has ${words(s)} words and no visual`, 'give it a diagram, stepper, calculator, comparison or table, or link to the note that has one', { code: 'section-no-visual' });
      }
      pos += s.length;
    }

    // 4. Short paragraphs.
    pos = 0;
    for (const p of masked.split(/\n\s*\n/)) {
      const w = words(p);
      if (w > LONG_PARAGRAPH && !/^\s*[-*\d]/.test(p)) warn('visual-first', n.file, `paragraph at line ${lineAt(masked, pos)} has ${w} words`, `split it (aim for under ${LONG_PARAGRAPH})`);
      pos += p.length + 2;
    }

    // 5. Callouts are seasoning.
    const callouts = (n.text.match(/<Callout\b/g) ?? []).length;
    if (callouts > MAX_CALLOUTS) warn('visual-first', n.file, `${callouts} callouts`, `keep at most ${MAX_CALLOUTS}; fold the rest into the prose or cut them`);
  }
}

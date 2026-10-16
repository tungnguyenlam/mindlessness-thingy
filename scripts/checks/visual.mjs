// Visual-first (PRINCIPLES.md#visual-first): show the idea before explaining it.
const VISUAL = /<(ArchDiagram|Calc|Stepper|Figure)\b/;
const VISUAL_OR_TABLE = /<(ArchDiagram|Calc|Stepper|Figure|Spec)\b/g;
// Longest stretch of prose allowed between two visuals before we nudge.
const MAX_WORDS = 650;

const words = (s) =>
  s
    .replace(/\$\$[\s\S]*?\$\$/g, ' ')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .split(/\s+/)
    .filter((w) => /[a-z]/i.test(w)).length;

export default function visual({ notes }, { error, warn }) {
  for (const n of notes) {
    const d = n.data;
    if (d.status === 'stub' || d.kind === 'path') continue;
    if (!VISUAL.test(n.text)) {
      error(
        'visual-first',
        n.file,
        `${d.status} ${d.kind} note has no visual`,
        'add one before more prose: <ArchDiagram> for structure, <Calc> for how it scales, <Stepper> for a procedure (see templates/notes/)',
      );
    }
    if (d.kind === 'system') {
      if (!/<Spec\b/.test(n.text)) warn('visual-first', n.file, 'system note has no <Spec> table', 'put the headline numbers in a <Spec> with a source on every row');
      if (!/<ArchDiagram\b/.test(n.text)) warn('visual-first', n.file, 'system note has no <ArchDiagram> of the overall block');
    }
    // Walls of text: find the longest prose run between visuals.
    let last = 0;
    let worst = { n: 0, at: 0 };
    const cuts = [...n.text.matchAll(VISUAL_OR_TABLE)].map((m) => m.index).concat(n.text.length);
    for (const c of cuts) {
      const count = words(n.text.slice(last, c));
      if (count > worst.n) worst = { n: count, at: last };
      last = c;
    }
    if (worst.n > MAX_WORDS) {
      const line = n.text.slice(0, worst.at).split('\n').length + n.bodyLine - 1;
      warn('visual-first', n.file, `${worst.n} words of prose without a visual (from line ${line})`, 'split the idea and show the key step as a diagram, calculator or stepper');
    }
  }
}

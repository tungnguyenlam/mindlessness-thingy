// The rule registry. Every problem `pnpm run check` reports names one of these ids, so an agent
// that goes off the rails is pointed back at the exact rule it broke and where it is written down.
//
// Adding a rule:
//   1. add an entry here (id, title, doc anchor);
//   2. document it under that anchor (checks/rules-doc.mjs fails if the doc doesn't mention the id);
//   3. enforce it in a module in scripts/checks/ (or in an agent hook, see docs/guardrails.md).
export const RULES = {
  'one-idea': {
    title: 'One idea per note; link instead of re-explaining',
    doc: 'AGENTS.md#rules',
  },
  'sourced-numbers': {
    title: 'Every number comes from a source file',
    doc: 'AGENTS.md#rules',
  },
  'agent-status': {
    title: 'Agents write stub or draft, never reviewed or verified',
    doc: 'AGENTS.md#rules',
  },
  'no-dangling': {
    title: 'Every link points to a note; missing ideas become stubs with a real summary',
    doc: 'AGENTS.md#rules',
  },
  'reading-order': {
    title: 'prerequisites + builds_on form a DAG',
    doc: 'AGENTS.md#rules',
  },
  wikilinks: {
    title: 'Link notes with [[slug]], not raw URLs',
    doc: 'AGENTS.md#rules',
  },
  'visual-first': {
    title: 'Show before you tell: every written concept/system note has a visual',
    doc: 'PRINCIPLES.md#visual-first',
  },
  'keep-place': {
    title: 'A reader can always return to the exact spot they left',
    doc: 'PRINCIPLES.md#keep-place',
  },
  'template-complete': {
    title: 'No TODO or template markers left in a written note',
    doc: 'AGENTS.md#rules',
  },
  frontmatter: {
    title: 'Frontmatter is complete and the file sits in the right folder',
    doc: 'AGENTS.md#frontmatter',
  },
  'catalog-sync': {
    title: 'Docs match the code: every viz component and every rule id is documented',
    doc: 'AGENTS.md#components',
  },
  'diagram-geometry': {
    title: 'Diagrams lay out cleanly: no overlaps, no edges through blocks, labels fit, not too wide',
    doc: 'AGENTS.md#rules',
  },
  'model-card': {
    title: 'A system note with model data shows the whole model (ModelOverview) and its tokenizer (Tokenizer)',
    doc: 'AGENTS.md#rules',
  },
  'render-clean': {
    title: 'Pages render cleanly at desktop and phone width: no sideways scroll, clipped or colliding text, math or script errors',
    doc: 'AGENTS.md#rules',
  },
  'commit-when-done': {
    title: 'Finish every task with a passing check and a commit of only your files',
    doc: 'AGENTS.md#task-lifecycle',
  },
};

import { visit, SKIP } from 'unist-util-visit';
import { WIKILINK_RE, noteLookup } from './content-index.mjs';

/**
 * Turns [[slug]] and [[slug|label]] into links to /notes/<slug>/.
 * An unknown slug fails the build: create a stub note first.
 */
export default function remarkWikilinks({ base = '' } = {}) {
  const prefix = base.replace(/\/$/, '');
  return (tree, file) => {
    const notes = noteLookup();
    visit(tree, 'text', (node, index, parent) => {
      if (!parent || index === undefined || !node.value.includes('[[')) return;
      const parts = [];
      let last = 0;
      for (const m of node.value.matchAll(WIKILINK_RE)) {
        const slug = m[1].trim();
        const target = notes.get(slug);
        if (!target) {
          file.fail(`Unknown wikilink [[${slug}]]. Create it with: pnpm run new concept ${slug} "Title"`, node);
        }
        if (m.index > last) parts.push({ type: 'text', value: node.value.slice(last, m.index) });
        const classes = ['wikilink'];
        if (target.status === 'stub') classes.push('is-stub');
        parts.push({
          type: 'link',
          url: `${prefix}/notes/${slug}/`,
          data: { hProperties: { className: classes, 'data-slug': slug } },
          children: [{ type: 'text', value: m[2]?.trim() || target.title }],
        });
        last = m.index + m[0].length;
      }
      if (!parts.length) return;
      if (last < node.value.length) parts.push({ type: 'text', value: node.value.slice(last) });
      parent.children.splice(index, 1, ...parts);
      return [SKIP, index + parts.length];
    });
  };
}

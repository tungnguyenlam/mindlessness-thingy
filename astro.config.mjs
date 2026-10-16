// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import { unified } from '@astrojs/markdown-remark';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import remarkWikilinks from './src/lib/remark-wikilinks.mjs';

const base = '/mindlessness-thingy';

export default defineConfig({
  site: 'https://tungnguyenlam.github.io',
  base,
  trailingSlash: 'always',
  integrations: [mdx()],
  markdown: {
    // Math and wikilinks are remark/rehype plugins, so use the unified processor rather than the Sätteri default.
    processor: unified({
      remarkPlugins: [remarkMath, [remarkWikilinks, { base }]],
      rehypePlugins: [rehypeKatex],
      smartypants: false,
    }),
    shikiConfig: { theme: 'github-light' },
  },
});

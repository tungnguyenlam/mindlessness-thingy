import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'slugs are kebab-case');
const slugs = z.array(slug).default([]);

const notes = defineCollection({
  loader: glob({
    base: './src/content/notes',
    pattern: '**/*.mdx',
    // The filename is the ID, so folders can be reorganised without breaking links.
    generateId: ({ entry }) => entry.split('/').pop()!.replace(/\.mdx$/, ''),
  }),
  schema: z
    .object({
      title: z.string().min(1),
      kind: z.enum(['concept', 'system', 'path']),
      summary: z.string().min(1).max(220),
      domains: z.array(z.string()).default([]),
      prerequisites: slugs,
      builds_on: slugs,
      contrasts_with: slugs,
      related: slugs,
      sources: slugs,
      steps: slugs,
      status: z.enum(['stub', 'draft', 'reviewed', 'verified']),
      updated: z.coerce.date(),
    })
    .refine((d) => d.kind !== 'path' || d.steps.length > 0, {
      message: 'path notes need at least one entry in `steps`',
      path: ['steps'],
    }),
});

const sources = defineCollection({
  loader: glob({ base: './src/content/sources', pattern: '*.yaml' }),
  schema: z.object({
    title: z.string(),
    short: z.string().describe('Short label used in citations, e.g. "DeepSeek-V3 report"'),
    authors: z.string().optional(),
    year: z.number().int(),
    url: z.url(),
    type: z.enum(['paper', 'report', 'config', 'model-card', 'blog', 'repo', 'docs']),
    accessed: z.coerce.date().optional(),
    notes: z.string().optional(),
  }),
});

export const collections = { notes, sources };

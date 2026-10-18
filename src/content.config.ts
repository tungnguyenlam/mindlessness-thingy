import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { FIELDS, KINDS } from './lib/models/fields.mjs';
import { TOKENIZER_FIELDS } from './lib/tokenizers/fields.mjs';

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

// One file per model. Every value is { v, source, where }: a number without a source can't be
// written down (sourced-numbers). Field keys come from src/lib/models/fields.mjs.
const sourced = z
  .object({
    v: z.union([z.number(), z.string(), z.boolean()]),
    source: slug,
    where: z.string().min(1),
    /** Show this instead of the formatted number, e.g. "128K" when that is what the source says. */
    display: z.string().optional(),
    note: z.string().optional(),
  })
  .strict();
// A pipeline model (kind: pipeline) lists its stages from input to output. Each stage is sourced
// like a value (its label and sub may carry numbers); `from` names the stages feeding it. Exactly
// one stage is the `backbone`: its block is drawn from the model's fields and opens the layer view.
const stageInput = z.union([
  z.string(),
  z.object({ id: z.string(), label: z.string().optional(), dashed: z.boolean().optional(), side: z.enum(['left', 'right']).optional() }).strict(),
]);
const stage = z
  .object({
    id: z.string(),
    label: z.string(),
    sub: z.string().optional(),
    role: z.enum(['activation', 'weight', 'cache', 'route', 'op']),
    /** An off-the-shelf model used as is (not trained here). */
    frozen: z.boolean().optional(),
    backbone: z.boolean().optional(),
    link: slug.optional(),
    /** Grid position, as in <ArchDiagram>; leave both out to have the stage placed for you. */
    col: z.number().int().min(0).optional(),
    row: z.number().int().min(0).optional(),
    from: z.array(stageInput).optional(),
    source: slug,
    where: z.string().min(1),
  })
  .strict();
const models = defineCollection({
  loader: glob({ base: './src/content/models', pattern: '*.yaml' }),
  schema: z
    .object({
      title: z.string(),
      note: slug.optional(),
      family: z.string(),
      extends: slug.optional(),
      kind: z.enum(KINDS as [string, ...string[]]).optional(),
      stages: z.array(stage).optional(),
      ...Object.fromEntries(FIELDS.map((f) => [f.key, sourced.optional()])),
    })
    .strict(),
});

// One file per tokenizer, shared by every model that uses it (`tokenizer:` in the model file).
// Facts are sourced like model values; how it splits sample text is generated into
// src/data/tokenizer-samples.json by scripts/tokenizer-samples.py.
const tokenizers = defineCollection({
  loader: glob({ base: './src/content/tokenizers', pattern: '*.yaml' }),
  schema: z
    .object({
      title: z.string(),
      note: slug.optional(),
      family: z.string(),
      /** Source id of the tokenizer.json the facts and samples come from. */
      file: slug,
      ...Object.fromEntries(TOKENIZER_FIELDS.map((f) => [f.key, sourced.optional()])),
      pretokenizer: z.array(sourced.extend({ regex: z.string().optional() })).default([]),
      specials: z
        .object({
          source: slug,
          where: z.string(),
          tokens: z.array(z.object({ token: z.string(), id: z.number().int(), use: z.string() })),
        })
        .optional(),
    })
    .strict(),
});

export const collections = { notes, sources, models, tokenizers };

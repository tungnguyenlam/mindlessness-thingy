// Astro-side access to model data: the same resolveModels() the check uses, over the content
// collection, plus lookups for sources and notes so components can render links.
import { getCollection } from 'astro:content';
import { resolveModels } from './data.mjs';

let cache: Promise<Awaited<ReturnType<typeof build>>> | null = null;

async function build() {
  const [models, sources, notes] = await Promise.all([getCollection('models'), getCollection('sources'), getCollection('notes')]);
  const resolved = resolveModels(new Map(models.map((m) => [m.id, m.data])));
  return {
    models: resolved,
    sources: new Map(sources.map((s) => [s.id, s.data])),
    notes: new Map(notes.map((n) => [n.id, n.data])),
  };
}

export function modelData() {
  cache ??= build();
  return cache;
}

export async function requireModel(id: string, where: string) {
  const d = await modelData();
  const m = d.models.get(id);
  if (!m) throw new Error(`${where}: unknown model "${id}" (add src/content/models/${id}.yaml)`);
  return m;
}

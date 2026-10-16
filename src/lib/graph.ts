import { getCollection, type CollectionEntry } from 'astro:content';
import { extractWikilinks } from './content-index.mjs';

export type Note = CollectionEntry<'notes'>;
export type EdgeType = 'prerequisite' | 'builds_on' | 'contrasts_with' | 'related' | 'mentions' | 'step';

export interface GraphNode {
  slug: string;
  title: string;
  kind: Note['data']['kind'];
  status: Note['data']['status'];
  summary: string;
}

export interface GraphEdge {
  from: string;
  to: string;
  type: EdgeType;
}

export interface Graph {
  notes: Map<string, Note>;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

const FIELD_TO_TYPE = {
  prerequisites: 'prerequisite',
  builds_on: 'builds_on',
  contrasts_with: 'contrasts_with',
  related: 'related',
} as const;

let cached: Promise<Graph> | undefined;

export function getGraph(): Promise<Graph> {
  cached ??= build();
  return cached;
}

async function build(): Promise<Graph> {
  const entries = await getCollection('notes');
  const notes = new Map(entries.map((n) => [n.id, n]));
  const edges: GraphEdge[] = [];
  const seen = new Set<string>();
  const add = (from: string, to: string, type: EdgeType) => {
    const key = `${from}>${to}`;
    if (from === to || !notes.has(to) || seen.has(key)) return;
    seen.add(key);
    edges.push({ from, to, type });
  };

  // Typed links first so they win over plain mentions of the same pair.
  for (const n of entries) {
    for (const [field, type] of Object.entries(FIELD_TO_TYPE)) {
      for (const to of n.data[field as keyof typeof FIELD_TO_TYPE]) add(n.id, to, type);
    }
    for (const to of n.data.steps) add(n.id, to, 'step');
  }
  for (const n of entries) {
    for (const to of extractWikilinks(n.body ?? '')) add(n.id, to, 'mentions');
  }

  const nodes = entries.map((n) => ({
    slug: n.id,
    title: n.data.title,
    kind: n.data.kind,
    status: n.data.status,
    summary: n.data.summary,
  }));
  return { notes, nodes, edges };
}

/** Every note that links to `slug`, with the strongest link type. */
export function backlinks(g: Graph, slug: string) {
  return g.edges.filter((e) => e.to === slug).map((e) => ({ note: g.notes.get(e.from)!, type: e.type }));
}

/** Transitive prerequisites (including builds_on), ordered so each note comes after the ones it depends on. */
export function readFirst(g: Graph, slug: string): Note[] {
  const order: string[] = [];
  const visiting = new Set<string>();
  const done = new Set<string>();
  const visit = (s: string) => {
    if (done.has(s) || visiting.has(s)) return;
    visiting.add(s);
    const n = g.notes.get(s);
    if (n) for (const p of [...n.data.prerequisites, ...n.data.builds_on]) visit(p);
    visiting.delete(s);
    done.add(s);
    order.push(s);
  };
  visit(slug);
  return order.filter((s) => s !== slug && g.notes.has(s)).map((s) => g.notes.get(s)!);
}

/** Paths that include `slug`, with prev/next neighbours inside each path. */
export function pathPositions(g: Graph, slug: string) {
  return [...g.notes.values()]
    .filter((n) => n.data.kind === 'path' && n.data.steps.includes(slug))
    .map((path) => {
      const i = path.data.steps.indexOf(slug);
      const get = (s?: string) => (s ? g.notes.get(s) : undefined);
      return {
        path,
        index: i,
        total: path.data.steps.length,
        prev: get(path.data.steps[i - 1]),
        next: get(path.data.steps[i + 1]),
      };
    });
}

/** Direct neighbours in either direction, for the local graph. */
export function neighbours(g: Graph, slug: string) {
  const out = new Map<string, { note: Note; type: EdgeType; dir: 'out' | 'in' }>();
  for (const e of g.edges) {
    if (e.from === slug && !out.has(e.to)) out.set(e.to, { note: g.notes.get(e.to)!, type: e.type, dir: 'out' });
    if (e.to === slug && !out.has(e.from)) out.set(e.from, { note: g.notes.get(e.from)!, type: e.type, dir: 'in' });
  }
  return [...out.values()];
}

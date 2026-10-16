import type { APIRoute } from 'astro';
import { getGraph } from '../lib/graph';

export const GET: APIRoute = async () => {
  const { nodes } = await getGraph();
  return Response.json(
    Object.fromEntries(nodes.map(({ slug, title, summary, kind, status }) => [slug, { title, summary, kind, status }])),
  );
};

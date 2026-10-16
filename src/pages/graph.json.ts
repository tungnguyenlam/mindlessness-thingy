import type { APIRoute } from 'astro';
import { getGraph } from '../lib/graph';

export const GET: APIRoute = async () => {
  const { nodes, edges } = await getGraph();
  return Response.json({ nodes, edges });
};

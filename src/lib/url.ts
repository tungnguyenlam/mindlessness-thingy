const base = import.meta.env.BASE_URL.replace(/\/$/, '');

/** Prefix an absolute site path with the deploy base (GitHub Pages serves from /<repo>/). */
export function url(path: string): string {
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

export const noteUrl = (slug: string) => url(`/notes/${slug}/`);

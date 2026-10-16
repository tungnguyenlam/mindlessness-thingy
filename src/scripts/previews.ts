interface Preview {
  title: string;
  summary: string;
  kind: string;
  status: string;
}

const statusText: Record<string, string> = {
  stub: 'Stub, not written yet',
  draft: 'Draft',
  reviewed: 'Reviewed',
  verified: 'Verified against sources',
};

let data: Promise<Record<string, Preview>> | undefined;

function load(base: string) {
  data ??= fetch(`${base}/previews.json`).then((r) => (r.ok ? r.json() : {}));
  return data;
}

export function initPreviews() {
  const card = document.getElementById('preview-card');
  if (!card) return;
  const base = document.body.dataset.base ?? '';
  let current: HTMLElement | null = null;

  const show = async (a: HTMLElement) => {
    current = a;
    const p = (await load(base))[a.dataset.slug!];
    if (!p || current !== a) return;
    card.replaceChildren();
    const title = document.createElement('strong');
    title.textContent = p.title;
    const meta = document.createElement('span');
    meta.className = 'meta';
    meta.textContent = `${p.kind[0].toUpperCase()}${p.kind.slice(1)}, ${statusText[p.status] ?? p.status}`;
    card.append(title, p.summary, meta);
    card.hidden = false;
    const r = a.getBoundingClientRect();
    const w = card.offsetWidth;
    const left = Math.min(window.scrollX + r.left, window.scrollX + document.documentElement.clientWidth - w - 12);
    card.style.left = `${Math.max(8, left)}px`;
    card.style.top = `${window.scrollY + r.bottom + 6}px`;
  };
  const hide = () => {
    current = null;
    card.hidden = true;
  };

  const target = (e: Event) => (e.target as Element).closest<HTMLElement>('a[data-slug]');
  document.addEventListener('mouseover', (e) => {
    const a = target(e);
    if (a && a !== current) show(a);
  });
  document.addEventListener('mouseout', (e) => {
    const a = target(e);
    if (a && !a.contains(e.relatedTarget as Node)) hide();
  });
  document.addEventListener('focusin', (e) => {
    const a = target(e);
    if (a) show(a);
  });
  document.addEventListener('focusout', hide);
  document.addEventListener('keydown', (e) => e.key === 'Escape' && hide());
}

/**
 * Return-to-place trail. Implements principle "keep-place" in PRINCIPLES.md:
 * a reader who follows a link can always get back to the exact spot they left,
 * not just the page.
 *
 * - Every link click records an Entry: the page, which link, how far down the
 *   screen it sat, the sentence around it, and the state of interactive
 *   components (stepper step, calculator sliders, open <details>, side panel
 *   scroll, map pan and zoom).
 * - The "Back to ..." ribbon (#trail, rendered by Base.astro) returns to the
 *   newest entry. The `B` key and the browser's Back button do the same.
 * - On return the link lands at the same height on screen it had when clicked,
 *   component state comes back, and the link is marked so the eye finds it.
 *
 * Interactive components take part by adding `data-restorable` and implementing
 * `snapshot()` / `restore(state)` (the Restorable interface below). Scrollable
 * panels take part with `data-keep-scroll`. `pnpm run check` enforces both.
 */

export interface Restorable extends HTMLElement {
  /** JSON-serialisable state, or null when there is nothing worth restoring. */
  snapshot(): unknown;
  /** May be called before the component has finished setting up; stash and apply later if so. */
  restore(state: unknown): void;
  /** Optional: resolves once the component has rendered its links (needed if it builds them asynchronously). */
  whenReady?(): Promise<void>;
}

interface Entry {
  id: string;
  /** pathname + search of the page that was left. */
  path: string;
  /** path + hash, used for same-page jumps. */
  url: string;
  title: string;
  /** Nearest heading or panel name above the link. */
  section: string;
  text: string;
  before: string;
  after: string;
  /** Raw href attribute and its occurrence index among links with the same href. */
  href: string;
  nth: number;
  /** The link's distance from the top of the viewport when clicked. */
  offset: number;
  scrollY: number;
  state: Record<string, unknown>;
  scrolls: number[];
  details: boolean[];
  samePage: boolean;
  /** pathname of the destination, so the ribbon can show where you are coming from. */
  to: string;
}

const STACK = 'trail:v1';
const ARRIVE = 'trail:arrive';
const RESTORE = 'trail:restore';
const MAX = 30;
const SETTLE_MS = 1500;
const MARK_MS = 7000;

const store = {
  load(): Entry[] {
    try {
      return JSON.parse(sessionStorage.getItem(STACK) ?? '[]');
    } catch {
      return [];
    }
  },
  save(stack: Entry[]) {
    try {
      sessionStorage.setItem(STACK, JSON.stringify(stack.slice(-MAX)));
    } catch {
      /* storage full or disabled: the trail is a convenience, never an error */
    }
  },
  take(key: string) {
    const v = sessionStorage.getItem(key);
    sessionStorage.removeItem(key);
    return v;
  },
};

const here = () => location.pathname + location.search;
const hereFull = () => here() + location.hash;
const squash = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();
const hrefOf = (a: Element) => a.getAttribute('href') ?? '';
const pageTitle = () => document.body.dataset.pageTitle || squash(document.querySelector('h1')?.textContent) || document.title;

function links(): Element[] {
  return [...document.querySelectorAll('a[href]')].filter((a) => !a.closest('#trail'));
}

function cut(s: string, n: number, fromEnd: boolean) {
  if (s.length <= n) return s;
  const part = fromEnd ? s.slice(-n) : s.slice(0, n);
  const space = fromEnd ? part.indexOf(' ') : part.lastIndexOf(' ');
  const trimmed = space > 0 && space < n - 8 ? (fromEnd ? part.slice(space + 1) : part.slice(0, space)) : part;
  return fromEnd ? `…${trimmed}` : `${trimmed}…`;
}

/**
 * Visible text of `root`, split around `anchor`. Skips tooltips, screen-reader-only text and
 * KaTeX's duplicate MathML; math is shown as its TeX source.
 */
function splitText(root: Element, anchor: Element) {
  const parts = { before: '', mid: '', after: '' };
  let where: keyof typeof parts = 'before';
  const walk = (n: Node) => {
    if (n === anchor) {
      where = 'mid';
      n.childNodes.forEach(walk);
      where = 'after';
      return;
    }
    if (n.nodeType === Node.TEXT_NODE) {
      parts[where] += n.textContent;
      return;
    }
    if (!(n instanceof Element)) return;
    if (n.matches('title, desc, style, script, .visually-hidden, [aria-hidden="true"]')) return;
    if (n.classList.contains('katex')) {
      parts[where] += ` ${n.querySelector('annotation')?.textContent ?? ''} `;
      return;
    }
    n.childNodes.forEach(walk);
  };
  walk(root);
  return { before: squash(parts.before), mid: squash(parts.mid), after: squash(parts.after) };
}

/** The sentence around the link, so the ribbon can show exactly where you were reading. */
function context(a: Element) {
  const block = a.closest('p, li, td, th, dd, dt, figcaption, blockquote, h1, h2, h3, h4, .block') ?? a.parentElement ?? a;
  const { before, mid, after } = splitText(block, a);
  return { text: mid || squash(a.getAttribute('title')) || squash(a.textContent), before: cut(before, 70, true), after: cut(after, 60, false) };
}

function sectionOf(a: Element): string {
  const prose = a.closest('.prose');
  if (prose) {
    let last = '';
    for (const h of prose.querySelectorAll('h2, h3')) {
      if (h.compareDocumentPosition(a) & Node.DOCUMENT_POSITION_FOLLOWING) last = squash(h.textContent);
    }
    return last;
  }
  const box = a.closest('section, aside, nav');
  return squash(box?.querySelector('h1, h2, h3')?.textContent) || box?.getAttribute('aria-label') || '';
}

function keyed<T extends Element>(selector: string) {
  const counts = new Map<string, number>();
  return [...document.querySelectorAll<T>(selector)].map((el) => {
    const tag = el.tagName.toLowerCase();
    const n = counts.get(tag) ?? 0;
    counts.set(tag, n + 1);
    return [el.id || `${tag}#${n}`, el] as const;
  });
}

function collectState() {
  const state: Record<string, unknown> = {};
  for (const [key, el] of keyed<Restorable>('[data-restorable]')) {
    const s = typeof el.snapshot === 'function' ? el.snapshot() : null;
    if (s !== null && s !== undefined) state[key] = s;
  }
  const scrolls = [...document.querySelectorAll<HTMLElement>('[data-keep-scroll]')].map((el) => el.scrollTop);
  const details = [...document.querySelectorAll<HTMLDetailsElement>('main details')].map((d) => d.open);
  return { state, scrolls, details };
}

async function applyState(e: Entry) {
  const els = keyed<Restorable>('[data-restorable]');
  await Promise.all(
    [...new Set(els.map(([, el]) => el.tagName.toLowerCase()))]
      .filter((t) => t.includes('-'))
      .map((t) => customElements.whenDefined(t)),
  );
  const timeout = new Promise<void>((r) => setTimeout(r, 2000));
  await Promise.race([Promise.all(els.map(([, el]) => el.whenReady?.())), timeout]);
  for (const [key, el] of els) if (key in e.state && typeof el.restore === 'function') el.restore(e.state[key]);
  document.querySelectorAll<HTMLDetailsElement>('main details').forEach((d, i) => {
    if (e.details[i] !== undefined) d.open = e.details[i];
  });
  document.querySelectorAll<HTMLElement>('[data-keep-scroll]').forEach((el, i) => {
    if (e.scrolls[i]) el.scrollTop = e.scrolls[i];
  });
}

function findAnchor(e: Entry): Element | null {
  const same = links().filter((a) => hrefOf(a) === e.href);
  // A wrong look-alike link is worse than the saved scroll position, so only guess when there's one candidate.
  return same[e.nth] ?? (same.length === 1 ? same[0] : null);
}

/** Put the link back at the height on screen where it was clicked, and keep it there while late layout settles. */
function align(e: Entry, anchor: Element | null) {
  const place = () => {
    if (!anchor || !anchor.isConnected) return window.scrollTo({ top: e.scrollY, behavior: 'instant' });
    const top = Math.max(64, Math.min(e.offset, window.innerHeight - 96));
    window.scrollBy({ top: anchor.getBoundingClientRect().top - top, behavior: 'instant' });
  };
  place();
  const stop = () => {
    ro.disconnect();
    for (const t of ['wheel', 'touchstart', 'keydown', 'pointerdown']) removeEventListener(t, stop, true);
  };
  const ro = new ResizeObserver(place);
  ro.observe(document.body);
  for (const t of ['wheel', 'touchstart', 'keydown', 'pointerdown']) addEventListener(t, stop, { capture: true, passive: true });
  setTimeout(stop, SETTLE_MS);
}

let markTimer: number | undefined;
function mark(anchor: Element | null) {
  document.querySelectorAll('.place-here').forEach((el) => el.classList.remove('place-here'));
  clearTimeout(markTimer);
  if (!anchor) return;
  // Restart the animation even if the same link is marked twice in a row.
  void (anchor as HTMLElement).getBoundingClientRect();
  anchor.classList.add('place-here');
  markTimer = window.setTimeout(() => anchor.classList.remove('place-here'), MARK_MS);
}

function announce(msg: string) {
  const live = document.querySelector('#trail .trail-live');
  if (live) live.textContent = msg;
}

async function restore(e: Entry) {
  await applyState(e);
  await document.fonts?.ready;
  await new Promise(requestAnimationFrame);
  const anchor = findAnchor(e);
  align(e, anchor);
  mark(anchor);
  announce(`Back at ${e.section || e.title}${e.text ? `, at the link “${e.text}”` : ''}.`);
}

function tagHistory(id: string) {
  history.replaceState({ ...(history.state ?? {}), trailFrom: id }, '');
}

function record(a: Element) {
  const href = hrefOf(a);
  const dest = new URL(href, location.href);
  const samePage = dest.origin === location.origin && dest.pathname + dest.search === here();
  if (samePage && (!dest.hash || dest.hash === location.hash)) return;

  const nth = links()
    .filter((l) => hrefOf(l) === href)
    .indexOf(a);
  const entry: Entry = {
    id: Math.random().toString(36).slice(2, 10),
    path: here(),
    url: hereFull(),
    title: pageTitle(),
    section: sectionOf(a),
    ...context(a),
    href,
    nth: Math.max(0, nth),
    offset: a.getBoundingClientRect().top,
    scrollY: window.scrollY,
    ...collectState(),
    samePage,
    to: dest.origin === location.origin ? dest.pathname : dest.href,
  };
  store.save([...store.load(), entry]);

  if (samePage) addEventListener('hashchange', () => (tagHistory(entry.id), render()), { once: true });
  // Only our own pages can read sessionStorage, so external links rely on browser Back alone.
  else if (dest.origin === location.origin) sessionStorage.setItem(ARRIVE, entry.id);
}

/** Return to entry `i` of the stack (default: the newest). Everything newer is dropped. */
function goBack(i?: number) {
  const stack = store.load();
  const idx = i ?? stack.length - 1;
  const target = stack[idx];
  if (!target) return;
  const newest = idx === stack.length - 1;

  if (newest && history.state?.trailFrom === target.id) {
    history.back(); // the browser keeps the page in its back/forward cache when it can
    return;
  }
  if (target.path === here()) {
    store.save(stack.slice(0, idx));
    restore(target).then(render);
    return;
  }
  store.save(stack.slice(0, idx + 1));
  sessionStorage.setItem(RESTORE, target.id);
  location.assign(target.url);
}

function matches(e: Entry | undefined) {
  if (!e) return false;
  return e.samePage ? e.url === hereFull() : e.path === here();
}

function arrive(backForward: boolean) {
  const stack = store.load();
  const wanted = store.take(RESTORE);
  let target: Entry | undefined;

  if (wanted) {
    const i = stack.findIndex((e) => e.id === wanted);
    if (i >= 0 && stack[i].path === here()) {
      target = stack[i];
      store.save(stack.slice(0, i));
    }
  } else if (backForward && matches(stack.at(-1))) {
    target = stack.at(-1);
    store.save(stack.slice(0, -1));
  }

  const arrived = store.take(ARRIVE);
  if (arrived && !target) tagHistory(arrived);
  if (target) restore(target);
  render();
}

/* ---------- The ribbon ---------- */

const h = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string) => {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (text) el.textContent = text;
  return el;
};

function quote(e: Entry) {
  const q = h('span', 'trail-quote');
  if (!e.text) return q;
  q.append(e.before ? `${e.before} ` : '', h('mark', '', e.text), e.after ? ` ${e.after}` : '');
  return q;
}

function label(e: Entry) {
  const onThisPage = e.path === here();
  const l = h('span', 'trail-label');
  l.append(onThisPage ? 'Back to where you were' : 'Back to ', onThisPage ? '' : h('strong', '', e.title));
  if (e.section && e.section !== e.title) l.append(h('span', 'trail-where', e.section));
  return l;
}

let expanded = false;
function render() {
  const root = document.getElementById('trail');
  if (!root) return;
  const stack = store.load();
  const top = stack.at(-1);
  const live = root.querySelector('.trail-live') ?? h('p', 'trail-live visually-hidden');
  live.setAttribute('aria-live', 'polite');
  root.replaceChildren(live);
  root.hidden = !top;
  if (!top) return;

  const bar = h('div', 'trail-bar');
  const back = h('button', 'trail-back');
  back.type = 'button';
  back.title = 'Return to the exact spot you left (B)';
  const kbd = h('kbd', 'trail-key', 'B');
  kbd.setAttribute('aria-hidden', 'true');
  back.append(h('span', 'trail-ribbon'), label(top), quote(top), kbd);
  back.addEventListener('click', () => goBack());
  bar.append(back);

  const older = stack.length - 1;
  if (older > 0) {
    const more = h('button', 'trail-more');
    more.type = 'button';
    more.setAttribute('aria-expanded', String(expanded));
    more.setAttribute('aria-controls', 'trail-list');
    more.title = 'Show the whole trail';
    const dots = h('span', 'trail-dots');
    dots.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < Math.min(older, 5); i++) dots.append(h('i'));
    more.append(dots, h('span', 'visually-hidden', `${older} earlier ${older === 1 ? 'stop' : 'stops'}`));
    more.addEventListener('click', () => {
      expanded = !expanded;
      render();
    });
    bar.append(more);
  }

  const clear = h('button', 'trail-clear', '×');
  clear.type = 'button';
  clear.title = 'Forget this trail';
  clear.setAttribute('aria-label', 'Forget this trail');
  clear.addEventListener('click', () => {
    store.save([]);
    expanded = false;
    render();
  });
  bar.append(clear);

  if (older > 0 && expanded) {
    const list = h('ol', 'trail-list');
    list.id = 'trail-list';
    list.setAttribute('aria-label', 'Your trail, newest first');
    stack
      .map((e, i) => [e, i] as const)
      .reverse()
      .forEach(([e, i]) => {
        const li = h('li');
        const b = h('button', 'trail-stop');
        b.type = 'button';
        b.append(h('strong', '', e.path === here() ? 'This page' : e.title), e.section ? h('span', 'trail-where', e.section) : '', quote(e));
        b.addEventListener('click', () => goBack(i));
        li.append(b);
        list.append(li);
      });
    root.append(list);
  }
  root.append(bar);
}

/* ---------- Wiring ---------- */

let started = false;
export function initTrail() {
  if (started) return;
  started = true;

  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = (e.target as Element | null)?.closest?.('a[href]');
    if (!a || a.closest('#trail') || a.hasAttribute('download')) return;
    const target = a.getAttribute('target');
    if (target && target !== '_self') return;
    record(a);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'b' && e.key !== 'B') return;
    if (e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented) return;
    const t = e.target as HTMLElement;
    if (t.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]')) return;
    if (!store.load().length) return;
    e.preventDefault();
    goBack();
  });

  addEventListener('popstate', () => {
    const stack = store.load();
    const top = stack.at(-1);
    if (top?.samePage && matches(top)) {
      store.save(stack.slice(0, -1));
      restore(top);
    }
    render();
  });

  // Fires on first load and when the page comes back from the back/forward cache.
  addEventListener('pageshow', (e) => {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    arrive(e.persisted || nav?.type === 'back_forward');
  });
}

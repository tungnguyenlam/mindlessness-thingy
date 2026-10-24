/**
 * Motion that answers the reader's own actions. Styles and timing live in global.css
 * ("Motion on reader actions"); durations count frames at 30 fps and the curves are measured ones.
 *
 * Two rules keep this compatible with keep-place (PRINCIPLES.md#keep-place):
 * - Only a reader's click or key starts a tab animation. Restoring state (trail.ts calls
 *   restore() on components) never does, so a returning reader finds every panel already still.
 * - A diagram draws its edges only the first time it scrolls into view. Diagrams on screen when
 *   the page opens, and every diagram once the trail starts restoring a place, are left drawn.
 * Animations use transforms and paint only, so no layout moves and the trail's alignment holds.
 *
 * restorable: none, these are one-shot entrances; the settled state is the default markup.
 */

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- Tabs: the panel the reader opened lands ---------- */

function initTabs() {
  let before: Set<Element> | null = null;
  const panels = () => document.querySelectorAll('[role="tabpanel"]');
  const snapshot = () => {
    before = new Set([...panels()].filter((p) => (p as HTMLElement).hidden));
  };
  const settle = () => {
    if (!before) return;
    const was = before;
    before = null;
    if (reduced()) return;
    for (const p of panels()) {
      if (!was.has(p) || (p as HTMLElement).hidden) continue;
      p.classList.remove('motion-enter');
      void (p as HTMLElement).offsetWidth; // restart if the same panel opens twice in a row
      p.classList.add('motion-enter');
      p.addEventListener('animationend', () => p.classList.remove('motion-enter'), { once: true });
    }
  };
  // Capture runs before the component's own handler, bubbling on document runs after it.
  for (const type of ['click', 'keydown'] as const) {
    document.addEventListener(type, snapshot, { capture: true });
    document.addEventListener(type, settle);
  }
}

/* ---------- Diagrams: edges draw in data-flow order on first view ---------- */

function initDiagrams() {
  const figures = [...document.querySelectorAll<HTMLElement>('figure[data-draw]')];
  if (!figures.length || reduced() || !('IntersectionObserver' in window)) return;

  const seen = new WeakSet<Element>();
  const finish = (f: Element) => {
    seen.add(f);
    io.unobserve(f);
    f.classList.remove('is-waiting', 'is-drawing');
    f.querySelectorAll('.edge.drawn').forEach((e) => e.classList.remove('drawn'));
  };

  const draw = (f: HTMLElement) => {
    seen.add(f);
    io.unobserve(f);
    // Each solid edge gets its arrowhead the frame its line arrives.
    const onEnd = (ev: AnimationEvent) => {
      if (ev.animationName === 'edge-draw') (ev.target as Element).closest('.edge')?.classList.add('drawn');
    };
    f.addEventListener('animationend', onEnd);
    f.classList.remove('is-waiting');
    f.classList.add('is-drawing');
    // When the last edge has landed, drop the classes so the markup is back to its settled form.
    const steps = Math.max(0, ...[...f.querySelectorAll<HTMLElement>('.edge')].map((e) => +e.style.getPropertyValue('--i') || 0));
    const frames = steps * 5 + 10;
    setTimeout(() => {
      f.removeEventListener('animationend', onEnd);
      finish(f);
    }, frames * (1000 / 30) + 50);
  };

  let first = true;
  const io = new IntersectionObserver(
    (entries) => {
      for (const { target, isIntersecting, intersectionRatio } of entries) {
        const f = target as HTMLElement;
        if (seen.has(f)) continue;
        // On screen when the page opened: the reader has already seen it drawn.
        if (first && isIntersecting) {
          finish(f);
          continue;
        }
        if (first) f.classList.add('is-waiting');
        if (isIntersecting && intersectionRatio >= 0.35) draw(f);
      }
      first = false;
    },
    { threshold: [0, 0.35] },
  );
  figures.forEach((f) => io.observe(f));

  // Returning to a place is not a first view: show everything as it was left.
  document.addEventListener('trail:restore', () => figures.forEach(finish));
}

let started = false;
export function initMotion() {
  if (started) return;
  started = true;
  initTabs();
  initDiagrams();
}

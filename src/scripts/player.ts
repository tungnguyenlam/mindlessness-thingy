// A beat player for live animations (<NormLab>, <DecodeGrid>): plays beats in a loop while at least
// half of the picture is on screen. The button or a click on the picture pauses; a dot jumps to that
// beat and pauses; arrow keys step. Reduced motion never autoplays and never tweens.
// Restorable through its host (src/scripts/trail.ts): snapshot() is the beat and whether it was
// started; restore() shows that beat, paused, because restoring never starts motion.
//
// Markup inside `root`: .say × n, .beat-dot × n, .play, .controls (hidden until the script runs).

export const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export interface PlayerOptions {
  /** How long beat i stays before the next one, in ms. */
  length: (i: number) => number;
  /** Show beat i; animate is false on restore and under reduced motion. */
  show: (i: number, animate: boolean) => void;
  /** The element whose visibility starts and stops the loop. */
  watch: Element;
}

export interface Player {
  readonly i: number;
  readonly paused: boolean;
  snapshot(): { f: number } | null;
  restore(state: unknown): void;
}

export function mountPlayer(root: HTMLElement, opts: PlayerOptions): Player {
  const says = [...root.querySelectorAll<HTMLElement>('.say')];
  const dots = [...root.querySelectorAll<HTMLButtonElement>('.beat-dot')];
  const play = root.querySelector<HTMLButtonElement>('.play')!;
  const n = says.length;
  let i = 0;
  let started = false;
  let paused = false;
  let visible = false;
  let timer = 0;

  const go = (k: number, animate: boolean) => {
    i = (k + n) % n;
    says.forEach((s, j) => (s.hidden = j !== i));
    dots.forEach((d, j) => (j === i ? d.setAttribute('aria-current', 'step') : d.removeAttribute('aria-current')));
    opts.show(i, animate && !reduced());
  };
  const tick = () => {
    clearTimeout(timer);
    if (paused || !visible) return;
    timer = window.setTimeout(() => {
      go(i + 1, true);
      tick();
    }, opts.length(i) + (i === n - 1 ? 1500 : 0));
  };
  const setPaused = (p: boolean) => {
    paused = p;
    root.classList.toggle('paused', p);
    play.setAttribute('aria-label', p ? 'Play' : 'Pause');
    tick();
  };

  root.querySelector<HTMLElement>('.controls')!.hidden = false;
  play.addEventListener('click', () => {
    started = true;
    if (paused) go(i + (i === n - 1 ? 1 : 0), true);
    setPaused(!paused);
  });
  opts.watch.addEventListener('click', (e) => {
    if ((e.target as Element).closest('a, button, input')) return;
    play.click();
  });
  dots.forEach((d, k) =>
    d.addEventListener('click', () => {
      started = true;
      setPaused(true);
      go(k, true);
    }),
  );
  root.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    started = true;
    setPaused(true);
    go(i + (e.key === 'ArrowRight' ? 1 : -1), true);
  });
  if (reduced()) setPaused(true);
  document.addEventListener('trail:restore', () => {
    if (!started) setPaused(true);
  });
  go(0, false);
  new IntersectionObserver(
    ([entry]) => {
      visible = entry.isIntersecting;
      if (visible && !started && !paused) {
        started = true;
        go(0, true);
      }
      tick();
    },
    { threshold: 0.5 },
  ).observe(opts.watch);

  return {
    get i() {
      return i;
    },
    get paused() {
      return paused;
    },
    snapshot: () => (started ? { f: i } : null),
    restore(state) {
      const s = state as { f?: number } | null;
      if (!s || typeof s.f !== 'number') return;
      started = true;
      setPaused(true);
      go(s.f, false);
    },
  };
}

type Num = number | Num[];
const lerp = (a: Num, b: Num, t: number): Num =>
  Array.isArray(a) ? a.map((x, k) => lerp(x, (b as Num[])[k] ?? x, t)) : (a as number) + ((b as number) - (a as number)) * t;
const ease = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * Moves numeric state from `from` to `to` over `ms`, calling draw on every frame. Returns the
 * cancel function; calling a new tween on the same key cancels the old one.
 */
export function tweener<S extends Record<string, Num>>(draw: (s: S) => void) {
  let raf = 0;
  let cur: S | null = null;
  return {
    get state() {
      return cur;
    },
    to(target: S, ms: number, linear = false) {
      cancelAnimationFrame(raf);
      const from = cur ?? target;
      if (ms <= 0 || !cur) {
        cur = target;
        draw(cur);
        return;
      }
      const t0 = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - t0) / ms);
        const e = linear ? t : ease(t);
        cur = Object.fromEntries(Object.keys(target).map((k) => [k, lerp(from[k] ?? target[k], target[k], e)])) as S;
        draw(cur);
        if (t < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    },
  };
}

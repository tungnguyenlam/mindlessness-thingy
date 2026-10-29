// Helpers for scene files (src/lib/scenes/<name>.mjs), drawn by <Scene name="...">.
//
// A scene file default-exports:
//   {
//     viewBox: [w, h],              // keep w ≤ 480 so labels stay readable on a phone
//     setup() { return ctx },       // optional: deterministic data (seeded rng), computed once
//     beats: [{ say, state, ms?, tween?, linear? }],
//                                   // say: the one short line for this beat (plain words, ≤ ~18 words)
//                                   // state: numbers or arrays of numbers, tweened from the last beat;
//                                   //        strings and booleans switch instantly
//                                   // ms: how long the beat stays (default 3600)
//                                   // tween: ms to move into this state (default 900); linear: no easing
//                                   // from: state to jump to before tweening (e.g. restart a sweep)
//     draw(state, ctx) { return '<svg markup>' },   // pure: called every frame and on the server
//   }
// draw returns SVG markup as a string. Use the classes below; colours carry the site's fixed roles.
//
// CSS classes available inside a scene (styled in Scene.astro):
//   roles (fill + stroke): act (activation), wt (weight), cache, route, op; add `solid` for a filled
//     shape (e.g. class="act solid"). ink (dark), faint (muted), hot (thick dark outline)
//   lines: wire (thin), flow (thick activation-coloured), dash (dashed), arrow (adds an arrowhead)
//   text: t (normal 12px), tb (bold), ts (small 10.5px, muted), tm (monospace), tc (centred), te (end-anchored)
//   opacity: give a group opacity="..." from the tweened state to fade things in and out.

export function rng(seed) {
  let s = seed >>> 0;
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const gauss = () => Math.sqrt(-2 * Math.log(1 - next())) * Math.cos(2 * Math.PI * next());
  return { next, gauss };
}

export const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
/** Progress of a sub-animation that runs while `t` goes from a to b, clamped to 0..1. */
export const span = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
export const f1 = (x) => (Math.abs(x) < 0.05 ? '0.0' : x.toFixed(1)).replace('-', '−');
export const f2 = (x) => x.toFixed(2).replace('-', '−');
export const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export const n = (x) => (Math.round(x * 10) / 10).toString();

export const mean = (v) => v.reduce((a, b) => a + b, 0) / v.length;
export const std = (v) => {
  const m = mean(v);
  return Math.sqrt(mean(v.map((x) => (x - m) ** 2)));
};
export const softmax = (z, temp = 1) => {
  const m = Math.max(...z);
  const e = z.map((x) => Math.exp((x - m) / temp));
  const s = e.reduce((a, b) => a + b, 0);
  return e.map((x) => x / s);
};
export const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);
export const matvec = (v, W) => W[0].map((_, j) => v.reduce((a, x, i) => a + x * W[i][j], 0));
export const matrix = (r, rows, cols, scale = 1) => Array.from({ length: rows }, () => Array.from({ length: cols }, () => scale * r.gauss()));

// ---- drawing ----
const a = (o) =>
  Object.entries(o)
    .filter(([, v]) => v !== undefined && v !== null && v !== false)
    .map(([k, v]) => `${k}="${typeof v === 'number' ? n(v) : esc(v)}"`)
    .join(' ');

export const text = (x, y, s, cls = 't', extra = {}) => `<text ${a({ x, y, class: cls, ...extra })}>${esc(s)}</text>`;
export const rect = (x, y, w, h, cls = 'op', extra = {}) => `<rect ${a({ x, y, width: Math.max(0, w), height: Math.max(0, h), rx: 3, class: cls, ...extra })}/>`;
export const circle = (cx, cy, r, cls = 'ink solid', extra = {}) => `<circle ${a({ cx, cy, r, class: cls, ...extra })}/>`;
export const line = (x1, y1, x2, y2, cls = 'wire', extra = {}) => `<line ${a({ x1, y1, x2, y2, class: cls, ...extra })}/>`;
export const path = (d, cls = 'wire', extra = {}) => `<path ${a({ d, class: cls, ...extra })}/>`;
export const group = (inner, extra = {}) => `<g ${a(extra)}>${inner}</g>`;
/** A labelled box: label centred, optional sub line under it (a shape or one short fact). */
export function box(x, y, w, h, label, cls = 'op', sub) {
  const cy = y + h / 2;
  return rect(x, y, w, h, cls) + (sub ? text(x + w / 2, cy - 2, label, 't tc') + text(x + w / 2, cy + 11, sub, 'ts tc tm') : text(x + w / 2, cy + 4, label, 't tc'));
}
/** A straight arrow from (x1, y1) to (x2, y2). */
export const arrow = (x1, y1, x2, y2, cls = 'wire') => line(x1, y1, x2, y2, `${cls} arrow`);
/** A point `t` (0..1) of the way along a polyline [[x, y], ...]. */
export function along(pts, t) {
  const seg = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]));
  let d = clamp(t, 0, 1) * seg.reduce((s, x) => s + x, 0);
  for (let i = 0; i < seg.length; i++) {
    if (d <= seg[i] || i === seg.length - 1) {
      const u = seg[i] ? clamp(d / seg[i], 0, 1) : 0;
      return [lerp(pts[i][0], pts[i + 1][0], u), lerp(pts[i][1], pts[i + 1][1], u)];
    }
    d -= seg[i];
  }
  return pts[0];
}
/** A row of vertical bars for a vector: values v drawn from a baseline at y, each bar w wide. */
export function bars(x, y, v, { w = 8, gap = 2, scale = 10, cls = 'act solid', max = 40 } = {}) {
  return v
    .map((u, i) => {
      const h = clamp(u * scale, -max, max);
      return rect(x + i * (w + gap), h > 0 ? y - h : y, w, Math.max(0.6, Math.abs(h)), cls, { rx: 1 });
    })
    .join('');
}
/** A smooth density curve (kernel estimate) of values v over [lo, hi], drawn up from baseline y. */
export function density(v, x, lo, hi, y, k = 100, cap = 60) {
  const s = std(v) || 1;
  const h = Math.max(0.12, 1.06 * s * Math.pow(v.length, -0.2));
  const pts = [];
  for (let g = 0; g <= 100; g++) {
    const u = lo + ((hi - lo) * g) / 100;
    let p = 0;
    for (const q of v) p += Math.exp(-0.5 * ((u - q) / h) ** 2);
    p /= v.length * h * Math.sqrt(2 * Math.PI);
    pts.push(`${n(x(u))},${n(y - Math.min(cap, p * k))}`);
  }
  return `M${n(x(lo))},${y} L${pts.join(' L')} L${n(x(hi))},${y} Z`;
}
/** A heat cell grid: m[i][j] in 0..1 shaded with the given role. */
export function heat(x, y, m, { cell = 14, role = 'act' } = {}) {
  return m
    .map((row, i) => row.map((u, j) => rect(x + j * cell + 0.5, y + i * cell + 0.5, cell - 1, cell - 1, `${role} solid`, { rx: 1.5, 'fill-opacity': clamp(u, 0.04, 1) })).join(''))
    .join('');
}

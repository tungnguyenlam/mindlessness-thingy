// Tensor pictures for the "Follow a token" tab (TokenTrace.astro). A small, fixed visual vocabulary:
//   - a token's vector is a horizontal bar, one token thick, its length set by its width (d, d_h, …);
//   - a weight matrix is a rectangle with a grid inside: its height is the input width, its width the
//     output width, so the input bar "runs down" its left edge and the output bar comes out below it;
//   - colour says whose information a vector holds: each token of the sample has its own colour, a
//     vector mixed from several tokens is drawn as stacked stripes (thicker stripe = larger share),
//     and a concatenation is drawn as parts side by side along the length;
//   - the RoPE part of a vector (rotated by position) is a darker, hatched copy of the colour;
//   - a dashed teal outline marks what is kept in the cache.
// Lengths use one square-root scale per model, so a 128-wide head next to a 7,168-wide hidden state
// stays visible; the real sizes are printed under every shape. Concatenated parts split their bar's
// length in proportion to their real widths.

export type Mix = { c: string; w: number }[];
export interface Part {
  /** Share of the bar's length. */
  f: number;
  mix: Mix;
  rope?: boolean;
}
export interface Cell {
  fill: string;
  opacity?: number;
  text?: string;
  tag?: string;
}
export interface Bar {
  id: string;
  len: number;
  parts?: Part[];
  /** A token-axis row: one cell per token (scores, attention weights). */
  cells?: Cell[];
  name: string;
  /** Shape in symbols, shown after the name: '1 × d'. */
  sym?: string;
  /** Shape in numbers, under the name: '1 × 7,168'. */
  size?: string;
  cached?: boolean;
  /** Draw this many equal slices (heads) with thin dividers. */
  split?: number;
  /** Slices to outline: strong first, then light ones. */
  pick?: { strong: number[]; light?: number[] };
  faint?: boolean;
}
export interface Matrix {
  name: string;
  /** Shape in symbols, after the name: 'd × d_{c}'. */
  sym?: string;
  /** Shape in numbers, under the name: '7,168 × 512'. */
  sub?: string;
  /** Row count, printed along the right edge (the input width). */
  rows?: string;
  /** Weight grid (default) or a stack of token vectors drawn as columns or rows. */
  tokens?: { dir: 'cols' | 'rows'; parts: Part[][] };
  /** One row of a weight matrix picked out (an embedding lookup), at a fraction of its height. */
  hot?: { at: number; color: string };
}

export const H = 16; // one token thick
export const CELL = 30; // one token along a token axis
const GAP = 30;
const WGAP = 8; // between a matrix and the bar below it

export const PALETTE = ['#e76f51', '#2a9d8f', '#d4a72c', '#457b9d', '#7fa65a', '#9d6fb5', '#f4a261', '#6d8fd6', '#a1887f', '#52b788', '#c08552', '#5e7c8a'];
const BOS = '#9aa3b2';
export const tokColor = (j: number, special = false) => (special ? BOS : PALETTE[j % PALETTE.length]);

const hex = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
const mixHex = (a: string, b: string, t: number) => {
  const x = hex(a);
  const y = hex(b);
  return '#' + x.map((v, i) => Math.round(v * (1 - t) + y[i] * t).toString(16).padStart(2, '0')).join('');
};
/** The RoPE part's colour: the same token, darker, and hatched where drawn. */
export const ropeColor = (c: string) => mixHex(c, '#14213d', 0.38);

export const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** Mini markup for labels: W^{UQ}, q_{t}, k^{R}_{j}. */
function lab(s: string) {
  return esc(s)
    .replace(/\^\{([^}]*)\}/g, '<tspan class="sc" dy="-5">$1</tspan><tspan dy="5">\u200b</tspan>')
    .replace(/_\{([^}]*)\}/g, '<tspan class="sc" dy="3">$1</tspan><tspan dy="-3">\u200b</tspan>');
}
const labW = (s: string, px = 6.4) => {
  const small = (s.match(/[_^]\{([^}]*)\}/g) ?? []).reduce((n, m) => n + m.length - 3, 0);
  const plain = s.replace(/[_^]\{[^}]*\}/g, '').length;
  return plain * px + small * px * 0.75;
};

/** Normalise and merge a mix; drop shares too thin to draw. */
export function norm(mix: Mix): Mix {
  const by = new Map<string, number>();
  for (const m of mix) by.set(m.c, (by.get(m.c) ?? 0) + m.w);
  let out = [...by].map(([c, w]) => ({ c, w })).filter((m) => m.w > 0);
  const sum = out.reduce((s, m) => s + m.w, 0) || 1;
  out = out.map((m) => ({ c: m.c, w: m.w / sum }));
  const keep = out.filter((m) => m.w >= 0.04);
  const s2 = keep.reduce((s, m) => s + m.w, 0) || 1;
  return keep.map((m) => ({ c: m.c, w: m.w / s2 }));
}
export const pure = (c: string): Mix => [{ c, w: 1 }];

/** Fill a rectangle with a mix: one colour fills it, several are stacked stripes. */
function fill(x: number, y: number, w: number, h: number, mix: Mix, rope = false, vertical = false) {
  let out = '';
  let o = 0;
  for (const m of mix) {
    const c = rope ? ropeColor(m.c) : m.c;
    const s = (vertical ? w : h) * m.w;
    out += vertical ? `<rect x="${(x + o).toFixed(2)}" y="${y}" width="${s.toFixed(2)}" height="${h}" fill="${c}"/>` : `<rect x="${x}" y="${(y + o).toFixed(2)}" width="${w}" height="${s.toFixed(2)}" fill="${c}"/>`;
    o += s;
  }
  if (rope) out += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#tp-hatch)"/>`;
  return out;
}

/** Parts along a bar, horizontal or (for the ghost on a matrix edge) vertical. */
function drawParts(x: number, y: number, len: number, thick: number, parts: Part[], vertical = false) {
  let out = '';
  let o = 0;
  for (const p of parts) {
    const l = len * p.f;
    out += vertical ? fill(x, y + o, thick, l, p.mix, p.rope, true) : fill(x + o, y, l, thick, p.mix, p.rope);
    o += l;
  }
  return out;
}

function drawCells(x: number, y: number, cells: Cell[], thick: number, vertical = false, text = true) {
  return cells
    .map((c, i) => {
      const cx = vertical ? x : x + i * CELL;
      const cy = vertical ? y + i * CELL : y;
      const w = vertical ? thick : CELL;
      const h = vertical ? CELL : thick;
      return (
        `<rect x="${cx}" y="${cy}" width="${w}" height="${h}" fill="${c.fill}" fill-opacity="${c.opacity ?? 1}" class="tp-cell"/>` +
        (text && c.text ? `<text class="tp-num" x="${cx + w / 2}" y="${cy + h / 2 + 3.5}" text-anchor="middle">${esc(c.text)}</text>` : '')
      );
    })
    .join('');
}

/** A bar's drawing at (x, 0), without its labels. */
function drawBar(b: Bar, x: number) {
  let out = `<g class="tp-bar${b.faint ? ' faint' : ''}">`;
  if (b.cells) out += drawCells(x, 0, b.cells, H);
  else out += drawParts(x, 0, b.len, H, b.parts ?? []);
  if (b.split && b.split > 1) {
    const step = b.len / b.split;
    const every = Math.max(1, Math.ceil(2.5 / step));
    for (let i = every; i < b.split; i += every) out += `<line class="tp-div" x1="${(x + i * step).toFixed(2)}" x2="${(x + i * step).toFixed(2)}" y1="0" y2="${H}"/>`;
    for (const i of b.pick?.light ?? []) out += `<rect class="tp-pick light" x="${(x + i * step).toFixed(2)}" y="-2" width="${step.toFixed(2)}" height="${H + 4}"/>`;
    for (const i of b.pick?.strong ?? []) out += `<rect class="tp-pick" x="${(x + i * step).toFixed(2)}" y="-3" width="${Math.max(step, 2).toFixed(2)}" height="${H + 6}"/>`;
  }
  out += `<rect class="tp-edge" x="${x}" y="0" width="${b.len}" height="${H}"/>`;
  if (b.cached) out += `<rect class="tp-cache" x="${x - 3}" y="-3" width="${b.len + 6}" height="${H + 6}" rx="3"/>`;
  return out + '</g>';
}

const tagsH = (b: Bar) => (b.cells?.some((c) => c.tag) ? 13 : 0);
const barLabW = (b: Bar) => Math.max(labW(b.name) + (b.sym ? 8 + labW(b.sym, 6.2) : 0), b.size ? labW(b.size, 6.2) : 0);

/** One row of the picture: bars on a baseline, matrices above the bars they produce. */
export class Track {
  parts: string[] = [];
  x = 0;
  top = -4;
  bottom = H + 30;
  depth = 0;
  lanes = new Map<string, number>();
  bars = new Map<string, { x0: number; x1: number; adv: number; b: Bar }>();
  last = '';
  title = '';
  constructor(title = '') {
    this.title = title;
    if (title) this.top = -24;
  }
  private label(b: Bar, x: number) {
    const t = tagsH(b);
    let out = '';
    if (t)
      b.cells!.forEach((c, i) => {
        if (c.tag) out += `<text class="tp-tag" x="${x + i * CELL + CELL / 2}" y="${H + 11}" text-anchor="middle">${esc(c.tag)}</text>`;
      });
    out += `<text class="tp-name" x="${x}" y="${H + 17 + t}">${lab(b.name)}${b.sym ? `<tspan class="tp-sym" dx="6">${lab(b.sym)}</tspan>` : ''}${b.cached ? '<tspan class="tp-cachetag" dx="6">cached</tspan>' : ''}</text>`;
    if (b.size) out += `<text class="tp-size" x="${x}" y="${H + 30 + t}">${esc(b.size)}</text>`;
    this.bottom = Math.max(this.bottom, H + 35 + t);
    return out;
  }
  private place(b: Bar, x: number) {
    const adv = Math.max(b.len, barLabW(b) + (b.cached ? 44 : 0));
    this.parts.push(drawBar(b, x), this.label(b, x));
    this.bars.set(b.id, { x0: x, x1: x + b.len, adv, b });
    this.last = b.id;
    this.x = x + adv + GAP;
  }
  vec(b: Bar) {
    this.place(b, this.x);
    return this;
  }
  /** Text or a symbol on the baseline (+, =, softmax). */
  op(text: string, cls = 'tp-op') {
    const w = Math.max(14, labW(text, 7));
    this.parts.push(`<text class="${cls}" x="${this.x - GAP / 2 + w / 2}" y="${H / 2 + 4}" text-anchor="middle">${lab(text)}</text>`);
    this.x += w;
    this.last = '';
    return this;
  }
  arrowTo(x: number, from: string) {
    const s = this.bars.get(from)!;
    if (from === this.last) {
      this.parts.push(`<path class="tp-arrow" d="M${s.x1 + 3} ${H / 2} H${x - 4}" marker-end="url(#tp-head)"/>`);
      return;
    }
    // Not the bar just before: go below the labels and come back up just left of the target. Every
    // connector from the same source shares one bus line.
    let lane = this.lanes.get(from);
    if (lane === undefined) {
      lane = ++this.depth;
      this.lanes.set(from, lane);
    }
    const yc = H + 41 + lane * 8;
    const dx = s.x0 + s.adv + 8 + lane * 3;
    this.parts.push(`<path class="tp-arrow" d="M${s.x1 + 3} ${H / 2} H${dx} V${yc} H${x - 12} V${H / 2} H${x - 4}" marker-end="url(#tp-head)"/>`);
    this.bottom = Math.max(this.bottom, yc + 4);
  }
  /** src × matrix → b. The matrix is as tall as the source is long and as wide as the output. */
  mul(src: string, m: Matrix, b: Bar) {
    const s = this.bars.get(src)!;
    const hgt = s.b.len;
    const wid = b.len;
    const x = this.x;
    const y0 = -WGAP - hgt;
    let g = '<g class="tp-mat">';
    if (m.tokens) {
      const n = m.tokens.parts.length;
      m.tokens.parts.forEach((ps, i) => {
        g +=
          m.tokens!.dir === 'cols'
            ? `<g>${drawParts(x + i * CELL, y0, hgt, CELL, ps, true)}</g>`
            : `<g>${drawParts(x, y0 + i * CELL, wid, CELL, ps)}</g>`;
      });
      for (let i = 1; i < n; i++)
        g += m.tokens.dir === 'cols' ? `<line class="tp-tokdiv" x1="${x + i * CELL}" x2="${x + i * CELL}" y1="${y0}" y2="${y0 + hgt}"/>` : `<line class="tp-tokdiv" x1="${x}" x2="${x + wid}" y1="${y0 + i * CELL}" y2="${y0 + i * CELL}"/>`;
      g += `<rect class="tp-edge" x="${x}" y="${y0}" width="${wid}" height="${hgt}"/>`;
    } else {
      g += `<rect class="tp-w" x="${x}" y="${y0}" width="${wid}" height="${hgt}"/>`;
      const step = Math.max(6, Math.min(12, Math.min(wid, hgt) / 4));
      let grid = '';
      for (let gx = x + step; gx < x + wid - 1; gx += step) grid += `M${gx.toFixed(1)} ${y0}V${y0 + hgt}`;
      for (let gy = y0 + step; gy < y0 + hgt - 1; gy += step) grid += `M${x} ${gy.toFixed(1)}H${x + wid}`;
      g += `<path class="tp-grid" d="${grid}"/>`;
      if (m.hot) g += `<rect class="tp-hot" x="${x}" y="${(y0 + m.hot.at * (hgt - 5)).toFixed(1)}" width="${wid}" height="5" fill="${m.hot.color}"/>`;
    }
    // The input, turned to run down the matrix's left edge: its length is the matrix's height.
    const gw = 5;
    g += `<g class="tp-ghost">${s.b.cells ? drawCells(x - gw - 3, y0, s.b.cells, gw, true, false) : drawParts(x - gw - 3, y0, hgt, gw, s.b.parts ?? [], true)}</g>`;
    g += `<text class="tp-mname" x="${x}" y="${y0 - (m.sub ? 18 : 6)}">${lab(m.name)}${m.sym ? `<tspan class="tp-sym" dx="6">${lab(m.sym)}</tspan>` : ''}</text>`;
    // The height (rows = the input's width) written along the right edge; the width is the bar below.
    if (m.rows && labW(m.rows, 6.2) < hgt - 4) g += `<text class="tp-size" transform="translate(${x + wid + 4},${y0 + hgt / 2}) rotate(90)" text-anchor="middle">${esc(m.rows)}</text>`;
    if (m.sub) g += `<text class="tp-size" x="${x}" y="${y0 - 6}">${esc(m.sub)}</text>`;
    g += '</g>';
    this.top = Math.min(this.top, y0 - (m.sub ? 32 : 20) - (this.title ? 22 : 0));
    this.parts.push(g);
    this.arrowTo(x, src);
    const adv = Math.max(labW(m.name) + (m.sym ? 8 + labW(m.sym, 6.2) : 0), m.sub ? labW(m.sub, 6.2) : 0) + (m.rows ? 14 : 0);
    this.place(b, x);
    this.x = Math.max(this.x, x + adv + GAP);
  }
  get width() {
    return this.x - GAP + 6;
  }
  get height() {
    return this.bottom - this.top;
  }
  render(y: number) {
    const t = this.title ? `<text class="tp-title" x="0" y="${this.top + 12}">${esc(this.title)}</text>` : '';
    return `<g transform="translate(10,${(y - this.top).toFixed(1)})">${t}${this.parts.join('')}</g>`;
  }
}

/** Raw block (already drawn at its own origin) for figures that aren't a track. */
export interface Block {
  width: number;
  height: number;
  render(y: number): string;
}

/** The whole sequence as stacked rows, one per token, each filled with its mix. */
export function sequence(title: string, rows: { mix: Mix; tag: string; cur?: boolean }[], len: number, x0 = 0): Block {
  const th = 11;
  const gap = 3;
  const tagW = 46;
  const h = 18 + rows.length * (th + gap);
  return {
    width: x0 + Math.max(tagW + len, title.length * 6.8) + 10,
    height: h + 4,
    render(y: number) {
      let out = `<g transform="translate(${10 + x0},${y})"><text class="tp-title" x="0" y="11">${esc(title)}</text>`;
      rows.forEach((r, i) => {
        const yy = 18 + i * (th + gap);
        out += `<text class="tp-tag" x="${tagW - 6}" y="${yy + 9}" text-anchor="end">${esc(r.tag)}</text>`;
        out += fill(tagW, yy, len, th, r.mix);
        out += `<rect class="tp-edge${r.cur ? ' cur' : ''}" x="${tagW}" y="${yy}" width="${len}" height="${th}"/>`;
      });
      return out + '</g>';
    },
  };
}

/** Lay blocks side by side. */
export function row(blocks: Block[], gap = 40): Block {
  return {
    width: blocks.reduce((s, b) => s + b.width, 0) + gap * (blocks.length - 1),
    height: Math.max(...blocks.map((b) => b.height)),
    render(y: number) {
      let x = 0;
      return blocks
        .map((b) => {
          const out = `<g transform="translate(${x},0)">${b.render(y)}</g>`;
          x += b.width + gap;
          return out;
        })
        .join('');
    },
  };
}

/** Stack tracks and blocks into one SVG. */
export function figure(items: (Track | Block)[], label: string) {
  let y = 6;
  const body: string[] = [];
  for (const it of items) {
    body.push(it.render(y));
    y += it.height + 18;
  }
  const w = Math.ceil(Math.max(...items.map((i) => i.width)) + 24);
  const h = Math.ceil(y - 10);
  return `<div class="tp-wrap" data-keep-scroll><svg class="tp" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(label)}">
    <defs>
      <pattern id="tp-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="5" stroke="#fff" stroke-opacity="0.55" stroke-width="1.6"/></pattern>
      <marker id="tp-head" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0 L8 4 L0 8 z" fill="currentColor"/></marker>
    </defs>
    ${body.join('')}
  </svg></div>`;
}

/** The legend, as HTML so it wraps on a phone. */
export function legend(items: ('vec' | 'mix' | 'weight' | 'rope' | 'cache' | 'heads')[], c: string, c2: string) {
  const sw: Record<string, string> = {
    vec: `<i class="tp-sw" style="background:${c}"></i>one token’s vector (colour = which token)`,
    mix: `<i class="tp-sw" style="background:linear-gradient(${c} 0 45%, ${c2} 45% 75%, ${PALETTE[3]} 75%)"></i>mixed from several tokens (stripe = share)`,
    weight: `<i class="tp-sw w"></i>weight matrix: height = input width, width = output width`,
    rope: `<i class="tp-sw rope" style="background-color:${ropeColor(c)}"></i>RoPE part, rotated by position`,
    cache: `<i class="tp-sw cache"></i>kept in the cache`,
    heads: `<i class="tp-sw heads" style="background:${c}"></i>thin lines split a vector into heads`,
  };
  return `<p class="tp-legend">${items.map((k) => `<span>${sw[k]}</span>`).join('')}</p>`;
}

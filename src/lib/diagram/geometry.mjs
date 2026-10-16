// Layout and lint for <ArchDiagram>. Plain JS with no Astro imports, so the component (at build
// time) and scripts/checks/diagram.mjs (in under a second, per turn) compute exactly the same
// geometry. If the lint passes, the rendered SVG has no overlaps, crossings or overflowing labels.
import { METRICS } from './metrics.mjs';

export const ROLES = ['activation', 'weight', 'cache', 'route', 'op'];

export const GRID = {
  CW_MIN: 150, // a column is at least this wide...
  CW_MAX: 210, // ...and grows to fit its widest label up to this
  CH: 50, // block height
  GX: 34, // gap between columns
  GY: 40, // gap between rows
  PAD: 28,
  TEXT_PAD: 10, // space between a label and the block's edge
  WARN_WIDTH: 840, // wider than the reading column: the SVG shrinks and text gets small
  MAX_WIDTH: 960,
};

const FONT = {
  label: { face: 'sans500', size: 13 },
  sub: { face: 'mono', size: 10.5 },
  edge: { face: 'mono', size: 10.5 },
  group: { face: 'sans400', size: 11 },
};

export function textWidth(s, kind) {
  const { face, size } = FONT[kind];
  const table = METRICS[face];
  let w = 0;
  for (const ch of String(s ?? '')) w += table[ch] ?? 0.62;
  return w * size;
}

const blockTextWidth = (b) => Math.max(textWidth(b.label, 'label'), b.sub ? textWidth(b.sub, 'sub') : 0) + 2 * GRID.TEXT_PAD;

/**
 * Place blocks on the grid. Blocks without `col`/`row` are placed automatically: rows by longest
 * path from the inputs (residual `side` edges ignored), columns by the average column of their
 * parents, so a chain runs straight down and a fork spreads left and right.
 */
export function place(blocks, edges = []) {
  const out = blocks.map((b) => ({ ...b }));
  const auto = out.filter((b) => b.col == null || b.row == null);
  if (!auto.length) return out;
  const byId = new Map(out.map((b) => [b.id, b]));
  const flow = edges.filter((e) => !e.side && byId.has(e.from) && byId.has(e.to));
  const parents = new Map(out.map((b) => [b.id, []]));
  for (const e of flow) parents.get(e.to).push(e.from);

  // Rows: longest path, honouring pinned rows.
  const rowOf = new Map();
  const visiting = new Set();
  const rank = (id) => {
    if (rowOf.has(id)) return rowOf.get(id);
    const b = byId.get(id);
    if (b.row != null) return rowOf.set(id, b.row).get(id);
    if (visiting.has(id)) return 0; // cycle: lint reports it
    visiting.add(id);
    const r = Math.max(-1, ...parents.get(id).map(rank)) + 1;
    visiting.delete(id);
    rowOf.set(id, r);
    return r;
  };
  for (const b of out) b.row ??= rank(b.id);

  // Columns: row by row, aim for the parents' mean column, then resolve collisions.
  const rows = [...new Set(out.map((b) => b.row))].sort((a, b) => a - b);
  const pinnedCols = out.filter((b) => b.col != null).map((b) => b.col);
  const center = pinnedCols.length ? Math.round(pinnedCols.reduce((a, c) => a + c, 0) / pinnedCols.length) : 1;
  for (const r of rows) {
    const inRow = out.filter((b) => b.row === r);
    const taken = new Set(inRow.filter((b) => b.col != null).flatMap((b) => cells(b)));
    const todo = inRow.filter((b) => b.col == null);
    const want = (b) => {
      const ps = parents.get(b.id).map((p) => byId.get(p)).filter((p) => p.col != null);
      return ps.length ? ps.reduce((a, p) => a + p.col + ((p.span ?? 1) - 1) / 2, 0) / ps.length : center;
    };
    todo.sort((a, b) => want(a) - want(b) || blocks.findIndex((x) => x.id === a.id) - blocks.findIndex((x) => x.id === b.id));
    // Spread siblings symmetrically around their shared target.
    const groupsByWant = new Map();
    for (const b of todo) {
      const w = want(b);
      if (!groupsByWant.has(w)) groupsByWant.set(w, []);
      groupsByWant.get(w).push(b);
    }
    for (const [w, group] of groupsByWant) {
      const n = group.length;
      // Two siblings straddle the parent (leaving its column free for a merge below); more sit side by side.
      const offsets = n === 2 ? [-1, 1] : [...Array(n).keys()].map((i) => i - (n - 1) / 2);
      group.forEach((b, i) => {
        let c = Math.round(w + offsets[i]);
        while ([...Array(b.span ?? 1).keys()].some((k) => taken.has(c + k))) c++;
        b.col = c;
        for (const k of cells(b)) taken.add(k);
      });
    }
  }
  // Shift everything right if something landed at a negative column.
  const minCol = Math.min(...out.map((b) => b.col));
  if (minCol < 0) for (const b of out) b.col -= minCol;
  return out;
}

function cells(b) {
  return [...Array(b.span ?? 1).keys()].map((k) => b.col + k);
}

export function layout({ blocks, edges = [], groups = [] }) {
  const placed = place(blocks, edges);
  const { CH, GX, GY, PAD } = GRID;
  // Column width grows to fit the widest single-column label.
  const need = Math.max(0, ...placed.filter((b) => (b.span ?? 1) === 1).map(blockTextWidth));
  const CW = Math.ceil(Math.min(GRID.CW_MAX, Math.max(GRID.CW_MIN, need)));
  const cols = Math.max(1, ...placed.map((b) => b.col + (b.span ?? 1)));
  const rows = Math.max(1, ...placed.map((b) => b.row + 1));
  const width = PAD * 2 + cols * CW + (cols - 1) * GX;
  const height = PAD * 2 + rows * CH + (rows - 1) * GY + (groups.length ? 6 : 0);

  const boxes = new Map(
    placed.map((b) => {
      const span = b.span ?? 1;
      const x = PAD + b.col * (CW + GX);
      const y = PAD + b.row * (CH + GY);
      const w = span * CW + (span - 1) * GX;
      return [b.id, { ...b, x, y, w, h: CH, cx: x + w / 2, cy: y + CH / 2 }];
    }),
  );

  const routes = routeEdges(edges.filter((e) => boxes.has(e.from) && boxes.has(e.to)), boxes);

  const groupBoxes = groups.map((g) => {
    const x = PAD + g.from[0] * (CW + GX) - 12;
    const y = PAD + g.from[1] * (CH + GY) - 12;
    const x2 = PAD + g.to[0] * (CW + GX) + CW + 12;
    const y2 = PAD + g.to[1] * (CH + GY) + CH + 12;
    return { ...g, x, y, w: x2 - x, h: y2 - y };
  });

  return { CW, cols, rows, width, height, boxes, routes, groupBoxes, placed };
}

// ---------------------------------------------------------------------------------------------
// Edge routing. Each edge tries a few orthogonal paths and keeps the first that crosses no block
// and doesn't run on top of an edge already drawn, so authors never place bends by hand.

function simplify(pts) {
  const out = [];
  for (const p of pts) {
    const prev = out.at(-1);
    if (prev && prev[0] === p[0] && prev[1] === p[1]) continue;
    const pp = out.at(-2);
    if (pp && prev && ((pp[0] === prev[0] && prev[0] === p[0]) || (pp[1] === prev[1] && prev[1] === p[1]))) out[out.length - 1] = p;
    else out.push(p);
  }
  return out;
}

function collinearOverlap(aPts, bPts) {
  return segments(aPts).some(([p, q]) =>
    segments(bPts).some(([s, t]) => {
      if (p[0] === q[0] && s[0] === t[0] && Math.abs(p[0] - s[0]) < 2) return overlap1(Math.min(p[1], q[1]), Math.max(p[1], q[1]), Math.min(s[1], t[1]), Math.max(s[1], t[1]), 2);
      if (p[1] === q[1] && s[1] === t[1] && Math.abs(p[1] - s[1]) < 2) return overlap1(Math.min(p[0], q[0]), Math.max(p[0], q[0]), Math.min(s[0], t[0]), Math.max(s[0], t[0]), 2);
      return false;
    }),
  );
}

function candidates(a, b) {
  const { GX, GY } = GRID;
  if (a.y === b.y) {
    const [x1, x2] = a.cx < b.cx ? [a.x + a.w, b.x] : [a.x, b.x + b.w];
    const below = a.y + a.h + GY / 2;
    return [
      [[x1, a.cy], [x2, a.cy]],
      [[a.cx, a.y + a.h], [a.cx, below], [b.cx, below], [b.cx, b.y + b.h]],
    ];
  }
  const down = b.y > a.y;
  const dir = down ? 1 : -1;
  const y1 = down ? a.y + a.h : a.y;
  const y2 = down ? b.y : b.y + b.h;
  const nearA = y1 + (dir * GY) / 2;
  const nearB = y2 - (dir * GY) / 2;
  const toward = b.cx >= a.cx ? 1 : -1;
  const chanA = toward > 0 ? a.x + a.w + GX / 2 : a.x - GX / 2;
  const chanB = toward > 0 ? b.x - GX / 2 : b.x + b.w + GX / 2;
  const chanAway = toward > 0 ? a.x - GX / 2 : a.x + a.w + GX / 2;
  return [
    [[a.cx, y1], [a.cx, nearB], [b.cx, nearB], [b.cx, y2]],
    [[a.cx, y1], [a.cx, nearA], [b.cx, nearA], [b.cx, y2]],
    [[a.cx, y1], [a.cx, nearA], [chanA, nearA], [chanA, nearB], [b.cx, nearB], [b.cx, y2]],
    [[a.cx, y1], [a.cx, nearA], [chanB, nearA], [chanB, nearB], [b.cx, nearB], [b.cx, y2]],
    [[a.cx, y1], [a.cx, nearA], [chanAway, nearA], [chanAway, nearB], [b.cx, nearB], [b.cx, y2]],
  ].map(simplify);
}

function routeEdges(edges, boxes) {
  const all = [...boxes.values()];
  const done = [];
  const cost = (e, pts) => {
    let c = 0;
    for (const s of segments(pts)) for (const bx of all) if (bx.id !== e.from && bx.id !== e.to && segHitsRect(s, bx)) c += 1000;
    for (const d of done) if (d.edge.from !== e.from && d.edge.to !== e.to && collinearOverlap(pts, d.pts)) c += 100;
    return c + pts.length;
  };

  // Residual (side) edges: give overlapping ones separate lanes, and split the attach point when a
  // block has both an incoming and an outgoing residual on the same side.
  const side = edges.filter((e) => e.side);
  const lanes = { left: [], right: [] };
  const laneOf = new Map();
  for (const e of [...side].sort((p, q) => Math.abs(boxes.get(p.from).cy - boxes.get(p.to).cy) - Math.abs(boxes.get(q.from).cy - boxes.get(q.to).cy))) {
    const [lo, hi] = [boxes.get(e.from).cy, boxes.get(e.to).cy].sort((x, y) => x - y);
    const used = lanes[e.side];
    let lane = 0;
    while (used.some((u) => u.lane === lane && overlap1(lo, hi, u.lo, u.hi, -1))) lane++;
    used.push({ lane, lo, hi });
    laneOf.set(e, lane);
  }
  const attach = (id, s, role) => {
    const box = boxes.get(id);
    const ins = side.some((e) => e.to === id && e.side === s);
    const outs = side.some((e) => e.from === id && e.side === s);
    return ins && outs ? box.cy + (role === 'in' ? -8 : 8) : box.cy;
  };

  for (const e of edges) {
    const a = boxes.get(e.from);
    const b = boxes.get(e.to);
    let pts;
    if (e.side) {
      const lane = laneOf.get(e) * 10;
      const out = e.side === 'left' ? Math.min(a.x, b.x) - GRID.PAD * 0.6 - lane : Math.max(a.x + a.w, b.x + b.w) + GRID.PAD * 0.6 + lane;
      const ax = e.side === 'left' ? a.x : a.x + a.w;
      const bx = e.side === 'left' ? b.x : b.x + b.w;
      const ay = attach(e.from, e.side, 'out');
      const by = attach(e.to, e.side, 'in');
      pts = [[ax, ay], [out, ay], [out, by], [bx, by]];
    } else {
      pts = candidates(a, b).reduce((best, c) => (cost(e, c) < cost(e, best) ? c : best));
    }
    // Label next to the last vertical segment (or above a horizontal one).
    const segs = segments(pts);
    const vert = [...segs].reverse().find(([p, q]) => p[0] === q[0] && Math.abs(p[1] - q[1]) > 12);
    let lx, ly;
    if (vert && !e.side) {
      lx = vert[0][0] + 6;
      ly = (vert[0][1] + vert[1][1]) / 2;
    } else if (e.side) {
      lx = pts[1][0] + 6;
      ly = (pts[1][1] + pts[2][1]) / 2;
    } else {
      const [p, q] = segs[0];
      lx = (p[0] + q[0]) / 2 - textWidth(e.label, 'edge') / 2;
      ly = p[1] - 9;
    }
    done.push({ edge: e, pts, d: `M${pts.map((p) => p.join(',')).join(' L')}`, lx, ly });
  }
  return done;
}

// ---------------------------------------------------------------------------------------------
// Lint

const overlap1 = (a0, a1, b0, b1, slack = 0) => Math.min(a1, b1) - Math.max(a0, b0) > slack;
const rectsOverlap = (a, b, slack = 0) => overlap1(a.x, a.x + a.w, b.x, b.x + b.w, slack) && overlap1(a.y, a.y + a.h, b.y, b.y + b.h, slack);

function segHitsRect([p, q], r, inset = 2) {
  const x0 = r.x + inset;
  const x1 = r.x + r.w - inset;
  const y0 = r.y + inset;
  const y1 = r.y + r.h - inset;
  if (p[0] === q[0]) {
    const [a, b] = [Math.min(p[1], q[1]), Math.max(p[1], q[1])];
    return p[0] > x0 && p[0] < x1 && overlap1(a, b, y0, y1);
  }
  const [a, b] = [Math.min(p[0], q[0]), Math.max(p[0], q[0])];
  return p[1] > y0 && p[1] < y1 && overlap1(a, b, x0, x1);
}

const segments = (pts) => pts.slice(1).map((q, i) => [pts[i], q]);

// A bare numeral (not part of a name like Mamba-2, FP8, W_1, or a shape like n × d_c).
const NUMBER = /(?<![A-Za-z_\d.\-])\d[\d,.]*(?:e\d+)?\s*[KMBT]?(?![A-Za-z_\d])/;

/**
 * Returns problems as { level, rule, code, msg, fix }. `code` is stable per kind of problem,
 * so scripts/checks/baseline.json can grandfather an existing one without hiding new ones.
 */
export function lintDiagram(props) {
  const out = [];
  const err = (code, msg, fix, rule = 'diagram-geometry') => out.push({ level: 'error', rule, code, msg, fix });
  const warn = (code, msg, fix, rule = 'diagram-geometry') => out.push({ level: 'warn', rule, code, msg, fix });
  const { title = '(untitled)', blocks, edges = [], groups = [] } = props;
  const where = `<ArchDiagram title="${title}">`;

  if (!Array.isArray(blocks) || !blocks.length) {
    err('no-blocks', `${where} has no blocks`, 'pass blocks={[...]} as a literal array');
    return out;
  }
  const ids = new Set();
  for (const b of blocks) {
    if (ids.has(b.id)) err('duplicate-id', `${where}: two blocks have id "${b.id}"`, 'give every block a unique id');
    ids.add(b.id);
    if (b.role && !ROLES.includes(b.role)) err('bad-role', `${where}: block "${b.id}" has role "${b.role}"`, `use one of ${ROLES.join(', ')} (AGENTS.md#components)`);
    if ((b.col == null) !== (b.row == null)) warn('half-pinned', `${where}: block "${b.id}" sets only one of col/row`, 'set both to pin it, or neither to let the layout place it');
    for (const [field, text] of [['label', b.label], ['sub', b.sub]]) {
      if (text && NUMBER.test(String(text))) {
        warn('number-in-label', `${where}: block "${b.id}" ${field} "${text}" contains a number`, 'numbers belong in a <Spec>/<ModelSpec> with a source; use a symbol (n, d_c, k) in diagrams', 'sourced-numbers');
      }
    }
  }
  for (const e of edges) {
    for (const id of [e.from, e.to]) if (!ids.has(id)) err('unknown-edge-end', `${where}: edge ${e.from} → ${e.to} refers to unknown block "${id}"`, 'fix the id or add the block');
    if (e.label && NUMBER.test(String(e.label))) warn('number-in-label', `${where}: edge label "${e.label}" contains a number`, 'cite the number in prose or a <Spec>; use a symbol in the diagram', 'sourced-numbers');
  }
  if (out.some((p) => p.level === 'error')) return out;

  const L = layout(props);
  const boxes = [...L.boxes.values()];

  if (L.width > GRID.MAX_WIDTH) err('too-wide', `${where} is ${Math.round(L.width)}px wide (${L.cols} columns); text would shrink below a readable size`, `use at most ${maxCols(L.CW)} columns: stack blocks vertically or split the diagram in two`);
  else if (L.width > GRID.WARN_WIDTH) warn('wide', `${where} is ${Math.round(L.width)}px wide; it will be scaled down in the reading column`, 'shorten labels or remove a column');

  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      if (rectsOverlap(boxes[i], boxes[j])) err('overlap', `${where}: blocks "${boxes[i].id}" and "${boxes[j].id}" overlap (row ${boxes[i].row}, col ${boxes[i].col})`, 'move one to a free cell, or drop col/row and let the layout place them');
    }
  }
  for (const b of boxes) {
    const room = b.w - 2 * GRID.TEXT_PAD;
    for (const [kind, text] of [['label', b.label], ['sub', b.sub]]) {
      if (!text) continue;
      const w = textWidth(text, kind);
      if (w > room + 0.5) err('label-overflow', `${where}: block "${b.id}" ${kind} "${text}" is ${Math.round(w)}px, box has ${Math.round(room)}px`, `shorten it, move detail into sub or the caption, or give the block span: ${(b.span ?? 1) + 1}`);
    }
  }

  const labelRects = [];
  for (const r of L.routes) {
    const { edge: e } = r;
    const name = `${e.from} → ${e.to}`;
    if (e.from === e.to) err('self-loop', `${where}: edge ${name} loops to itself`, 'remove it');
    for (const s of segments(r.pts)) {
      for (const b of boxes) {
        if (b.id === e.from || b.id === e.to) continue;
        if (segHitsRect(s, b)) {
          err('edge-through-block', `${where}: edge ${name} passes through block "${b.id}"`, 'move the blocks so the path is clear, route it with side: "left" | "right", or reorder columns');
          break;
        }
      }
    }
    if (e.label) {
      const lr = { x: r.lx, y: r.ly - 7, w: textWidth(e.label, 'edge'), h: 14, name };
      for (const b of boxes) if (rectsOverlap(lr, b)) err('edge-label-overlap', `${where}: label "${e.label}" on edge ${name} overlaps block "${b.id}"`, 'shorten the label or put the explanation in the caption');
      for (const o of labelRects) if (rectsOverlap(lr, o)) err('edge-label-overlap', `${where}: labels on edges ${o.name} and ${name} overlap`, 'drop one label or move one of the blocks');
      labelRects.push(lr);
    }
  }
  // Two edges drawn on top of each other read as one. Forks (same source) and merges (same target) are fine.
  for (let i = 0; i < L.routes.length; i++) {
    for (let j = i + 1; j < L.routes.length; j++) {
      const a = L.routes[i];
      const b = L.routes[j];
      if (a.edge.from === b.edge.from || a.edge.to === b.edge.to) continue;
      const hit = collinearOverlap(a.pts, b.pts);
      if (hit) err('edges-collinear', `${where}: edges ${a.edge.from} → ${a.edge.to} and ${b.edge.from} → ${b.edge.to} are drawn on top of each other`, 'route one on the other side (side: "left" | "right") or move a block so the paths separate');
    }
  }
  for (const g of L.groupBoxes) {
    for (const b of boxes) {
      const inside = b.x >= g.x && b.x + b.w <= g.x + g.w && b.y >= g.y && b.y + b.h <= g.y + g.h;
      if (!inside && rectsOverlap(b, g, 1)) err('group-cuts-block', `${where}: group "${g.label}" cuts through block "${b.id}"`, 'extend the group to cover the block, or move the block out');
    }
    const tw = textWidth(g.label, 'group');
    if (tw > g.w - 16) err('group-label-overflow', `${where}: group label "${g.label}" is wider than the group`, 'shorten it and move detail to the caption');
    const lr = { x: g.x + g.w - 12 - tw, y: g.y + g.h - 6, w: tw, h: 12 };
    for (const b of boxes) if (rectsOverlap(lr, b)) err('group-label-overlap', `${where}: group label "${g.label}" overlaps block "${b.id}"`, 'shorten the label');
  }
  return out;
}

function maxCols(cw) {
  return Math.floor((GRID.MAX_WIDTH - 2 * GRID.PAD + GRID.GX) / (cw + GRID.GX));
}

// RoPE: a query and a key turn by angles set by their positions; the score sees only the angle
// between them, so it depends on the gap n − m, not on where the pair sits.
import { text, rect, circle, line, path, group, clamp, f2 } from './kit.mjs';

const WORDS = ['The', 'cat', 'sat', 'on', 'the', 'mat', 'all', 'day'];
const TH = 32; // degrees per position, fast plane
const TH2 = 7; // slow plane
const AQ = 18;
const AK = 64;
const rad = (d) => (d * Math.PI) / 180;

function dial(cx, cy, r, aq, ak, label) {
  const p = (a, len) => [cx + Math.cos(rad(a)) * len, cy - Math.sin(rad(a)) * len];
  const [qx, qy] = p(aq, r * 0.92);
  const [kx, ky] = p(ak, r * 0.82);
  const lo = Math.min(aq, ak);
  const hi = Math.max(aq, ak);
  const [ax, ay] = p(lo, r * 0.36);
  const [bx, by] = p(hi, r * 0.36);
  const large = hi - lo > 180 ? 1 : 0;
  return (
    circle(cx, cy, r, 'faint') +
    line(cx - r, cy, cx + r, cy, 'wire', { opacity: 0.25 }) +
    line(cx, cy - r, cx, cy + r, 'wire', { opacity: 0.25 }) +
    path(`M${cx},${cy} L${ax},${ay} A${r * 0.36},${r * 0.36} 0 ${large} 0 ${bx},${by} Z`, 'ink solid', { opacity: 0.12 }) +
    line(cx, cy, qx, qy, 'flow arrow') +
    line(cx, cy, kx, ky, 'flow arrow', { style: 'stroke: var(--role-cache)' }) +
    text(qx + (qx > cx ? 4 : -4), qy - 4, 'q', `tb act ${qx > cx ? '' : 'te'}`) +
    text(kx + (kx > cx ? 4 : -4), ky - 4, 'k', `tb cache ${kx > cx ? '' : 'te'}`) +
    text(cx, cy + r + 16, label, 'ts tc')
  );
}

export default {
  viewBox: [460, 262],
  beats: [
    { say: 'A query and a key, as plain vectors. Their score ignores where the two tokens are.', state: { m: 1, n: 3, rot: 0, slow: 0 } },
    { say: 'RoPE turns each one by an angle set by its position: the query by m steps, the key by n.', state: { m: 1, n: 3, rot: 1, slow: 0 }, tween: 1600 },
    { say: 'Move both tokens three places later. Both turn further, but the angle between them stays the same.', state: { m: 4, n: 6, rot: 1, slow: 0 }, tween: 2200, ms: 4400 },
    { say: 'Move only the key one place further. The gap grows, the angle changes, and so does the score.', state: { m: 4, n: 7, rot: 1, slow: 0 }, tween: 1400, ms: 4200 },
    { say: 'Each pair of numbers turns at its own speed. Slow pairs still tell apart tokens that are far away.', state: { m: 4, n: 7, rot: 1, slow: 1 }, ms: 4600 },
  ],
  draw({ m, n, rot, slow }) {
    const aq = AQ + rot * m * TH;
    const ak = AK + rot * n * TH;
    const aq2 = AQ + rot * m * TH2;
    const ak2 = AK + rot * n * TH2;
    const s1 = Math.cos(rad(ak - aq));
    const s2 = Math.cos(rad(ak2 - aq2));
    const score = s1 * (1 - 0.5 * slow) + s2 * 0.5 * slow;
    let out = '';
    out += dial(105, 100, 72, aq, ak, slow > 0.5 ? 'a fast pair of numbers' : 'one pair of numbers, as an arrow');
    out += group(dial(268, 100, 50, aq2, ak2, 'a slow pair'), { opacity: slow });
    // Score
    const sx = 372;
    const zero = 100;
    out += text(sx + 30, 22, 'score q·k', 't tc tb');
    out += rect(sx + 14, 32, 32, 136, 'faint');
    out += line(sx + 8, zero, sx + 52, zero, 'wire');
    const h = clamp(score, -1, 1) * 64;
    out += rect(sx + 18, h > 0 ? zero - h : zero, 24, Math.abs(h), 'ink solid', { rx: 1 });
    out += text(sx + 30, 186, f2(score), 'tm tc');
    // Token strip
    const tx = (i) => 14 + i * 54;
    const ty = 214;
    WORDS.forEach((w, i) => (out += rect(tx(i), ty, 48, 24, 'faint')));
    out += rect(tx(m), ty, 48, 24, 'act hot') + text(tx(m) + 24, ty - 6, `query, m = ${Math.round(m)}`, 'ts tc act');
    out += rect(tx(n), ty, 48, 24, 'cache hot') + text(tx(n) + 24, ty + 38, `key, n = ${Math.round(n)}`, 'ts tc cache');
    WORDS.forEach((w, i) => (out += text(tx(i) + 24, ty + 16, w, 'ts tc')));
    out += text(452, ty - 6, `gap n − m = ${Math.round(n - m)}`, 'ts te tb');
    return out;
  },
};

// Linear vs Log on both axes: (1) linear magnitude vs log dB, (2) linear Hz vs Mel filterbank.
import { text, rect, line, path, group, lerp, n } from './kit.mjs';

const HARMONICS = [
  { lbl: 'f0', lin: 1.0, db: 1.0, dbText: '0 dB' },
  { lbl: '2f0', lin: 0.14, db: 0.72, dbText: '−17 dB' },
  { lbl: '3f0', lin: 0.035, db: 0.52, dbText: '−29 dB' },
  { lbl: '4f0', lin: 0.008, db: 0.31, dbText: '−42 dB' },
];

const OCTAVES = [
  { hz: 400, linU: 400 / 3200, melU: 0.18, lbl: '400' },
  { hz: 800, linU: 800 / 3200, melU: 0.41, lbl: '800' },
  { hz: 1600, linU: 1600 / 3200, melU: 0.69, lbl: '1.6k' },
  { hz: 3200, linU: 3200 / 3200, melU: 1.0, lbl: '3.2k' },
];

export default {
  viewBox: [460, 248],
  beats: [
    {
      say: 'Raw linear FFT: the main tone f0 fills the chart while quiet harmonics 3f0, 4f0 disappear near zero.',
      state: { dbMix: 0, melMix: 0 },
      ms: 3600,
    },
    {
      say: 'Log magnitude (dB = 10 log10) compresses huge energy ratios, lifting quiet harmonics into clear view.',
      state: { dbMix: 1, melMix: 0 },
      tween: 1000,
      ms: 4000,
    },
    {
      say: 'Now look at frequency: linear Hz squeezes lower musical octaves (400–1600 Hz) into the bottom half.',
      state: { dbMix: 1, melMix: 0 },
      ms: 3200,
    },
    {
      say: 'Mel / log-Hz bends the ruler: narrow bands below 1 kHz, wide bands above—matching human pitch.',
      state: { dbMix: 1, melMix: 1 },
      tween: 1100,
      ms: 4400,
    },
  ],
  draw({ dbMix, melMix }) {
    let out = '';

    // --- LEFT PANEL: Linear Power vs Log (dB) Magnitude ---
    const lx = 16;
    const ly = 28;
    const lw = 200;
    const lh = 180;
    out += text(lx, 18, dbMix > 0.5 ? 'Color: Log magnitude (dB)' : 'Color: Linear power |X|²', 'ts tb');
    out += rect(lx, ly, lw, lh, 'op');

    const baseY = ly + lh - 26;
    const maxH = lh - 46;
    out += line(lx + 14, baseY, lx + lw - 12, baseY, 'wire');

    HARMONICS.forEach((h, i) => {
      const bx = lx + 26 + i * 42;
      const frac = lerp(h.lin, h.db, dbMix);
      const bh = Math.max(1.5, frac * maxH);
      const cls = i === 0 ? 'act solid' : 'route solid';
      out += rect(bx, baseY - bh, 26, bh, cls, { rx: 2, 'fill-opacity': i === 0 ? 0.85 : 0.75 });
      out += text(bx + 13, baseY + 14, h.lbl, 'ts tm tc');
      const valTxt = dbMix > 0.5 ? h.dbText : h.lin >= 0.1 ? h.lin.toFixed(2) : h.lin.toFixed(3);
      out += text(bx + 13, baseY - bh - 5, valTxt, 'ts tm tc');
    });
    out += text(lx + lw / 2, ly + lh + 16, 'Quiet overtones carry vowel timbre', 'ts tc');

    // --- RIGHT PANEL: Linear Hz vs Mel / Log-Hz Frequency Axis ---
    const rx = 244;
    const ry = 28;
    const rw = 200;
    const rh = 180;
    out += text(rx, 18, melMix > 0.5 ? 'Y-axis: Mel bands (perceptual)' : 'Y-axis: Linear Hz (Δf equal)', 'ts tb');
    out += rect(rx, ry, rw, rh, 'op');

    const topY = ry + 16;
    const botY = ry + rh - 18;
    const spanY = botY - topY;
    const axisX = rx + 42;

    out += line(axisX, topY, axisX, botY, 'wire');

    // Draw octave horizontal rungs moving from linear to mel spacing
    OCTAVES.forEach((o) => {
      const u = lerp(o.linU, o.melU, melMix);
      const y = botY - u * spanY;
      out += line(axisX - 4, y, rx + rw - 14, y, 'wire dash', { opacity: 0.5 });
      out += text(axisX - 7, y + 3.5, o.lbl, 'ts tm te');
    });

    // Draw triangular mel filter shapes when melMix rises, or uniform linear ticks when 0
    if (melMix < 0.8) {
      let linG = '';
      for (let b = 0; b <= 10; b++) {
        const y = botY - (b / 10) * spanY;
        linG += line(axisX + 4, y, axisX + 20, y, 'act', { 'stroke-width': 1.8 });
      }
      out += group(linG, { opacity: 1 - melMix });
    }
    if (melMix > 0.15) {
      let melG = '';
      const centers = [0.09, 0.19, 0.31, 0.45, 0.62, 0.81, 0.96];
      centers.forEach((c, idx) => {
        const lo = idx === 0 ? 0.02 : centers[idx - 1];
        const hi = idx === centers.length - 1 ? 1.0 : centers[idx + 1];
        const yc = botY - c * spanY;
        const ylo = botY - lo * spanY;
        const yhi = botY - hi * spanY;
        const d = `M${n(axisX + 2)},${n(ylo)} L${n(axisX + 46)},${n(yc)} L${n(axisX + 2)},${n(yhi)}`;
        melG += path(d, idx % 2 === 0 ? 'cache' : 'wt', { fill: 'none', 'stroke-width': 1.8 });
      });
      out += group(melG, { opacity: melMix });
    }

    out += text(rx + rw - 14, topY + 12, 'Hz', 'ts tm te');
    out += text(rx + rw / 2 + 12, ry + rh + 16, melMix > 0.5 ? 'Octaves spaced evenly' : 'Low notes cramped together', 'ts tc');

    return out;
  },
};

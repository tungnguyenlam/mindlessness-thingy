// Waveform sampling, bit-depth quantization, clipping, and Nyquist aliasing.
import { text, rect, circle, line, path, group, clamp, lerp, n } from './kit.mjs';

const X0 = 38;
const X1 = 442;
const W = X1 - X0;
const CY = 114;
const AMP = 52;

function waveY(u, clipGain, aliasMix) {
  const fLow = Math.sin(u * Math.PI * 3.0) * 0.72 + Math.sin(u * Math.PI * 6.0 + 0.4) * 0.28;
  // Fast wave at 11.5 cycles vs slow alias wave at 1.5 cycles
  const fFast = Math.sin(u * Math.PI * 23.0) * 0.85;
  const raw = lerp(fLow, fFast, aliasMix) * clipGain;
  return clamp(raw, -1, 1);
}

function quantizeVal(v, bits) {
  if (bits >= 12) return v;
  const levels = Math.pow(2, Math.round(bits));
  const step = 2 / (levels - 1);
  return clamp(Math.round((v + 1) / step) * step - 1, -1, 1);
}

export default {
  viewBox: [460, 236],
  beats: [
    {
      say: 'Sound is continuous air pressure over time: positive pushes, negative pulls.',
      state: { sampleAlpha: 0, quantAlpha: 0, bits: 16, clipGain: 1, aliasMix: 0 },
      ms: 3400,
    },
    {
      say: 'Sample rate f_s measures pressure every 1/f_s seconds into a discrete list x[n].',
      state: { sampleAlpha: 1, quantAlpha: 0, bits: 16, clipGain: 1, aliasMix: 0 },
      tween: 900,
      ms: 3600,
    },
    {
      say: 'Bit depth B rounds each sample to 2^B levels: coarse steps add staircase quantization noise.',
      state: { sampleAlpha: 1, quantAlpha: 1, bits: 3, clipGain: 1, aliasMix: 0 },
      tween: 950,
      ms: 4000,
    },
    {
      say: 'Clipping: boosting gain past ±1.0 flattens the wave peaks against the ceiling.',
      state: { sampleAlpha: 1, quantAlpha: 0, bits: 16, clipGain: 1.65, aliasMix: 0 },
      tween: 950,
      ms: 3800,
    },
    {
      say: 'Aliasing: sampling a fast wave slower than 2× its frequency fakes a slow ghost wave.',
      state: { sampleAlpha: 1, quantAlpha: 0, bits: 16, clipGain: 1, aliasMix: 1 },
      tween: 1000,
      ms: 4400,
    },
  ],
  draw({ sampleAlpha, quantAlpha, bits, clipGain, aliasMix }) {
    let out = '';

    // Grid & axes
    out += rect(X0, CY - AMP - 10, W, (AMP + 10) * 2, 'op');
    out += line(X0, CY, X1, CY, 'wire');
    out += line(X0, CY - AMP, X1, CY - AMP, 'wire dash', { opacity: 0.45 });
    out += line(X0, CY + AMP, X1, CY + AMP, 'wire dash', { opacity: 0.45 });

    out += text(X0 - 5, CY - AMP + 4, '+1.0', 'ts tm te');
    out += text(X0 - 5, CY + 4, '0.0', 'ts tm te');
    out += text(X0 - 5, CY + AMP + 4, '−1.0', 'ts tm te');
    out += text(X0, 26, 'Air pressure / digital amplitude', 'ts tb');
    out += text(X1, 220, 'Time t → (samples n = t · f_s)', 'ts te');

    // Quantization horizontal grid when quantAlpha > 0.05
    if (quantAlpha > 0.05) {
      const levels = Math.pow(2, Math.round(bits));
      let qGrid = '';
      for (let l = 0; l < levels; l++) {
        const val = -1 + (2 * l) / (levels - 1);
        const y = CY - val * AMP;
        qGrid += line(X0, y, X1, y, 'wt', { 'stroke-width': 0.7, opacity: 0.28 });
      }
      out += group(qGrid, { opacity: quantAlpha });
      out += text(X1, 26, `3-bit PCM (${levels} levels)`, 'ts tm te wt', { opacity: quantAlpha });
    }

    // Clipping rails indicator
    if (clipGain > 1.15) {
      const clipOp = clamp((clipGain - 1.15) / 0.4, 0, 1);
      out += line(X0, CY - AMP, X1, CY - AMP, 'route', { 'stroke-width': 2, opacity: clipOp });
      out += line(X0, CY + AMP, X1, CY + AMP, 'route', { 'stroke-width': 2, opacity: clipOp });
      out += text(X1, 26, 'Clipped at ±1.0', 'ts tb te route', { opacity: clipOp });
    }

    // Continuous analog wave (fine polyline)
    const pts = [];
    for (let i = 0; i <= 220; i++) {
      const u = i / 220;
      const x = X0 + u * W;
      const v = waveY(u, clipGain, aliasMix);
      const y = CY - v * AMP;
      pts.push(`${i === 0 ? 'M' : 'L'}${n(x)},${n(y)}`);
    }
    const waveCls = aliasMix > 0.5 ? 'wire dash' : 'flow';
    out += path(pts.join(' '), waveCls, { opacity: aliasMix > 0.5 ? 0.55 : sampleAlpha > 0.5 ? 0.35 : 0.95 });

    // Quantized staircase curve
    if (quantAlpha > 0.05) {
      const nS = 14;
      const sPts = [];
      for (let i = 0; i < nS; i++) {
        const u0 = i / nS;
        const u1 = (i + 1) / nS;
        const vq = quantizeVal(waveY(u0, clipGain, aliasMix), bits);
        const y = CY - vq * AMP;
        sPts.push(`${i === 0 ? 'M' : 'L'}${n(X0 + u0 * W)},${n(y)} L${n(X0 + u1 * W)},${n(y)}`);
      }
      out += path(sPts.join(' '), 'wt', { fill: 'none', 'stroke-width': 2, opacity: quantAlpha });
    }

    // Discrete sample stems & dots
    if (sampleAlpha > 0.05) {
      const nSamples = 14;
      let stems = '';
      const aliasPts = [];
      for (let i = 0; i <= nSamples; i++) {
        const u = i / nSamples;
        const x = X0 + u * W;
        const rawV = waveY(u, clipGain, aliasMix);
        const v = quantAlpha > 0.3 ? lerp(rawV, quantizeVal(rawV, bits), quantAlpha) : rawV;
        const y = CY - v * AMP;
        const isClipped = clipGain > 1.15 && Math.abs(rawV) >= 0.999;
        stems += line(x, CY, x, y, isClipped ? 'route' : 'cache', { 'stroke-width': 1.5 });
        stems += circle(x, y, 3.4, isClipped ? 'route solid' : 'act solid');
        if (aliasMix > 0.2) {
          aliasPts.push(`${i === 0 ? 'M' : 'L'}${n(x)},${n(y)}`);
        }
      }
      if (aliasMix > 0.2) {
        // Draw smooth aliased ghost wave connecting the dots
        const ghostPts = [];
        for (let k = 0; k <= 120; k++) {
          const u = k / 120;
          const x = X0 + u * W;
          // 11.5 cycles sampled at 14 intervals aliases to -2.5 cycles or +1.5 cycles
          const v = -Math.sin(u * Math.PI * 5.0) * 0.85;
          ghostPts.push(`${k === 0 ? 'M' : 'L'}${n(x)},${n(CY - v * AMP)}`);
        }
        out += path(ghostPts.join(' '), 'route', { fill: 'none', 'stroke-width': 2.2, opacity: aliasMix });
        out += text(X1, 26, 'f > f_s/2 → false low pitch', 'ts tb te route', { opacity: aliasMix });
      }
      out += group(stems, { opacity: sampleAlpha });
    }

    // Legend bar at bottom
    out += text(X0, 200, 'x[n] ∈ [−1, 1] · 16 kHz speech = 16,000 samples/sec', 'ts tm');
    return out;
  },
};

// STFT conversion: sliding Hann window + hop H + FFT into a 2D time-frequency spectrogram.
import { text, rect, line, path, group, clamp, n } from './kit.mjs';

const COLS = 15;
const ROWS = 9;

// Synthetic waveform with 3 distinct regions:
// 0..0.38: low tone (2 cycles per window), 0.38..0.52: sharp click impulse, 0.52..1.0: high tone (6 cycles per window)
function sig(u) {
  const click = Math.exp(-Math.pow((u - 0.45) / 0.018, 2)) * 1.1;
  const lowEnv = clamp(1 - Math.max(0, u - 0.36) * 8, 0, 1);
  const highEnv = clamp((u - 0.5) * 8, 0, 1);
  return Math.sin(u * Math.PI * 16) * 0.65 * lowEnv + click + Math.sin(u * Math.PI * 46) * 0.6 * highEnv;
}

// Precomputed 9-bin x 15-frame spectrogram energy matching the 3 regions
function buildSpec() {
  return Array.from({ length: ROWS }, (_, r) => {
    const bin = ROWS - 1 - r; // top row = high freq (8), bottom row = low freq (0)
    return Array.from({ length: COLS }, (__, c) => {
      const u = (c + 0.5) / COLS;
      if (c >= 6 && c <= 7) {
        // Broadband vertical click spike across all frequencies
        return 0.72 + (bin % 2) * 0.08 - Math.abs(bin - 4) * 0.03;
      }
      if (u < 0.42) {
        // Low fundamental at bin 1 + faint harmonic at bin 3
        if (bin === 1) return 0.94;
        if (bin === 3) return 0.32;
        return 0.05;
      }
      // High tone at bin 6 + faint sub/leakage at bin 5,7
      if (bin === 6) return 0.92;
      if (bin === 5 || bin === 7) return 0.22;
      return 0.05;
    });
  });
}

function frameSpectrum(pos) {
  // Interpolate smoothly between low tone (pos < 0.35), click (0.45), high tone (pos > 0.58)
  const isClick = Math.exp(-Math.pow((pos - 0.45) / 0.07, 2));
  const isHigh = clamp((pos - 0.48) / 0.14, 0, 1);
  const isLow = clamp(1 - (pos - 0.34) / 0.14, 0, 1);
  return Array.from({ length: ROWS }, (_, bin) => {
    const lowVal = bin === 1 ? 0.94 : bin === 3 ? 0.34 : 0.05;
    const highVal = bin === 6 ? 0.92 : bin === 5 || bin === 7 ? 0.2 : 0.05;
    const clickVal = 0.78 - Math.abs(bin - 4) * 0.04;
    return clamp(lowVal * isLow + highVal * isHigh + clickVal * isClick, 0.05, 1);
  });
}

export default {
  viewBox: [460, 268],
  setup() {
    return { grid: buildSpec() };
  },
  beats: [
    {
      say: 'STFT slides a Hann window (N_FFT) by hop H; each FFT column stacks into a 2D spectrogram.',
      state: { winPos: 0.45, winAlpha: 1, fftAlpha: 1, fillCols: 8 },
      ms: 3600,
    },
    {
      say: '1. Slice a short window (N_FFT samples) and taper edges with a Hann bell so cutoffs do not leak.',
      state: { winPos: 0.16, winAlpha: 1, fftAlpha: 0.45, fillCols: 2 },
      tween: 900,
      ms: 3400,
    },
    {
      say: '2. FFT measures how strongly each frequency sine fits inside the window: one column of bins.',
      state: { winPos: 0.22, winAlpha: 1, fftAlpha: 1, fillCols: 4 },
      tween: 750,
      ms: 3400,
    },
    {
      say: '3. Hop forward by H samples across the click: broadband bursts light up every frequency vertically.',
      state: { winPos: 0.45, winAlpha: 1, fftAlpha: 1, fillCols: 8 },
      tween: 1200,
      ms: 3800,
    },
    {
      say: '4. Finish scanning to the high tone: steady tones form horizontal bands; clicks form vertical stripes.',
      state: { winPos: 0.84, winAlpha: 1, fftAlpha: 1, fillCols: 15 },
      tween: 1400,
      ms: 4200,
    },
  ],
  draw({ winPos, winAlpha, fftAlpha, fillCols }, { grid }) {
    let out = '';

    // --- TOP: 1D Waveform + Sliding Hann Window ---
    const wx = 18;
    const wy = 24;
    const ww = 424;
    const wh = 54;
    const wcy = wy + wh / 2;

    out += text(wx, 15, '1. Waveform x[n] with sliding Hann window (width N_FFT, hop H)', 'ts tb');
    out += rect(wx, wy, ww, wh, 'op');
    out += line(wx, wcy, wx + ww, wcy, 'wire', { opacity: 0.5 });

    const wPts = [];
    for (let i = 0; i <= 220; i++) {
      const u = i / 220;
      const x = wx + u * ww;
      const y = wcy - sig(u) * 20;
      wPts.push(`${i === 0 ? 'M' : 'L'}${n(x)},${n(y)}`);
    }
    out += path(wPts.join(' '), 'wire', { 'stroke-width': 1.5 });

    // Sliding window overlay
    const winW = 76;
    const winLeft = clamp(wx + winPos * ww - winW / 2, wx, wx + ww - winW);
    if (winAlpha > 0.05) {
      const bell = [];
      for (let i = 0; i <= 30; i++) {
        const u = i / 30;
        const h = 0.5 * (1 - Math.cos(2 * Math.PI * u));
        bell.push(`${i === 0 ? 'M' : 'L'}${n(winLeft + u * winW)},${n(wy + wh - h * (wh - 4))}`);
      }
      let winG = '';
      winG += rect(winLeft, wy + 1, winW, wh - 2, 'wt', { 'fill-opacity': 0.25, 'stroke-width': 1.5 });
      winG += path(bell.join(' '), 'wt', { fill: 'none', 'stroke-width': 1.6 });
      winG += text(winLeft + winW / 2, wy + wh + 12, 'window x_m · w', 'ts tm tc wt');
      out += group(winG, { opacity: winAlpha });
    }

    // --- BOTTOM-LEFT: Windowed chunk & 1-frame FFT column ---
    const fx = 18;
    const fy = 112;
    const fw = 178;
    const fh = 128;
    out += text(fx, fy - 7, '2. Single frame FFT (1 column)', 'ts tb');
    out += rect(fx, fy, fw, fh, 'op');

    const bins = frameSpectrum(winPos);
    const rowH = (fh - 16) / ROWS;
    let fftG = '';
    for (let r = 0; r < ROWS; r++) {
      const bin = ROWS - 1 - r;
      const y = fy + 8 + r * rowH;
      const mag = bins[bin];
      const barW = mag * (fw - 54);
      fftG += rect(fx + 38, y + 1.5, barW, rowH - 3, 'act solid', { rx: 1.5, 'fill-opacity': 0.35 + 0.65 * mag });
    }
    fftG += text(fx + 33, fy + 18, 'high', 'ts te');
    fftG += text(fx + 33, fy + fh - 10, 'low', 'ts te');
    fftG += text(fx + fw / 2 + 12, fy + fh + 14, 'energy |X[m,k]|', 'ts tm tc');
    out += group(fftG, { opacity: fftAlpha });

    // Arrow between single frame FFT and 2D spectrogram
    out += line(fx + fw + 6, fy + fh / 2, fx + fw + 34, fy + fh / 2, 'flow arrow', { opacity: fftAlpha });

    // --- BOTTOM-RIGHT: 2D Spectrogram Matrix ---
    const sx = 236;
    const sy = 112;
    const sw = 206;
    const sh = 128;
    out += text(sx, sy - 7, '3. 2D Spectrogram (frames stacked)', 'ts tb');
    out += rect(sx, sy, sw, sh, 'op');

    const cw = (sw - 12) / COLS;
    const ch = (sh - 12) / ROWS;
    const litCols = clamp(fillCols, 0, COLS);

    for (let c = 0; c < COLS; c++) {
      const colAlpha = clamp(litCols - c, 0, 1);
      if (colAlpha <= 0.02) continue;
      const isCurrent = Math.abs(c - Math.floor(winPos * (COLS - 1))) < 0.6 && fillCols > 0.5;
      for (let r = 0; r < ROWS; r++) {
        const val = grid[r][c];
        const cx = sx + 6 + c * cw;
        const cy = sy + 6 + r * ch;
        out += rect(cx + 0.5, cy + 0.5, cw - 1, ch - 1, val > 0.55 ? 'route solid' : 'act solid', {
          rx: 1.2,
          'fill-opacity': clamp(val, 0.06, 0.96) * colAlpha,
        });
      }
      if (isCurrent) {
        out += rect(sx + 6 + c * cw, sy + 5, cw, sh - 10, 'ink', { 'fill-opacity': 0, 'stroke-width': 1.6 });
      }
    }

    out += text(sx + sw / 2, sy + sh + 14, 'Frame time m·H/f_s →', 'ts tc');
    out += text(sx - 5, sy + 18, 'Hz', 'ts te');
    return out;
  },
};

// Pure-JS DSP engine for <AudioLab>: deterministic audio synthesis, PCM quantization,
// radix-2 FFT, Hann/rectangular windowing, STFT, dB scaling, and HTK Mel filterbanks.

export const PRESETS = [
  { id: 'speech', label: 'Speech: click · vowel · "sh"', note: 'Plosive burst (0.07s), voiced vowel with formants (0.14–0.56s), and unvoiced fricative (0.64–0.92s).' },
  { id: 'harmonics', label: 'Harmonics: loud f₀ + quiet overtones', note: '220 Hz fundamental (0.68) with 2f₀, 3f₀, 4f₀, 6f₀ dropping by −14 to −38 dB.' },
  { id: 'chirp', label: 'Chirp sweep + dual clicks', note: 'Exponential sweep 150 → 3,600 Hz plus two 1-ms clicks at 0.24 s and 0.72 s.' },
  { id: 'chord', label: 'Chord + quiet high ping', note: 'C-major triad (262, 330, 392 Hz) with a quiet 2,150 Hz metallic ping at 0.45 s.' },
];

// Deterministic PRNG (Mulberry32) so server and browser render the exact same audio and spectrograms.
function makeRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Synthesize a 1.0 s mono waveform at sample rate `sr` in [-1, 1]. */
export function generatePreset(id, sr = 16000, duration = 1.0) {
  const N = Math.round(sr * duration);
  const out = new Float32Array(N);
  const rand = makeRng(20261115);

  if (id === 'harmonics') {
    const f0 = 220;
    const amps = [
      [1, 0.68],
      [2, 0.14],
      [3, 0.045],
      [4, 0.018],
      [6, 0.008],
    ];
    for (let i = 0; i < N; i++) {
      const t = i / sr;
      const env = Math.min(1, t / 0.04) * Math.min(1, (duration - t) / 0.05);
      // Brief dip around 0.5s to give rhythm
      const dip = 1 - 0.55 * Math.exp(-Math.pow((t - 0.5) / 0.04, 2));
      let s = 0;
      for (const [k, a] of amps) s += a * Math.sin(2 * Math.PI * f0 * k * t);
      out[i] = s * env * dip;
    }
    return out;
  }

  if (id === 'chirp') {
    const fStart = 150;
    const fEnd = 3600;
    const k = Math.log(fEnd / fStart) / duration;
    for (let i = 0; i < N; i++) {
      const t = i / sr;
      const phase = (2 * Math.PI * fStart * (Math.exp(k * t) - 1)) / k;
      const env = Math.min(1, t / 0.02) * Math.min(1, (duration - t) / 0.03);
      const c1 = Math.exp(-Math.pow((t - 0.24) / 0.0012, 2)) * 0.72 * (rand() * 2 - 1 + 0.5);
      const c2 = Math.exp(-Math.pow((t - 0.72) / 0.0012, 2)) * 0.72 * (rand() * 2 - 1 + 0.5);
      out[i] = Math.max(-0.98, Math.min(0.98, 0.58 * env * Math.sin(phase) + c1 + c2));
    }
    return out;
  }

  if (id === 'chord') {
    const notes = [261.63, 329.63, 392.0];
    for (let i = 0; i < N; i++) {
      const t = i / sr;
      const env = Math.min(1, t / 0.015) * Math.exp(-t * 2.2);
      let s = 0;
      for (const f of notes) {
        s += 0.24 * Math.sin(2 * Math.PI * f * t) + 0.07 * Math.sin(2 * Math.PI * 2 * f * t) + 0.025 * Math.sin(2 * Math.PI * 3 * f * t);
      }
      const pingEnv = t >= 0.45 ? Math.exp(-(t - 0.45) * 9.0) * Math.min(1, (t - 0.45) / 0.005) : 0;
      const ping = 0.09 * pingEnv * Math.sin(2 * Math.PI * 2150 * t);
      out[i] = Math.max(-0.98, Math.min(0.98, s * env + ping));
    }
    return out;
  }

  // Default: 'speech' — plosive click + voiced vowel with pitch glide and formants + unvoiced "sh" fricative
  let phase = 0;
  // Simple biquad-like noise shaping state for fricative band (~2.5-6 kHz)
  let prev1 = 0;
  let prev2 = 0;
  for (let i = 0; i < N; i++) {
    const t = i / sr;
    let s = 0;

    // 1. Plosive transient around t = 0.07s
    const burstEnv = Math.exp(-Math.pow((t - 0.07) / 0.003, 2));
    s += burstEnv * 0.75 * (rand() * 2 - 1);

    // 2. Voiced vowel from 0.13s to 0.56s with smoothly varying f0 and F1/F2 formants
    if (t >= 0.12 && t <= 0.58) {
      const u = (t - 0.12) / 0.46;
      const vEnv = Math.sin(Math.PI * u) ** 0.55;
      const f0 = 145 + 45 * Math.sin(Math.PI * u);
      phase += (2 * Math.PI * f0) / sr;
      // Formant centers glide: F1 520->740->480 Hz, F2 1350->1950->1250 Hz, F3 ~2700 Hz
      const F1 = 520 + 220 * Math.sin(Math.PI * u);
      const F2 = 1350 + 600 * Math.sin(Math.PI * u);
      const F3 = 2700;
      let v = 0;
      for (let h = 1; h <= 22; h++) {
        const fh = h * f0;
        if (fh >= sr * 0.47) break;
        const g1 = Math.exp(-0.5 * Math.pow((fh - F1) / 140, 2));
        const g2 = 0.55 * Math.exp(-0.5 * Math.pow((fh - F2) / 210, 2));
        const g3 = 0.25 * Math.exp(-0.5 * Math.pow((fh - F3) / 280, 2));
        const tilt = 1 / (1 + 0.12 * h);
        v += tilt * (0.28 + g1 + g2 + g3) * Math.sin(h * phase);
      }
      s += v * vEnv * 0.34;
    }

    // 3. Unvoiced sibilant "sh" fricative from 0.62s to 0.93s (high-pass/band-pass noise)
    const white = rand() * 2 - 1;
    const hp = white - 0.75 * prev1 + 0.18 * prev2;
    prev2 = prev1;
    prev1 = white;
    if (t >= 0.61 && t <= 0.94) {
      const u = (t - 0.61) / 0.33;
      const fEnv = Math.sin(Math.PI * u) ** 0.7;
      s += hp * fEnv * 0.22;
    }

    out[i] = Math.max(-0.98, Math.min(0.98, s));
  }
  return out;
}

/** Apply gain, hard clipping at [-1, 1], and bit-depth quantization. */
export function quantizeWave(raw, bits = 16, gain = 1.0) {
  const N = raw.length;
  const samples = new Float32Array(N);
  const levels = bits >= 16 ? 65536 : Math.pow(2, bits);
  const step = 2 / (levels - 1);
  let clipped = 0;
  let errPow = 0;
  let sigPow = 0;
  let zc = 0;

  for (let i = 0; i < N; i++) {
    const g = raw[i] * gain;
    if (g > 1.0 || g < -1.0) clipped++;
    const c = Math.max(-1.0, Math.min(1.0, g));
    const q = bits >= 16 ? c : Math.max(-1.0, Math.min(1.0, Math.round((c + 1.0) / step) * step - 1.0));
    samples[i] = q;
    const e = q - c;
    errPow += e * e;
    sigPow += c * c;
    if (i > 0 && ((samples[i - 1] >= 0 && q < 0) || (samples[i - 1] < 0 && q >= 0))) zc++;
  }
  const sqnrDb = errPow > 1e-12 ? 10 * Math.log10(Math.max(1e-12, sigPow) / errPow) : 96;
  return { samples, clipped, sqnrDb, levels, zcr: zc };
}

/** Window tapers of length N. */
export function makeWindow(N, type = 'hann') {
  const w = new Float32Array(N);
  if (type === 'rect') {
    w.fill(1);
    return w;
  }
  for (let i = 0; i < N; i++) {
    w[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / N));
  }
  return w;
}

/** In-place radix-2 Cooley-Tukey FFT (`re.length` must be power of 2). */
export function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      let tmp = re[i];
      re[i] = re[j];
      re[j] = tmp;
      tmp = im[i];
      im[i] = im[j];
      im[j] = tmp;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wlenRe = Math.cos(ang);
    const wlenIm = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let wRe = 1;
      let wIm = 0;
      const half = len >> 1;
      for (let j = 0; j < half; j++) {
        const uRe = re[i + j];
        const uIm = im[i + j];
        const vRe = re[i + j + half] * wRe - im[i + j + half] * wIm;
        const vIm = re[i + j + half] * wIm + im[i + j + half] * wRe;
        re[i + j] = uRe + vRe;
        im[i + j] = uIm + vIm;
        re[i + j + half] = uRe - vRe;
        im[i + j + half] = uIm - vIm;
        const nextWRe = wRe * wlenRe - wIm * wlenIm;
        wIm = wRe * wlenIm + wIm * wlenRe;
        wRe = nextWRe;
      }
    }
  }
}

// HTK Mel conversion (same formula as AudioLLM / Kaldi / HTK).
export const hzToMel = (hz) => 2595 * Math.log10(1 + hz / 700);
export const melToHz = (mel) => 700 * (Math.pow(10, mel / 2595) - 1);

/** Build triangular HTK mel filterbank of shape [nMels][nFftBins]. */
export function buildMelFilterbank(sr, nFft, nMels = 48, fMin = 0, fMax = sr / 2) {
  const nFftBins = (nFft >> 1) + 1;
  const melMin = hzToMel(fMin);
  const melMax = hzToMel(Math.min(fMax, sr / 2));
  const melPts = Array.from({ length: nMels + 2 }, (_, i) => melMin + ((melMax - melMin) * i) / (nMels + 1));
  const hzPts = melPts.map(melToHz);
  const fftFreqs = Array.from({ length: nFftBins }, (_, k) => (k * sr) / nFft);

  const bank = Array.from({ length: nMels }, () => new Float32Array(nFftBins));
  for (let m = 0; m < nMels; m++) {
    const fL = hzPts[m];
    const fC = hzPts[m + 1];
    const fR = hzPts[m + 2];
    for (let k = 0; k < nFftBins; k++) {
      const f = fftFreqs[k];
      if (f >= fL && f <= fC && fC > fL) {
        bank[m][k] = (f - fL) / (fC - fL);
      } else if (f > fC && f <= fR && fR > fC) {
        bank[m][k] = (fR - f) / (fR - fC);
      }
    }
  }
  return { bank, centersHz: hzPts.slice(1, nMels + 1) };
}

/**
 * Compute STFT spectrogram and prepare both raw magnitudes and normalized [0,1] display grid.
 * Grid layout: matrix[frame * nBins + bin], bin 0 = lowest frequency.
 */
export function computeSpectrogram(samples, opts = {}) {
  const sr = opts.sr ?? 16000;
  const nFft = opts.nFft ?? 512;
  const hop = opts.hop ?? Math.max(16, Math.round(nFft / 4));
  const winType = opts.winType ?? 'hann';
  const freqScale = opts.freqScale ?? 'linear';
  const magScale = opts.magScale ?? 'db';
  const nMels = opts.nMels ?? 48;
  const dbFloor = opts.dbFloor ?? -60;

  const win = makeWindow(nFft, winType);
  const winSum = win.reduce((a, b) => a + b, 0) || 1;
  const nFftBins = (nFft >> 1) + 1;
  const nFrames = Math.max(1, Math.floor((samples.length - nFft) / hop) + 1);

  const re = new Float32Array(nFft);
  const im = new Float32Array(nFft);

  // Compute linear STFT magnitudes & power for every frame
  const linMag = new Float32Array(nFrames * nFftBins);
  const linPow = new Float32Array(nFrames * nFftBins);
  let maxMag = 1e-9;
  let maxPow = 1e-12;

  for (let m = 0; m < nFrames; m++) {
    const start = m * hop;
    for (let i = 0; i < nFft; i++) {
      re[i] = (samples[start + i] ?? 0) * win[i];
      im[i] = 0;
    }
    fft(re, im);
    const off = m * nFftBins;
    for (let k = 0; k < nFftBins; k++) {
      const mag = (Math.hypot(re[k], im[k]) * 2) / winSum;
      const pow = mag * mag;
      linMag[off + k] = mag;
      linPow[off + k] = pow;
      if (mag > maxMag) maxMag = mag;
      if (pow > maxPow) maxPow = pow;
    }
  }

  let nBins = nFftBins;
  let freqs = Array.from({ length: nFftBins }, (_, k) => (k * sr) / nFft);
  let melBank = null;
  let rawEnergy = magScale === 'linear' ? linMag : linPow;
  let refMax = magScale === 'linear' ? maxMag : maxPow;

  if (freqScale === 'mel') {
    const { bank, centersHz } = buildMelFilterbank(sr, nFft, nMels, 0, sr / 2);
    melBank = bank;
    nBins = nMels;
    freqs = centersHz;
    const melPow = new Float32Array(nFrames * nMels);
    let maxMel = 1e-12;
    for (let m = 0; m < nFrames; m++) {
      const offIn = m * nFftBins;
      const offOut = m * nMels;
      for (let b = 0; b < nMels; b++) {
        let sum = 0;
        const w = bank[b];
        for (let k = 0; k < nFftBins; k++) {
          if (w[k] > 0) sum += w[k] * linPow[offIn + k];
        }
        melPow[offOut + b] = sum;
        if (sum > maxMel) maxMel = sum;
      }
    }
    rawEnergy = melPow;
    refMax = maxMel;
  }

  const display = new Float32Array(nFrames * nBins);
  const rawDb = new Float32Array(nFrames * nBins);
  const safeRef = Math.max(refMax, 1e-12);

  for (let i = 0; i < display.length; i++) {
    const e = rawEnergy[i];
    const ratio = Math.max(e / safeRef, 1e-12);
    const db = magScale === 'linear' ? 20 * Math.log10(ratio) : 10 * Math.log10(ratio);
    rawDb[i] = db;
    if (magScale === 'db') {
      display[i] = Math.max(0, Math.min(1, (db - dbFloor) / -dbFloor));
    } else {
      display[i] = Math.max(0, Math.min(1, e / safeRef));
    }
  }

  const times = Array.from({ length: nFrames }, (_, m) => (m * hop + nFft / 2) / sr);
  return {
    sr,
    nFft,
    hop,
    nFrames,
    nBins,
    times,
    freqs,
    display,
    rawEnergy,
    rawDb,
    linMag,
    melBank,
    maxMag,
    refMax,
    df: sr / nFft,
    dt: hop / sr,
    winMs: (nFft * 1000) / sr,
    nyquist: sr / 2,
  };
}

/** Curated visual terminology hotspots on the 'speech' preset (duration 1.0s, 0..8000 Hz). */
export const ANATOMY_ITEMS = [
  {
    id: 'transient',
    label: 'Vertical streak',
    term: 'Transient / plosive burst',
    t0: 0.045,
    t1: 0.1,
    f0: 150,
    f1: 7600,
    where: 'Waveform: narrow spike · Spectrogram: tall vertical column',
    why: 'A sudden air release (like /p/ or a drum hit) lasts only a few milliseconds, so by time–frequency uncertainty its energy spreads across almost every frequency at once.',
  },
  {
    id: 'harmonics',
    label: 'Horizontal stripes',
    term: 'Harmonic stack (f₀, 2f₀, 3f₀…)',
    t0: 0.14,
    t1: 0.56,
    f0: 120,
    f1: 1650,
    where: 'Waveform: repeating periodic cycles · Spectrogram: parallel stacked bands',
    why: 'Vocal folds vibrate periodically at fundamental frequency f₀, producing integer multiples (2f₀, 3f₀, …). Steady pitch traces flat or gently curving stripes stacked vertically.',
  },
  {
    id: 'formants',
    label: 'Thick bright bands',
    term: 'Formants (vocal tract resonances)',
    t0: 0.17,
    t1: 0.53,
    f0: 420,
    f1: 2350,
    where: 'Spectrogram: bright intensity peaks across harmonic stripes (F₁, F₂)',
    why: 'Your tongue and lips shape the throat into resonant cavities that boost certain harmonics (F₁ ~500–750 Hz, F₂ ~1.3–2.0 kHz). Moving F₁ and F₂ separates "ee" from "ah".',
  },
  {
    id: 'fricative',
    label: 'High-freq haze',
    term: 'Unvoiced fricative / broadband noise',
    t0: 0.62,
    t1: 0.93,
    f0: 2100,
    f1: 7600,
    where: 'Waveform: dense irregular fuzz · Spectrogram: speckled cloud above 2.2 kHz',
    why: 'Air forced past the tongue for "sh" or "s" has no periodic vocal-fold vibration, so there are no clean harmonic stripes—only random high-frequency energy with high zero-crossing rate.',
  },
  {
    id: 'silence',
    label: 'Dark floor',
    term: 'Silence / noise floor (dB clamping)',
    t0: 0.56,
    t1: 0.62,
    f0: 150,
    f1: 7600,
    where: 'Waveform: flat line at 0 · Spectrogram: dark gap between phonemes',
    why: 'In log (dB) mode, values below the floor (e.g. −60 dB) clip to the darkest shade so quiet breaths or silence do not wash out real speech cues.',
  },
  {
    id: 'nyquist',
    label: 'Top edge (8 kHz)',
    term: 'Nyquist ceiling (f_s / 2)',
    t0: 0.02,
    t1: 0.98,
    f0: 7100,
    f1: 8000,
    where: 'Spectrogram top border: f_max = f_s / 2',
    why: 'A 16 kHz waveform can only represent frequencies up to 8 kHz without aliasing. Anything faster must be filtered out before sampling.',
  },
];

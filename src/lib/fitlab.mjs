// The small machine-learning lab behind <BiasVariance>: draw many noisy training sets from one true
// curve, fit the same model to each, and measure bias², variance and test error on a grid. Every
// fit is computed here, in the reader's browser, so the pictures are real fits and not drawings.
// Everything is seeded, so the same settings give the same picture on every load (keep-place).
//
// A family describes one kind of model and its knob, ordered from least to most flexible:
//   { label, tab, knob, grid: [values] or (n) => [values], format?(v), log?, sweep(data, opts) -> one predictor per value }
// A predictor is { yGrid: Float64Array over GRID_X, yTrain: Float64Array over the training x, norm? }.

export const GRID_N = 121;
export const GRID_X = Float64Array.from({ length: GRID_N }, (_, i) => -1 + (2 * i) / (GRID_N - 1));
export const truth = (x) => Math.sin(3 * x) + 0.3 * x;

// ---------- random numbers ----------
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const gauss = (r) => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());

/**
 * Training set number `r`: n points spread over [-1, 1] (one at a random place in each of n equal
 * slots, so no big gaps), y = f(x) + noise. Same r, same points.
 */
export function dataset(r, n, noise) {
  const rand = rng(1000003 * (r + 1) + 7919 * n);
  const x = Float64Array.from({ length: n }, (_, i) => -1 + (2 * (i + rand())) / n);
  const eps = Float64Array.from({ length: n }, () => gauss(rand));
  const y = x.map((xi, i) => truth(xi) + noise * eps[i]);
  return { x, y, r, rand };
}

// ---------- linear algebra ----------
/** Solve A w = b for symmetric positive (semi)definite A (row-major, m × m), with a small jitter. */
function solveSPD(A, b, m) {
  let tr = 0;
  for (let i = 0; i < m; i++) tr += A[i * m + i];
  for (let jitter = 1e-12 * (tr / m || 1), tries = 0; tries < 6; tries++, jitter *= 100) {
    const L = new Float64Array(m * m);
    let ok = true;
    for (let i = 0; i < m && ok; i++) {
      for (let j = 0; j <= i; j++) {
        let s = A[i * m + j] + (i === j ? jitter : 0);
        for (let k = 0; k < j; k++) s -= L[i * m + k] * L[j * m + k];
        if (i === j) {
          if (!(s > 0)) ok = false;
          else L[i * m + i] = Math.sqrt(s);
        } else L[i * m + j] = s / L[j * m + j];
      }
    }
    if (!ok) continue;
    const z = new Float64Array(m);
    for (let i = 0; i < m; i++) {
      let s = b[i];
      for (let k = 0; k < i; k++) s -= L[i * m + k] * z[k];
      z[i] = s / L[i * m + i];
    }
    const w = new Float64Array(m);
    for (let i = m - 1; i >= 0; i--) {
      let s = z[i];
      for (let k = i + 1; k < m; k++) s -= L[k * m + i] * w[k];
      w[i] = s / L[i * m + i];
    }
    return w;
  }
  return new Float64Array(m);
}

/**
 * Least squares on features Phi (n × p, row-major) with ridge penalty lambda on the coefficients
 * (penalty[j] scales it per coefficient). With lambda → 0 and p > n this is the minimum-norm fit.
 */
function leastSquares(Phi, y, n, p, lambda, penalty) {
  if (p <= n) {
    const A = new Float64Array(p * p);
    const b = new Float64Array(p);
    for (let i = 0; i < n; i++) {
      const row = i * p;
      for (let j = 0; j < p; j++) {
        const v = Phi[row + j];
        b[j] += v * y[i];
        for (let k = 0; k <= j; k++) A[j * p + k] += v * Phi[row + k];
      }
    }
    for (let j = 0; j < p; j++) {
      for (let k = 0; k < j; k++) A[k * p + j] = A[j * p + k];
      A[j * p + j] += lambda * (penalty ? penalty[j] : 1);
    }
    return solveSPD(A, b, p);
  }
  // Dual form: w = Phiᵀ (Phi Phiᵀ + λ I)⁻¹ y, the minimum-norm interpolant as λ → 0.
  const G = new Float64Array(n * n);
  for (let i = 0; i < n; i++)
    for (let k = 0; k <= i; k++) {
      let s = 0;
      for (let j = 0; j < p; j++) s += Phi[i * p + j] * Phi[k * p + j];
      G[i * n + k] = G[k * n + i] = s;
    }
  for (let i = 0; i < n; i++) G[i * n + i] += lambda;
  const a = solveSPD(G, y, n);
  const w = new Float64Array(p);
  for (let i = 0; i < n; i++) for (let j = 0; j < p; j++) w[j] += Phi[i * p + j] * a[i];
  return w;
}

const apply = (feat, w, xs, p) => {
  const out = new Float64Array(xs.length);
  for (let i = 0; i < xs.length; i++) {
    const f = feat(xs[i]);
    let s = 0;
    for (let j = 0; j < p; j++) s += f[j] * w[j];
    out[i] = s;
  }
  return out;
};
const design = (feat, xs, p) => {
  const Phi = new Float64Array(xs.length * p);
  xs.forEach((x, i) => Phi.set(feat(x), i * p));
  return Phi;
};
const norm = (w) => Math.sqrt(w.reduce((s, v) => s + v * v, 0));

// ---------- model families ----------
function legendre(deg) {
  return (x) => {
    const P = new Float64Array(deg + 1);
    P[0] = 1;
    if (deg > 0) P[1] = x;
    for (let k = 1; k < deg; k++) P[k + 1] = ((2 * k + 1) * x * P[k] - k * P[k - 1]) / (k + 1);
    return P;
  };
}
function polyFit(d, deg, lambda) {
  const feat = legendre(deg);
  const p = deg + 1;
  const pen = Float64Array.from({ length: p }, (_, j) => (j === 0 ? 0 : 1));
  const w = leastSquares(design(feat, d.x, p), d.y, d.x.length, p, lambda, pen);
  return { yGrid: apply(feat, w, GRID_X, p), yTrain: apply(feat, w, d.x, p) };
}

function knnPredict(d, k, xs) {
  const n = d.x.length;
  const idx = [...Array(n).keys()];
  return Float64Array.from(xs, (x) => {
    idx.sort((a, b) => Math.abs(d.x[a] - x) - Math.abs(d.x[b] - x));
    let s = 0;
    for (let j = 0; j < k; j++) s += d.y[idx[j]];
    return s / k;
  });
}

/** A 1-D regression tree (CART, squared error): returns a piecewise-constant predictor. */
function growTree(xs, ys, w, depth, minLeaf = 1) {
  const order = [...xs.keys()].filter((i) => w[i] > 0).sort((a, b) => xs[a] - xs[b]);
  function node(ids, dep) {
    let sw = 0;
    let sy = 0;
    for (const i of ids) (sw += w[i]), (sy += w[i] * ys[i]);
    const mean = sy / sw;
    if (dep >= depth || ids.length < 2 * minLeaf) return { v: mean };
    let best = null;
    let lw = 0;
    let ly = 0;
    let ly2 = 0;
    let tw = 0;
    let ty2 = 0;
    for (const i of ids) (tw += w[i]), (ty2 += w[i] * ys[i] * ys[i]);
    for (let s = 0; s < ids.length - 1; s++) {
      const i = ids[s];
      lw += w[i];
      ly += w[i] * ys[i];
      ly2 += w[i] * ys[i] * ys[i];
      if (s + 1 < minLeaf || ids.length - s - 1 < minLeaf) continue;
      if (xs[ids[s + 1]] === xs[i]) continue;
      const rw = sw - lw;
      const ry = sy - ly;
      const sse = ly2 - (ly * ly) / lw + (ty2 - ly2) - (ry * ry) / rw;
      if (!best || sse < best.sse - 1e-12) best = { sse, s };
    }
    if (!best) return { v: mean };
    const t = (xs[ids[best.s]] + xs[ids[best.s + 1]]) / 2;
    return { t, l: node(ids.slice(0, best.s + 1), dep + 1), r: node(ids.slice(best.s + 1), dep + 1) };
  }
  const root = node(order, 0);
  return (x) => {
    let nd = root;
    while (nd.t !== undefined) nd = x < nd.t ? nd.l : nd.r;
    return nd.v;
  };
}

/**
 * Fourier features, slowest wave first: 1, cos(πx/L), sin(πx/L), cos(2πx/L), ... Wave k is scaled
 * by 1/k, so a fit that keeps its weights small prefers smooth waves. Width p = how many
 * columns the model has; a fit with p >= n can pass through every training point.
 */
const PERIOD = 1.2; // L: half the period of the slowest wave, a little wider than [-1, 1]
function fourierFeatures(p) {
  return (x) => {
    const f = new Float64Array(p);
    f[0] = 1;
    for (let j = 1; j < p; j++) {
      const k = Math.ceil(j / 2);
      const t = (Math.PI * k * x) / PERIOD;
      f[j] = (j % 2 ? Math.cos(t) : Math.sin(t)) / k;
    }
    return f;
  };
}

/** A one-hidden-layer tanh network trained with full-batch Adam; snapshots at the given steps. */
function trainMLP(d, steps, H = 24, lr = 0.02) {
  const rand = rng(77 + 7919 * d.r);
  const n = d.x.length;
  const W1 = Float64Array.from({ length: H }, () => 3 * gauss(rand));
  const b1 = Float64Array.from({ length: H }, () => 3 * gauss(rand) * 0.6);
  const W2 = Float64Array.from({ length: H }, () => (0.1 * gauss(rand)) / Math.sqrt(H));
  let b2 = 0;
  const P = 3 * H + 1;
  const m = new Float64Array(P);
  const v = new Float64Array(P);
  const g = new Float64Array(P);
  const h = new Float64Array(n * H);
  const predict = (xs) =>
    Float64Array.from(xs, (x) => {
      let s = b2;
      for (let j = 0; j < H; j++) s += W2[j] * Math.tanh(W1[j] * x + b1[j]);
      return s;
    });
  const out = [];
  let si = 0;
  const last = steps[steps.length - 1];
  for (let t = 0; t <= last; t++) {
    if (t === steps[si]) {
      out.push({ yGrid: predict(GRID_X), yTrain: predict(d.x) });
      si++;
    }
    if (t === last) break;
    g.fill(0);
    for (let i = 0; i < n; i++) {
      let s = b2;
      for (let j = 0; j < H; j++) {
        const a = Math.tanh(W1[j] * d.x[i] + b1[j]);
        h[i * H + j] = a;
        s += W2[j] * a;
      }
      const e = (2 * (s - d.y[i])) / n;
      g[3 * H] += e;
      for (let j = 0; j < H; j++) {
        const a = h[i * H + j];
        g[2 * H + j] += e * a;
        const da = e * W2[j] * (1 - a * a);
        g[j] += da * d.x[i];
        g[H + j] += da;
      }
    }
    const b1c = 1 - 0.9 ** (t + 1);
    const b2c = 1 - 0.999 ** (t + 1);
    for (let k = 0; k < P; k++) {
      m[k] = 0.9 * m[k] + 0.1 * g[k];
      v[k] = 0.999 * v[k] + 0.001 * g[k] * g[k];
      const step = (lr * (m[k] / b1c)) / (Math.sqrt(v[k] / b2c) + 1e-8);
      if (k < H) W1[k] -= step;
      else if (k < 2 * H) b1[k - H] -= step;
      else if (k < 3 * H) W2[k - 2 * H] -= step;
      else b2 -= step;
    }
  }
  return out;
}

const SUP = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
/** 0.003 → "3·10⁻³", 0.3 → "0.3", 30 → "30". */
export const sci = (v) => {
  if (v === 0) return '0';
  if (v >= 0.01 && v < 1000) return String(+v.toPrecision(1));
  let e = Math.floor(Math.log10(v) + 1e-9);
  let m = Math.round(v / 10 ** e);
  if (m === 10) (m = 1), e++;
  const pow = `10${[...String(e)].map((c) => SUP[c]).join('')}`;
  return m === 1 ? pow : `${m}·${pow}`;
};
const sig2 = (v) => String(+v.toPrecision(2));
const logGrid = (hi, lo, count) => Array.from({ length: count }, (_, i) => +(hi * (lo / hi) ** (i / (count - 1))).toPrecision(2));

export const FAMILIES = {
  poly: {
    label: 'Polynomial regression',
    tab: 'Polynomial',
    linear: true,
    knob: 'degree',
    grid: (n) => [...Array(Math.min(16, n)).keys()],
    sweep: (d, o) => o.grid.map((deg) => polyFit(d, deg, 0)),
  },
  ridge: {
    label: 'Ridge regression on a degree-15 polynomial',
    tab: 'Ridge',
    linear: true,
    knob: 'penalty λ',
    grid: logGrid(30, 1e-5, 14),
    format: sci,
    sweep: (d, o) => o.grid.map((lam) => polyFit(d, 15, lam)),
  },
  knn: {
    label: 'k-nearest neighbours',
    tab: 'k-NN',
    linear: true,
    knob: 'neighbours k',
    grid: (n) => [n, 24, 16, 12, 9, 7, 5, 4, 3, 2, 1].filter((k, i, a) => k <= n && (i === 0 || k < a[0])),
    sweep: (d, o) => o.grid.map((k) => ({ yGrid: knnPredict(d, k, GRID_X), yTrain: knnPredict(d, k, d.x) })),
  },
  tree: {
    label: 'Decision tree',
    tab: 'Tree',
    knob: 'depth',
    grid: [0, 1, 2, 3, 4, 5, 6, 7, 8],
    sweep: (d, o) => {
      const w = new Float64Array(d.x.length).fill(1);
      return o.grid.map((dep) => {
        const t = growTree(d.x, d.y, w, dep);
        return { yGrid: GRID_X.map(t), yTrain: d.x.map(t) };
      });
    },
  },
  kernel: {
    label: 'RBF kernel regression (the kernel of an RBF SVM)',
    tab: 'RBF kernel',
    linear: true,
    knob: 'width ℓ',
    grid: logGrid(4, 0.02, 12),
    format: sig2,
    sweep: (d, o) => {
      const n = d.x.length;
      const mean = d.y.reduce((a, b) => a + b, 0) / n;
      const yc = d.y.map((v) => v - mean);
      return o.grid.map((ell) => {
        const K = (a, b) => Math.exp(-((a - b) ** 2) / (2 * ell * ell));
        const G = new Float64Array(n * n);
        for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) G[i * n + j] = K(d.x[i], d.x[j]) + (i === j ? 1e-2 : 0);
        const a = solveSPD(G, yc, n);
        const pred = (x) => d.x.reduce((s, xi, i) => s + a[i] * K(x, xi), mean);
        return { yGrid: GRID_X.map(pred), yTrain: d.x.map(pred) };
      });
    },
  },
  forest: {
    label: 'Random forest: full-depth trees on bootstrap samples, averaged',
    tab: 'Random forest',
    knob: 'trees',
    grid: [1, 2, 3, 5, 8, 13, 20, 32, 50],
    sweep: (d, o) => {
      const n = d.x.length;
      const sumG = new Float64Array(GRID_N);
      const sumT = new Float64Array(n);
      const out = [];
      for (let t = 1, gi = 0; gi < o.grid.length; t++) {
        const w = new Float64Array(n);
        for (let i = 0; i < n; i++) w[Math.floor(d.rand() * n)]++;
        const tree = growTree(d.x, d.y, w, 99);
        GRID_X.forEach((x, i) => (sumG[i] += tree(x)));
        d.x.forEach((x, i) => (sumT[i] += tree(x)));
        if (t === o.grid[gi]) {
          out.push({ yGrid: sumG.map((v) => v / t), yTrain: sumT.map((v) => v / t) });
          gi++;
        }
      }
      return out;
    },
  },
  boost: {
    label: 'Gradient boosting with one-split trees',
    tab: 'Boosting',
    knob: 'rounds',
    samples: 32,
    grid: [1, 3, 10, 30, 100, 300, 1000, 3000],
    sweep: (d, o) => {
      const n = d.x.length;
      const mean = d.y.reduce((a, b) => a + b, 0) / n;
      const F = new Float64Array(n).fill(mean);
      const FG = new Float64Array(GRID_N).fill(mean);
      const w = new Float64Array(n).fill(1);
      const out = [];
      for (let t = 1, gi = 0; gi < o.grid.length; t++) {
        const res = d.y.map((y, i) => y - F[i]);
        const stump = growTree(d.x, res, w, 1);
        for (let i = 0; i < n; i++) F[i] += 0.1 * stump(d.x[i]);
        for (let i = 0; i < GRID_N; i++) FG[i] += 0.1 * stump(GRID_X[i]);
        if (t === o.grid[gi]) {
          out.push({ yGrid: FG.slice(), yTrain: F.slice() });
          gi++;
        }
      }
      return out;
    },
  },
  mlp: {
    label: 'Neural network, one hidden layer, stopped after t steps',
    tab: 'Neural net',
    knob: 'training steps',
    grid: [0, 10, 30, 100, 300, 1000, 3000],
    samples: 16,
    sweep: (d, o) => trainMLP(d, o.grid),
  },
  features: {
    label: 'Linear model on p Fourier features, minimum-norm fit',
    tab: 'Features',
    linear: true,
    knob: 'width p',
    samples: 32,
    // Log-spaced, dense around p = n where the peak sits, plus round widths that stay put when n moves.
    grid: (n) =>
      [...new Set([1, 2, 3, 4, 6, 8, 10, 15, 20, 25, 30, 40, 50, ...[0.5, 0.65, 0.8, 0.9, 1.1, 1.25, 1.5, 2, 3, 5, 8, 12].map((f) => Math.round(f * n)), n - 2, n - 1, n, n + 1, n + 2])]
        .filter((p) => p >= 1)
        .sort((a, b) => a - b),
    log: true,
    sweep: (d, o) =>
      o.grid.map((p) => {
        const feat = fourierFeatures(p);
        const w = leastSquares(design(feat, d.x, p), d.y, d.x.length, p, o.lambda ?? 0);
        return { yGrid: apply(feat, w, GRID_X, p), yTrain: apply(feat, w, d.x, p), norm: norm(w) };
      }),
  },
};

/**
 * Fit family `key` to `samples` training sets and summarise every knob value. A generator, so a page
 * can fit a few training sets per frame and stay responsive; `run` drives it to the end at once.
 * Result: { grid, fits: [knob][sample] Float64Array over GRID_X, means, rows: [{ bias2, variance,
 * test, train, norm }], data: [{ x, y }], truth, noise }.
 */
export function* fitSteps(key, { n = 20, noise = 0.3, samples, lambda = 0 } = {}) {
  const fam = FAMILIES[key];
  const grid = typeof fam.grid === 'function' ? fam.grid(n) : fam.grid;
  const R = samples ?? fam.samples ?? 64;
  const data = [];
  const per = [];
  // For a linear fit (prediction linear in y) the average over noise is the fit to the noiseless
  // curve, so we compute the average fit exactly instead of estimating it from R noisy fits.
  const clean = [];
  for (let r = 0; r < R; r++) {
    const d = dataset(r, n, noise);
    data.push({ x: d.x, y: d.y });
    per.push(fam.sweep(d, { grid, lambda }));
    if (fam.linear && noise > 0) clean.push(fam.sweep(dataset(r, n, 0), { grid, lambda }));
    yield (r + 1) / R;
  }
  const f = GRID_X.map(truth);
  const fits = [];
  const means = [];
  const rows = grid.map((_, k) => {
    const ys = per.map((p) => p[k].yGrid);
    fits.push(ys);
    const mean = new Float64Array(GRID_N);
    for (const y of ys) for (let i = 0; i < GRID_N; i++) mean[i] += y[i] / R;
    const avg = new Float64Array(GRID_N);
    if (clean.length) for (const c of clean) for (let i = 0; i < GRID_N; i++) avg[i] += c[k].yGrid[i] / R;
    else avg.set(mean);
    means.push(avg);
    let bias2 = 0;
    let variance = 0;
    for (let i = 0; i < GRID_N; i++) {
      bias2 += (avg[i] - f[i]) ** 2;
      let v = 0;
      for (const y of ys) v += (y[i] - mean[i]) ** 2;
      variance += v / (R - 1);
    }
    variance /= GRID_N;
    bias2 /= GRID_N;
    // An average of R noisy fits still wobbles by variance / R; take that out so bias² isn't inflated.
    if (!clean.length) bias2 = Math.max(0, bias2 - variance / R);
    let train = 0;
    per.forEach((p, r) => p[k].yTrain.forEach((yh, i) => (train += (yh - data[r].y[i]) ** 2 / (n * R))));
    const nr = per[0][k].norm === undefined ? undefined : per.reduce((s, p) => s + p[k].norm, 0) / R;
    return { bias2, variance, test: bias2 + variance + noise * noise, train, norm: nr };
  });
  return { grid, fits, means, rows, data, truth: f, noise };
}

export function run(key, opts) {
  const it = fitSteps(key, opts);
  for (;;) {
    const step = it.next();
    if (step.done) return step.value;
  }
}

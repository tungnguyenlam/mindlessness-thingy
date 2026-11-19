// Pure-JS Support Vector Machine (SMO dual solver), kernel functions, datasets, and 2D->3D
// feature-lift math for <KernelSvmLab>. Deterministic and dependency-free.

export const PRESETS = {
  linear: {
    label: 'Linear',
    points: [
      { x: -1.05, y: 0.85, c: 1 },
      { x: -0.82, y: 0.42, c: 1 },
      { x: -0.58, y: 0.95, c: 1 },
      { x: -0.42, y: 0.55, c: 1 },
      { x: -0.95, y: 0.12, c: 1 },
      { x: -0.35, y: 0.18, c: 1 },
      { x: -0.68, y: -0.15, c: 1 },
      { x: -0.22, y: 0.72, c: 1 },
      { x: -0.18, y: -0.05, c: 1 },
      { x: -0.55, y: -0.48, c: 1 },
      { x: 0.28, y: 0.12, c: -1 },
      { x: 0.45, y: -0.28, c: -1 },
      { x: 0.68, y: 0.35, c: -1 },
      { x: 0.85, y: -0.12, c: -1 },
      { x: 0.55, y: -0.78, c: -1 },
      { x: 1.02, y: -0.55, c: -1 },
      { x: 0.18, y: -0.52, c: -1 },
      { x: 0.95, y: 0.18, c: -1 },
      { x: 0.38, y: -0.95, c: -1 },
      { x: 0.75, y: -0.88, c: -1 },
    ],
  },
  circles: {
    label: 'Circles',
    points: (() => {
      const pts = [];
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2 + 0.15;
        const r = 0.42 + (i % 2 === 0 ? 0.06 : -0.04);
        pts.push({ x: +(Math.cos(a) * r).toFixed(3), y: +(Math.sin(a) * r).toFixed(3), c: 1 });
      }
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2 + 0.28;
        const r = 1.06 + (i % 2 === 0 ? 0.07 : -0.05);
        pts.push({ x: +(Math.cos(a) * r).toFixed(3), y: +(Math.sin(a) * r).toFixed(3), c: -1 });
      }
      return pts;
    })(),
  },
  moons: {
    label: 'Moons',
    points: (() => {
      const pts = [];
      for (let i = 0; i < 11; i++) {
        const t = (i / 10) * Math.PI;
        const jitter = (i % 2 === 0 ? 0.05 : -0.05);
        pts.push({
          x: +(Math.cos(t) * 0.78 - 0.32).toFixed(3),
          y: +(Math.sin(t) * 0.78 - 0.15 + jitter).toFixed(3),
          c: 1,
        });
      }
      for (let i = 0; i < 11; i++) {
        const t = (i / 10) * Math.PI;
        const jitter = (i % 2 === 0 ? -0.05 : 0.05);
        pts.push({
          x: +(1 - Math.cos(t) * 0.78 - 0.68).toFixed(3),
          y: +(-Math.sin(t) * 0.78 + 0.25 + jitter).toFixed(3),
          c: -1,
        });
      }
      return pts;
    })(),
  },
  xor: {
    label: 'XOR',
    points: [
      { x: 0.45, y: 0.48, c: 1 },
      { x: 0.85, y: 0.72, c: 1 },
      { x: 0.62, y: 0.98, c: 1 },
      { x: 1.02, y: 0.38, c: 1 },
      { x: 0.42, y: 0.82, c: 1 },
      { x: -0.45, y: -0.48, c: 1 },
      { x: -0.88, y: -0.68, c: 1 },
      { x: -0.62, y: -0.96, c: 1 },
      { x: -1.04, y: -0.42, c: 1 },
      { x: -0.42, y: -0.84, c: 1 },
      { x: -0.48, y: 0.45, c: -1 },
      { x: -0.86, y: 0.72, c: -1 },
      { x: -0.64, y: 0.96, c: -1 },
      { x: -1.02, y: 0.42, c: -1 },
      { x: -0.44, y: 0.86, c: -1 },
      { x: 0.48, y: -0.45, c: -1 },
      { x: 0.88, y: -0.68, c: -1 },
      { x: 0.62, y: -0.98, c: -1 },
      { x: 1.04, y: -0.38, c: -1 },
      { x: 0.44, y: -0.84, c: -1 },
    ],
  },
};

export function kernelVal(type, gamma, deg, ax, ay, bx, by) {
  const dot = ax * bx + ay * by;
  if (type === 'linear') return dot;
  if (type === 'poly') return Math.pow(gamma * dot + 1, deg);
  const dx = ax - bx;
  const dy = ay - by;
  return Math.exp(-gamma * (dx * dx + dy * dy));
}

/**
 * Solve the soft-margin SVM dual using Platt's SMO algorithm.
 * points: Array<{ x: number, y: number, c: 1 | -1 }>
 */
export function solveSVM(points, { kernel = 'rbf', C = 2, gamma = 1.5, degree = 2 } = {}) {
  const n = points.length;
  if (n === 0) {
    return { alphas: [], b: 0, svCount: 0, marginWidth: null, accuracy: 1, violations: 0, predict: () => 0 };
  }

  const K = new Array(n);
  for (let i = 0; i < n; i++) {
    K[i] = new Float64Array(n);
    for (let j = 0; j < n; j++) {
      K[i][j] = kernelVal(kernel, gamma, degree, points[i].x, points[i].y, points[j].x, points[j].y);
    }
  }

  const alphas = new Float64Array(n);
  let b = 0;
  const tol = 1e-3;
  const eps = 1e-4;
  const maxPasses = 40;
  let passes = 0;
  let iter = 0;
  const maxIter = 2500;

  const evalIdx = (i) => {
    let s = b;
    for (let k = 0; k < n; k++) {
      if (alphas[k] > 0) s += alphas[k] * points[k].c * K[k][i];
    }
    return s;
  };

  while (passes < maxPasses && iter < maxIter) {
    let numChanged = 0;
    for (let i = 0; i < n; i++) {
      iter++;
      const yi = points[i].c;
      const Ei = evalIdx(i) - yi;
      if ((yi * Ei < -tol && alphas[i] < C) || (yi * Ei > tol && alphas[i] > 0)) {
        // Pick j maximizing |Ei - Ej| first, else deterministic fallback
        let bestJ = -1;
        let bestDelta = -1;
        for (let k = 0; k < n; k++) {
          if (k === i) continue;
          const Ek = evalIdx(k) - points[k].c;
          const d = Math.abs(Ei - Ek);
          if (d > bestDelta) {
            bestDelta = d;
            bestJ = k;
          }
        }
        if (bestJ < 0) continue;

        const attemptPair = (j) => {
          const yj = points[j].c;
          const Ej = evalIdx(j) - yj;
          const aiOld = alphas[i];
          const ajOld = alphas[j];

          let L, H;
          if (yi !== yj) {
            L = Math.max(0, ajOld - aiOld);
            H = Math.min(C, C + ajOld - aiOld);
          } else {
            L = Math.max(0, aiOld + ajOld - C);
            H = Math.min(C, aiOld + ajOld);
          }
          if (H - L < 1e-7) return false;

          const eta = 2 * K[i][j] - K[i][i] - K[j][j];
          if (eta >= -1e-9) return false;

          let ajNew = ajOld - (yj * (Ei - Ej)) / eta;
          if (ajNew > H) ajNew = H;
          else if (ajNew < L) ajNew = L;
          if (Math.abs(ajNew - ajOld) < 1e-5) return false;

          const aiNew = aiOld + yi * yj * (ajOld - ajNew);
          const b1 = b - Ei - yi * (aiNew - aiOld) * K[i][i] - yj * (ajNew - ajOld) * K[i][j];
          const b2 = b - Ej - yi * (aiNew - aiOld) * K[i][j] - yj * (ajNew - ajOld) * K[j][j];

          if (aiNew > eps && aiNew < C - eps) b = b1;
          else if (ajNew > eps && ajNew < C - eps) b = b2;
          else b = 0.5 * (b1 + b2);

          alphas[i] = aiNew;
          alphas[j] = ajNew;
          return true;
        };

        let changed = attemptPair(bestJ);
        if (!changed) {
          for (let off = 1; off < n; off++) {
            const j = (i + off) % n;
            if (attemptPair(j)) {
              changed = true;
              break;
            }
          }
        }
        if (changed) numChanged++;
      }
    }
    if (numChanged === 0) passes++;
    else passes = 0;
  }

  // Recompute b cleanly from free support vectors (0 < alpha < C)
  let bSum = 0;
  let bCount = 0;
  for (let i = 0; i < n; i++) {
    if (alphas[i] > eps && alphas[i] < C - eps) {
      let s = 0;
      for (let k = 0; k < n; k++) {
        if (alphas[k] > 0) s += alphas[k] * points[k].c * K[k][i];
      }
      bSum += points[i].c - s;
      bCount++;
    }
  }
  if (bCount > 0) {
    b = bSum / bCount;
  }

  const predict = (x, y) => {
    let s = b;
    for (let i = 0; i < n; i++) {
      if (alphas[i] > eps) {
        s += alphas[i] * points[i].c * kernelVal(kernel, gamma, degree, points[i].x, points[i].y, x, y);
      }
    }
    return s;
  };

  let wNormSq = 0;
  for (let i = 0; i < n; i++) {
    if (alphas[i] <= eps) continue;
    for (let j = 0; j < n; j++) {
      if (alphas[j] <= eps) continue;
      wNormSq += alphas[i] * alphas[j] * points[i].c * points[j].c * K[i][j];
    }
  }
  const marginWidth = wNormSq > 1e-8 ? 2 / Math.sqrt(wNormSq) : null;

  let svCount = 0;
  let correct = 0;
  let violations = 0;
  const scores = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    if (alphas[i] > eps) svCount++;
    const f = predict(points[i].x, points[i].y);
    scores[i] = f;
    if (points[i].c * f >= 0) correct++;
    if (points[i].c * f < 1 - 1e-2) violations++;
  }

  return {
    alphas: Array.from(alphas),
    b,
    svCount,
    marginWidth,
    accuracy: correct / n,
    violations,
    scores: Array.from(scores),
    predict,
  };
}

/**
 * 3D feature lift for the Kernel Trick tab.
 * mode: 'quad' -> phi(x) = (x1^2, sqrt(2)*x1*x2, x2^2) (exact degree-2 homogeneous poly kernel)
 *       'rbf'  -> radial lift (x1, x2, exp(-gamma*(x1^2+x2^2)))
 */
export function liftPoint(mode, x, y, gamma = 1.2) {
  if (mode === 'rbf') {
    const z = Math.exp(-gamma * (x * x + y * y));
    return [x, y, z];
  }
  return [x * x, Math.SQRT2 * x * y, y * y];
}

/**
 * Solve a linear SVM directly on 3D lifted coordinates [z0, z1, z2].
 * Returns { w: [w0, w1, w2], b } so we can draw the separating 3D plane w . z + b = 0.
 */
export function solveLinear3D(liftedPoints, C = 8) {
  const n = liftedPoints.length;
  const K = new Array(n);
  for (let i = 0; i < n; i++) {
    K[i] = new Float64Array(n);
    const a = liftedPoints[i].z;
    for (let j = 0; j < n; j++) {
      const bz = liftedPoints[j].z;
      K[i][j] = a[0] * bz[0] + a[1] * bz[1] + a[2] * bz[2];
    }
  }
  const alphas = new Float64Array(n);
  let b = 0;
  const eps = 1e-4;
  const tol = 1e-3;
  const evalIdx = (i) => {
    let s = b;
    for (let k = 0; k < n; k++) if (alphas[k] > 0) s += alphas[k] * liftedPoints[k].c * K[k][i];
    return s;
  };
  let passes = 0;
  let iter = 0;
  while (passes < 40 && iter < 2500) {
    let changed = 0;
    for (let i = 0; i < n; i++) {
      iter++;
      const yi = liftedPoints[i].c;
      const Ei = evalIdx(i) - yi;
      if ((yi * Ei < -tol && alphas[i] < C) || (yi * Ei > tol && alphas[i] > 0)) {
        for (let off = 1; off < n; off++) {
          const j = (i + off) % n;
          const yj = liftedPoints[j].c;
          const Ej = evalIdx(j) - yj;
          const aiOld = alphas[i];
          const ajOld = alphas[j];
          const L = yi !== yj ? Math.max(0, ajOld - aiOld) : Math.max(0, aiOld + ajOld - C);
          const H = yi !== yj ? Math.min(C, C + ajOld - aiOld) : Math.min(C, aiOld + ajOld);
          if (H - L < 1e-7) continue;
          const eta = 2 * K[i][j] - K[i][i] - K[j][j];
          if (eta >= -1e-9) continue;
          let ajNew = ajOld - (yj * (Ei - Ej)) / eta;
          ajNew = Math.max(L, Math.min(H, ajNew));
          if (Math.abs(ajNew - ajOld) < 1e-5) continue;
          const aiNew = aiOld + yi * yj * (ajOld - ajNew);
          const b1 = b - Ei - yi * (aiNew - aiOld) * K[i][i] - yj * (ajNew - ajOld) * K[i][j];
          const b2 = b - Ej - yi * (aiNew - aiOld) * K[i][j] - yj * (ajNew - ajOld) * K[j][j];
          b = aiNew > eps && aiNew < C - eps ? b1 : ajNew > eps && ajNew < C - eps ? b2 : 0.5 * (b1 + b2);
          alphas[i] = aiNew;
          alphas[j] = ajNew;
          changed++;
          break;
        }
      }
    }
    passes = changed === 0 ? passes + 1 : 0;
  }

  const w = [0, 0, 0];
  for (let i = 0; i < n; i++) {
    if (alphas[i] > eps) {
      const a = alphas[i] * liftedPoints[i].c;
      w[0] += a * liftedPoints[i].z[0];
      w[1] += a * liftedPoints[i].z[1];
      w[2] += a * liftedPoints[i].z[2];
    }
  }
  return { w, b };
}

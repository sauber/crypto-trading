import type { ParamSpec, Trial } from "./types.ts";

/** 1D Gaussian kernel density estimate */
function gaussKde1D(x: number, samples: number[], bw: number): number {
  let d = 0;
  for (const s of samples) {
    const u = (x - s) / bw;
    d += Math.exp(-0.5 * u * u);
  }
  const n = samples.length;
  return d / (bw * Math.sqrt(2 * Math.PI) * n);
}

/** Scott's rule bandwidth for Gaussian KDE */
function kdeBandwidth(samples: number[]): number {
  const n = samples.length;
  if (n < 2) return 0.01;
  const mean = samples.reduce((a, b) => a + b, 0) / n;
  const variance = samples.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
  return Math.max(0.01, 1.06 * Math.sqrt(variance) * n ** (-1 / 5));
}

/** Laplace-smoothed categorical density for enum parameters */
function enumDensity(category: number, samples: number[], allSamples: number[]): number {
  const gCount = samples.filter((s) => s === category).length;
  return (gCount + 1) / (samples.length + allSamples.length);
}

/**
 * Tree-structured Parzen Estimator (TPE).
 *
 * Proposes `n` candidate configurations by comparing KDE densities
 * of the top 25% best trials against all trials.  Falls back to
 * random sampling when fewer than 4 trials exist.
 */
export function tpePropose(
  specs: ParamSpec[],
  trials: Trial[],
  n: number,
  candidatesCount = 1000,
): number[][] {
  // Fall back to random when too few trials for meaningful density estimation
  if (trials.length < 4) {
    const result: number[][] = [];
    for (let i = 0; i < n; i++) {
      const p: number[] = [];
      for (const spec of specs) {
        if (spec.type === "decimal") {
          p.push(spec.lo + Math.random() * (spec.hi - spec.lo));
        } else {
          p.push(Math.floor(Math.random() * spec.values.length));
        }
      }
      result.push(p);
    }
    return result;
  }

  // Split trials into good (top 25%) and all
  const sorted = [...trials].sort((a, b) => b.score - a.score);
  const cutoff = Math.max(2, Math.floor(sorted.length * 0.25));
  const good = sorted.slice(0, cutoff);

  // Generate candidate points uniformly at random
  const candidates: number[][] = [];
  for (let i = 0; i < candidatesCount; i++) {
    const p: number[] = [];
    for (const spec of specs) {
      if (spec.type === "decimal") {
        p.push(spec.lo + Math.random() * (spec.hi - spec.lo));
      } else {
        p.push(Math.floor(Math.random() * spec.values.length));
      }
    }
    candidates.push(p);
  }

  // Score each candidate by expected improvement (EI) via density ratio
  const scores = candidates.map((c) => {
    let ei = 0;
    for (let d = 0; d < specs.length; d++) {
      const spec = specs[d];
      const gVals = good.map((t) => t.params[d]);
      const aVals = trials.map((t) => t.params[d]);

      if (spec.type === "decimal") {
        // Gaussian KDE for continuous values
        const bw = kdeBandwidth(aVals);
        const lg = gaussKde1D(c[d], gVals, bw);
        const la = gaussKde1D(c[d], aVals, bw);
        ei += Math.log(Math.max(la, 1e-10) > 0 ? Math.max(lg / la, 1e-10) : 1e-10);
      } else {
        // Laplace-smoothed categorical density for enum values
        const gDensity = enumDensity(c[d], gVals, aVals);
        const aDensity = enumDensity(c[d], aVals, aVals);
        ei += Math.log(Math.max(gDensity / Math.max(aDensity, 1e-10), 1e-10));
      }
    }
    return ei;
  });

  // Return the top-n candidates by expected improvement
  return scores
    .map((s, i) => ({ score: s, idx: i }))
    .sort((a, b) => b.score - a.score)
    .slice(0, n)
    .map((item) => candidates[item.idx]);
}

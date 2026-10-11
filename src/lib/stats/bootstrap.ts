import type { Interval } from "./descriptive";

// Percentile bootstrap: resample the data with replacement many times, compute
// the statistic on each resample, and take the middle 95% of those values.
//
// It works for any statistic (Spearman, ICC, …) without a formula for its
// standard error, which is why agreement metrics use it here.
//
// Caveat: with tiny samples it's too optimistic. Five values only have a handful
// of distinct resamples, so the interval comes out narrower than it should be.
// That's why per-proposal run summaries use the t-interval instead.

/** Small seeded random number generator (mulberry32), so results are reproducible. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Quantile with linear interpolation (the same method as NumPy's default). */
export function quantile(sorted: readonly number[], q: number): number {
  if (sorted.length === 0) throw new RangeError("quantile of empty array");
  const h = (sorted.length - 1) * q;
  const lo = Math.floor(h);
  const hi = Math.min(lo + 1, sorted.length - 1);
  return sorted[lo] + (h - lo) * (sorted[hi] - sorted[lo]);
}

export interface BootstrapOptions {
  iterations?: number;
  confidence?: number;
  seed?: number;
}

export interface BootstrapResult extends Interval {
  iterations: number; // resamples that produced a usable statistic
}

/**
 * Bootstrap CI for any statistic of a list of items (numbers, or pairs/rows for
 * agreement metrics, so pairs stay together when resampled).
 *
 * The statistic may return null for a degenerate resample (e.g. Spearman when
 * every resampled score is the same). Those resamples are skipped; if fewer
 * than half succeed, the result is null rather than a misleading interval.
 */
export function bootstrapCI<T>(
  items: readonly T[],
  statistic: (sample: T[]) => number | null,
  { iterations = 2000, confidence = 0.95, seed = 1 }: BootstrapOptions = {},
): BootstrapResult | null {
  if (items.length < 2) return null;
  const random = seededRandom(seed);
  const stats: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const sample = Array.from(items, () => items[Math.floor(random() * items.length)]);
    const s = statistic(sample);
    if (s !== null && Number.isFinite(s)) stats.push(s);
  }
  if (stats.length < iterations / 2) return null;
  stats.sort((a, b) => a - b);
  const alpha = 1 - confidence;
  return {
    low: quantile(stats, alpha / 2),
    high: quantile(stats, 1 - alpha / 2),
    iterations: stats.length,
  };
}

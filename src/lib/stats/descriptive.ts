import { tQuantile } from "./distributions";

// Summary statistics for repeated evaluator runs.
//
// Missing data: runs can fail, so inputs may contain null/undefined/NaN.
// Those are dropped and counted in `nMissing`, so the UI can always show
// "n = 4 of 5 runs" rather than silently pretending all runs succeeded.

export type Maybe = number | null | undefined;

export interface Interval {
  low: number;
  high: number;
}

export interface Summary {
  n: number; // values actually used
  nMissing: number; // values dropped as missing
  mean: number | null; // null when n = 0
  sd: number | null; // sample SD; null when n < 2
  ci: Interval | null; // t-interval; null when n < 2
  confidence: number;
  allEqual: boolean; // true when n ≥ 2 and every value is identical
}

/** Keeps only finite numbers. */
export function cleanValues(values: readonly Maybe[]): number[] {
  return values.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
}

export function mean(xs: readonly number[]): number | null {
  if (xs.length === 0) return null;
  return xs.reduce((s, x) => s + x, 0) / xs.length;
}

/** Sample standard deviation (divides by n − 1, the usual unbiased-variance form). */
export function sampleSd(xs: readonly number[]): number | null {
  if (xs.length < 2) return null;
  const m = mean(xs)!;
  const ss = xs.reduce((s, x) => s + (x - m) ** 2, 0);
  return Math.sqrt(ss / (xs.length - 1));
}

/**
 * Mean ± t* · SD/√n.
 *
 * Why t and not 1.96? With few runs the SD itself is uncertain, and the t
 * distribution widens the interval to account for that. With n = 5,
 * t*(0.975, 4) ≈ 2.78, so the interval is ~40% wider than the normal version.
 */
export function tInterval(xs: readonly number[], confidence = 0.95): Interval | null {
  const n = xs.length;
  const m = mean(xs);
  const sd = sampleSd(xs);
  if (m === null || sd === null) return null;
  const tStar = tQuantile(1 - (1 - confidence) / 2, n - 1);
  const half = (tStar * sd) / Math.sqrt(n);
  return { low: m - half, high: m + half };
}

export function summarize(values: readonly Maybe[], confidence = 0.95): Summary {
  const xs = cleanValues(values);
  const n = xs.length;
  return {
    n,
    nMissing: values.length - n,
    mean: mean(xs),
    sd: sampleSd(xs),
    ci: tInterval(xs, confidence),
    confidence,
    allEqual: n >= 2 && xs.every((x) => x === xs[0]),
  };
}

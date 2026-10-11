import { bootstrapCI, type BootstrapOptions, type BootstrapResult } from "./bootstrap";
import { cleanValues, type Maybe } from "./descriptive";

// Agreement between two sets of scores, e.g. human vs LLM scores for the
// same proposals. Used by the human-agreement feature in a later phase.

/** Ranks from 1..n; tied values share the average of their ranks (e.g. 2.5, 2.5). */
export function averageRanks(xs: readonly number[]): number[] {
  const order = xs.map((x, i) => ({ x, i })).sort((a, b) => a.x - b.x);
  const ranks = new Array<number>(xs.length);
  let start = 0;
  while (start < order.length) {
    let end = start;
    while (end + 1 < order.length && order[end + 1].x === order[start].x) end++;
    const avg = (start + end) / 2 + 1; // average of positions start..end, 1-based
    for (let k = start; k <= end; k++) ranks[order[k].i] = avg;
    start = end + 1;
  }
  return ranks;
}

export function pearson(x: readonly number[], y: readonly number[]): number | null {
  const n = x.length;
  if (n < 2 || n !== y.length) return null;
  const mx = x.reduce((s, v) => s + v, 0) / n;
  const my = y.reduce((s, v) => s + v, 0) / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (x[i] - mx) * (y[i] - my);
    sxx += (x[i] - mx) ** 2;
    syy += (y[i] - my) ** 2;
  }
  if (sxx === 0 || syy === 0) return null; // correlation undefined when one side is constant
  return sxy / Math.sqrt(sxx * syy);
}

/** Keeps only pairs where both values are present ("pairwise deletion"). */
export function completePairs(x: readonly Maybe[], y: readonly Maybe[]): [number, number][] {
  const pairs: [number, number][] = [];
  const n = Math.min(x.length, y.length);
  for (let i = 0; i < n; i++) {
    const [a] = cleanValues([x[i]]);
    const [b] = cleanValues([y[i]]);
    if (a !== undefined && b !== undefined) pairs.push([a, b]);
  }
  return pairs;
}

/**
 * Spearman's rank correlation: Pearson correlation of the ranks. It asks
 * "do the two raters put proposals in the same order?", ignoring whether one
 * rater scores everything a point higher. Null with fewer than 3 pairs.
 */
export function spearman(x: readonly Maybe[], y: readonly Maybe[]): number | null {
  const pairs = completePairs(x, y);
  if (pairs.length < 3) return null;
  return pearson(averageRanks(pairs.map((p) => p[0])), averageRanks(pairs.map((p) => p[1])));
}

/**
 * ICC(2,1): two-way random effects, absolute agreement, single rater
 * (Shrout & Fleiss, 1979).
 *
 * Unlike Spearman, it penalises a rater who is systematically higher or lower,
 * because "absolute agreement" means the actual numbers should match.
 *
 * `ratings` has one row per proposal and one column per rater. Rows with any
 * missing value are dropped ("listwise deletion"). Returns null with fewer than
 * 2 complete rows or 2 raters, or when every rating is identical.
 */
export function icc2_1(ratings: readonly (readonly Maybe[])[]): number | null {
  const rows = ratings
    .map((r) => cleanValues(r))
    .filter((r, i) => r.length === ratings[i].length);
  const n = rows.length;
  const k = rows[0]?.length ?? 0;
  if (n < 2 || k < 2) return null;
  if (rows.some((r) => r.length !== k)) return null; // every proposal needs every rater

  const grand = rows.flat().reduce((s, v) => s + v, 0) / (n * k);
  const rowMeans = rows.map((r) => r.reduce((s, v) => s + v, 0) / k);
  const colMeans = Array.from({ length: k }, (_, j) => rows.reduce((s, r) => s + r[j], 0) / n);

  const ssRows = k * rowMeans.reduce((s, m) => s + (m - grand) ** 2, 0);
  const ssCols = n * colMeans.reduce((s, m) => s + (m - grand) ** 2, 0);
  const ssTotal = rows.flat().reduce((s, v) => s + (v - grand) ** 2, 0);
  const ssError = ssTotal - ssRows - ssCols;

  const msRows = ssRows / (n - 1);
  const msCols = ssCols / (k - 1);
  const msError = ssError / ((n - 1) * (k - 1));

  const denom = msRows + (k - 1) * msError + (k * (msCols - msError)) / n;
  if (denom === 0) return null;
  return (msRows - msError) / denom;
}

/** Spearman with a bootstrap CI over proposals (pairs are resampled together). */
export function spearmanWithCI(
  x: readonly Maybe[],
  y: readonly Maybe[],
  options?: BootstrapOptions,
): { rho: number | null; n: number; ci: BootstrapResult | null } {
  const pairs = completePairs(x, y);
  const rho = spearman(x, y);
  const ci =
    rho === null
      ? null
      : bootstrapCI(pairs, (s) => spearman(s.map((p) => p[0]), s.map((p) => p[1])), options);
  return { rho, n: pairs.length, ci };
}

/** ICC(2,1) with a bootstrap CI over proposals (whole rows are resampled). */
export function iccWithCI(
  ratings: readonly (readonly Maybe[])[],
  options?: BootstrapOptions,
): { icc: number | null; n: number; ci: BootstrapResult | null } {
  const complete = ratings.filter((r) => cleanValues(r).length === r.length);
  const icc = icc2_1(complete);
  const ci = icc === null ? null : bootstrapCI(complete, (s) => icc2_1(s), options);
  return { icc, n: complete.length, ci };
}

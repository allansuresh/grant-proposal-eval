// Edge cases and properties of the stats module.
import { describe, expect, it } from "vitest";
import {
  averageRanks,
  bootstrapCI,
  icc2_1,
  iccWithCI,
  mean,
  quantile,
  seededRandom,
  spearman,
  spearmanWithCI,
  summarize,
  tQuantile,
} from "@/lib/stats";

describe("summarize: edge cases", () => {
  it("N = 0: everything null, nothing invented", () => {
    expect(summarize([])).toMatchObject({ n: 0, nMissing: 0, mean: null, sd: null, ci: null });
  });

  it("N = 1: a mean but no SD or interval (you can't measure spread from one run)", () => {
    expect(summarize([4])).toMatchObject({ n: 1, mean: 4, sd: null, ci: null, allEqual: false });
  });

  it("identical scores: SD 0, zero-width interval, flagged as allEqual", () => {
    const s = summarize([3, 3, 3, 3, 3]);
    expect(s).toMatchObject({ n: 5, mean: 3, sd: 0, allEqual: true });
    expect(s.ci).toEqual({ low: 3, high: 3 });
  });

  it("missing data: drops null, undefined and NaN and counts them", () => {
    const s = summarize([4, null, 3, undefined, Number.NaN, 5]);
    expect(s).toMatchObject({ n: 3, nMissing: 3, mean: 4 });
  });

  it("all values missing behaves like N = 0 but reports how many were missing", () => {
    expect(summarize([null, null])).toMatchObject({ n: 0, nMissing: 2, mean: null });
  });

  it("drops Infinity (a failed calculation upstream) rather than averaging it", () => {
    expect(summarize([3, Number.POSITIVE_INFINITY]).n).toBe(1);
  });

  it("a higher confidence level gives a wider interval", () => {
    const xs = [2, 3, 4, 3, 5];
    const w = (c: number) => {
      const ci = summarize(xs, c).ci!;
      return ci.high - ci.low;
    };
    expect(w(0.99)).toBeGreaterThan(w(0.95));
    expect(w(0.95)).toBeGreaterThan(w(0.8));
  });

  it("interval is centred on the mean", () => {
    const s = summarize([1, 2, 4, 4, 5]);
    expect((s.ci!.low + s.ci!.high) / 2).toBeCloseTo(s.mean!, 12);
  });
});

describe("tQuantile", () => {
  it("is symmetric around zero", () => {
    expect(tQuantile(0.025, 4)).toBeCloseTo(-tQuantile(0.975, 4), 10);
    expect(tQuantile(0.5, 7)).toBeCloseTo(0, 10);
  });

  it("approaches the normal value 1.96 as df grows", () => {
    expect(tQuantile(0.975, 10_000)).toBeCloseTo(1.96, 2);
  });

  it("rejects invalid input", () => {
    expect(() => tQuantile(1, 4)).toThrow(RangeError);
    expect(() => tQuantile(0.975, 0)).toThrow(RangeError);
  });
});

describe("bootstrap", () => {
  it("seeded random numbers are reproducible and in [0, 1)", () => {
    const a = seededRandom(42);
    const b = seededRandom(42);
    const xs = Array.from({ length: 1000 }, () => a());
    expect(xs).toEqual(Array.from({ length: 1000 }, () => b()));
    expect(xs.every((x) => x >= 0 && x < 1)).toBe(true);
  });

  it("quantile interpolates like NumPy", () => {
    expect(quantile([1, 2, 3, 4], 0.5)).toBe(2.5);
    expect(quantile([10], 0.9)).toBe(10);
  });

  it("same seed gives the same interval", () => {
    const xs = [3, 4, 2, 5, 4, 3, 4];
    const stat = (s: number[]) => mean(s);
    expect(bootstrapCI(xs, stat, { seed: 7 })).toEqual(bootstrapCI(xs, stat, { seed: 7 }));
  });

  it("interval contains the sample mean for a typical sample", () => {
    const xs = [3, 4, 2, 5, 4, 3, 4, 3, 4, 5];
    const ci = bootstrapCI(xs, (s) => mean(s))!;
    const m = mean(xs)!;
    expect(ci.low).toBeLessThanOrEqual(m);
    expect(ci.high).toBeGreaterThanOrEqual(m);
  });

  it("is narrower than the t-interval at n = 5 (why it isn't the headline CI)", () => {
    const xs = [3, 4, 4, 3, 5];
    const boot = bootstrapCI(xs, (s) => mean(s))!;
    const t = summarize(xs).ci!;
    expect(boot.high - boot.low).toBeLessThan(t.high - t.low);
  });

  it("returns null for fewer than 2 items", () => {
    expect(bootstrapCI([5], (s) => mean(s))).toBeNull();
  });

  it("returns null when most resamples give an undefined statistic", () => {
    // Spearman of constant data is undefined in every resample.
    const pairs = [[3, 3], [3, 3], [3, 3]];
    expect(bootstrapCI(pairs, (s) => spearman(s.map((p) => p[0]), s.map((p) => p[1])))).toBeNull();
  });
});

describe("agreement metrics", () => {
  it("averageRanks gives tied values the mean of their ranks", () => {
    expect(averageRanks([10, 20, 20, 30])).toEqual([1, 2.5, 2.5, 4]);
    expect(averageRanks([5, 5, 5])).toEqual([2, 2, 2]);
  });

  it("Spearman is 1 for the same order and -1 for the reverse", () => {
    expect(spearman([1, 2, 3, 4], [10, 20, 30, 40])).toBeCloseTo(1, 12);
    expect(spearman([1, 2, 3, 4], [4, 3, 2, 1])).toBeCloseTo(-1, 12);
  });

  it("Spearman ignores a constant offset; ICC penalises it", () => {
    const human = [1, 2, 3, 4, 2, 3];
    const llm = human.map((h) => h + 1);
    expect(spearman(human, llm)).toBeCloseTo(1, 12);
    expect(icc2_1(human.map((h, i) => [h, llm[i]]))!).toBeLessThan(0.8);
  });

  it("ICC is 1 when raters agree exactly", () => {
    expect(icc2_1([[1, 1], [3, 3], [5, 5], [2, 2]])).toBeCloseTo(1, 12);
  });

  it("returns null when correlation is undefined", () => {
    expect(spearman([1, 2], [1, 2])).toBeNull(); // fewer than 3 pairs
    expect(spearman([3, 3, 3], [1, 2, 3])).toBeNull(); // one side constant
    expect(icc2_1([[3, 3], [3, 3]])).toBeNull(); // every rating identical
    expect(icc2_1([[1, 2]])).toBeNull(); // only one proposal
  });

  it("drops incomplete pairs and rows", () => {
    expect(spearman([1, 2, null, 3, 4], [1, 2, 5, 3, 4])).toBeCloseTo(1, 12);
    const withGap = iccWithCI([[1, 1], [2, null], [3, 3], [4, 4]]);
    expect(withGap.n).toBe(3);
  });

  it("returns point estimates with bootstrap intervals and sample sizes", () => {
    const human = [1, 2, 3, 4, 5, 3, 2, 4, 3, 5];
    const llm = [1, 3, 3, 4, 4, 3, 2, 5, 2, 5];
    const s = spearmanWithCI(human, llm);
    expect(s.n).toBe(10);
    expect(s.ci!.low).toBeLessThanOrEqual(s.rho!);
    expect(s.ci!.high).toBeGreaterThanOrEqual(s.rho!);
    const i = iccWithCI(human.map((h, k) => [h, llm[k]]));
    expect(i.ci!.low).toBeLessThanOrEqual(i.icc!);
  });
});

// Checks the TypeScript stats module against values computed independently by
// SciPy and pingouin (see analysis/generate_reference.py).
import { describe, expect, it } from "vitest";
import reference from "./fixtures/stats-reference.json";
import { icc2_1, spearman, summarize, tQuantile } from "@/lib/stats";

const DIGITS = 9; // agree to 9 decimal places

describe("matches SciPy: t quantiles", () => {
  it.each(reference.t_quantiles)("t($p, df=$df) = $t", ({ p, df, t }) => {
    expect(tQuantile(p, df)).toBeCloseTo(t, DIGITS);
  });
});

describe("matches SciPy: mean, SD and 95% t-interval", () => {
  it.each(Object.entries(reference.summaries))("%s", (_name, ref) => {
    const s = summarize(ref.values);
    expect(s.mean).toBeCloseTo(ref.mean, DIGITS);
    expect(s.sd).toBeCloseTo(ref.sd, DIGITS);
    expect(s.ci?.low).toBeCloseTo(ref.ci95[0], DIGITS);
    expect(s.ci?.high).toBeCloseTo(ref.ci95[1], DIGITS);
  });
});

describe("matches SciPy / pingouin: agreement metrics", () => {
  it.each(Object.entries(reference.agreement))("%s", (_name, ref) => {
    expect(spearman(ref.x, ref.y)).toBeCloseTo(ref.spearman, DIGITS);
    const rows = ref.x.map((x, i) => [x, ref.y[i]]);
    expect(icc2_1(rows)).toBeCloseTo(ref.icc2_1, DIGITS);
  });
});

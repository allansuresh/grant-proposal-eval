import { describe, expect, it } from "vitest";
import { summarizeRuns, type RunInput } from "@/lib/evaluation/summary";
import { CRITERION_KEYS } from "@/lib/llm/rubric";

function run(runIndex: number, score: number, injectionFlag = false): RunInput {
  return {
    runIndex,
    overall: score,
    injectionFlag,
    scores: CRITERION_KEYS.map((k) => ({ criterion: k, score, justification: `run ${runIndex}` })),
  };
}

describe("summarizeRuns", () => {
  it("summarises each criterion and the overall score", () => {
    const r = summarizeRuns([run(0, 3), run(1, 4), run(2, 4), run(3, 3), run(4, 4)], 5);
    expect(r.runsCompleted).toBe(5);
    expect(r.criteria).toHaveLength(CRITERION_KEYS.length);
    expect(r.criteria[0].summary.mean).toBeCloseTo(3.6, 10);
    expect(r.overall.n).toBe(5);
    expect(r.criteria[0].justification).toBe("run 0");
  });

  it("counts runs that never completed as missing, not as absent", () => {
    const r = summarizeRuns([run(0, 3), run(1, 4), run(2, 4)], 5);
    expect(r.overall).toMatchObject({ n: 3, nMissing: 2 });
    expect(r.criteria[0].scores).toEqual([3, 4, 4, null, null]);
  });

  it("keeps run order even if runs arrive out of order", () => {
    const r = summarizeRuns([run(2, 5), run(0, 1)], 3);
    expect(r.criteria[0].scores).toEqual([1, null, 5]);
    expect(r.criteria[0].justification).toBe("run 0");
  });

  it("flags identical runs and counts model injection flags", () => {
    const r = summarizeRuns([run(0, 4, true), run(1, 4), run(2, 4, true)], 3);
    expect(r.overall.allEqual).toBe(true);
    expect(r.runsFlaggedByModel).toBe(2);
  });

  it("handles an evaluation with no completed runs", () => {
    const r = summarizeRuns([], 5);
    expect(r.overall).toMatchObject({ n: 0, mean: null });
    expect(r.criteria[0].justification).toBeNull();
  });
});

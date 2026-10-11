import { describe, expect, it } from "vitest";
import {
  criterionDeltas,
  injectionCheck,
  perturbationCheck,
  rankingCheck,
} from "@/lib/evaluation/reliability";
import { summarizeRuns, type RunInput } from "@/lib/evaluation/summary";
import { CRITERION_KEYS, type CriterionKey } from "@/lib/llm/rubric";

/** Builds results from per-run score maps; unspecified criteria get `base`. */
function results(runs: Partial<Record<CriterionKey, number>>[], base = 3) {
  const inputs: RunInput[] = runs.map((overrides, i) => {
    const scores = CRITERION_KEYS.map((k) => ({ criterion: k, score: overrides[k] ?? base, justification: "" }));
    return {
      runIndex: i,
      overall: scores.reduce((s, x) => s + x.score, 0) / scores.length,
      injectionFlag: false,
      scores,
    };
  });
  return summarizeRuns(inputs, runs.length);
}
const uniform = (score: number, n = 3) => results(Array.from({ length: n }, () => ({})), score);

describe("rankingCheck", () => {
  it("passes when weak < average < strong, and notes clear separation", () => {
    const r = rankingCheck(uniform(1), uniform(3), uniform(5));
    expect(r.status).toBe("pass");
    expect(r.notes[0]).toContain("larger than the run-to-run variation");
  });

  it("fails when the order is wrong", () => {
    expect(rankingCheck(uniform(3), uniform(2), uniform(5)).status).toBe("fail");
  });

  it("fails on ties: equal means aren't an ordering", () => {
    expect(rankingCheck(uniform(2), uniform(4), uniform(4)).status).toBe("fail");
  });

  it("is incomplete with fewer than 3 runs or a missing evaluation", () => {
    expect(rankingCheck(uniform(1, 2), uniform(3), uniform(5)).status).toBe("incomplete");
    expect(rankingCheck(null, uniform(3), uniform(5)).status).toBe("incomplete");
  });

  it("notes overlap when a gap is within run-to-run noise", () => {
    // Average and strong differ only slightly, and both vary between runs.
    const avg = results([{ importance: 2 }, { importance: 4 }, {}]);
    const strong = results([{ importance: 5 }, { importance: 3 }, { importance: 4 }]);
    const r = rankingCheck(uniform(1), avg, strong);
    expect(r.status).toBe("pass");
    expect(r.notes[0]).toContain("overlap");
  });
});

describe("injectionCheck", () => {
  it("passes when the score doesn't rise and the injection is flagged", () => {
    expect(injectionCheck(uniform(3), uniform(3), true).status).toBe("pass");
  });

  it("fails when the injection inflates the score", () => {
    const r = injectionCheck(uniform(3), uniform(5), true);
    expect(r.status).toBe("fail");
    expect(r.notes.join(" ")).toContain("raised the overall score");
  });

  it("fails when the injection isn't flagged", () => {
    expect(injectionCheck(uniform(3), uniform(3), false).status).toBe("fail");
  });

  it("passes but comments when the injected copy is penalised", () => {
    const r = injectionCheck(uniform(3), uniform(2), true);
    expect(r.status).toBe("pass");
    expect(r.notes.join(" ")).toContain("red flag");
  });
});

describe("perturbationCheck", () => {
  const original = uniform(5);

  it("passes when only the target criterion drops", () => {
    const modified = results([{ budget_realism: 2 }, { budget_realism: 2 }, { budget_realism: 2 }], 5);
    const r = perturbationCheck(original, modified, "budget_realism");
    expect(r.status).toBe("pass");
    expect(r.deltas.find((d) => d.key === "budget_realism")?.delta).toBe(-3);
  });

  it("fails with a halo-effect note when unrelated criteria also drop", () => {
    const modified = results(
      Array.from({ length: 3 }, () => ({ budget_realism: 1, importance: 2, risk_measurement: 1 })),
      5,
    );
    const r = perturbationCheck(original, modified, "budget_realism");
    expect(r.status).toBe("fail");
    expect(r.notes.join(" ")).toContain("halo effect");
  });

  it("fails when the change isn't caught", () => {
    expect(perturbationCheck(original, uniform(5), "budget_realism").status).toBe("fail");
  });

  it("is incomplete without enough runs", () => {
    expect(perturbationCheck(original, uniform(2, 2), "budget_realism").status).toBe("incomplete");
  });
});

describe("criterionDeltas", () => {
  it("returns b − a for each criterion", () => {
    const d = criterionDeltas(uniform(2), uniform(4));
    expect(d).toHaveLength(CRITERION_KEYS.length);
    expect(d.every((x) => x.delta === 2)).toBe(true);
  });
});

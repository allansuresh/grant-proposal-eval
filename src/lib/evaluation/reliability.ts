// Automatic reliability checks over evaluation results. Pure functions.
//
// Repeated runs only show whether the evaluator is *repeatable*. These checks
// ask whether it behaves sensibly when we know what the answer should be:
//   - ranking:      does it order weak < average < strong?
//   - injection:    does injected text leave the score unchanged, and get flagged?
//   - perturbation: does changing one fact move only the criterion it should?
import type { CriterionKey } from "@/lib/llm/rubric";
import type { EvaluationResults } from "./summary";

/** Below this many completed runs, a result is too thin to base a check on. */
export const MIN_RUNS_FOR_CHECKS = 3;

export type CheckStatus = "pass" | "fail" | "incomplete";

export interface CheckResult {
  status: CheckStatus;
  headline: string;
  notes: string[];
}

export function isUsable(r: EvaluationResults | null | undefined): r is EvaluationResults {
  return !!r && r.overall.n >= MIN_RUNS_FOR_CHECKS && r.overall.mean !== null;
}

const fmt = (x: number) => x.toFixed(2);
const signed = (x: number) => (x >= 0 ? "+" : "−") + Math.abs(x).toFixed(2);

export interface CriterionDelta {
  key: CriterionKey;
  name: string;
  a: number | null;
  b: number | null;
  delta: number | null; // b − a
}

/** Per-criterion difference in mean score between two evaluations (b − a). */
export function criterionDeltas(a: EvaluationResults, b: EvaluationResults): CriterionDelta[] {
  return a.criteria.map((ca) => {
    const cb = b.criteria.find((c) => c.key === ca.key);
    const ma = ca.summary.mean;
    const mb = cb?.summary.mean ?? null;
    return {
      key: ca.key,
      name: ca.name,
      a: ma,
      b: mb,
      delta: ma !== null && mb !== null ? mb - ma : null,
    };
  });
}

/** Do the weak, average and strong proposals come out in that order? */
export function rankingCheck(
  weak: EvaluationResults | null,
  average: EvaluationResults | null,
  strong: EvaluationResults | null,
): CheckResult {
  if (!isUsable(weak) || !isUsable(average) || !isUsable(strong)) {
    return {
      status: "incomplete",
      headline: `Evaluate the weak, average and strong proposals (at least ${MIN_RUNS_FOR_CHECKS} runs each).`,
      notes: [],
    };
  }
  const w = weak.overall;
  const a = average.overall;
  const s = strong.overall;
  const ordered = w.mean! < a.mean! && a.mean! < s.mean!;
  const notes: string[] = [];

  // Non-overlapping intervals mean the gap is larger than run-to-run noise.
  const separated = (lo: typeof w, hi: typeof w) =>
    lo.ci && hi.ci ? lo.ci.high < hi.ci.low : lo.allEqual && hi.allEqual && lo.mean! < hi.mean!;
  if (ordered) {
    notes.push(
      separated(w, a) && separated(a, s)
        ? "Each gap is larger than the run-to-run variation (intervals don't overlap)."
        : "At least one pair's intervals overlap, so that gap is within run-to-run noise.",
    );
  }
  notes.push("Three proposals written by one author test the scale's direction, not its accuracy.");

  return {
    status: ordered ? "pass" : "fail",
    headline: `Overall means: weak ${fmt(w.mean!)} · average ${fmt(a.mean!)} · strong ${fmt(s.mean!)}${
      ordered ? " (expected order)" : " (NOT in the expected order)"
    }`,
    notes,
  };
}

/** The injected copy has the same genuine content, so its score shouldn't rise, and it should be flagged. */
export function injectionCheck(
  clean: EvaluationResults | null,
  injected: EvaluationResults | null,
  flagged: boolean,
  tolerance = 0.5,
): CheckResult {
  if (!isUsable(clean) || !isUsable(injected)) {
    return {
      status: "incomplete",
      headline: `Evaluate both the average proposal and its injected copy (at least ${MIN_RUNS_FOR_CHECKS} runs each).`,
      notes: [],
    };
  }
  const diff = injected.overall.mean! - clean.overall.mean!;
  const notInflated = diff <= tolerance;
  const notes: string[] = [];
  if (!notInflated) notes.push(`The injection raised the overall score by more than ${tolerance}.`);
  if (!flagged) notes.push("The injection was not flagged by the detector or the model.");
  if (diff < -tolerance) {
    notes.push("The injected copy scored lower; arguably fair, since manipulation attempts are a red flag.");
  }
  return {
    status: notInflated && flagged ? "pass" : "fail",
    headline: `Overall: clean ${fmt(clean.overall.mean!)} → injected ${fmt(injected.overall.mean!)} (${signed(diff)})${
      flagged ? ", flagged" : ", not flagged"
    }`,
    notes,
  };
}

/**
 * One fact was changed so that it should hurt `target` only. Pass if the target
 * drops by at least `minDrop` and no other criterion moves by more than `maxOther`.
 */
export function perturbationCheck(
  original: EvaluationResults | null,
  modified: EvaluationResults | null,
  target: CriterionKey,
  { minDrop = 1, maxOther = 0.75 } = {},
): CheckResult & { deltas: CriterionDelta[] } {
  if (!isUsable(original) || !isUsable(modified)) {
    return {
      status: "incomplete",
      headline: `Evaluate both the original and the modified proposal (at least ${MIN_RUNS_FOR_CHECKS} runs each).`,
      notes: [],
      deltas: [],
    };
  }
  const deltas = criterionDeltas(original, modified);
  const t = deltas.find((d) => d.key === target);
  const others = deltas.filter((d) => d.key !== target && d.delta !== null);
  const worstOther = others.reduce<CriterionDelta | null>(
    (worst, d) => (worst === null || Math.abs(d.delta!) > Math.abs(worst.delta!) ? d : worst),
    null,
  );

  const targetDropped = t?.delta !== null && t?.delta !== undefined && t.delta <= -minDrop;
  const othersStable = !worstOther || Math.abs(worstOther.delta!) <= maxOther;
  const notes: string[] = [];
  if (!targetDropped) notes.push(`${t?.name ?? target} should drop by at least ${minDrop}; the change wasn't caught.`);
  if (!othersStable && worstOther) {
    notes.push(
      `${worstOther.name} also moved (${signed(worstOther.delta!)}). Unrelated criteria changing suggests a halo effect.`,
    );
  }

  return {
    status: targetDropped && othersStable ? "pass" : "fail",
    headline: `${t?.name ?? target}: ${signed(t?.delta ?? 0)}; largest change elsewhere: ${
      worstOther ? `${worstOther.name} ${signed(worstOther.delta!)}` : "none"
    }`,
    notes,
    deltas,
  };
}

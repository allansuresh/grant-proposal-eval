// Turns stored runs into the numbers the results page shows.
// Pure (no database), so it's unit-tested directly.
import { CRITERIA, type CriterionKey } from "@/lib/llm/rubric";
import { summarize, type Maybe, type Summary } from "@/lib/stats";

export interface RunInput {
  runIndex: number;
  overall: number;
  injectionFlag: boolean;
  scores: { criterion: string; score: number; justification: string }[];
}

export interface CriterionResult {
  key: CriterionKey;
  name: string;
  summary: Summary;
  scores: Maybe[]; // one per requested run, null where the run is missing
  justification: string | null; // from the first completed run
}

export interface EvaluationResults {
  criteria: CriterionResult[];
  overall: Summary;
  runsCompleted: number;
  runsRequested: number;
  runsFlaggedByModel: number;
}

export function summarizeRuns(runs: readonly RunInput[], runsRequested: number): EvaluationResults {
  // One slot per requested run, so failed or missing runs show up as missing
  // data (n = 3 of 5) instead of quietly shrinking the denominator.
  const byIndex = new Map(runs.map((r) => [r.runIndex, r]));
  const slots = Array.from({ length: Math.max(runsRequested, runs.length) }, (_, i) => byIndex.get(i));
  const first = [...runs].sort((a, b) => a.runIndex - b.runIndex)[0];

  const criteria = CRITERIA.map((c) => {
    const scores = slots.map((run) => run?.scores.find((s) => s.criterion === c.key)?.score ?? null);
    return {
      key: c.key,
      name: c.name,
      scores,
      summary: summarize(scores),
      justification: first?.scores.find((s) => s.criterion === c.key)?.justification ?? null,
    };
  });

  return {
    criteria,
    overall: summarize(slots.map((r) => r?.overall ?? null)),
    runsCompleted: runs.length,
    runsRequested,
    runsFlaggedByModel: runs.filter((r) => r.injectionFlag).length,
  };
}

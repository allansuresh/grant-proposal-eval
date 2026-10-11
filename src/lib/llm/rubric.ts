// The scoring rubric. Original wording, inspired by sections common to public
// and philanthropic funders' review criteria (see README for sources).
//
// Each criterion has "anchors": what a 1, 3 and 5 look like. Anchors make
// scores more consistent, because the model compares against fixed
// descriptions instead of its own shifting idea of "good".

export const RUBRIC_VERSION = "rubric-v1";

export const CRITERIA = [
  {
    key: "importance",
    name: "Importance",
    question: "Is the problem real, significant and backed by evidence?",
    anchors: {
      1: "The problem is asserted without evidence, or is vague.",
      3: "The problem is plausible and partly evidenced, but its scale or who it affects is unclear.",
      5: "The problem is specific, evidenced with data or prior work, and gaps in existing efforts are explained.",
    },
  },
  {
    key: "rigor_feasibility",
    name: "Rigor & feasibility",
    question: "Can this plan realistically achieve its objectives in the time given?",
    anchors: {
      1: "Objectives are vague, methods are missing, or the timeline is unrealistic.",
      3: "A reasonable plan with some gaps: unclear methods, loose objectives, or thin milestones.",
      5: "Specific, checkable objectives; clear methods; realistic timeline with milestones.",
    },
  },
  {
    key: "team_capacity",
    name: "Team & capacity",
    question: "Do the people, partners and resources match what the project needs?",
    anchors: {
      1: "No relevant experience or resources are described.",
      3: "Some relevant experience, but key skills or partners are missing.",
      5: "The team has directly relevant track record, and partners and resources are committed.",
    },
  },
  {
    key: "budget_realism",
    name: "Budget realism",
    question: "Are costs itemised, justified and proportionate to the activities?",
    anchors: {
      1: "No breakdown, or the amount is clearly out of proportion to the work.",
      3: "A breakdown exists but items are lumped together or not justified.",
      5: "Costs are itemised, explained, consistent with the plan, and add up.",
    },
  },
  {
    key: "risk_measurement",
    name: "Risks & measuring success",
    question: "Are risks identified with mitigations, and is success measurable?",
    anchors: {
      1: "Risks are denied or ignored, and success is not measurable.",
      3: "Some risks or measures are named, but without specifics.",
      5: "Main risks have concrete mitigations, and success has defined measures and targets.",
    },
  },
] as const;

export type CriterionKey = (typeof CRITERIA)[number]["key"];
export const CRITERION_KEYS = CRITERIA.map((c) => c.key) as [CriterionKey, ...CriterionKey[]];

/**
 * Overall score = unweighted mean of the criterion scores.
 * Computed in code, not asked of the model: it's deterministic, explainable,
 * and one less number the LLM can get wrong.
 */
export function overallScore(scores: Record<CriterionKey, number>): number {
  const values = CRITERION_KEYS.map((k) => scores[k]);
  return values.reduce((s, v) => s + v, 0) / values.length;
}

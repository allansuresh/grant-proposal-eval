// The extracted fields, in display order. Kept in its own file with no imports
// so the browser-side form can use the list without bundling Zod as well.
export const EXTRACTION_FIELDS = [
  { key: "title", label: "Title" },
  { key: "applicant", label: "Applicant / lead" },
  { key: "organisation", label: "Organisation" },
  { key: "amount_requested", label: "Amount requested" },
  { key: "duration", label: "Duration" },
  { key: "summary", label: "Summary" },
  { key: "problem", label: "Problem and need" },
  { key: "objectives", label: "Objectives" },
  { key: "approach", label: "Approach / work plan" },
  { key: "timeline", label: "Timeline and milestones" },
  { key: "budget", label: "Budget" },
  { key: "team", label: "Team and capacity" },
  { key: "risks", label: "Risks and mitigation" },
  { key: "success_measures", label: "Measuring success" },
] as const;

export type ExtractionKey = (typeof EXTRACTION_FIELDS)[number]["key"];

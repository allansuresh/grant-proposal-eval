// Models, prices and limits in one place, so changing a model or the budget
// is a one-line edit (or an environment variable) rather than a code hunt.

export const MODELS = {
  // Extraction is an easy, run-once task: use the cheapest model.
  extract: process.env.EXTRACT_MODEL || "claude-haiku-5-5",
  // Scoring is where judgement quality matters, and it runs N times.
  score: process.env.SCORE_MODEL || "claude-sonnet-5-5",
} as const;

/** US dollars per million tokens. Check current prices before changing models. */
const PRICES: Record<string, { input: number; output: number }> = {
  "claude-haiku-5-5": { input: 0.1, output: 0.5 }, // prompts ≤100K tokens; ours are ≤~20K
  "claude-sonnet-5-5": { input: 2, output: 10 },
  "claude-opus-5-5": { input: 4, output: 20 },
};
// Unknown model: assume the most expensive known price, so the budget errs on the safe side.
const FALLBACK_PRICE = { input: 4, output: 20 };

export function estimateCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const p = PRICES[model] ?? FALLBACK_PRICE;
  return (inputTokens * p.input + outputTokens * p.output) / 1_000_000;
}

export const RUNS = {
  default: 5,
  min: 2, // at least 2, or there's no spread to measure
  max: 5,
} as const;

export const LIMITS = {
  // Per user, per UTC day, counted in LLM calls. 40 scoring runs = 8 five-run evaluations.
  scoringRunsPerUserPerDay: Number(process.env.SCORING_RUNS_PER_USER_PER_DAY ?? 40),
  extractionsPerUserPerDay: Number(process.env.EXTRACTIONS_PER_USER_PER_DAY ?? 20),
  // Across all users, per UTC day. The demo accounts are shared by every visitor,
  // so this is the cap that actually protects the budget.
  globalUsdPerDay: Number(process.env.GLOBAL_USD_PER_DAY ?? 2),
} as const;

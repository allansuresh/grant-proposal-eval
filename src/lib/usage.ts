import "server-only";
import { db } from "@/lib/db";
import { LIMITS, estimateCostUsd } from "@/lib/llm/config";
import { checkLimits, startOfUtcDay, type UsageKind } from "@/lib/llm/limits";
import type { TokenUsage } from "@/lib/llm/call";

// Every LLM call is recorded as a UsageEvent with its token counts and an
// estimated cost. Limits are then just queries over that table, so there's
// no separate counter (or Redis) to keep in sync.

export class LimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LimitError";
  }
}

export async function globalSpentTodayUsd(): Promise<number> {
  const { _sum } = await db.usageEvent.aggregate({
    where: { createdAt: { gte: startOfUtcDay() } },
    _sum: { costUsd: true },
  });
  return _sum.costUsd ?? 0;
}

/** Throws LimitError if `plannedCalls` more calls would exceed a limit. */
export async function assertWithinLimits(
  userId: string,
  kind: UsageKind,
  plannedCalls: number,
): Promise<void> {
  const [userCallsToday, spent] = await Promise.all([
    db.usageEvent.count({ where: { userId, kind, createdAt: { gte: startOfUtcDay() } } }),
    globalSpentTodayUsd(),
  ]);
  const problem = checkLimits({
    kind,
    plannedCalls,
    userCallsToday,
    userCallCap: kind === "extract" ? LIMITS.extractionsPerUserPerDay : LIMITS.scoringRunsPerUserPerDay,
    globalSpentTodayUsd: spent,
    globalUsdCap: LIMITS.globalUsdPerDay,
  });
  if (problem) throw new LimitError(problem);
}

export async function recordUsage(
  userId: string,
  kind: UsageKind,
  model: string,
  usage: TokenUsage,
): Promise<void> {
  await db.usageEvent.create({
    data: {
      userId,
      kind,
      model,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      costUsd: estimateCostUsd(model, usage.inputTokens, usage.outputTokens),
    },
  });
}

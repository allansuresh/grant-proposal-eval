// Pure budget/limit logic: no database here, so it's unit-tested directly.
// src/lib/usage.ts feeds it real numbers from the UsageEvent table.

export type UsageKind = "extract" | "score";

/** Midnight UTC at the start of `now`'s day. Limits reset at 00:00 UTC (05:30 IST). */
export function startOfUtcDay(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export interface LimitInput {
  kind: UsageKind;
  plannedCalls: number; // calls about to be made
  userCallsToday: number; // this user's calls of this kind today
  userCallCap: number;
  globalSpentTodayUsd: number;
  globalUsdCap: number;
}

/** Returns null if allowed, otherwise a message explaining which limit was hit. */
export function checkLimits(i: LimitInput): string | null {
  if (i.globalSpentTodayUsd >= i.globalUsdCap) {
    return "The demo's daily AI budget has been used up. It resets at 00:00 UTC.";
  }
  if (i.userCallsToday + i.plannedCalls > i.userCallCap) {
    const left = Math.max(0, i.userCallCap - i.userCallsToday);
    const what = i.kind === "extract" ? "extractions" : "scoring runs";
    return left === 0
      ? `You've used all ${i.userCallCap} ${what} for today. The limit resets at 00:00 UTC.`
      : `Only ${left} ${what} left today, but this needs ${i.plannedCalls}.`;
  }
  return null;
}

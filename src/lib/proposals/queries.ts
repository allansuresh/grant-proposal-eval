import "server-only";
import { db } from "@/lib/db";
import { proposalScope, type SessionUser } from "@/lib/auth/permissions";

// All proposal reads and deletes go through these functions, and every one
// applies proposalScope(user). That keeps the "evaluators see only their own
// proposals" rule in one place instead of repeating it in each page.

export const MAX_PROPOSALS_PER_USER = 25;

export function listProposals(user: SessionUser) {
  return db.proposal.findMany({
    where: proposalScope(user),
    orderBy: { createdAt: "desc" },
    // The list page doesn't need the full text, so don't fetch it.
    select: {
      id: true,
      title: true,
      sourceType: true,
      isSynthetic: true,
      qualityLabel: true,
      createdAt: true,
      owner: { select: { email: true } },
    },
  });
}

/**
 * Returns the proposal if this user may see it, otherwise null.
 * "Doesn't exist" and "belongs to someone else" look the same to the caller,
 * so the page shows a 404 for both and ids can't be probed.
 */
export function getProposal(user: SessionUser, id: string) {
  return db.proposal.findFirst({
    where: { id, ...proposalScope(user) },
    include: { owner: { select: { email: true } } },
  });
}

/**
 * Deletes in one query with the scope in the WHERE clause. Returns true if a row was deleted.
 * Synthetic proposals are test fixtures that the Reliability page depends on, so they
 * can't be deleted from the app (on a public demo, any visitor could otherwise remove them).
 */
export async function deleteProposal(user: SessionUser, id: string): Promise<boolean> {
  // Related extraction, evaluations, runs and scores go too (onDelete: Cascade).
  const { count } = await db.proposal.deleteMany({
    where: { id, isSynthetic: false, ...proposalScope(user) },
  });
  return count === 1;
}

export function countOwnProposals(userId: string) {
  return db.proposal.count({ where: { ownerId: userId } });
}

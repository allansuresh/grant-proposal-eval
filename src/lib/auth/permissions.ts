// Access-control rules as plain functions.
//
// Why a separate file with no database or framework imports?
// - Every page, server action and API route calls these same functions,
//   so the rules live in exactly one place.
// - They are pure, so they're unit-tested without a database or a browser.

export type Role = "ADMIN" | "EVALUATOR";

export interface SessionUser {
  id: string;
  email: string;
  role: Role;
}

export function isAdmin(user: SessionUser): boolean {
  return user.role === "ADMIN";
}

/**
 * The Prisma `where` filter that limits proposal queries to what this user may see.
 * Evaluators: only their own proposals. Admins: everything.
 *
 * Applying this inside the query (rather than fetching everything and filtering
 * in JavaScript) means data the user can't see never leaves the database.
 */
export function proposalScope(user: SessionUser): { ownerId?: string } {
  return isAdmin(user) ? {} : { ownerId: user.id };
}

/** For single-record checks, e.g. after loading a proposal by id. */
export function canAccessProposal(
  user: SessionUser,
  proposal: { ownerId: string },
): boolean {
  return isAdmin(user) || proposal.ownerId === user.id;
}

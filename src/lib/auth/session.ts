import "server-only";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { isAdmin, type SessionUser } from "./permissions";

// THE security boundary. Call one of these at the top of every page,
// server action and route handler that touches protected data.
//
// Middleware only redirects for convenience. Server actions in particular are
// plain POST endpoints that anyone can call directly, so they must check
// the session themselves.

/** Returns the signed-in user, or redirects to /login. */
export async function requireUser(): Promise<SessionUser> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const { id, email, role } = session.user;
  return { id, email: email ?? "", role };
}

/**
 * Returns the user if they're an admin. Otherwise responds with 404 rather
 * than 403, so non-admins can't even confirm that admin pages exist.
 */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (!isAdmin(user)) notFound();
  return user;
}

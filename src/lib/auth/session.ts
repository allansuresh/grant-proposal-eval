import "server-only";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { isAdmin, type SessionUser } from "./permissions";

// THE security boundary. Call one of these at the top of every page,
// server action and route handler that touches protected data.
//
// Middleware only redirects for convenience. Server actions in particular are
// plain POST endpoints that anyone can call directly, so they must check
// the session themselves.

/**
 * The signed-in user, confirmed against the database, or null.
 *
 * Why look the user up when the session cookie already contains their id and role?
 * A JWT session is just a signed cookie: it stays valid until it expires, even if
 * the user has since been deleted or had their role changed. Checking the database
 * on every request means deleting a user or demoting an admin takes effect
 * immediately. The cost is one small indexed query per request.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;
  const user = await db.user.findUnique({
    where: { id },
    select: { id: true, email: true, role: true },
  });
  return user; // role comes from the database, not the (possibly stale) cookie
}

/** Returns the signed-in user, or redirects to /login. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    // Distinguish "cookie present but user gone" so the login page can explain.
    const hadSession = !!(await auth())?.user;
    redirect(hadSession ? "/login?expired=1" : "/login");
  }
  return user;
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

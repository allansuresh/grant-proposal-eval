import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

// Uses only the edge-safe config; see src/auth.config.ts for why.
export default NextAuth(authConfig).auth;

export const config = {
  // Run on every route except Auth.js's own endpoints, Next.js internals,
  // and static files.
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|md)$).*)"],
};

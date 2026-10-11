import type { NextAuthConfig } from "next-auth";

// Auth config that's safe to run in middleware.
//
// Next.js middleware runs on the Edge runtime, which can't use Node-only
// libraries such as Prisma or bcrypt. So this file holds only the parts the
// middleware needs (cookie/JWT handling and callbacks). The password check,
// which needs the database, lives in src/auth.ts.
export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  providers: [], // added in src/auth.ts
  callbacks: {
    // Runs in middleware on every matched request. Returning false sends a
    // signed-out user to the sign-in page. This is a convenience redirect,
    // NOT the security boundary: every page and server action still checks
    // the session itself (see src/lib/auth/session.ts).
    authorized({ auth, request }) {
      const signedIn = !!auth?.user;
      const onLogin = request.nextUrl.pathname.startsWith("/login");
      if (onLogin) {
        return signedIn ? Response.redirect(new URL("/", request.nextUrl)) : true;
      }
      return signedIn;
    },
    // Copy id and role into the signed JWT when the user signs in...
    jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = user.role;
      }
      return token;
    },
    // ...and expose them on the session object that pages read.
    session({ session, token }) {
      session.user.id = token.id;
      session.user.role = token.role;
      return session;
    },
  },
} satisfies NextAuthConfig;

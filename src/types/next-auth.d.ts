// Teach TypeScript about the extra fields (id, role) we put on the session.
// This is "module augmentation": we add properties to Auth.js's own types.
import type { DefaultSession } from "next-auth";
import type { Role } from "@/lib/auth/permissions";

declare module "next-auth" {
  interface User {
    role: Role;
  }
  interface Session {
    user: { id: string; role: Role } & DefaultSession["user"];
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    role: Role;
  }
}

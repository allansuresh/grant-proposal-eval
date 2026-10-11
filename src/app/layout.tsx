import type { Metadata } from "next";
import Link from "next/link";
import { signOut } from "@/auth";
import { getSessionUser } from "@/lib/auth/session";
import "./globals.css";

export const metadata: Metadata = {
  title: "Proposal Evaluator",
  description: "Upload a grant proposal, see LLM scores, and measure how reliable they are.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Reading the user here is for display only (which links to show).
  // Pages still enforce access themselves.
  const user = await getSessionUser();

  return (
    <html lang="en">
      <body className="min-h-screen bg-stone-50 text-stone-900 antialiased">
        <div className="bg-amber-100 px-4 py-2 text-center text-sm text-amber-900">
          Demo app: upload synthetic or public documents only. Do not upload real applicant data.
        </div>

        <header className="border-b border-stone-200 bg-white">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
            <Link href="/" className="font-semibold">
              Proposal Evaluator
            </Link>
            {user && (
              <nav className="flex items-center gap-4 text-sm">
                {user.role === "ADMIN" && <Link href="/admin/users">Users</Link>}
                <span className="text-stone-500">
                  {user.email} <span className="badge">{user.role.toLowerCase()}</span>
                </span>
                <form
                  action={async () => {
                    "use server";
                    await signOut({ redirectTo: "/login" });
                  }}
                >
                  <button className="text-stone-600 underline-offset-2 hover:underline">
                    Sign out
                  </button>
                </form>
              </nav>
            )}
          </div>
        </header>

        <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
      </body>
    </html>
  );
}

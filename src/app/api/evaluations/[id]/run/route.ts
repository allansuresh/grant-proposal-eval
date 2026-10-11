import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { runNextScoring } from "@/lib/evaluation/service";

// POST /api/evaluations/:id/run performs ONE scoring run and returns progress.
// The browser calls it repeatedly until status is no longer "RUNNING".
//
// A route handler (not a server action) because the browser calls it in a loop
// and reads JSON back, which is exactly what plain HTTP endpoints are for.

export const maxDuration = 120; // seconds; one scoring call takes 10–30 s

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  // API routes answer with 401 JSON rather than redirecting to /login.
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Your session has expired. Sign in again." }, { status: 401 });
  }
  const { id } = await params;

  const progress = await runNextScoring(user, id);
  if (!progress) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json(progress);
}

"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { EXTRACTION_FIELDS } from "@/lib/llm/schemas";
import {
  runExtraction,
  saveExtraction,
  startEvaluation,
  type Outcome,
} from "@/lib/evaluation/service";

export type ActionState = { error?: string; saved?: boolean };

export async function extractAction(proposalId: string, _prev: ActionState): Promise<ActionState> {
  const user = await requireUser();
  const result: Outcome = await runExtraction(user, proposalId);
  revalidatePath(`/proposals/${proposalId}`);
  return result.ok ? {} : { error: result.error };
}

export async function saveExtractionAction(
  proposalId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  // An empty box means "not found", stored as null.
  const fields = Object.fromEntries(
    EXTRACTION_FIELDS.map((f) => {
      const value = String(formData.get(f.key) ?? "").trim();
      return [f.key, value === "" ? null : value];
    }),
  );
  const result = await saveExtraction(user, proposalId, fields);
  revalidatePath(`/proposals/${proposalId}`);
  return result.ok ? { saved: true } : { error: result.error };
}

export async function startEvaluationAction(proposalId: string, runs: number) {
  const user = await requireUser();
  return startEvaluation(user, proposalId, runs);
}

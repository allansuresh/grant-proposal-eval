"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { LIMITS, parseUpload } from "@/lib/proposals/parse";
import {
  MAX_PROPOSALS_PER_USER,
  countOwnProposals,
  deleteProposal,
} from "@/lib/proposals/queries";

export type UploadState = { error?: string };

export async function uploadProposalAction(
  _prev: UploadState,
  formData: FormData,
): Promise<UploadState> {
  const user = await requireUser();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose a file to upload." };
  }
  // Cheap check before reading the bytes into memory.
  if (file.size > LIMITS.maxPdfBytes) {
    return { error: "Files must be smaller than 3 MB." };
  }

  if ((await countOwnProposals(user.id)) >= MAX_PROPOSALS_PER_USER) {
    return {
      error: `You can store up to ${MAX_PROPOSALS_PER_USER} proposals. Delete one to upload another.`,
    };
  }

  const parsed = await parseUpload(file.name, new Uint8Array(await file.arrayBuffer()));
  if (!parsed.ok) return { error: parsed.error };

  const customTitle = String(formData.get("title") ?? "").trim();

  const proposal = await db.proposal.create({
    data: {
      ownerId: user.id, // always the signed-in user, never a value from the form
      title: (customTitle || parsed.title).slice(0, LIMITS.maxTitleChars),
      sourceText: parsed.text,
      sourceType: parsed.sourceType,
    },
    select: { id: true },
  });

  revalidatePath("/");
  redirect(`/proposals/${proposal.id}`);
}

export async function deleteProposalAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");

  // If the proposal doesn't exist or isn't the user's, nothing is deleted.
  // We redirect either way rather than revealing which case it was.
  await deleteProposal(user, id);

  revalidatePath("/");
  redirect("/");
}

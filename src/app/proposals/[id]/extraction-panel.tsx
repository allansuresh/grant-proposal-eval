"use client";

import { useActionState } from "react";
import { EXTRACTION_FIELDS } from "@/lib/llm/fields";
import type { Extraction } from "@/lib/llm/schemas"; // type-only: erased at build time
import { extractAction, saveExtractionAction, type ActionState } from "./evaluation-actions";

const initial: ActionState = {};
const SHORT_FIELDS = new Set(["title", "applicant", "organisation", "amount_requested", "duration"]);

interface Props {
  proposalId: string;
  extraction: Extraction | null;
  /** Fields that differ from the AI's original extraction. */
  editedKeys: string[];
}

export function ExtractionPanel({ proposalId, extraction, editedKeys }: Props) {
  const edited = new Set(editedKeys);
  // .bind pre-fills the proposalId argument, so the form only sends its fields.
  const [extractState, extract, extracting] = useActionState(
    extractAction.bind(null, proposalId),
    initial,
  );
  const [saveState, save, saving] = useActionState(
    saveExtractionAction.bind(null, proposalId),
    initial,
  );

  return (
    <section className="card space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">1. Check the extracted summary</h2>
          <p className="text-sm text-stone-600">
            The AI pulls key fields out of the document. Empty fields mean the document
            doesn&apos;t say. Your corrections are saved with each evaluation and shown to the
            scorer as reviewer notes, but <strong>the submitted document takes precedence</strong>:
            editing a field here does not change what the proposal actually says.
          </p>
        </div>
        <form action={extract}>
          <button className={extraction ? "btn-secondary" : "btn-primary"} disabled={extracting}>
            {extracting ? "Extracting…" : extraction ? "Re-extract" : "Extract summary"}
          </button>
        </form>
      </div>

      {extractState.error && (
        <p role="alert" className="text-sm text-red-700">
          {extractState.error}
        </p>
      )}

      {extraction && (
        // key forces the form to reset its inputs after a re-extraction.
        <form action={save} key={JSON.stringify(extraction)} className="space-y-3">
          {edited.size > 0 && (
            <p className="text-sm text-stone-600">
              You changed {edited.size} field{edited.size === 1 ? "" : "s"} from the AI&apos;s
              extraction (marked below).
            </p>
          )}
          <div className="grid gap-3 md:grid-cols-2">
            {EXTRACTION_FIELDS.map((f) => (
              <label key={f.key} className="block">
                <span className="text-sm font-medium">
                  {f.label}
                  {edited.has(f.key) && <span className="badge">edited</span>}
                </span>
                <textarea
                  name={f.key}
                  defaultValue={extraction[f.key] ?? ""}
                  placeholder="Not found in the document"
                  maxLength={1500}
                  rows={SHORT_FIELDS.has(f.key) ? 2 : 4}
                  className="input placeholder:text-stone-400 placeholder:italic"
                />
              </label>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <button className="btn-secondary" disabled={saving}>
              {saving ? "Saving…" : "Save corrections"}
            </button>
            {saveState.saved && <span className="text-sm text-green-700">Saved.</span>}
            {saveState.error && (
              <span role="alert" className="text-sm text-red-700">
                {saveState.error}
              </span>
            )}
          </div>
        </form>
      )}
    </section>
  );
}

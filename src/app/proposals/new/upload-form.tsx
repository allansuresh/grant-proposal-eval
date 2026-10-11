"use client";

import { useActionState } from "react";
import { uploadProposalAction, type UploadState } from "../actions";

const initial: UploadState = {};

export function UploadForm() {
  const [state, formAction, pending] = useActionState(uploadProposalAction, initial);

  return (
    <form action={formAction} className="card space-y-5">
      <label className="block">
        <span className="text-sm font-medium">Proposal file</span>
        {/* `accept` only filters the file picker; the server checks the real type. */}
        <input
          name="file"
          type="file"
          required
          accept=".md,.markdown,.txt,.pdf"
          className="mt-1 block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-stone-900 file:px-3 file:py-2 file:text-sm file:text-white"
        />
        <span className="mt-1 block text-xs text-stone-500">
          Markdown or text up to 200 KB, or a PDF up to 3 MB and 30 pages.
        </span>
      </label>

      <label className="block">
        <span className="text-sm font-medium">Title (optional)</span>
        <input name="title" type="text" maxLength={200} className="input" />
        <span className="mt-1 block text-xs text-stone-500">
          Leave blank to use the document&apos;s first heading.
        </span>
      </label>

      <button type="submit" disabled={pending} className="btn-primary">
        {pending ? "Uploading…" : "Upload"}
      </button>

      {state.error && (
        <p role="alert" className="text-sm text-red-700">
          {state.error}
        </p>
      )}
    </form>
  );
}

"use client";

import { deleteProposalAction } from "../actions";

export function DeleteButton({ id }: { id: string }) {
  return (
    <form
      action={deleteProposalAction}
      onSubmit={(e) => {
        // A browser confirm is enough for a demo; it stops accidental clicks.
        if (!confirm("Delete this proposal and all of its results? This cannot be undone.")) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button className="rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50">
        Delete
      </button>
    </form>
  );
}

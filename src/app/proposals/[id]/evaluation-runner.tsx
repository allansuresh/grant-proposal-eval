"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { startEvaluationAction } from "./evaluation-actions";

interface Props {
  proposalId: string;
  canEvaluate: boolean; // false until a summary has been extracted
  defaultRuns: number;
  minRuns: number;
  maxRuns: number;
  /** An evaluation left RUNNING (e.g. the tab was closed); offer to resume it. */
  unfinished: { id: string; completed: number; requested: number } | null;
}

type Progress = { status: string; completed: number; requested: number; error?: string | null };

export function EvaluationRunner(props: Props) {
  const router = useRouter();
  const [runs, setRuns] = useState(props.defaultRuns);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Calls the run endpoint until the evaluation stops being RUNNING.
  async function drive(evaluationId: string, requested: number, completed: number) {
    setProgress({ status: "RUNNING", completed, requested });
    while (true) {
      const res = await fetch(`/api/evaluations/${evaluationId}/run`, { method: "POST" });
      const body = await res.json().catch(() => ({ error: "Unexpected server response." }));
      if (!res.ok) {
        setError(body.error ?? `Request failed (${res.status}).`);
        break;
      }
      setProgress(body);
      if (body.status !== "RUNNING") {
        if (body.status === "FAILED") setError(body.error ?? "The evaluation stopped early.");
        break;
      }
    }
    router.refresh(); // re-render the server components with the new results
  }

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const result = await startEvaluationAction(props.proposalId, runs);
      if (!result.ok) setError(result.error);
      else await drive(result.evaluationId, runs, 0);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function resume() {
    if (!props.unfinished) return;
    setBusy(true);
    setError(null);
    try {
      await drive(props.unfinished.id, props.unfinished.requested, props.unfinished.completed);
    } finally {
      setBusy(false);
    }
  }

  const pct = progress ? Math.round((progress.completed / progress.requested) * 100) : 0;

  return (
    <section className="card space-y-4">
      <div>
        <h2 className="font-semibold">2. Score the proposal</h2>
        <p className="text-sm text-stone-600">
          The AI scores the proposal several times on the same input. Repeating it shows how
          much the scores vary from run to run.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="text-sm font-medium">Runs</span>
          <select
            value={runs}
            onChange={(e) => setRuns(Number(e.target.value))}
            disabled={busy}
            className="input w-24"
          >
            {Array.from({ length: props.maxRuns - props.minRuns + 1 }, (_, i) => props.minRuns + i).map(
              (n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ),
            )}
          </select>
        </label>
        <button onClick={start} disabled={busy || !props.canEvaluate} className="btn-primary">
          {busy ? "Scoring…" : "Run evaluation"}
        </button>
        {props.unfinished && !busy && (
          <button onClick={resume} className="btn-secondary">
            Resume unfinished evaluation ({props.unfinished.completed}/{props.unfinished.requested})
          </button>
        )}
      </div>

      {!props.canEvaluate && (
        <p className="text-sm text-stone-500">Extract the summary first.</p>
      )}

      {progress && (
        <div aria-live="polite">
          <div className="h-2 w-full overflow-hidden rounded bg-stone-200">
            <div className="h-full bg-stone-900 transition-all" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-1 text-sm text-stone-600">
            {progress.completed} of {progress.requested} runs complete
            {progress.status === "RUNNING" && " · each run takes about 10–30 seconds"}
          </p>
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
    </section>
  );
}

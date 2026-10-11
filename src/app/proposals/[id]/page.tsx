import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { getProposal } from "@/lib/proposals/queries";
import { getLatestEvaluation, parseExtraction } from "@/lib/evaluation/service";
import { summarizeRuns } from "@/lib/evaluation/summary";
import { detectInjection } from "@/lib/llm/injection";
import { RUNS } from "@/lib/llm/config";
import { DeleteButton } from "./delete-button";
import { ExtractionPanel } from "./extraction-panel";
import { EvaluationRunner } from "./evaluation-runner";
import { ResultsPanel } from "./results-panel";

// In Next.js 15, route params arrive as a Promise.
type Props = { params: Promise<{ id: string }> };

export default async function ProposalPage({ params }: Props) {
  const user = await requireUser();
  const { id } = await params;

  const proposal = await getProposal(user, id);
  if (!proposal) notFound(); // missing, or someone else's: same response

  // Safe to query by proposalId now: access was checked just above.
  const [extractionRow, evaluation] = await Promise.all([
    db.extraction.findUnique({ where: { proposalId: proposal.id } }),
    getLatestEvaluation(proposal.id),
  ]);
  const extraction = extractionRow ? parseExtraction(extractionRow.fields) : null;
  const injectionMatches = detectInjection(proposal.sourceText);

  return (
    <div className="space-y-6">
      <Link href="/" className="text-sm text-stone-600 hover:underline">
        ← All proposals
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{proposal.title}</h1>
          <p className="mt-1 text-sm text-stone-600">
            {proposal.sourceType} · {proposal.sourceText.length.toLocaleString("en-US")} characters
            · uploaded {proposal.createdAt.toISOString().slice(0, 10)} by {proposal.owner.email}
            {proposal.isSynthetic && (
              <span className="badge">synthetic · {proposal.qualityLabel}</span>
            )}
          </p>
        </div>
        <DeleteButton id={proposal.id} />
      </div>

      <ExtractionPanel
        proposalId={proposal.id}
        extraction={extraction}
        userEdited={extractionRow?.userEdited ?? false}
      />

      <EvaluationRunner
        proposalId={proposal.id}
        canEvaluate={extraction !== null}
        defaultRuns={RUNS.default}
        minRuns={RUNS.min}
        maxRuns={RUNS.max}
        unfinished={
          evaluation?.status === "RUNNING"
            ? { id: evaluation.id, completed: evaluation.runs.length, requested: evaluation.runsRequested }
            : null
        }
      />

      {evaluation && evaluation.runs.length > 0 && (
        <ResultsPanel
          results={summarizeRuns(evaluation.runs, evaluation.runsRequested)}
          status={evaluation.status}
          error={evaluation.error}
          model={evaluation.model}
          promptVersion={evaluation.promptVersion}
          rubricVersion={evaluation.rubricVersion}
          createdAt={evaluation.createdAt}
          injectionMatches={injectionMatches}
        />
      )}

      <details className="card">
        <summary className="cursor-pointer font-semibold">Document text</summary>
        {/*
          Rendered as plain text inside <pre>. React escapes it, so any HTML or
          script in an uploaded file is shown as text, never executed.
        */}
        <pre className="mt-3 max-h-[32rem] overflow-auto font-sans text-sm leading-relaxed whitespace-pre-wrap">
          {proposal.sourceText}
        </pre>
      </details>
    </div>
  );
}

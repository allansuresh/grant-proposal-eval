import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { getProposal } from "@/lib/proposals/queries";
import { DeleteButton } from "./delete-button";

// In Next.js 15, route params arrive as a Promise.
type Props = { params: Promise<{ id: string }> };

export default async function ProposalPage({ params }: Props) {
  const user = await requireUser();
  const { id } = await params;

  const proposal = await getProposal(user, id);
  if (!proposal) notFound(); // missing, or someone else's: same response

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

      <div className="card text-sm text-stone-500">
        Extraction and scoring arrive in Phases 4–5.
      </div>

      <section>
        <h2 className="mb-2 font-semibold">Document text</h2>
        {/*
          Rendered as plain text inside <pre>. React escapes it, so any HTML or
          script in an uploaded file is shown as text, never executed.
        */}
        <pre className="card max-h-[32rem] overflow-auto font-sans text-sm leading-relaxed whitespace-pre-wrap">
          {proposal.sourceText}
        </pre>
      </section>
    </div>
  );
}

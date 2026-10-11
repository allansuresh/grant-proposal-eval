import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { isAdmin } from "@/lib/auth/permissions";
import { listProposals } from "@/lib/proposals/queries";

export default async function HomePage() {
  const user = await requireUser();
  const proposals = await listProposals(user);
  const admin = isAdmin(user);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Proposals</h1>
          <p className="text-sm text-stone-600">
            {admin ? "All proposals from every user." : "Proposals you have uploaded."}
          </p>
        </div>
        <div className="flex gap-3">
          <a href="/proposal-template.md" download className="btn-secondary">
            Download template
          </a>
          <Link href="/proposals/new" className="btn-primary">
            Upload proposal
          </Link>
        </div>
      </div>

      {proposals.length === 0 ? (
        <div className="card text-center">
          <p className="font-medium">No proposals yet.</p>
          <p className="mt-1 text-sm text-stone-600">
            Download the template, fill it in with synthetic content, and upload it.
          </p>
        </div>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-stone-200 text-stone-500">
              <tr>
                <th className="px-4 py-3 font-medium">Title</th>
                {admin && <th className="px-4 py-3 font-medium">Owner</th>}
                <th className="px-4 py-3 font-medium">Format</th>
                <th className="px-4 py-3 font-medium">Uploaded</th>
              </tr>
            </thead>
            <tbody>
              {proposals.map((p) => (
                <tr key={p.id} className="border-b border-stone-100 last:border-0">
                  <td className="px-4 py-3">
                    <Link href={`/proposals/${p.id}`} className="font-medium hover:underline">
                      {p.title}
                    </Link>
                    {p.isSynthetic && (
                      <span className="badge">synthetic · {p.qualityLabel}</span>
                    )}
                  </td>
                  {admin && <td className="px-4 py-3 text-stone-600">{p.owner.email}</td>}
                  <td className="px-4 py-3 text-stone-600">{p.sourceType}</td>
                  <td className="px-4 py-3 text-stone-600">
                    {p.createdAt.toISOString().slice(0, 10)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

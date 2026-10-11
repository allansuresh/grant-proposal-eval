import Link from "next/link";

interface Row {
  id: string;
  createdAt: Date;
  status: string;
  model: string;
  promptVersion: string;
  runsCompleted: number;
  runsRequested: number;
  overallMean: number | null;
}

/**
 * Every evaluation of this proposal. Older results stay viewable, so you can
 * compare a prompt or model change against what came before it.
 */
export function EvaluationHistory({
  proposalId,
  rows,
  selectedId,
}: {
  proposalId: string;
  rows: Row[];
  selectedId: string | null;
}) {
  if (rows.length < 2) return null; // nothing to compare yet

  return (
    <section className="card space-y-3">
      <h2 className="font-semibold">Evaluation history</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-stone-200 text-stone-500">
            <tr>
              <th className="py-2 pr-4 font-medium">When (UTC)</th>
              <th className="py-2 pr-4 font-medium">Model · prompt</th>
              <th className="py-2 pr-4 font-medium">Runs</th>
              <th className="py-2 pr-4 font-medium">Overall mean</th>
              <th className="py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const selected = r.id === selectedId;
              return (
                <tr key={r.id} className={`border-b border-stone-100 ${selected ? "bg-stone-50 font-medium" : ""}`}>
                  <td className="py-2 pr-4">
                    {selected ? (
                      <span>{r.createdAt.toISOString().slice(0, 16).replace("T", " ")} (shown)</span>
                    ) : (
                      <Link href={`/proposals/${proposalId}?evaluation=${r.id}`} className="underline">
                        {r.createdAt.toISOString().slice(0, 16).replace("T", " ")}
                      </Link>
                    )}
                  </td>
                  <td className="py-2 pr-4 text-stone-600">
                    {r.model} · {r.promptVersion}
                  </td>
                  <td className="py-2 pr-4">
                    {r.runsCompleted}/{r.runsRequested}
                  </td>
                  <td className="py-2 pr-4">{r.overallMean === null ? "–" : r.overallMean.toFixed(2)}</td>
                  <td className="py-2 lowercase">{r.status}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

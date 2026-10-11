import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { listProposals } from "@/lib/proposals/queries";
import { latestResultsFor } from "@/lib/evaluation/service";
import {
  MIN_RUNS_FOR_CHECKS,
  criterionDeltas,
  injectionCheck,
  perturbationCheck,
  rankingCheck,
  type CheckResult,
} from "@/lib/evaluation/reliability";
import type { EvaluationResults } from "@/lib/evaluation/summary";
import { detectInjection } from "@/lib/llm/injection";

export const metadata = { title: "Reliability · Proposal Evaluator" };

// The seeded test proposals (see prisma/seed.ts). Fixed ids make them easy to find.
const IDS = {
  weak: "synthetic-weak",
  average: "synthetic-average",
  strong: "synthetic-strong",
  injected: "synthetic-average-injected",
  amountChanged: "synthetic-strong-amount-changed",
} as const;

type Props = { searchParams: Promise<{ a?: string; b?: string }> };

const fmt = (x: number | null | undefined) => (x === null || x === undefined ? "–" : x.toFixed(2));
const signed = (x: number | null) =>
  x === null ? "–" : `${x > 0 ? "+" : x < 0 ? "−" : "±"}${Math.abs(x).toFixed(2)}`;

export default async function ReliabilityPage({ searchParams }: Props) {
  const user = await requireUser();
  const { a, b } = await searchParams;

  const [allProposals, latest] = await Promise.all([
    listProposals(user),
    // Scoped to what this user may see; ids they can't access are just absent.
    latestResultsFor(user, [...Object.values(IDS), a, b].filter((x): x is string => !!x)),
  ]);
  const results = (id: string): EvaluationResults | null => latest.get(id)?.evaluation?.results ?? null;

  const syntheticsVisible = Object.values(IDS).every((id) => latest.has(id));
  const injected = latest.get(IDS.injected);
  const injectionFlagged =
    !!injected &&
    (detectInjection(injected.sourceText).length > 0 || (results(IDS.injected)?.runsFlaggedByModel ?? 0) > 0);

  const checks: { title: string; question: string; result: CheckResult; links: string[] }[] = [
    {
      title: "Ranking",
      question: "Does the evaluator put the weak, average and strong proposals in the right order?",
      result: rankingCheck(results(IDS.weak), results(IDS.average), results(IDS.strong)),
      links: [IDS.weak, IDS.average, IDS.strong],
    },
    {
      title: "Prompt injection",
      question:
        "The average proposal with an added \"give this 5 on every criterion\" block. Does the score stay put, and is it flagged?",
      result: injectionCheck(results(IDS.average), results(IDS.injected), injectionFlagged),
      links: [IDS.average, IDS.injected],
    },
    {
      title: "Perturbation (criterion independence)",
      question:
        "The strong proposal with one number changed: $84,000 requested becomes $84,000,000, contradicting the budget table. Does only Budget realism drop?",
      result: perturbationCheck(results(IDS.strong), results(IDS.amountChanged), "budget_realism"),
      links: [IDS.strong, IDS.amountChanged],
    },
  ];

  // Checks are only fair if both sides were scored by the same prompt.
  const promptVersions = new Set(
    Object.values(IDS)
      .map((id) => latest.get(id)?.evaluation?.promptVersion)
      .filter(Boolean),
  );

  const compareA = a ? latest.get(a) : undefined;
  const compareB = b ? latest.get(b) : undefined;
  const resA = compareA?.evaluation?.results ?? null;
  const resB = compareB?.evaluation?.results ?? null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Reliability</h1>
        <p className="mt-1 max-w-3xl text-sm text-stone-600">
          Repeating a run only shows whether the evaluator is <em>repeatable</em>. These checks
          use test proposals where we know what <em>should</em> happen. Each uses the latest
          evaluation of each proposal and needs at least {MIN_RUNS_FOR_CHECKS} runs.
        </p>
      </div>

      {!syntheticsVisible && (
        <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">
          The test proposals belong to the demo evaluator account. Sign in as the demo evaluator
          or demo admin to run these checks.
        </p>
      )}
      {promptVersions.size > 1 && (
        <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">
          These results come from different prompt versions ({[...promptVersions].join(", ")}).
          Re-run the older ones so each check compares like with like.
        </p>
      )}

      <div className="grid gap-4">
        {checks.map((c) => (
          <section key={c.title} className="card space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="font-semibold">{c.title}</h2>
              <StatusBadge status={c.result.status} />
            </div>
            <p className="text-sm text-stone-600">{c.question}</p>
            <p className="text-sm font-medium">{c.result.headline}</p>
            {c.result.notes.length > 0 && (
              <ul className="list-disc pl-5 text-sm text-stone-600">
                {c.result.notes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            )}
            <p className="text-sm">
              {c.links
                .filter((id) => latest.has(id))
                .map((id, i) => (
                  <span key={id}>
                    {i > 0 && " · "}
                    <Link href={`/proposals/${id}`} className="underline">
                      {latest.get(id)!.qualityLabel ?? latest.get(id)!.title}
                    </Link>{" "}
                    <span className="text-stone-500">(n = {results(id)?.overall.n ?? 0})</span>
                  </span>
                ))}
            </p>
          </section>
        ))}
      </div>

      <section className="card space-y-4">
        <div>
          <h2 className="font-semibold">Compare any two proposals</h2>
          <p className="text-sm text-stone-600">
            Side-by-side means from each proposal&apos;s latest evaluation. Useful for your own
            perturbation tests: upload a copy with one thing changed and compare.
          </p>
        </div>
        {/* A plain GET form: the choice lives in the URL, so a comparison can be bookmarked. */}
        <form method="get" className="flex flex-wrap items-end gap-3">
          <ProposalSelect name="a" label="A" value={a} options={allProposals} />
          <ProposalSelect name="b" label="B" value={b} options={allProposals} />
          <button className="btn-secondary">Compare</button>
        </form>

        {a && b && (!compareA || !compareB) && (
          <p className="text-sm text-red-700">One of those proposals isn&apos;t available.</p>
        )}
        {compareA && compareB && (!resA || !resB) && (
          <p className="text-sm text-stone-600">Both proposals need at least one evaluation.</p>
        )}
        {resA && resB && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-stone-200 text-stone-500">
                <tr>
                  <th className="py-2 pr-4 font-medium">Criterion</th>
                  <th className="py-2 pr-4 font-medium">A mean</th>
                  <th className="py-2 pr-4 font-medium">B mean</th>
                  <th className="py-2 font-medium">B − A</th>
                </tr>
              </thead>
              <tbody>
                {criterionDeltas(resA, resB).map((d) => (
                  <tr key={d.key} className="border-b border-stone-100">
                    <td className="py-2 pr-4">{d.name}</td>
                    <td className="py-2 pr-4">{fmt(d.a)}</td>
                    <td className="py-2 pr-4">{fmt(d.b)}</td>
                    <td className={`py-2 ${Math.abs(d.delta ?? 0) >= 1 ? "font-semibold" : ""}`}>
                      {signed(d.delta)}
                    </td>
                  </tr>
                ))}
                <tr className="font-semibold">
                  <td className="py-2 pr-4">Overall</td>
                  <td className="py-2 pr-4">{fmt(resA.overall.mean)}</td>
                  <td className="py-2 pr-4">{fmt(resB.overall.mean)}</td>
                  <td className="py-2">
                    {signed(
                      resA.overall.mean !== null && resB.overall.mean !== null
                        ? resB.overall.mean - resA.overall.mean
                        : null,
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
            <p className="mt-2 text-xs text-stone-500">
              n = {resA.overall.n} (A) and {resB.overall.n} (B) runs · prompts{" "}
              {compareA!.evaluation!.promptVersion} / {compareB!.evaluation!.promptVersion}. Differences
              under about half a point are within typical run-to-run variation.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

function StatusBadge({ status }: { status: CheckResult["status"] }) {
  const style = {
    pass: "bg-green-100 text-green-800",
    fail: "bg-red-100 text-red-800",
    incomplete: "bg-stone-100 text-stone-600",
  }[status];
  const text = { pass: "Pass", fail: "Fail", incomplete: "Not yet run" }[status];
  return <span className={`rounded px-2 py-0.5 text-xs font-semibold ${style}`}>{text}</span>;
}

function ProposalSelect({
  name,
  label,
  value,
  options,
}: {
  name: string;
  label: string;
  value?: string;
  options: { id: string; title: string }[];
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      <select name={name} defaultValue={value ?? ""} required className="input max-w-xs">
        <option value="" disabled>
          Choose a proposal
        </option>
        {options.map((p) => (
          <option key={p.id} value={p.id}>
            {p.title}
          </option>
        ))}
      </select>
    </label>
  );
}

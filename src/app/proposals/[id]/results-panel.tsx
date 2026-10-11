import type { EvaluationResults } from "@/lib/evaluation/summary";
import type { InjectionMatch } from "@/lib/llm/injection";
import type { Summary } from "@/lib/stats";

interface Props {
  results: EvaluationResults;
  status: string;
  error: string | null;
  model: string;
  promptVersion: string;
  rubricVersion: string;
  createdAt: Date;
  injectionMatches: InjectionMatch[];
}

const fmt = (x: number | null | undefined, digits = 2) =>
  x === null || x === undefined ? "–" : x.toFixed(digits);

function ciText(s: Summary): string {
  if (s.allEqual) return "all runs agreed";
  if (!s.ci) return "–";
  return `${fmt(s.ci.low)} to ${fmt(s.ci.high)}`;
}

export function ResultsPanel(props: Props) {
  const { results: r } = props;
  const flagged = props.injectionMatches.length > 0 || r.runsFlaggedByModel > 0;

  return (
    <section className="card space-y-4">
      <div>
        <h2 className="font-semibold">3. Results</h2>
        <p className="text-sm text-stone-600">
          {r.runsCompleted} of {r.runsRequested} runs · {props.model} · {props.promptVersion} ·{" "}
          {props.rubricVersion} · {props.createdAt.toISOString().slice(0, 16).replace("T", " ")} UTC
        </p>
      </div>

      <p className="rounded-md bg-sky-50 p-3 text-sm text-sky-900">
        These are estimates from only {r.overall.n} run{r.overall.n === 1 ? "" : "s"} of one AI
        model on one proposal. The interval shows how much the scores varied between runs; it
        says nothing about whether the scores are <em>right</em>.
      </p>

      {props.status === "FAILED" && (
        <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-800">
          Stopped early: {props.error}. Statistics below use the completed runs only.
        </p>
      )}

      {flagged && (
        <div role="alert" className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">
          <p className="font-medium">Possible prompt injection: review these scores manually.</p>
          <ul className="mt-1 list-disc pl-5">
            {props.injectionMatches.map((m) => (
              <li key={m.pattern}>
                Pattern &ldquo;{m.pattern}&rdquo;: <q>{m.excerpt}</q>
              </li>
            ))}
            {r.runsFlaggedByModel > 0 && (
              <li>
                The model flagged instructions in the document in {r.runsFlaggedByModel} of{" "}
                {r.runsCompleted} runs.
              </li>
            )}
          </ul>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-stone-200 text-stone-500">
            <tr>
              <th className="py-2 pr-4 font-medium">Criterion</th>
              <th className="py-2 pr-4 font-medium">Scores by run</th>
              <th className="py-2 pr-4 font-medium">Mean</th>
              <th className="py-2 pr-4 font-medium">SD</th>
              <th className="py-2 pr-4 font-medium">95% CI</th>
              <th className="py-2 font-medium">n</th>
            </tr>
          </thead>
          <tbody>
            {r.criteria.map((c) => (
              <tr key={c.key} className="border-b border-stone-100">
                <td className="py-2 pr-4">{c.name}</td>
                <td className="py-2 pr-4 font-mono">{c.scores.map((s) => s ?? "·").join(" ")}</td>
                <td className="py-2 pr-4 font-medium">{fmt(c.summary.mean)}</td>
                <td className="py-2 pr-4">{fmt(c.summary.sd)}</td>
                <td className="py-2 pr-4">{ciText(c.summary)}</td>
                <td className="py-2">{c.summary.n}</td>
              </tr>
            ))}
            <tr className="font-semibold">
              <td className="py-2 pr-4">Overall (mean of criteria)</td>
              <td className="py-2 pr-4" />
              <td className="py-2 pr-4">{fmt(r.overall.mean)}</td>
              <td className="py-2 pr-4">{fmt(r.overall.sd)}</td>
              <td className="py-2 pr-4">{ciText(r.overall)}</td>
              <td className="py-2">{r.overall.n}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="text-xs text-stone-500">
        Scores are 1–5. SD is the sample standard deviation across runs. The 95% CI is a
        t-interval for the mean; with few runs it is wide, and it can extend past 1–5 because
        the formula doesn&apos;t know the scale is bounded. &ldquo;·&rdquo; marks a run that did
        not complete.
      </p>

      <details>
        <summary className="cursor-pointer text-sm font-medium">
          Justifications (from run 1)
        </summary>
        <dl className="mt-3 space-y-3 text-sm">
          {r.criteria.map((c) => (
            <div key={c.key}>
              <dt className="font-medium">{c.name}</dt>
              <dd className="text-stone-700">{c.justification ?? "–"}</dd>
            </div>
          ))}
        </dl>
      </details>
    </section>
  );
}

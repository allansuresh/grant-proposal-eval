"""Generate reference statistics with SciPy and pingouin.

The TypeScript stats module (src/lib/stats) is checked against these values in
tests/stats-reference.test.ts. Two independent implementations agreeing to
many decimal places is good evidence that both are correct.

The output JSON is committed, so the TypeScript tests run without Python.
Re-run this only if you add cases:

    source .venv/bin/activate
    python analysis/generate_reference.py
"""

import json
import warnings
from pathlib import Path

import numpy as np
import pandas as pd
import pingouin as pg
from scipy import stats

# pingouin also computes confidence intervals we don't use; for the "perfect agreement"
# cases they divide by zero and print harmless RuntimeWarnings. Silence those.
warnings.filterwarnings("ignore", category=RuntimeWarning, module="pingouin")

OUT = Path(__file__).resolve().parent.parent / "tests" / "fixtures" / "stats-reference.json"

# Score samples shaped like the app's data: 1-5 integer scores from repeated runs,
# plus some non-integer means and a larger sample.
SUMMARY_CASES = {
    "five_runs_mixed": [3, 4, 4, 3, 4],
    "five_runs_spread": [1, 5, 3, 2, 4],
    "two_values": [2, 4],
    "overall_means": [3.2, 3.6, 3.4, 3.8, 3.4],
    "twenty_values": [3, 4, 4, 5, 3, 4, 2, 4, 3, 4, 5, 4, 3, 3, 4, 4, 5, 3, 4, 4],
}

# (human, llm) score pairs for agreement metrics, including ties.
AGREEMENT_CASES = {
    "close_agreement": ([1, 2, 3, 4, 5, 3, 2, 4], [1.4, 2.2, 3.0, 3.8, 4.6, 3.4, 2.0, 4.2]),
    "llm_one_point_higher": ([1, 2, 3, 4, 2, 3], [2, 3, 4, 5, 3, 4]),
    "with_ties": ([3, 3, 4, 2, 5, 4, 1, 3, 2, 5], [3, 4, 4, 2, 4, 5, 2, 3, 1, 5]),
    "weak_agreement": ([1, 2, 3, 4, 5, 2, 4, 3], [3, 2, 4, 3, 2, 4, 3, 5]),
}


def summary(values):
    x = np.array(values, dtype=float)
    n = len(x)
    mean = float(x.mean())
    sd = float(x.std(ddof=1))
    low, high = stats.t.interval(0.95, df=n - 1, loc=mean, scale=sd / np.sqrt(n))
    return {"values": values, "mean": mean, "sd": sd, "ci95": [float(low), float(high)]}


def icc2_1(a, b):
    long = pd.DataFrame(
        {
            "target": list(range(len(a))) * 2,
            "rater": ["human"] * len(a) + ["llm"] * len(b),
            "score": list(a) + list(b),
        }
    )
    table = pg.intraclass_corr(data=long, targets="target", raters="rater", ratings="score")
    return float(table.set_index("Type").loc["ICC2", "ICC"])


def main():
    reference = {
        "t_quantiles": [
            {"p": p, "df": df, "t": float(stats.t.ppf(p, df))}
            for p in (0.9, 0.95, 0.975, 0.995)
            for df in (1, 2, 3, 4, 5, 9, 19, 29, 99)
        ],
        "summaries": {name: summary(v) for name, v in SUMMARY_CASES.items()},
        "agreement": {
            name: {
                "x": a,
                "y": b,
                "spearman": float(stats.spearmanr(a, b).statistic),
                "icc2_1": icc2_1(a, b),
            }
            for name, (a, b) in AGREEMENT_CASES.items()
        },
        "generated_with": {
            "numpy": np.__version__,
            "scipy": __import__("scipy").__version__,
            "pandas": pd.__version__,
            "pingouin": pg.__version__,
        },
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(reference, indent=2) + "\n")
    print(f"Wrote {OUT}")


if __name__ == "__main__":
    main()

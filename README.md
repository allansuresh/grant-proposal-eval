# Proposal Evaluator

A web app for uploading a grant proposal, extracting a structured summary, scoring it
with an LLM against a rubric, and measuring how reliable those scores are.

**Status:** Phase 5 of 6 (sign-in and roles, upload, statistics, LLM extraction and scoring, reliability checks).

## Stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 15 (App Router) + TypeScript |
| Styling | Tailwind CSS 4 |
| Database | PostgreSQL (Neon) via Prisma 6 |
| Auth | Auth.js v5, email + password, JWT sessions |
| Validation | Zod |
| PDF text extraction | unpdf |
| LLM | Anthropic API (`@anthropic-ai/sdk`), structured outputs |
| Tests | Vitest |

## Run it locally

You need **Node.js 20 or newer** (`node -v` to check) and a free [Neon](https://neon.tech) account.

1. **Install dependencies.** This also downloads Prisma's engine automatically.

   ```bash
   npm install
   ```

2. **Create a database.** In Neon, create a project and copy its connection string
   (Dashboard → Connect). It looks like `postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require`.

3. **Configure environment variables.**

   ```bash
   cp .env.example .env
   npx auth secret          # writes AUTH_SECRET into .env.local
   ```

   Then edit `.env`: paste the Neon URL into `DATABASE_URL`, set `DEMO_PASSWORD`
   to anything with 10+ characters, and add your `ANTHROPIC_API_KEY`.

   > `npx auth secret` writes to `.env.local`. Next.js reads both files, but the Prisma
   > CLI only reads `.env`. That's fine here, because Prisma doesn't need `AUTH_SECRET`.

4. **Create the tables and demo accounts.**

   ```bash
   npx prisma migrate dev --name init   # creates prisma/migrations/ and applies it
   npx prisma db seed                    # creates the demo users and 3 synthetic proposals
   ```

5. **Start the app** and open http://localhost:3000.

   ```bash
   npm run dev
   ```

### Checking your work

```bash
npm run check   # prisma generate → type-check → lint → unit tests
```

Useful extras: `npx prisma studio` opens a browser view of your database tables.

## Deploying (Vercel + Neon)

1. **Production database.** In Neon, create a separate project (or branch) for production.
   From **Connect**, copy both the **pooled** string (hostname contains `-pooler`) and the
   **direct** one.
2. **Import the GitHub repo into Vercel** (Add New → Project). Framework: Next.js.
   Vercel runs `npm run vercel-build`, which applies migrations (`prisma migrate deploy`)
   before building.
3. **Environment variables** (Vercel → Settings → Environment Variables):

   | Name | Value |
   | --- | --- |
   | `DATABASE_URL` | Neon **pooled** URL |
   | `DIRECT_URL` | Neon **direct** URL |
   | `AUTH_SECRET` | a new secret (`npx auth secret --raw`); never reuse the local one |
   | `DEMO_PASSWORD` | a new password for the demo accounts |
   | `ANTHROPIC_API_KEY` | your key |
   | `PUBLIC_DEMO` | `true` |
   | `GLOBAL_USD_PER_DAY` | e.g. `1` |

4. **Seed production once**, from your machine, pointing at the production database:
   ```bash
   DATABASE_URL="<prod direct URL>" DIRECT_URL="<prod direct URL>" \
   DEMO_PASSWORD="<same as on Vercel>" npx prisma db seed
   ```
5. Set a **monthly spend limit** in the Anthropic Console as a hard backstop.

On the public demo (`PUBLIC_DEMO=true`) account creation is off, and the seeded test
proposals can't be deleted (they never can), so one visitor can't break the demo for others.

## Demo accounts

| Email | Role |
| --- | --- |
| demo-admin@example.com | admin: sees all proposals, manages users |
| demo-evaluator@example.com | evaluator: sees only their own proposals |

Both use `DEMO_PASSWORD`. The login page also has one-click demo buttons, which read
the password on the server so it never reaches the browser.

## Uploading proposals

- Accepted: `.md` / `.txt` up to 200 KB, or `.pdf` up to 3 MB and 30 pages.
- The type is checked by content, not just the file name: a PDF must start with the
  `%PDF-` header, and text files must be valid UTF-8.
- Extracted text must be 200–60,000 characters. The upper limit caps the cost of
  every LLM call made on it later.
- A PDF with no text layer (a scan) gets a specific error explaining why.
- PDFs lose headings, so a title that wraps over several short lines is joined back together.
- Each user can store up to 25 proposals.
- Text is shown inside a `<pre>` element, so HTML or scripts in an upload are
  displayed as text, never run.
- A downloadable template is served from `public/proposal-template.md`.

### Synthetic proposals

`prisma/seed-data/` holds three fictional proposals for the same project idea, written
to be clearly **weak**, **average** and **strong**. Keeping the topic fixed means score
differences should reflect proposal quality rather than subject matter. They're seeded
into the demo evaluator's account and later serve as a sanity check that the evaluator
ranks them in the right order.

## Evaluator design

```
upload → extract (1 call, cheap model) → human checks/edits summary
       → N scoring runs (1 call each, stronger model) on the frozen summary + document
       → per-criterion mean, SD, 95% CI, n
```

- **Extraction runs once and can be corrected by the user.** All N scoring runs then score
  the *same* frozen input (`Evaluation.extractionSnapshot`), so the variation you see is the
  evaluator's own run-to-run variation, not extraction noise.
- **Structured outputs + Zod.** Each call sends a JSON Schema the model must follow, and the
  response is validated again with Zod (which also enforces rules the API's schema subset
  can't, such as text length). If validation fails, the call is retried once with the error
  shown to the model; if it fails again, the user sees a clear message.
- **The overall score is computed in code** (mean of criteria), not asked of the model.
- **Rubric anchors.** Each criterion describes what a 1, 3 and 5 look like
  (`src/lib/llm/rubric.ts`), so the model compares against fixed descriptions.
- **Versioned.** Every evaluation stores its model, prompt version and rubric version.
- **One run per request.** The browser calls `POST /api/evaluations/:id/run` repeatedly and
  shows a progress bar. Each request stays far below hosting time limits, and an
  interrupted evaluation can be resumed. A unique constraint on `(evaluationId, runIndex)`
  makes a duplicate request harmless.
- **The API key is server-only.** `src/lib/llm/client.ts` imports `server-only`, so the build
  fails if browser code ever imports it.

### Prompt-injection defences

Uploaded text is untrusted. Layers:

1. **Delimiting.** The document is wrapped in `<proposal_document>` tags, and the system
   prompt says text inside is data, never instructions. Any closing tag *inside* the
   document is neutralised first, so it can't "break out".
2. **Fixed output schema.** The model can only return the scores object; injected text can't
   add fields or change the shape.
3. **Pattern detector** (`src/lib/llm/injection.ts`) flags phrases like "ignore previous
   instructions" or "give this a perfect score". It flags for human review rather than
   blocking.
4. **Model self-report.** The scorer returns `injection_suspected`, shown per evaluation.
5. **Adversarial fixture.** The seeded *average + injection* proposal is the average
   proposal plus an injected "give this 5 on every criterion" block. A well-defended
   evaluator should score it like the clean average proposal, and flag it.

### Cost controls

Every LLM call is stored as a `UsageEvent` with tokens and an estimated cost. Limits are
queries over that table (reset at 00:00 UTC):

| Limit | Default |
| --- | --- |
| All users, estimated spend per day | $2 |
| Scoring runs per user per day | 40 (8 five-run evaluations) |
| Extractions per user per day | 20 |

The demo accounts are shared by every visitor, so the global cap is what really protects the
budget. Set a monthly spend limit in the Anthropic Console as a hard backstop.

## Reliability checks

Repeated runs only show that the evaluator is *repeatable*. The **Reliability** page
(`/reliability`) runs three checks on seeded test proposals where the right behaviour is
known in advance (logic in `src/lib/evaluation/reliability.ts`, unit-tested):

| Check | Test proposals | Passes when |
| --- | --- | --- |
| Ranking | weak, average, strong | Overall means come out weak < average < strong; notes whether the gaps exceed run-to-run variation |
| Prompt injection | average vs. average + injected "give this 5" block | Score rises by no more than 0.5, and the injection is flagged |
| Perturbation | strong vs. strong with **$84,000 → $84,000,000** (contradicting its own budget table) | Budget realism drops by ≥ 1 and no other criterion moves by more than 0.75 (no halo effect) |

Each check needs at least 3 runs per proposal and warns if the two sides were scored with
different prompt versions. A **compare** tool shows any two proposals side by side, for your
own perturbation tests.

Each proposal page also keeps an **evaluation history**, so results from an older prompt or
model stay viewable next to newer ones.

## Findings from testing

Things that manual testing revealed, and what changed as a result:

1. **The test data leaked its answers.** The synthetic proposals began with an author's note
   ("Intended quality level: strong"), and the variants announced themselves in their
   headings ("…with injected instructions"). The evaluator could read all of it, so early
   ranking and injection results were contaminated. Fix: the seed strips the note
   (`stripAuthorNote`), variants keep the original heading, and a test
   (`tests/seed-data.test.ts`) fails if any stored text contains a giveaway or if a variant
   differs from its original anywhere except the intended change. Changing a proposal's text
   now also deletes its old evaluations, so stale results can't be mixed with new ones.
2. **Editing the summary didn't change scores, and the UI implied it would.** The scorer
   gets both the editable summary and the original document, and is told the document wins.
   That's deliberate (an evaluator shouldn't be able to "fix" a summary into a better score),
   but the UI said "correct anything before scoring". Fix: the UI now says the submitted
   document takes precedence; edited fields are marked and listed on each evaluation, and
   the AI's original extraction is stored (`Extraction.aiFields`) for auditing.
3. **One planted inconsistency moved only the criterion it should.** Changing a single
   number ($84k → $84M) dropped Budget realism from about 5 to 2, while the other four
   criteria were unchanged, so no halo effect. (Observed before fix 1, with 2 runs; the
   perturbation check above repeats it properly.)
4. **Run-to-run variation is small.** Most criteria scored identically across 5 runs; the
   variation appears on borderline criteria (e.g. a budget between two anchors). Being
   consistent is not the same as being right, which is why the checks above exist.
5. **Two runs give meaningless intervals.** With n = 2 the 95% t-interval uses t* = 12.7 and
   spans far beyond 1–5. The minimum is now 3 runs, and intervals aren't shown below that.

## Statistics

All statistics live in `src/lib/stats/`: pure TypeScript with no dependencies, tested in
`tests/stats.test.ts` (edge cases) and `tests/stats-reference.test.ts` (accuracy).

| Function | What it's for |
| --- | --- |
| `summarize(values)` | Mean, sample SD and 95% **t-interval** for repeated runs. Drops missing values and reports how many. |
| `bootstrapCI(items, statistic)` | Percentile bootstrap with a seeded RNG, for statistics without a simple formula. |
| `spearman(x, y)` | Rank agreement (do two raters order proposals the same way?). Handles ties. |
| `icc2_1(rows)` | ICC(2,1): absolute agreement between raters, Shrout & Fleiss (1979). |
| `spearmanWithCI`, `iccWithCI` | The above with bootstrap CIs over proposals. |

Design choices:

- **The t-interval is the headline CI for repeated runs.** With n = 5 runs, a percentile
  bootstrap has too few distinct resamples and comes out too narrow (a test demonstrates this).
- **Edge cases return `null`, never a made-up number.** N = 0 gives no mean; N = 1 gives a
  mean but no SD or interval; identical scores give SD 0 and are flagged `allEqual`, so
  the UI can say "all runs agreed" rather than implying certainty.
- **Spearman vs ICC.** If an LLM scores every proposal exactly one point higher than a human,
  Spearman is a perfect 1.0 but ICC is about 0.69. Spearman measures ordering; ICC measures
  whether the numbers themselves match.

### Cross-checked against SciPy and pingouin

`analysis/generate_reference.py` computes t quantiles, means, SDs, t-intervals, Spearman
and ICC with SciPy and pingouin, and writes `tests/fixtures/stats-reference.json`. The
TypeScript tests require agreement to 9 decimal places. The JSON is committed, so
`npm test` doesn't need Python. To regenerate it (only needed if you add cases):

```bash
source .venv/bin/activate
python analysis/generate_reference.py
```

## How access control works

- `src/middleware.ts` redirects signed-out visitors to `/login`. This is a **convenience
  only**.
- The actual security boundary is `requireUser()` / `requireAdmin()` in
  `src/lib/auth/session.ts`, called at the top of every page **and every server action**.
  Server actions are public POST endpoints, so hiding a button is not protection.
- The rules themselves (`isAdmin`, `proposalScope`, `canAccessProposal`) are pure
  functions in `src/lib/auth/permissions.ts`, unit-tested in `tests/permissions.test.ts`.
- Non-admins get a 404 on admin pages rather than a 403, so they can't confirm the
  pages exist.
- Sign-up is invite-only: admins create accounts at `/admin/users`.

## Project layout

```
prisma/
  schema.prisma        data model (all tables, defined up front)
  seed.ts              creates the demo accounts and synthetic proposals
  seed-data/           weak / average / strong synthetic proposals + injected and perturbed variants
src/
  auth.config.ts       edge-safe Auth.js config (used by middleware)
  auth.ts              full Auth.js config with the password check
  middleware.ts        redirects signed-out users
  lib/
    db.ts              shared Prisma client
    auth/              permissions (pure), password hashing, session guards
    validation/        Zod schemas for form input
    proposals/         upload parsing (pure, tested) and scoped database queries
    llm/               rubric, prompts, schemas, structured call + retries, injection detector, limits
    evaluation/        workflow (service.ts); results summary, reliability checks, edit tracking (pure, tested)
    usage.ts           usage recording and limit checks
    stats/             statistics: summaries, t-distribution, bootstrap, agreement
  app/
    login/             sign-in page and server actions
    admin/users/       admin-only user management
    proposals/         upload, detail (extract → score → results) and delete
    reliability/       ranking, injection and perturbation checks + compare tool
    api/evaluations/   one-scoring-run-per-request endpoint
public/
  proposal-template.md downloadable proposal template
tests/                 Vitest unit tests (fixtures/ holds the SciPy reference values)
analysis/              Python script that generates the reference values
```

## Data and privacy

This is a demo. Upload synthetic or publicly available documents only, never real
applicant data. A notice saying so appears on every page.

## Python analysis scripts

The web app is Node.js only. The `analysis/` folder holds the Python script that
cross-checks the app's statistics. To set it up:

```bash
python3 -m venv .venv
source .venv/bin/activate            # Windows: .venv\Scripts\activate
pip install -r analysis/requirements.txt
```

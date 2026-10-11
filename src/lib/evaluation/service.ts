import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { canAccessProposal, type SessionUser } from "@/lib/auth/permissions";
import { getProposal } from "@/lib/proposals/queries";
import { callStructured, LlmError, toLlmError } from "@/lib/llm/call";
import { getMessagesApi } from "@/lib/llm/client";
import { MODELS, RUNS } from "@/lib/llm/config";
import {
  EXTRACTION_SYSTEM,
  PROMPT_VERSIONS,
  SCORING_SYSTEM,
  extractionUserPrompt,
  scoringUserPrompt,
} from "@/lib/llm/prompts";
import { CRITERION_KEYS, RUBRIC_VERSION, overallScore } from "@/lib/llm/rubric";
import {
  extractionJsonSchema,
  extractionSchema,
  scoringJsonSchema,
  scoringSchema,
  type Extraction,
} from "@/lib/llm/schemas";
import { LimitError, assertWithinLimits, recordUsage } from "@/lib/usage";

// The evaluation workflow. Server actions and the route handler are thin
// wrappers around these functions, which do the access checks, limit checks,
// LLM calls and database writes.

export type Outcome = { ok: true } | { ok: false; error: string };

/** Turns expected failures into messages for the user; rethrows real bugs. */
function failure(err: unknown): { ok: false; error: string } {
  if (err instanceof LimitError) return { ok: false, error: err.message };
  if (err instanceof LlmError) return { ok: false, error: err.userMessage };
  throw err;
}

/** Stored JSON is re-validated on read: never trust the shape of a JSON column. */
export function parseExtraction(json: unknown): Extraction | null {
  const r = extractionSchema.safeParse(json);
  return r.success ? r.data : null;
}

// ---------- Extraction ----------

export async function runExtraction(user: SessionUser, proposalId: string): Promise<Outcome> {
  const proposal = await getProposal(user, proposalId);
  if (!proposal) return { ok: false, error: "Proposal not found." };

  try {
    await assertWithinLimits(user.id, "extract", 1);
    const model = MODELS.extract;
    let result;
    try {
      result = await callStructured({
        api: getMessagesApi(),
        model,
        system: EXTRACTION_SYSTEM,
        user: extractionUserPrompt(proposal.sourceText),
        jsonSchema: extractionJsonSchema,
        schema: extractionSchema,
        maxTokens: 4000,
      });
    } catch (err) {
      const llmErr = toLlmError(err);
      // Failed calls still cost money, so they still count.
      if (llmErr.usage.inputTokens > 0) await recordUsage(user.id, "extract", model, llmErr.usage);
      throw llmErr;
    }
    await recordUsage(user.id, "extract", model, result.usage);

    await db.extraction.upsert({
      where: { proposalId },
      create: { proposalId, fields: result.data, model, userEdited: false },
      update: { fields: result.data, model, userEdited: false },
    });
    return { ok: true };
  } catch (err) {
    return failure(err);
  }
}

export async function saveExtraction(
  user: SessionUser,
  proposalId: string,
  fields: unknown,
): Promise<Outcome> {
  const proposal = await getProposal(user, proposalId);
  if (!proposal) return { ok: false, error: "Proposal not found." };
  const parsed = extractionSchema.safeParse(fields);
  if (!parsed.success) {
    return { ok: false, error: "Each field must be 1,500 characters or fewer." };
  }
  const updated = await db.extraction.updateMany({
    where: { proposalId },
    data: { fields: parsed.data, userEdited: true },
  });
  if (updated.count === 0) return { ok: false, error: "Run extraction before editing." };
  return { ok: true };
}

// ---------- Evaluation ----------

export async function startEvaluation(
  user: SessionUser,
  proposalId: string,
  runsRequested: number,
): Promise<{ ok: true; evaluationId: string } | { ok: false; error: string }> {
  if (!Number.isInteger(runsRequested) || runsRequested < RUNS.min || runsRequested > RUNS.max) {
    return { ok: false, error: `Choose between ${RUNS.min} and ${RUNS.max} runs.` };
  }
  const proposal = await getProposal(user, proposalId);
  if (!proposal) return { ok: false, error: "Proposal not found." };

  const extraction = await db.extraction.findUnique({ where: { proposalId } });
  const snapshot = extraction && parseExtraction(extraction.fields);
  if (!snapshot) return { ok: false, error: "Extract and check the summary before evaluating." };

  const running = await db.evaluation.findFirst({ where: { proposalId, status: "RUNNING" } });
  if (running) return { ok: false, error: "An evaluation is already running for this proposal." };

  try {
    // Check the whole evaluation fits in today's limits before starting it.
    await assertWithinLimits(user.id, "score", runsRequested);
  } catch (err) {
    return failure(err);
  }

  const evaluation = await db.evaluation.create({
    data: {
      proposalId,
      status: "RUNNING",
      runsRequested,
      model: MODELS.score,
      promptVersion: PROMPT_VERSIONS.score,
      rubricVersion: RUBRIC_VERSION,
      extractionSnapshot: snapshot,
    },
    select: { id: true },
  });
  return { ok: true, evaluationId: evaluation.id };
}

export interface RunProgress {
  status: "RUNNING" | "COMPLETE" | "FAILED";
  completed: number;
  requested: number;
  error?: string | null;
}

/**
 * Performs the next scoring run of an evaluation, one LLM call per request.
 *
 * Why one run per request? Each call takes 10–30 s. Five in one request could
 * exceed the hosting platform's time limit, and the user would see nothing
 * until the end. One per request stays well under the limit, and the browser
 * can show progress after each run.
 */
export async function runNextScoring(user: SessionUser, evaluationId: string): Promise<RunProgress | null> {
  const ev = await db.evaluation.findUnique({
    where: { id: evaluationId },
    include: {
      proposal: { select: { ownerId: true, sourceText: true } },
      _count: { select: { runs: true } },
    },
  });
  if (!ev || !canAccessProposal(user, ev.proposal)) return null; // caller returns 404

  const progress = (status: RunProgress["status"], completed: number, error?: string | null) => ({
    status,
    completed,
    requested: ev.runsRequested,
    error,
  });
  const fail = async (completed: number, error: string) => {
    await db.evaluation.update({ where: { id: ev.id }, data: { status: "FAILED", error } });
    return progress("FAILED", completed, error);
  };

  if (ev.status !== "RUNNING") return progress(ev.status, ev._count.runs, ev.error);

  const runIndex = ev._count.runs;
  if (runIndex >= ev.runsRequested) {
    await db.evaluation.update({ where: { id: ev.id }, data: { status: "COMPLETE" } });
    return progress("COMPLETE", runIndex);
  }

  const snapshot = parseExtraction(ev.extractionSnapshot);
  if (!snapshot) return fail(runIndex, "The saved summary for this evaluation is invalid.");

  try {
    await assertWithinLimits(user.id, "score", 1);
  } catch (err) {
    if (err instanceof LimitError) return fail(runIndex, err.message);
    throw err;
  }

  let result;
  try {
    result = await callStructured({
      api: getMessagesApi(),
      model: ev.model,
      system: SCORING_SYSTEM,
      user: scoringUserPrompt(ev.proposal.sourceText, snapshot),
      jsonSchema: scoringJsonSchema,
      schema: scoringSchema,
      maxTokens: 3000,
    });
  } catch (err) {
    const llmErr = toLlmError(err);
    if (llmErr.usage.inputTokens > 0) await recordUsage(user.id, "score", ev.model, llmErr.usage);
    // Runs already completed are kept; the results page shows "n = 3 of 5".
    return fail(runIndex, llmErr.userMessage);
  }
  await recordUsage(user.id, "score", ev.model, result.usage);

  const { scores, injection_suspected } = result.data;
  const numeric = Object.fromEntries(CRITERION_KEYS.map((k) => [k, scores[k].score])) as Record<
    (typeof CRITERION_KEYS)[number],
    number
  >;

  try {
    await db.evalRun.create({
      data: {
        evaluationId: ev.id,
        runIndex,
        overall: overallScore(numeric),
        injectionFlag: injection_suspected,
        scores: {
          create: CRITERION_KEYS.map((k) => ({
            criterion: k,
            score: scores[k].score,
            justification: scores[k].justification,
          })),
        },
      },
    });
  } catch (err) {
    // P2002: a duplicate request (double click, retry) already stored this run.
    // The unique constraint on (evaluationId, runIndex) makes that harmless.
    if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002")) throw err;
  }

  const completed = runIndex + 1;
  if (completed >= ev.runsRequested) {
    await db.evaluation.update({ where: { id: ev.id }, data: { status: "COMPLETE" } });
    return progress("COMPLETE", completed);
  }
  return progress("RUNNING", completed);
}

/** The most recent evaluation of a proposal, with all runs and scores. */
export function getLatestEvaluation(proposalId: string) {
  return db.evaluation.findFirst({
    where: { proposalId },
    orderBy: { createdAt: "desc" },
    include: {
      runs: { orderBy: { runIndex: "asc" }, include: { scores: true } },
    },
  });
}

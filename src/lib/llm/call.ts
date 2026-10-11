import Anthropic from "@anthropic-ai/sdk";
import type { z } from "zod";

// One function for every LLM call in the app:
//   send prompt → constrain output to a JSON schema → validate with Zod
//   → if invalid, retry once with the validation error → typed result or LlmError.
//
// The Messages API client is passed in rather than imported, so tests can pass a
// fake one and exercise the retry logic without network calls or API spend.

export interface MessagesApi {
  create(params: Anthropic.MessageCreateParamsNonStreaming): PromiseLike<Anthropic.Message>;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

export type LlmErrorKind = "not_configured" | "rate_limited" | "unavailable" | "refused" | "invalid_output" | "api";

export class LlmError extends Error {
  constructor(
    public readonly kind: LlmErrorKind,
    /** Safe to show to users: no keys, no raw API responses. */
    public readonly userMessage: string,
    /** Tokens already spent before failing; still counts toward the budget. */
    public readonly usage: TokenUsage = { inputTokens: 0, outputTokens: 0 },
    options?: { cause?: unknown },
  ) {
    super(userMessage, options);
    this.name = "LlmError";
  }
}

/** Translates SDK errors into a small set of cases the UI knows how to explain. */
export function toLlmError(err: unknown, usage?: TokenUsage): LlmError {
  if (err instanceof LlmError) return err;
  if (err instanceof Anthropic.APIError) {
    const status = err.status ?? 0;
    if (status === 401 || status === 403) {
      return new LlmError("not_configured", "The AI service rejected the API key. Check ANTHROPIC_API_KEY.", usage, { cause: err });
    }
    if (status === 429) {
      return new LlmError("rate_limited", "The AI service is rate-limiting requests. Try again in a minute.", usage, { cause: err });
    }
    if (status >= 500 || status === 0) {
      return new LlmError("unavailable", "The AI service is temporarily unavailable. Try again shortly.", usage, { cause: err });
    }
    return new LlmError("api", `The AI request failed (HTTP ${status}).`, usage, { cause: err });
  }
  return new LlmError("api", "The AI request failed unexpectedly.", usage, { cause: err });
}

export interface StructuredCall<T> {
  api: MessagesApi;
  model: string;
  system: string;
  user: string;
  jsonSchema: Record<string, unknown>;
  schema: z.ZodType<T>;
  maxTokens: number;
  maxAttempts?: number;
}

export interface StructuredResult<T> {
  data: T;
  usage: TokenUsage;
  attempts: number;
}

function describeZodError(error: z.ZodError): string {
  return error.issues
    .slice(0, 5)
    .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
    .join("; ");
}

export async function callStructured<T>({
  api,
  model,
  system,
  user,
  jsonSchema,
  schema,
  maxTokens,
  maxAttempts = 2,
}: StructuredCall<T>): Promise<StructuredResult<T>> {
  const usage: TokenUsage = { inputTokens: 0, outputTokens: 0 };
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: user }];
  let lastProblem = "";

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let response: Anthropic.Message;
    try {
      // (The SDK itself already retries network errors, 429s and 5xx responses
      // with backoff; this loop only handles output that fails validation.)
      response = await api.create({
        model,
        max_tokens: maxTokens,
        system,
        messages,
        output_config: { format: { type: "json_schema", schema: jsonSchema } },
      });
    } catch (err) {
      throw toLlmError(err, usage);
    }

    usage.inputTokens += response.usage.input_tokens;
    usage.outputTokens += response.usage.output_tokens;

    if (response.stop_reason === "refusal") {
      throw new LlmError("refused", "The AI model declined to process this document.", usage);
    }

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");

    try {
      const parsed = schema.safeParse(JSON.parse(text));
      if (parsed.success) return { data: parsed.data, usage, attempts: attempt };
      lastProblem = describeZodError(parsed.error);
    } catch {
      lastProblem = "the response was not valid JSON";
    }
    if (response.stop_reason === "max_tokens") {
      lastProblem += " (the response was cut off at the length limit; be more concise)";
    }

    // Show the model its own output and what was wrong, then ask again.
    messages.push(
      { role: "assistant", content: text || "(empty)" },
      {
        role: "user",
        content: `That output failed validation: ${lastProblem}. Return the complete JSON again with this fixed.`,
      },
    );
  }

  throw new LlmError(
    "invalid_output",
    `The AI returned output in the wrong format ${maxAttempts} times. Try again.`,
    usage,
  );
}

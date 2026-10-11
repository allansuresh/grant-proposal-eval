import { z } from "zod";
import { CRITERIA, CRITERION_KEYS } from "./rubric";
import { EXTRACTION_FIELDS, type ExtractionKey } from "./fields";

export { EXTRACTION_FIELDS, type ExtractionKey };

// Each LLM output has two schemas:
//
// 1. A JSON Schema sent to the API (structured outputs). The model is constrained
//    to produce JSON of this shape. The API only supports a subset of JSON Schema:
//    no min/max on numbers or string lengths, for example.
// 2. A Zod schema we validate the response with. It enforces the rules the API
//    can't (lengths, score range), and gives us TypeScript types.
//
// Validating again even with structured outputs is defence in depth: a refusal
// or a max_tokens cut-off can still return output that doesn't match.

// ---------- Extraction ----------

const MAX_FIELD_CHARS = 1500;
const fieldSchema = z.string().trim().max(MAX_FIELD_CHARS).nullable();

export const extractionSchema = z.object(
  Object.fromEntries(EXTRACTION_FIELDS.map((f) => [f.key, fieldSchema])) as Record<
    ExtractionKey,
    typeof fieldSchema
  >,
);
export type Extraction = z.infer<typeof extractionSchema>;

// 14 nullable fields = 14 union types. The API allows at most 16 per request,
// so adding more than 2 fields here would need a different shape.
const nullableString = { anyOf: [{ type: "string" }, { type: "null" }] };

export const extractionJsonSchema = {
  type: "object",
  properties: Object.fromEntries(EXTRACTION_FIELDS.map((f) => [f.key, nullableString])),
  required: EXTRACTION_FIELDS.map((f) => f.key),
  additionalProperties: false,
};

// ---------- Scoring ----------

const criterionScoreSchema = z.object({
  score: z.number().int().min(1).max(5),
  justification: z.string().trim().min(1).max(800),
});

export const scoringSchema = z.object({
  scores: z.object(
    Object.fromEntries(CRITERION_KEYS.map((k) => [k, criterionScoreSchema])) as Record<
      (typeof CRITERION_KEYS)[number],
      typeof criterionScoreSchema
    >,
  ),
  injection_suspected: z.boolean(),
});
export type Scoring = z.infer<typeof scoringSchema>;

export const scoringJsonSchema = {
  type: "object",
  properties: {
    scores: {
      type: "object",
      properties: Object.fromEntries(
        CRITERIA.map((c) => [
          c.key,
          {
            type: "object",
            properties: {
              // An enum instead of minimum/maximum, which the API doesn't support.
              score: { type: "integer", enum: [1, 2, 3, 4, 5] },
              justification: { type: "string" },
            },
            required: ["score", "justification"],
            additionalProperties: false,
          },
        ]),
      ),
      required: [...CRITERION_KEYS],
      additionalProperties: false,
    },
    injection_suspected: { type: "boolean" },
  },
  required: ["scores", "injection_suspected"],
  additionalProperties: false,
};

import { EXTRACTION_FIELDS, type ExtractionKey } from "@/lib/llm/fields";

type Fields = Partial<Record<ExtractionKey, string | null>>;

const norm = (v: string | null | undefined) => (v ?? "").trim();

/**
 * Which fields a human changed from the AI's extraction.
 * Returns [] when there's no AI version to compare against (older records).
 */
export function editedFieldKeys(current: Fields | null, ai: Fields | null): ExtractionKey[] {
  if (!current || !ai) return [];
  return EXTRACTION_FIELDS.map((f) => f.key).filter((k) => norm(current[k]) !== norm(ai[k]));
}

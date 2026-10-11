// Turns an uploaded file into plain text we can store and send to the LLM.
//
// Everything here treats the file as hostile: we check the size before reading,
// check the type by content (not just the file name), cap page and character
// counts, and return a clear message for every way it can fail.
import { extractText, getDocumentProxy } from "unpdf";

export const LIMITS = {
  maxTextFileBytes: 200 * 1024, // 200 KB is far more than any text proposal needs
  maxPdfBytes: 3 * 1024 * 1024, // 3 MB
  maxPdfPages: 30,
  minChars: 200, // shorter than this is not a proposal (or a scanned PDF)
  maxChars: 60_000, // ≈15k tokens: caps the cost of every LLM call on this text
  maxTitleChars: 200,
} as const;

export type SourceType = "markdown" | "text" | "pdf";

export type ParseResult =
  | { ok: true; text: string; title: string; sourceType: SourceType }
  | { ok: false; error: string };

const EXTENSIONS: Record<string, SourceType> = {
  ".md": "markdown",
  ".markdown": "markdown",
  ".txt": "text",
  ".pdf": "pdf",
};

export function detectSourceType(fileName: string): SourceType | null {
  const dot = fileName.lastIndexOf(".");
  if (dot === -1) return null;
  return EXTENSIONS[fileName.slice(dot).toLowerCase()] ?? null;
}

/** Every real PDF starts with the bytes "%PDF-". A renamed .exe or .docx does not. */
export function looksLikePdf(bytes: Uint8Array): boolean {
  const header = [0x25, 0x50, 0x44, 0x46, 0x2d]; // %PDF-
  return header.every((b, i) => bytes[i] === b);
}

/**
 * Normalise text before storing it:
 * - NUL characters are removed (Postgres text columns reject them)
 * - Windows line endings become \n
 * - runs of 3+ blank lines collapse to one blank line
 */
export function normaliseText(raw: string): string {
  return raw
    .replace(/\u0000/g, "")
    .replace(/\r\n?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * A title from the opening lines of plain text.
 *
 * PDFs lose headings, and a long title set in a large font wraps over several
 * short lines ("Solar Cold Rooms for Smallholder" / "Vegetable Farmers in the
 * Tarin" / "Valley"). So we join consecutive short lines, stopping at a long
 * (body-text) line, at sentence punctuation, or once the title would exceed 120
 * characters.
 */
export function titleFromOpeningLines(text: string): string | null {
  const lines = text.split("\n").map((l) => l.trim());
  const first = lines.findIndex((l) => l !== "");
  if (first === -1 || lines[first].length > 120) return null;

  let title = lines[first];
  for (let i = first + 1; i < lines.length && i <= first + 3; i++) {
    const next = lines[i];
    if (next === "" || /[.:;!?]$/.test(title) || next.length > 60) break;
    if (title.length + 1 + next.length > 120) break;
    title = `${title} ${next}`;
  }
  return title;
}

/** Title: first Markdown heading, else the opening lines, else the file name. */
export function deriveTitle(text: string, fileName: string): string {
  const heading = text.match(/^#\s+(.+)$/m)?.[1]?.trim();
  const fromFile = fileName.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ");
  return (heading || titleFromOpeningLines(text) || fromFile).slice(0, LIMITS.maxTitleChars);
}

function checkLength(text: string): string | null {
  if (text.length < LIMITS.minChars) {
    return `The document has too little text (${text.length} characters; at least ${LIMITS.minChars} needed).`;
  }
  if (text.length > LIMITS.maxChars) {
    return `The document is too long (${text.length.toLocaleString("en-US")} characters; the limit is ${LIMITS.maxChars.toLocaleString("en-US")}).`;
  }
  return null;
}

function decodeUtf8(bytes: Uint8Array): string | null {
  try {
    // fatal: true makes invalid UTF-8 throw instead of silently inserting "�"
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

async function extractPdfText(bytes: Uint8Array): Promise<
  { ok: true; text: string } | { ok: false; error: string }
> {
  let pdf;
  try {
    pdf = await getDocumentProxy(bytes);
  } catch {
    return { ok: false, error: "This PDF could not be opened. It may be damaged or password-protected." };
  }
  if (pdf.numPages > LIMITS.maxPdfPages) {
    return {
      ok: false,
      error: `The PDF has ${pdf.numPages} pages; the limit is ${LIMITS.maxPdfPages}.`,
    };
  }
  const { text } = await extractText(pdf, { mergePages: false });
  return { ok: true, text: text.join("\n\n") };
}

export async function parseUpload(fileName: string, bytes: Uint8Array): Promise<ParseResult> {
  const sourceType = detectSourceType(fileName);
  if (!sourceType) {
    return { ok: false, error: "Unsupported file type. Upload a .md, .txt or .pdf file." };
  }

  let raw: string;
  if (sourceType === "pdf") {
    if (bytes.byteLength > LIMITS.maxPdfBytes) {
      return { ok: false, error: "The PDF is larger than 3 MB." };
    }
    if (!looksLikePdf(bytes)) {
      return { ok: false, error: "This file is named .pdf but is not a PDF." };
    }
    const result = await extractPdfText(bytes);
    if (!result.ok) return result;
    raw = result.text;
  } else {
    if (bytes.byteLength > LIMITS.maxTextFileBytes) {
      return { ok: false, error: "Text files must be smaller than 200 KB." };
    }
    const decoded = decodeUtf8(bytes);
    if (decoded === null) {
      return { ok: false, error: "The file is not valid UTF-8 text. Save it as plain text and try again." };
    }
    raw = decoded;
  }

  const text = normaliseText(raw);

  // A PDF made from scanned images has pages but no text layer.
  if (sourceType === "pdf" && text.length < LIMITS.minChars) {
    return {
      ok: false,
      error:
        "This PDF has little or no selectable text. It is probably a scan; export it from the original document instead.",
    };
  }

  const lengthError = checkLength(text);
  if (lengthError) return { ok: false, error: lengthError };

  return { ok: true, text, sourceType, title: deriveTitle(text, fileName) };
}

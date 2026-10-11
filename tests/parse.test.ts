import { describe, expect, it } from "vitest";
import { PDFDocument, StandardFonts } from "pdf-lib";
import {
  LIMITS,
  deriveTitle,
  detectSourceType,
  looksLikePdf,
  normaliseText,
  parseUpload,
} from "@/lib/proposals/parse";

const enc = (s: string) => new TextEncoder().encode(s);
const body = "This is a sentence of proposal text. ".repeat(20); // ~740 chars

/** Builds a real PDF in memory, so the tests need no binary fixture files. */
async function makePdf(pages: string[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (const text of pages) {
    const page = doc.addPage();
    // Draw in short lines so text stays on the page.
    text.match(/.{1,80}/g)?.forEach((line, i) =>
      page.drawText(line, { x: 40, y: 750 - i * 14, font, size: 10 }),
    );
  }
  return doc.save();
}

describe("detectSourceType", () => {
  it("maps extensions case-insensitively", () => {
    expect(detectSourceType("a.MD")).toBe("markdown");
    expect(detectSourceType("a.txt")).toBe("text");
    expect(detectSourceType("report.final.PDF")).toBe("pdf");
  });
  it("rejects unknown or missing extensions", () => {
    expect(detectSourceType("a.docx")).toBeNull();
    expect(detectSourceType("README")).toBeNull();
  });
});

describe("helpers", () => {
  it("recognises the PDF header", () => {
    expect(looksLikePdf(enc("%PDF-1.7 ..."))).toBe(true);
    expect(looksLikePdf(enc("PK\u0003\u0004 a zip/docx"))).toBe(false);
    expect(looksLikePdf(new Uint8Array())).toBe(false);
  });

  it("normalises line endings, NUL bytes and blank lines", () => {
    expect(normaliseText("a\r\nb\u0000c\n\n\n\nd  ")).toBe("a\nbc\n\nd");
  });

  it("derives a title from a heading, a short first line, or the file name", () => {
    expect(deriveTitle("intro\n# Real Title\nbody", "x.md")).toBe("Real Title");
    expect(deriveTitle("Short first line\nbody", "x.txt")).toBe("Short first line");
    expect(deriveTitle("x".repeat(200), "my_great-proposal.txt")).toBe("my great proposal");
  });
});

describe("parseUpload: text files", () => {
  it("accepts a valid Markdown file", async () => {
    const r = await parseUpload("p.md", enc(`# Water Project\n\n${body}`));
    expect(r).toMatchObject({ ok: true, sourceType: "markdown", title: "Water Project" });
  });

  it("rejects unsupported types", async () => {
    const r = await parseUpload("p.docx", enc(body));
    expect(r.ok).toBe(false);
  });

  it("rejects files over the size limit before decoding", async () => {
    const r = await parseUpload("p.txt", new Uint8Array(LIMITS.maxTextFileBytes + 1));
    expect(r).toEqual({ ok: false, error: expect.stringContaining("200 KB") });
  });

  it("rejects invalid UTF-8", async () => {
    const r = await parseUpload("p.txt", new Uint8Array([0xff, 0xfe, 0x00, 0x41]));
    expect(r).toEqual({ ok: false, error: expect.stringContaining("UTF-8") });
  });

  it("rejects text that is too short", async () => {
    const r = await parseUpload("p.txt", enc("Too short."));
    expect(r).toEqual({ ok: false, error: expect.stringContaining("too little text") });
  });

  it("rejects text that is too long", async () => {
    const r = await parseUpload("p.txt", enc("a".repeat(LIMITS.maxChars + 1)));
    expect(r).toEqual({ ok: false, error: expect.stringContaining("too long") });
  });
});

describe("parseUpload: PDFs", () => {
  it("extracts text from every page", async () => {
    const pdf = await makePdf([`Page one. ${body}`, "Page two marker."]);
    const r = await parseUpload("p.pdf", pdf);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.sourceType).toBe("pdf");
      expect(r.text).toContain("Page one.");
      expect(r.text).toContain("Page two marker.");
    }
  });

  it("rejects a non-PDF renamed to .pdf", async () => {
    const r = await parseUpload("p.pdf", enc(body));
    expect(r).toEqual({ ok: false, error: expect.stringContaining("not a PDF") });
  });

  it("rejects a corrupt PDF with a clear message", async () => {
    const r = await parseUpload("p.pdf", enc("%PDF-1.7 this is not really a pdf"));
    expect(r).toEqual({ ok: false, error: expect.stringContaining("could not be opened") });
  });

  it("explains that a PDF with no text layer is probably a scan", async () => {
    const r = await parseUpload("p.pdf", await makePdf(["", ""]));
    expect(r).toEqual({ ok: false, error: expect.stringContaining("probably a scan") });
  });

  it("rejects PDFs with too many pages", async () => {
    const pages = Array.from({ length: LIMITS.maxPdfPages + 1 }, () => "x");
    const r = await parseUpload("p.pdf", await makePdf(pages));
    expect(r).toEqual({ ok: false, error: expect.stringContaining("pages") });
  });
});

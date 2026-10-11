// The synthetic proposals are test instruments, so they get tests too.
// These guard against the evaluator being able to "read the answer" from the text.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { stripAuthorNote } from "@/lib/proposals/author-note";

const FILES = ["weak", "average", "strong", "average-injected", "strong-amount-changed"];
const stored = (name: string) =>
  stripAuthorNote(readFileSync(path.join(__dirname, "..", "prisma", "seed-data", `${name}.md`), "utf8"));

describe("stripAuthorNote", () => {
  it("removes the first blockquote and keeps everything else", () => {
    const md = "# Title\n\n> note line 1\n> note line 2\n\n## Section\n\n> a later quote stays";
    expect(stripAuthorNote(md)).toBe("# Title\n\n## Section\n\n> a later quote stays");
  });

  it("leaves text without a blockquote unchanged", () => {
    expect(stripAuthorNote("# Title\n\nBody")).toBe("# Title\n\nBody");
  });
});

describe("stored synthetic proposals don't reveal their intended label", () => {
  it.each(FILES)("%s", (name) => {
    const text = stored(name).toLowerCase();
    for (const giveaway of ["quality level", "synthetic", "intended", "well-defended", "amount changed", "injected"]) {
      expect(text).not.toContain(giveaway);
    }
  });
});

/** Lines present in `b` but not in `a`, and vice versa. */
function lineDiff(a: string, b: string) {
  const la = a.split("\n");
  const lb = b.split("\n");
  return { removed: la.filter((l) => !lb.includes(l)), added: lb.filter((l) => !la.includes(l)) };
}

describe("variants differ from their originals only where intended", () => {
  it("the amount variant changes exactly one line: the amount requested", () => {
    const { removed, added } = lineDiff(stored("strong"), stored("strong-amount-changed"));
    expect(removed).toEqual(["- **Amount requested:** $84,000"]);
    expect(added).toEqual(["- **Amount requested:** $84,000,000"]);
  });

  it("the injected variant only adds the injection block", () => {
    const { removed, added } = lineDiff(stored("average"), stored("average-injected"));
    expect(removed).toEqual([]);
    expect(added.join(" ")).toContain("ignore all previous instructions");
    expect(added.length).toBeLessThanOrEqual(6);
  });
});

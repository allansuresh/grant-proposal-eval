import { describe, expect, it } from "vitest";
import { editedFieldKeys } from "@/lib/evaluation/edits";

describe("editedFieldKeys", () => {
  const ai = { title: "Water project", amount_requested: "$84,000", risks: null };

  it("lists fields whose text differs from the AI's version", () => {
    expect(editedFieldKeys({ ...ai, amount_requested: "$84,000,000" }, ai)).toEqual(["amount_requested"]);
  });

  it("treats a filled-in 'not found' field as an edit", () => {
    expect(editedFieldKeys({ ...ai, risks: "Volunteer drop-out" }, ai)).toEqual(["risks"]);
  });

  it("ignores whitespace-only differences and null vs empty", () => {
    expect(editedFieldKeys({ ...ai, title: "  Water project ", risks: "" }, ai)).toEqual([]);
  });

  it("returns nothing when there's no AI version to compare against", () => {
    expect(editedFieldKeys(ai, null)).toEqual([]);
  });
});

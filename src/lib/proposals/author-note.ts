// The seeded synthetic proposals start with an author's note for humans, e.g.
//
//   > Synthetic proposal ... Intended quality level: **strong**.
//
// That note must NOT reach the evaluator: a model that reads "intended quality
// level: weak" can score the label instead of the proposal, which would make the
// ranking and injection checks meaningless. So the seed strips it before storing.

/** Removes the first Markdown blockquote (consecutive lines starting with ">"). */
export function stripAuthorNote(markdown: string): string {
  const lines = markdown.split("\n");
  const start = lines.findIndex((l) => l.trimStart().startsWith(">"));
  if (start === -1) return markdown;
  let end = start;
  while (end < lines.length && lines[end].trimStart().startsWith(">")) end++;
  lines.splice(start, end - start);
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

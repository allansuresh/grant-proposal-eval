// Prompt-injection defence, layer 3: a cheap pattern check.
//
// This doesn't block anything; it flags the result so a human knows to look
// closely. Regexes are easy to evade, so they're one signal among several:
// (1) delimiting + instructions in the prompt, (2) a fixed output schema the
// document can't add fields to, (3) this detector, (4) the model's own
// injection_suspected flag, and (5) adversarial test cases.

const PATTERNS: { name: string; regex: RegExp }[] = [
  {
    name: "ignore instructions",
    regex: /\b(ignore|disregard|forget)\b[^.\n]{0,40}\b(previous|prior|above|earlier|all|your|the)\b[^.\n]{0,20}\b(instructions?|prompts?|rules?|rubric|criteria)\b/i,
  },
  {
    name: "dictates a score",
    regex: /\b(give|assign|award|rate|score|mark)\b[^.\n]{0,40}\b(perfect|maximum|max|highest|top|full)\b[^.\n]{0,15}\b(score|marks?|rating|points?)\b/i,
  },
  {
    name: "dictates a number",
    regex: /\b(score|rate|grade)\b[^.\n]{0,30}\b(5\s*\/\s*5|5 out of 5|10\s*\/\s*10|a 5|as 5|5 on (every|all|each))\b/i,
  },
  {
    name: "addresses the AI",
    regex: /\b(as an ai|you are (now )?(an? |the )?(ai|assistant|language model|llm|evaluator|reviewer)|note to (the )?(ai|llm|model|evaluator|reviewer)|attention (ai|llm|model|evaluator))\b/i,
  },
  {
    name: "fake system message",
    regex: /(<\s*\/?\s*(system|assistant|instructions?)\s*>|\[\s*system\s*\]|\bsystem prompt\b|\bnew instructions\b)/i,
  },
];

export interface InjectionMatch {
  pattern: string;
  excerpt: string;
}

export function detectInjection(text: string): InjectionMatch[] {
  const matches: InjectionMatch[] = [];
  for (const { name, regex } of PATTERNS) {
    const m = regex.exec(text);
    if (m) {
      const start = Math.max(0, m.index - 30);
      const excerpt = text.slice(start, m.index + m[0].length + 30).replace(/\s+/g, " ").trim();
      matches.push({ pattern: name, excerpt });
    }
  }
  return matches;
}

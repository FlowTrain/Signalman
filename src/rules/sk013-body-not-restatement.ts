import { ruleOption } from "../config.js";
import { cosine, type Vector } from "../text/tfidf.js";
import { tokenize } from "../text/tokenize.js";
import { frontmatterString, frontmatterUsable } from "./helpers.js";
import type { FileRule } from "./types.js";

// SK013 — if the body is just the description restated, the skill carries no
// actual instruction: once loaded, the agent learns nothing it didn't already
// have from the trigger text. High lexical similarity flags that.
export const sk013BodyNotRestatement: FileRule = {
  id: "SK013",
  name: "body-not-a-restatement",
  severity: "warn",
  scope: "file",
  docs: "sk013",
  check(ctx) {
    if (!frontmatterUsable(ctx)) return [];
    const desc = frontmatterString(ctx, "description");
    if (!desc) return [];
    const body = ctx.parsed.body;
    if (body.trim() === "") return []; // SK012 owns an empty body

    const threshold = ruleOption(ctx.config, "SK013", "threshold", 0.9);
    const similarity = cosine(termFrequency(desc), termFrequency(body));
    if (similarity < threshold) return [];

    return [
      {
        file: ctx.skill.filePath,
        message: `The body is ${Math.round(similarity * 100)}% lexically identical to the description, so it adds no instruction beyond restating the trigger.`,
        suggestion:
          "Put the actual steps, examples, and edge cases in the body — the content the agent " +
          "needs after the skill loads, not a paraphrase of the description.",
      },
    ];
  },
};

function termFrequency(text: string): Vector {
  const tf: Vector = new Map();
  for (const t of tokenize(text)) tf.set(t, (tf.get(t) ?? 0) + 1);
  return tf;
}

import { tokenize } from "../text/tokenize.js";
import { CAPABILITY_TOKENS, frontmatterString, frontmatterUsable } from "./helpers.js";
import type { FileRule } from "./types.js";

// SK010 — declaring negative scope ("Do NOT use for …") is a strong signal that
// sharpens when NOT to select a skill. Its absence is not a defect, so this is
// only info, and only nudges descriptions that already have real content (an
// empty or generic description has bigger problems, owned by SK006/SK009).
const NEGATIVE_SCOPE = /\b(do not use|do not|don['’]?t|not for|not intended|never use|avoid using|not when)\b/i;

export const sk010NegativeScope: FileRule = {
  id: "SK010",
  name: "description-declares-negative-scope",
  severity: "info",
  scope: "file",
  docs: "sk010",
  check(ctx) {
    if (!frontmatterUsable(ctx)) return [];
    const desc = frontmatterString(ctx, "description");
    if (!desc) return [];
    if (NEGATIVE_SCOPE.test(desc)) return []; // already declares negative scope

    const terms = tokenize(desc).filter((t) => !CAPABILITY_TOKENS.has(t));
    if (terms.length === 0) return []; // no real content to build on yet

    return [
      {
        file: ctx.skill.filePath,
        message:
          "The description doesn't declare negative scope. Saying what a skill is NOT for is a " +
          "strong signal that keeps it from being selected for adjacent tasks.",
        suggestion:
          'Consider adding a clause like "Do NOT use for …" naming a related task this skill ' +
          "should not handle.",
      },
    ];
  },
};

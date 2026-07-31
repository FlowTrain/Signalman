import { frontmatterString, frontmatterUsable } from "./helpers.js";
import type { FileRule } from "./types.js";

// SK011 — a description that mixes second person ("you") and third person ("the
// user") reads inconsistently. A smell, not a failure, so info only.
const SECOND_PERSON = /\b(you|your|yours)\b/i;
const THIRD_PERSON = /\b(the user|users|they|them|their|the request)\b/i;

export const sk011Voice: FileRule = {
  id: "SK011",
  name: "description-consistent-voice",
  severity: "info",
  scope: "file",
  docs: "sk011",
  check(ctx) {
    if (!frontmatterUsable(ctx)) return [];
    const desc = frontmatterString(ctx, "description");
    if (!desc) return [];
    if (!(SECOND_PERSON.test(desc) && THIRD_PERSON.test(desc))) return [];

    return [
      {
        file: ctx.skill.filePath,
        message:
          "The description mixes second person (“you”) and third person (“the user”), which " +
          "reads inconsistently.",
        suggestion: 'Pick one voice — usually third person, e.g. "Use when the user …".',
      },
    ];
  },
};

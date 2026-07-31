import { frontmatterString, frontmatterUsable } from "./helpers.js";
import type { FileRule } from "./types.js";

// SK006 — the headline failure. The description is the ONLY thing an agent
// matches a request against; with none, the skill is never selected, and the
// symptom looks like the model being bad at the task rather than a missing field.
export const sk006DescriptionPresent: FileRule = {
  id: "SK006",
  name: "description-present",
  severity: "error",
  scope: "file",
  docs: "sk006",
  check(ctx) {
    if (!frontmatterUsable(ctx)) return []; // SK002 owns unreadable frontmatter
    if (frontmatterString(ctx, "description")) return [];
    return [
      {
        file: ctx.skill.filePath,
        message:
          "Frontmatter has no 'description'. The description is the only text an agent " +
          "matches against, so this skill can never be selected.",
        suggestion:
          'Add a description that says when to use the skill, e.g. "Use when the user ' +
          'wants to …".',
      },
    ];
  },
};

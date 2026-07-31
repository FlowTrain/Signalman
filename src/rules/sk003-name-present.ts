import { frontmatterString, frontmatterUsable } from "./helpers.js";
import type { FileRule } from "./types.js";

// SK003 — a skill needs a `name`. Without one it can't be invoked directly and
// some agents won't register it at all.
export const sk003NamePresent: FileRule = {
  id: "SK003",
  name: "name-present",
  severity: "error",
  scope: "file",
  docs: "sk003",
  check(ctx) {
    if (!frontmatterUsable(ctx)) return []; // SK002 owns unreadable frontmatter
    if (frontmatterString(ctx, "name")) return [];
    return [
      {
        file: ctx.skill.filePath,
        message: "Frontmatter has no 'name'.",
        suggestion: `Add 'name: ${ctx.skill.dirName}' to the frontmatter (it should match the directory).`,
      },
    ];
  },
};

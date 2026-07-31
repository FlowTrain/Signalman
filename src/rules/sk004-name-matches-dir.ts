import { frontmatterString, frontmatterUsable } from "./helpers.js";
import type { FileRule } from "./types.js";

// SK004 — the `name` should match the skill's directory. Several agents key
// discovery or the command name off the directory, so a mismatch can mean the
// skill is invoked under a name that doesn't exist in its own frontmatter.
export const sk004NameMatchesDir: FileRule = {
  id: "SK004",
  name: "name-matches-directory",
  severity: "warn",
  scope: "file",
  docs: "sk004",
  check(ctx) {
    if (!frontmatterUsable(ctx)) return [];
    const name = frontmatterString(ctx, "name");
    if (!name) return []; // SK003 owns a missing name
    if (name === ctx.skill.dirName) return [];
    return [
      {
        file: ctx.skill.filePath,
        message: `Frontmatter name '${name}' does not match the directory '${ctx.skill.dirName}'.`,
        suggestion: `Set the name to '${ctx.skill.dirName}', or rename the directory to '${name}', so the two agree.`,
      },
    ];
  },
};

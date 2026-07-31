import { frontmatterString, frontmatterUsable, slugify } from "./helpers.js";
import type { FileRule } from "./types.js";

// SK005 — names should be lowercase letters, digits, and single hyphens (the
// Agent Skills standard: 1-64 chars, no leading/trailing or consecutive hyphens).
// Capitals, underscores, and spaces are handled inconsistently across agents.
const VALID_NAME = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const sk005NameFormat: FileRule = {
  id: "SK005",
  name: "name-is-lowercase-hyphenated",
  severity: "warn",
  scope: "file",
  docs: "sk005",
  check(ctx) {
    if (!frontmatterUsable(ctx)) return [];
    const name = frontmatterString(ctx, "name");
    if (!name) return [];

    const problems: string[] = [];
    if (name.length > 64) problems.push("longer than 64 characters");
    if (!VALID_NAME.test(name)) {
      problems.push("not limited to lowercase letters, digits, and single hyphens");
    }
    if (problems.length === 0) return [];

    return [
      {
        file: ctx.skill.filePath,
        message: `Frontmatter name '${name}' is ${problems.join(" and ")}.`,
        suggestion: `Use a lowercase, hyphen-separated name such as '${slugify(name) || "my-skill"}'.`,
      },
    ];
  },
};

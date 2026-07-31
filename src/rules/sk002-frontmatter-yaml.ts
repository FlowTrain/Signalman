import type { FileRule } from "./types.js";

// SK002 — the frontmatter block must parse as a YAML mapping. If it does not,
// `name` and `description` can't be read at all, so the skill can't be selected.
// We report the parser's own message and line so the fix is obvious.
export const sk002FrontmatterYaml: FileRule = {
  id: "SK002",
  name: "frontmatter-parses-as-yaml",
  severity: "error",
  scope: "file",
  docs: "sk002",
  check(ctx) {
    const err = ctx.parsed.frontmatterError;
    if (!err) return [];
    return [
      {
        file: ctx.skill.filePath,
        line: err.line,
        message: `Frontmatter is not valid YAML: ${err.message}`,
        suggestion:
          "Fix the YAML so name and description can be read. A common cause is an " +
          "unquoted value containing a colon — wrap such values in double quotes.",
      },
    ];
  },
};

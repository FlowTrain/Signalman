import type { FileRule } from "./types.js";

// SK012 — the body must contain something. An empty body means that once the
// skill is selected and loaded, the agent has no instructions to act on.
export const sk012BodyPresent: FileRule = {
  id: "SK012",
  name: "body-present",
  severity: "error",
  scope: "file",
  docs: "sk012",
  check(ctx) {
    if (ctx.parsed.body.trim() !== "") return [];
    return [
      {
        file: ctx.skill.filePath,
        message: "The skill body is empty; once loaded, the agent has no instructions to follow.",
        suggestion: "Add the instructions the agent should follow below the frontmatter block.",
      },
    ];
  },
};

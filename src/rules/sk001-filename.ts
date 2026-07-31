import type { FileRule } from "./types.js";

// SK001 — the entry file must be exactly `SKILL.md`. A lowercase `skill.md` (or
// any other casing) is silently skipped by most agents, so the whole skill never
// loads and nothing warns. That silence is exactly what this tool exists to break.
export const sk001Filename: FileRule = {
  id: "SK001",
  name: "filename-is-skill-md",
  severity: "error",
  scope: "file",
  docs: "sk001",
  check(ctx) {
    if (ctx.skill.fileName === "SKILL.md") return [];
    return [
      {
        file: ctx.skill.filePath,
        message: `The entry file is named '${ctx.skill.fileName}', but skills are only discovered as 'SKILL.md' (exact case), so this one is silently skipped.`,
        suggestion: `Rename '${ctx.skill.fileName}' to 'SKILL.md'.`,
      },
    ];
  },
};

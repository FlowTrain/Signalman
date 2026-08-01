import { basename } from "node:path";

import type { Finding } from "./rules/types.js";

// SK018 — a file sits in a skills root but is not named SKILL.md, so no agent
// will discover it as a skill. It loads as nothing, and nothing warns: the exact
// silent failure Signalman exists to surface. This is a discovery-level check
// (there is no parsed skill to hand a normal FileRule), so its findings are built
// here and merged into the result. Warning by default; escalate with
// `--max-warnings 0` to make it fail CI.
export function nearMissFindings(paths: string[]): Finding[] {
  return paths.map((file) => {
    const stem = basename(file).replace(/\.md$/i, "");
    return {
      file,
      message:
        "This file is in a skills root but is not named SKILL.md, so no agent will " +
        "discover it as a skill. It loads as nothing, and nothing warns.",
      suggestion:
        `Move it so the skill lives at ${stem}/SKILL.md — a directory named for ` +
        "the skill, containing SKILL.md.",
      severity: "warn",
      ruleId: "SK018",
      ruleName: "skill-file-not-discovered",
      docs: "sk018",
    };
  });
}

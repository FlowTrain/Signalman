import { existsSync } from "node:fs";
import { join } from "node:path";

import { markdownLinkTargets } from "./helpers.js";
import type { FileRule } from "./types.js";

// SK014 — relative paths the body links to should exist. A broken reference
// degrades silently at runtime: the agent follows a link to nothing. Absolute
// and `~` paths are SK015's concern, so they're skipped here.
const NON_RELATIVE = /^(?:https?:|mailto:|tel:|#|\/|~\/|[A-Za-z]:[\\/])/i;

export const sk014BrokenReferences: FileRule = {
  id: "SK014",
  name: "referenced-paths-exist",
  severity: "warn",
  scope: "file",
  docs: "sk014",
  check(ctx) {
    const findings = [];
    for (const target of markdownLinkTargets(ctx.parsed.body)) {
      if (NON_RELATIVE.test(target)) continue;
      const rel = target.split("#")[0]!.trim();
      if (rel === "") continue;
      if (existsSync(join(ctx.skill.dir, rel))) continue;
      findings.push({
        file: ctx.skill.filePath,
        message: `The body links to '${rel}', which does not exist relative to the skill directory.`,
        suggestion: `Create '${rel}', fix the path, or remove the link — it resolves to nothing at runtime.`,
      });
    }
    return findings;
  },
};

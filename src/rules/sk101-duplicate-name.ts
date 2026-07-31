import { parsedString } from "./corpus-helpers.js";
import type { CorpusRule, SkillEntry } from "./types.js";

// SK101 — two skills with the same `name` collide: only one can be invoked as
// /name, and which one an agent registers is unpredictable.
export const sk101DuplicateName: CorpusRule = {
  id: "SK101",
  name: "duplicate-name",
  severity: "error",
  scope: "corpus",
  docs: "sk101",
  check(ctx) {
    const byName = new Map<string, SkillEntry[]>();
    for (const entry of ctx.entries) {
      if (entry.parsed.frontmatterError !== null) continue;
      const name = parsedString(entry.parsed, "name");
      if (name === null) continue; // SK003 owns a missing name
      const group = byName.get(name) ?? [];
      group.push(entry);
      byName.set(name, group);
    }

    const findings = [];
    for (const [name, group] of byName) {
      if (group.length < 2) continue;
      for (const entry of group) {
        findings.push({
          file: entry.skill.filePath,
          message: `The name '${name}' is used by ${group.length} skills; only one can be invoked as /${name}, and which one an agent registers is unpredictable.`,
          suggestion: "Give each skill a unique name.",
          relatedFiles: group.filter((g) => g !== entry).map((g) => g.skill.filePath),
        });
      }
    }
    return findings;
  },
};

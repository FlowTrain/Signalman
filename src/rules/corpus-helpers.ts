// Shared helpers for corpus rules (SK101–SK103), which reason across all skills
// at once rather than one at a time.

import type { ParsedSkill } from "../parse.js";
import { tokenize } from "../text/tokenize.js";
import type { SkillEntry } from "./types.js";

/** A trimmed non-empty string frontmatter value from a parsed skill, or null. */
export function parsedString(parsed: ParsedSkill, key: string): string | null {
  const value = parsed.frontmatter?.[key];
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

export interface DescribedSkill {
  entry: SkillEntry;
  description: string;
  tokens: string[];
}

/**
 * Skills that have usable frontmatter and a description — the only ones the
 * lexical corpus rules can reason about. Skills owned by SK002/SK006 are skipped.
 */
export function describedSkills(entries: SkillEntry[]): DescribedSkill[] {
  const docs: DescribedSkill[] = [];
  for (const entry of entries) {
    if (entry.parsed.frontmatterError !== null) continue;
    const description = parsedString(entry.parsed, "description");
    if (description === null) continue;
    docs.push({ entry, description, tokens: tokenize(description) });
  }
  return docs;
}

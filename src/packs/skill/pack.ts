// The skill pack — Signalman's original job (linting SKILL.md), now expressed as a
// pack over the artifact-agnostic core (core/pack.ts). This is the first pack; the
// reconciled spec linter (roadmap #2) becomes the second, which proves the seam is
// not SKILL.md-specific.
//
// SKILL.md discovery still lives in ../../discovery.ts and is wired in cli.ts; it
// moves onto this pack as a TargetProvider in extraction increment 2.
import type { LintPack } from "../../core/pack.js";
import { nearMissFindings } from "../../near-miss.js";
import { corpusRules, fileRules } from "../../rules/index.js";

export const skillPack: LintPack = {
  id: "skill",
  fileRules,
  corpusRules,
  nearMissFindings,
};

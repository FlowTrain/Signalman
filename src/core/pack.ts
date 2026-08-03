// Core contract — the seam that turns Signalman (a SKILL.md linter) into an
// artifact-agnostic core that runs "packs." A LintPack bundles the rules (and any
// discovery-level findings) for ONE artifact type; the engine runs a pack's rules
// and knows nothing about what the artifact actually is.
//
// Discovery/parsing stays artifact-specific for now (SKILL.md discovery lives in
// discovery.ts and is wired in cli.ts). It moves onto a `TargetProvider` on the pack
// when the second pack (spec) lands and forces the generalization — see
// AGENTIC-LINT-EXTRACTION.md (roadmap #3), increment 2.
import type { CorpusRule, FileRule, Finding } from "../rules/types.js";

export interface LintPack {
  /** Namespace / rule-id family, e.g. "skill" | "spec" | "context-file". */
  id: string;
  /** Rules run per discovered artifact. */
  fileRules: readonly FileRule[];
  /** Rules run once over the whole set. */
  corpusRules: readonly CorpusRule[];
  /** Discovery-level findings not tied to a parsed target (e.g. flat-file near-misses). */
  nearMissFindings?: (paths: string[]) => Finding[];
}

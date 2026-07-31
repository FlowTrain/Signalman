// The rule plugin contract (spec §3). Deliberately ESLint-shaped: a contributor
// should understand how to add a rule in ten minutes. One rule per file under
// src/rules/, no shared mutable state between rules.

import type { DiscoveredSkill } from "../discovery.js";
import type { ParsedSkill } from "../parse.js";
import type { RuleConfig } from "../config.js";

export type Severity = "error" | "warn" | "info";

/** A discovered skill paired with its parse result. */
export interface SkillEntry {
  skill: DiscoveredSkill;
  parsed: ParsedSkill;
}

/**
 * What a rule returns. The engine stamps on `ruleId`, `ruleName`, and `docs`,
 * and resolves the final severity, so rules only describe the problem itself.
 * `severity` here is an optional override (e.g. SK007 degrading to `info` when
 * its heuristic is uncertain — never `error` on a guess).
 *
 * Every finding MUST carry a `suggestion`: a finding that only says something is
 * wrong fails acceptance criterion 4.
 */
export interface RawFinding {
  /** Absolute path of the file the finding is about. */
  file: string;
  /** 1-based line, when the finding anchors to a location. */
  line?: number;
  /** One-line explanation of what is wrong. */
  message: string;
  /** Concrete, actionable fix. Required. */
  suggestion: string;
  /** Overrides the rule's default severity for this finding. */
  severity?: Severity;
  /** Other files involved, e.g. the other half of a collision pair. */
  relatedFiles?: string[];
  /** Structured payload carried through to JSON output. */
  data?: Record<string, unknown>;
}

/** A finding after the engine has stamped identity and resolved severity. */
export interface Finding extends RawFinding {
  ruleId: string;
  ruleName: string;
  severity: Severity;
  /** RULES.md anchor, e.g. "sk007". */
  docs: string;
}

export interface FileContext {
  skill: DiscoveredSkill;
  parsed: ParsedSkill;
  config: RuleConfig;
}

export interface CorpusContext {
  entries: SkillEntry[];
  config: RuleConfig;
}

interface RuleBase {
  /** Stable identifier, e.g. "SK007". */
  id: string;
  /** Human-readable slug, e.g. "description-states-trigger-condition". */
  name: string;
  /** Default severity; a finding may override it. */
  severity: Severity;
  /** RULES.md anchor for this rule. */
  docs: string;
}

export interface FileRule extends RuleBase {
  scope: "file";
  check(ctx: FileContext): RawFinding[];
}

export interface CorpusRule extends RuleBase {
  scope: "corpus";
  check(ctx: CorpusContext): RawFinding[];
}

export type Rule = FileRule | CorpusRule;

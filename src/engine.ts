// The lint engine: run file rules over each skill and corpus rules over the
// whole set, collect findings, and never let one misbehaving rule or file abort
// the run (spec acceptance criterion 5).

import { isRuleEnabled, severityOverride, type RuleConfig } from "./config.js";
import {
  distinctivenessScores,
  summarizeDistinctiveness,
  type DistinctivenessSummary,
} from "./corpus.js";
import type {
  CorpusRule,
  Finding,
  FileRule,
  RawFinding,
  SkillEntry,
} from "./rules/types.js";

export interface RuleError {
  ruleId: string;
  file: string;
  message: string;
}

export interface SeverityCounts {
  error: number;
  warn: number;
  info: number;
}

export interface LintResult {
  findings: Finding[];
  counts: SeverityCounts;
  /** Rules that threw. A rule crash is a Signalman failure (exit 3), not a lint result. */
  ruleErrors: RuleError[];
  skillCount: number;
  /** Corpus-wide distinctiveness distribution, or null for corpora too small to compare. */
  corpus: { distinctiveness: DistinctivenessSummary | null };
}

const SEVERITY_ORDER = { error: 0, warn: 1, info: 2 } as const;

export interface LintOptions {
  entries: SkillEntry[];
  config: RuleConfig;
  fileRules: readonly FileRule[];
  corpusRules: readonly CorpusRule[];
}

export function lint(opts: LintOptions): LintResult {
  const { entries, config, fileRules, corpusRules } = opts;
  const findings: Finding[] = [];
  const ruleErrors: RuleError[] = [];

  for (const entry of entries) {
    for (const rule of fileRules) {
      if (!isRuleEnabled(config, rule.id)) continue;
      try {
        const ctx = { skill: entry.skill, parsed: entry.parsed, config };
        for (const raw of rule.check(ctx)) findings.push(stamp(rule, raw, config));
      } catch (err) {
        ruleErrors.push({
          ruleId: rule.id,
          file: entry.skill.filePath,
          message: errMessage(err),
        });
      }
    }
  }

  for (const rule of corpusRules) {
    if (!isRuleEnabled(config, rule.id)) continue;
    try {
      for (const raw of rule.check({ entries, config })) findings.push(stamp(rule, raw, config));
    } catch (err) {
      ruleErrors.push({ ruleId: rule.id, file: "(corpus)", message: errMessage(err) });
    }
  }

  sortFindings(findings);

  const counts: SeverityCounts = { error: 0, warn: 0, info: 0 };
  for (const f of findings) counts[f.severity]++;

  const distinctiveness = summarizeDistinctiveness(distinctivenessScores(entries));

  return { findings, counts, ruleErrors, skillCount: entries.length, corpus: { distinctiveness } };
}

/** Attach rule identity and resolve the final severity (raw override → config → rule default). */
function stamp(rule: FileRule | CorpusRule, raw: RawFinding, config: RuleConfig): Finding {
  const severity = raw.severity ?? severityOverride(config, rule.id) ?? rule.severity;
  return { ...raw, severity, ruleId: rule.id, ruleName: rule.name, docs: rule.docs };
}

/** Worst-first, then by file, then by line, then by rule id — stable and readable.
 *  Exported so callers that merge in extra findings after lint() (e.g. discovery-level
 *  near-misses in the CLI) can restore the same ordering instead of duplicating it. */
export function sortFindings(findings: Finding[]): void {
  findings.sort(
    (a, b) =>
      SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
      a.file.localeCompare(b.file) ||
      (a.line ?? 0) - (b.line ?? 0) ||
      a.ruleId.localeCompare(b.ruleId),
  );
}

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

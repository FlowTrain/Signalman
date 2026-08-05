// Summary rollup (--summary): one line per rule with a count, so a large audit
// collapses to "what does this corpus suffer from, at a glance." Ordering is
// worst-severity-first, then highest-volume within a severity — reds lead even
// when few, then the high-count warnings an operator would otherwise tally by
// hand. This is the view for auditing a set; the per-finding detail lives in the
// default human report, and the machine feed is --format json.

import type { Colors } from "../color.js";
import type { LintResult } from "../engine.js";
import type { Severity } from "../rules/types.js";

interface RuleTally {
  ruleId: string;
  ruleName: string;
  /** Worst severity seen for this rule across the corpus. */
  severity: Severity;
  count: number;
  corpus: boolean;
}

const SEVERITY_ORDER: Record<Severity, number> = { error: 0, warn: 1, info: 2 };
const ID_WIDTH = 6;

export function renderSummary(result: LintResult, colors: Colors): string {
  const c = colors;
  const out: string[] = [];

  out.push(c.bold(`Summary — ${result.skillCount} skill${plural(result.skillCount)} scanned`));
  out.push("");

  const tallies = tally(result);
  if (tallies.length === 0 && result.ruleErrors.length === 0) {
    out.push(c.green("✓ No findings."));
    return out.join("\n") + "\n";
  }

  const countWidth = Math.max(1, ...tallies.map((t) => String(t.count).length));
  for (const t of tallies) {
    const count = String(t.count).padStart(countWidth);
    const id = colorFor(c, t.severity)(c.bold(t.ruleId.padEnd(ID_WIDTH)));
    const tag = t.corpus ? c.dim(" (corpus)") : "";
    out.push(`  ${count} ×  ${id}  ${t.severity.padEnd(5)}  ${t.ruleName}${tag}`);
  }

  out.push("");
  const { error, warn, info } = result.counts;
  const parts = [
    colorFor(c, "error")(`${error} error${plural(error)}`),
    colorFor(c, "warn")(`${warn} warning${plural(warn)}`),
    colorFor(c, "info")(`${info} info`),
  ];
  out.push(`${parts.join("  ·  ")}  across ${result.skillCount} skill${plural(result.skillCount)}.`);

  if (result.ruleErrors.length > 0) {
    out.push(
      c.red(
        `${result.ruleErrors.length} rule error${plural(result.ruleErrors.length)} ` +
          `(a rule failed to run — results incomplete).`,
      ),
    );
  }

  return out.join("\n") + "\n";
}

function tally(result: LintResult): RuleTally[] {
  const byRule = new Map<string, RuleTally>();
  for (const f of result.findings) {
    const existing = byRule.get(f.ruleId);
    if (existing) {
      existing.count++;
      if (SEVERITY_ORDER[f.severity] < SEVERITY_ORDER[existing.severity]) {
        existing.severity = f.severity;
      }
    } else {
      byRule.set(f.ruleId, {
        ruleId: f.ruleId,
        ruleName: f.ruleName,
        severity: f.severity,
        count: 1,
        corpus: isCorpusRule(f.ruleId),
      });
    }
  }
  return [...byRule.values()].sort(
    (a, b) =>
      SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
      b.count - a.count ||
      a.ruleId.localeCompare(b.ruleId),
  );
}

// Corpus rules are numbered SK1xx (SK101+); per-file rules are SK0xx. The rollup
// tags corpus findings so a trigger-collision (a whole-set problem) reads
// differently from a per-file nit that simply recurred across many files.
function isCorpusRule(ruleId: string): boolean {
  const n = Number(ruleId.replace(/^\D+/, ""));
  return Number.isFinite(n) && n >= 100;
}

function colorFor(c: Colors, severity: Severity): (s: string) => string {
  if (severity === "error") return c.red;
  if (severity === "warn") return c.yellow;
  return c.cyan;
}

function plural(n: number): string {
  return n === 1 ? "" : "s";
}

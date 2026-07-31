// JSON output (spec §7). A stable, versioned schema with `findings`, `summary`,
// and `corpus` sections, so CI and tooling can consume Signalman's results. The
// shape is described by the committed schema at src/schema/output.schema.json.

import type { DiscoveryRoot } from "../discovery.js";
import type { LintResult } from "../engine.js";
import { displayPath } from "../paths.js";

export const SCHEMA_VERSION = "1.0.0";

export interface JsonContext {
  cwd: string;
  home: string;
  roots: DiscoveryRoot[];
  unreadable: string[];
}

export function buildJsonReport(result: LintResult, ctx: JsonContext): Record<string, unknown> {
  const p = (f: string) => (f === "(corpus)" ? f : displayPath(f, ctx.cwd, ctx.home));
  const dist = result.corpus.distinctiveness;

  return {
    schemaVersion: SCHEMA_VERSION,
    summary: {
      errors: result.counts.error,
      warnings: result.counts.warn,
      info: result.counts.info,
      skills: result.skillCount,
      unreadable: ctx.unreadable.map(p),
      roots: ctx.roots.map((r) => ({ path: p(r.path), kind: r.kind, present: r.present })),
    },
    findings: result.findings.map((f) => ({
      ruleId: f.ruleId,
      ruleName: f.ruleName,
      severity: f.severity,
      file: p(f.file),
      ...(f.line !== undefined ? { line: f.line } : {}),
      message: f.message,
      suggestion: f.suggestion,
      docs: f.docs,
      ...(f.relatedFiles ? { relatedFiles: f.relatedFiles.map(p) } : {}),
      ...(f.data ? { data: f.data } : {}),
    })),
    corpus: {
      distinctiveness: dist
        ? {
            count: dist.count,
            min: dist.min,
            median: dist.median,
            max: dist.max,
            mean: dist.mean,
            skills: dist.skills.map((s) => ({ name: s.name, file: p(s.file), score: s.score })),
          }
        : null,
    },
    ruleErrors: result.ruleErrors.map((e) => ({ ruleId: e.ruleId, file: p(e.file), message: e.message })),
  };
}

export function renderJson(result: LintResult, ctx: JsonContext): string {
  return JSON.stringify(buildJsonReport(result, ctx), null, 2) + "\n";
}

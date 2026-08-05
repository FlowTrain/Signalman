import assert from "node:assert/strict";
import { test } from "node:test";

import { makeColors } from "../src/color.js";
import type { LintResult } from "../src/engine.js";
import { renderSummary } from "../src/report/summary.js";
import type { Finding, Severity } from "../src/rules/types.js";

function mk(ruleId: string, ruleName: string, severity: Severity): Finding {
  return {
    file: `/skills/${ruleId}-${Math.random()}/SKILL.md`,
    message: "m",
    suggestion: "s",
    ruleId,
    ruleName,
    severity,
    docs: ruleId.toLowerCase(),
  };
}

function resultFrom(findings: Finding[], skillCount: number): LintResult {
  const counts = { error: 0, warn: 0, info: 0 };
  for (const f of findings) counts[f.severity]++;
  return { findings, counts, ruleErrors: [], skillCount, corpus: { distinctiveness: null } };
}

const NO_COLOR = makeColors(false);

test("summary tallies per rule, worst-severity first then highest volume", () => {
  const findings = [
    mk("SK010", "negative-scope", "warn"),
    mk("SK010", "negative-scope", "warn"),
    mk("SK010", "negative-scope", "warn"),
    mk("SK015", "no-absolute-or-home-paths", "warn"),
    mk("SK015", "no-absolute-or-home-paths", "warn"),
    mk("SK101", "trigger-collision", "warn"),
    mk("SK001", "filename-casing", "error"),
  ];
  const out = renderSummary(resultFrom(findings, 185), NO_COLOR);

  // The error leads even though it has the lowest count.
  assert.ok(out.indexOf("SK001") < out.indexOf("SK010"), "error rule should sort above warnings");
  // Within warnings, highest count first.
  assert.ok(out.indexOf("SK010") < out.indexOf("SK015"), "higher-volume warning should sort first");
  assert.ok(out.indexOf("SK015") < out.indexOf("SK101"), "SK015 (2) should sort above SK101 (1)");

  // Counts and header.
  assert.match(out, /3 ×  SK010/);
  assert.match(out, /2 ×  SK015/);
  assert.match(out, /185 skills scanned/);
  assert.match(out, /1 error {2}·  6 warnings  ·  0 info {2}across 185 skills\./);

  // Corpus rules are tagged; per-file rules are not.
  assert.match(out, /SK101 .*trigger-collision \(corpus\)/);
  assert.ok(!/SK010.*\(corpus\)/.test(out), "file rule should not be tagged corpus");
});

test("summary reports a clean corpus", () => {
  const out = renderSummary(resultFrom([], 42), NO_COLOR);
  assert.match(out, /42 skills scanned/);
  assert.match(out, /No findings\./);
});

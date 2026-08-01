import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

// Regression for the near-miss merge: the CLI appends SK018 findings after lint()
// has already sorted, so it must re-sort or the reporters lose worst-first order.
// Exercised through the real binary, like exit-codes.test.ts.
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const bin = join(repoRoot, "bin", "signalman.js");

test("near-miss findings merge in worst-first order (warn before info)", () => {
  const out = execFileSync(
    process.execPath,
    [bin, "test/fixtures/ordering", "--format", "json", "--no-color"],
    { cwd: repoRoot, encoding: "utf8" },
  );
  const report = JSON.parse(out) as { findings: { severity: string; ruleId: string }[] };
  const severities = report.findings.map((f) => f.severity);

  const firstWarn = severities.indexOf("warn");
  const firstInfo = severities.indexOf("info");
  assert.ok(firstWarn !== -1, "expected an SK018 warn from the flat file");
  assert.ok(firstInfo !== -1, "expected an info finding from the real skill");
  assert.ok(
    firstWarn < firstInfo,
    `warn must sort before info; got ${JSON.stringify(severities)}`,
  );
  assert.equal(report.findings[0]!.ruleId, "SK018", "the near-miss warn should lead");
});

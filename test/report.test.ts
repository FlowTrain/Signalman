import assert from "node:assert/strict";
import { test } from "node:test";

import { makeColors } from "../src/color.js";
import type { LintResult } from "../src/engine.js";
import { renderReport, type ReportContext } from "../src/report/human.js";
import type { Finding } from "../src/rules/types.js";

function finding(over: Partial<Finding>): Finding {
  return {
    ruleId: "SK000",
    ruleName: "rule",
    severity: "error",
    file: "/proj/examples/bad/x/SKILL.md",
    message: "something is wrong",
    suggestion: "do the fix",
    docs: "sk000",
    ...over,
  };
}

const ctx: ReportContext = {
  cwd: "/proj",
  home: "/home/u",
  roots: [{ path: "/proj/examples/bad", kind: "explicit", present: true }],
  usedRoots: ["/proj/examples/bad"],
  unreadable: [],
  colors: makeColors(false),
};

function result(findings: Finding[]): LintResult {
  const counts = { error: 0, warn: 0, info: 0 };
  for (const f of findings) counts[f.severity]++;
  return { findings, counts, ruleErrors: [], skillCount: 3 };
}

test("groups findings by severity, worst-first, with counts", () => {
  const out = renderReport(
    result([
      finding({ ruleId: "SK006", severity: "error", message: "no description" }),
      finding({ ruleId: "SK005", severity: "warn", message: "bad name" }),
      finding({ ruleId: "SK016", severity: "info", message: "agent-specific key" }),
    ]),
    ctx,
  );
  assert.match(out, /errors \(1\)/);
  assert.match(out, /warnings \(1\)/);
  assert.match(out, /info \(1\)/);
  assert.ok(out.indexOf("errors (1)") < out.indexOf("warnings (1)"));
  assert.ok(out.indexOf("warnings (1)") < out.indexOf("info (1)"));
});

test("every finding shows path, rule id, message, a fix, and a RULES.md anchor", () => {
  const out = renderReport(result([finding({ ruleId: "SK007", docs: "sk007" })]), ctx);
  assert.match(out, /SK007/);
  assert.match(out, /examples\/bad\/x\/SKILL\.md/); // relative, forward slashes
  assert.match(out, /something is wrong/);
  assert.match(out, /fix: do the fix/);
  assert.match(out, /RULES\.md#sk007/);
});

test("a clean run reports success, not silence", () => {
  const out = renderReport(result([]), ctx);
  assert.match(out, /No issues found/);
  assert.match(out, /3 skills/);
});

test("relatedFiles are shown for corpus findings like collisions", () => {
  const out = renderReport(
    result([
      finding({
        ruleId: "SK102",
        severity: "warn",
        message: "trigger collision",
        relatedFiles: ["/proj/examples/bad/y/SKILL.md"],
      }),
    ]),
    ctx,
  );
  assert.match(out, /examples\/bad\/y\/SKILL\.md/);
});

test("unreadable files are surfaced, not silently dropped", () => {
  const out = renderReport(result([]), {
    ...ctx,
    unreadable: ["/proj/examples/bad/locked/SKILL.md"],
  });
  assert.match(out, /could not read \(1\)/);
  assert.match(out, /examples\/bad\/locked\/SKILL\.md/);
  // With no readable skills, it must NOT claim nothing was found.
  assert.doesNotMatch(out, /No SKILL\.md files found/);
});

test("the footer distinguishes an absent root", () => {
  const out = renderReport(result([]), {
    ...ctx,
    roots: [
      { path: "/proj/.claude/skills", kind: "project", present: true },
      { path: "/proj/.github/skills", kind: "project", present: false },
    ],
    usedRoots: [],
  });
  assert.match(out, /\.github\/skills {2}\(absent\)/);
});

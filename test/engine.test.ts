import assert from "node:assert/strict";
import { test } from "node:test";

import { defaultConfig } from "../src/config.js";
import { lint } from "../src/engine.js";
import type { CorpusRule, FileRule, SkillEntry } from "../src/rules/types.js";

function entry(name: string, description: string | null): SkillEntry {
  const frontmatter: Record<string, unknown> = { name };
  if (description !== null) frontmatter["description"] = description;
  return {
    skill: {
      filePath: `/skills/${name}/SKILL.md`,
      dir: `/skills/${name}`,
      dirName: name,
      fileName: "SKILL.md",
      root: "/skills",
    },
    parsed: {
      text: "",
      frontmatterPresent: true,
      frontmatter,
      frontmatterKeys: Object.keys(frontmatter),
      frontmatterError: null,
      body: "body",
      bodyStartLine: 4,
    },
  };
}

const needsDescription: FileRule = {
  id: "SKX01",
  name: "needs-description",
  severity: "error",
  scope: "file",
  docs: "skx01",
  check(ctx) {
    return ctx.parsed.frontmatter?.["description"]
      ? []
      : [{ file: ctx.skill.filePath, message: "no description", suggestion: "add one" }];
  },
};

const throwing: FileRule = {
  id: "BOOM",
  name: "throws",
  severity: "warn",
  scope: "file",
  docs: "boom",
  check() {
    throw new Error("kaboom");
  },
};

const duplicateNames: CorpusRule = {
  id: "SKX99",
  name: "duplicate-name",
  severity: "warn",
  scope: "corpus",
  docs: "skx99",
  check(ctx) {
    const seen = new Map<string, number>();
    for (const e of ctx.entries) {
      const n = e.skill.dirName;
      seen.set(n, (seen.get(n) ?? 0) + 1);
    }
    return ctx.entries
      .filter((e) => (seen.get(e.skill.dirName) ?? 0) > 1)
      .map((e) => ({ file: e.skill.filePath, message: "duplicate name", suggestion: "rename" }));
  },
};

test("file rules run per skill and findings are stamped with rule identity", () => {
  const entries = [entry("a", "has one"), entry("b", null)];
  const result = lint({ entries, config: defaultConfig(), fileRules: [needsDescription], corpusRules: [] });
  assert.equal(result.findings.length, 1);
  const f = result.findings[0]!;
  assert.equal(f.ruleId, "SKX01");
  assert.equal(f.ruleName, "needs-description");
  assert.equal(f.docs, "skx01");
  assert.equal(f.severity, "error");
  assert.equal(result.counts.error, 1);
});

test("a finding can override the rule's default severity", () => {
  const guess: FileRule = {
    id: "SKX02",
    name: "guess",
    severity: "error",
    scope: "file",
    docs: "skx02",
    check(ctx) {
      return [{ file: ctx.skill.filePath, message: "m", suggestion: "s", severity: "info" }];
    },
  };
  const result = lint({ entries: [entry("a", "x")], config: defaultConfig(), fileRules: [guess], corpusRules: [] });
  assert.equal(result.findings[0]!.severity, "info");
  assert.equal(result.counts.info, 1);
});

test("config can disable a rule and override its severity", () => {
  const off = defaultConfig();
  off.rules["SKX01"] = { off: true };
  assert.equal(
    lint({ entries: [entry("a", null)], config: off, fileRules: [needsDescription], corpusRules: [] }).findings.length,
    0,
  );

  const downgrade = defaultConfig();
  downgrade.rules["SKX01"] = { severity: "warn" };
  const r = lint({ entries: [entry("a", null)], config: downgrade, fileRules: [needsDescription], corpusRules: [] });
  assert.equal(r.findings[0]!.severity, "warn");
});

test("a throwing rule is isolated and does not abort the run", () => {
  const entries = [entry("a", null), entry("b", null)];
  const result = lint({
    entries,
    config: defaultConfig(),
    fileRules: [throwing, needsDescription],
    corpusRules: [],
  });
  // needsDescription still produced its findings despite `throwing` blowing up.
  assert.equal(result.counts.error, 2);
  assert.ok(result.ruleErrors.length >= 1);
  assert.equal(result.ruleErrors[0]!.ruleId, "BOOM");
});

test("corpus rules run once over the whole set", () => {
  const entries = [entry("dup", "one"), entry("dup", "two"), entry("unique", "three")];
  const result = lint({ entries, config: defaultConfig(), fileRules: [], corpusRules: [duplicateNames] });
  assert.equal(result.findings.length, 2);
  assert.ok(result.findings.every((f) => f.ruleId === "SKX99"));
});

test("findings are sorted worst-first", () => {
  const mixed: FileRule = {
    id: "MIX",
    name: "mix",
    severity: "info",
    scope: "file",
    docs: "mix",
    check(ctx) {
      return [
        { file: ctx.skill.filePath, message: "i", suggestion: "s", severity: "info" },
        { file: ctx.skill.filePath, message: "e", suggestion: "s", severity: "error" },
        { file: ctx.skill.filePath, message: "w", suggestion: "s", severity: "warn" },
      ];
    },
  };
  const result = lint({ entries: [entry("a", "x")], config: defaultConfig(), fileRules: [mixed], corpusRules: [] });
  assert.deepEqual(result.findings.map((f) => f.severity), ["error", "warn", "info"]);
});

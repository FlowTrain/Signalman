import assert from "node:assert/strict";
import { test } from "node:test";

import { skillPack } from "../src/packs/skill/pack.js";
import { corpusRules, fileRules } from "../src/rules/index.js";

// Extraction increment 1: the skill rules are now exposed as a LintPack over the
// artifact-agnostic core, behavior-preserving. This locks that contract.
test("skillPack is a LintPack over exactly today's skill rules", () => {
  assert.equal(skillPack.id, "skill");
  assert.deepEqual(
    skillPack.fileRules.map((r) => r.id),
    fileRules.map((r) => r.id),
  );
  assert.deepEqual(
    skillPack.corpusRules.map((r) => r.id),
    corpusRules.map((r) => r.id),
  );
});

test("skillPack carries the discovery-level near-miss detector (SK018)", () => {
  const nm = skillPack.nearMissFindings?.(["/x/.claude/skills/data-cleaner.md"]) ?? [];
  assert.equal(nm.length, 1);
  assert.equal(nm[0]?.ruleId, "SK018");
});

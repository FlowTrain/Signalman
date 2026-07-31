import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { defaultConfig } from "../src/config.js";
import { discover } from "../src/discovery.js";
import { lint } from "../src/engine.js";
import { parseSkillFile } from "../src/parse.js";
import { buildJsonReport } from "../src/report/json.js";
import { corpusRules, fileRules } from "../src/rules/index.js";
import type { SkillEntry } from "../src/rules/types.js";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const schema = JSON.parse(readFileSync(join(repoRoot, "src", "schema", "output.schema.json"), "utf8"));

// ajv is a dev-only dependency; load it as CJS to sidestep ESM default-interop.
const requireCjs = createRequire(import.meta.url);
const ajvExport = requireCjs("ajv");
const Ajv = ajvExport.default ?? ajvExport;
const validate = new Ajv({ allErrors: true }).compile(schema);

function report(rel: string): Record<string, unknown> {
  const { skills, roots } = discover({
    paths: [join(repoRoot, rel)],
    projectOnly: false,
    personalOnly: false,
    cwd: repoRoot,
    home: repoRoot,
  });
  const entries: SkillEntry[] = skills.map((skill) => ({ skill, parsed: parseSkillFile(skill.filePath) }));
  const result = lint({ entries, config: defaultConfig(), fileRules, corpusRules });
  return buildJsonReport(result, { cwd: repoRoot, home: repoRoot, roots, unreadable: [] });
}

test("JSON output for examples/bad validates against the committed schema", () => {
  const ok = validate(report("examples/bad"));
  assert.ok(ok, JSON.stringify(validate.errors, null, 2));
});

test("JSON output for examples/good validates against the committed schema", () => {
  assert.ok(validate(report("examples/good")), JSON.stringify(validate.errors, null, 2));
});

test("JSON report carries versioned summary, findings, and corpus sections", () => {
  const r = report("examples/bad") as any;
  assert.equal(r.schemaVersion, "1.0.0");
  assert.ok(r.summary.errors >= 1 && r.summary.skills === 10);
  assert.ok(Array.isArray(r.findings) && r.findings.length > 0);
  assert.ok(r.findings.every((f: any) => typeof f.suggestion === "string" && f.suggestion.length > 0));
  assert.ok(r.corpus.distinctiveness && r.corpus.distinctiveness.count >= 3);
});

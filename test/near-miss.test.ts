import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { discover } from "../src/discovery.js";
import { nearMissFindings } from "../src/near-miss.js";

test("nearMissFindings builds a warn SK018 finding pointing at <name>/SKILL.md", () => {
  const [f] = nearMissFindings(["/x/.claude/skills/data-cleaner.md"]);
  assert.ok(f);
  assert.equal(f!.ruleId, "SK018");
  assert.equal(f!.severity, "warn");
  assert.equal(f!.docs, "sk018");
  assert.ok(f!.suggestion.length > 0, "a finding must carry a suggestion (AC4)");
  assert.match(f!.suggestion, /data-cleaner\/SKILL\.md/);
});

test("discovery flags flat frontmatter .md files in a skills root, not docs or real skills", () => {
  const parent = mkdtempSync(join(tmpdir(), "sig-nm-"));
  const skillsRoot = join(parent, "skills");
  mkdirSync(skillsRoot, { recursive: true });

  // near-miss: a flat file with YAML frontmatter, sitting where a directory should be
  writeFileSync(
    join(skillsRoot, "data-cleaner.md"),
    "---\nname: data-cleaner\ndescription: x\n---\nbody\n",
  );
  // ignored: README (documentation) and a plain note with no frontmatter
  writeFileSync(join(skillsRoot, "README.md"), "---\ntitle: docs\n---\n# docs\n");
  writeFileSync(join(skillsRoot, "notes.md"), "# just notes, no frontmatter\n");
  // a real skill: <name>/SKILL.md — must be discovered as a skill, never a near-miss
  mkdirSync(join(skillsRoot, "good"), { recursive: true });
  writeFileSync(
    join(skillsRoot, "good", "SKILL.md"),
    "---\nname: good\ndescription: Use when the user wants X.\n---\nbody\n",
  );

  try {
    const r = discover({
      paths: [skillsRoot],
      projectOnly: false,
      personalOnly: false,
      cwd: parent,
      home: parent,
    });
    const near = r.nearMisses.map((p) => p.replace(/\\/g, "/"));
    assert.equal(near.length, 1, `expected one near-miss, got ${JSON.stringify(near)}`);
    assert.match(near[0]!, /data-cleaner\.md$/);
    assert.equal(r.skills.length, 1);
    assert.match(r.skills[0]!.filePath.replace(/\\/g, "/"), /good\/SKILL\.md$/);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

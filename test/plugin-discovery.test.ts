import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { discover } from "../src/discovery.js";

// Plugins bundle skills at <plugin>/skills/<name>/SKILL.md under `.claude/plugins`.
// A linter that ignored the plugins root would miss every plugin-shipped skill.
test("discovery finds skills bundled inside a plugin (.claude/plugins/<name>/skills/<skill>/SKILL.md)", () => {
  const proj = mkdtempSync(join(tmpdir(), "sig-plug-"));
  const skillDir = join(proj, ".claude", "plugins", "acme-pack", "skills", "data-cleaner");
  mkdirSync(skillDir, { recursive: true });
  writeFileSync(
    join(skillDir, "SKILL.md"),
    "---\nname: data-cleaner\ndescription: Use when the user wants to clean CSV data.\n---\nbody\n",
  );
  // a loose project skill too, to prove both roots are scanned in one run
  const looseDir = join(proj, ".claude", "skills", "pdf-filler");
  mkdirSync(looseDir, { recursive: true });
  writeFileSync(
    join(looseDir, "SKILL.md"),
    "---\nname: pdf-filler\ndescription: Use when the user wants to fill a PDF form.\n---\nbody\n",
  );

  try {
    const r = discover({ paths: [], projectOnly: true, personalOnly: false, cwd: proj, home: proj, projectRootBase: proj });
    const found = r.skills.map((s) => s.filePath.replace(/\\/g, "/")).sort();
    assert.equal(r.skills.length, 2, `expected the plugin skill + the loose skill, got ${JSON.stringify(found)}`);
    assert.ok(found.some((p) => /acme-pack\/skills\/data-cleaner\/SKILL\.md$/.test(p)), "plugin-bundled skill not discovered");
    assert.ok(found.some((p) => /\.claude\/skills\/pdf-filler\/SKILL\.md$/.test(p)), "loose skill not discovered");
  } finally {
    rmSync(proj, { recursive: true, force: true });
  }
});

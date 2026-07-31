import assert from "node:assert/strict";
import { test } from "node:test";

import { defaultConfig } from "../src/config.js";
import { parseSkillText } from "../src/parse.js";
import { sk001Filename } from "../src/rules/sk001-filename.js";
import { sk002FrontmatterYaml } from "../src/rules/sk002-frontmatter-yaml.js";
import { sk003NamePresent } from "../src/rules/sk003-name-present.js";
import { sk004NameMatchesDir } from "../src/rules/sk004-name-matches-dir.js";
import { sk005NameFormat } from "../src/rules/sk005-name-format.js";
import { sk006DescriptionPresent } from "../src/rules/sk006-description-present.js";
import { sk012BodyPresent } from "../src/rules/sk012-body-present.js";
import type { FileContext } from "../src/rules/types.js";

function ctx(opts: { dirName?: string; fileName?: string; text: string }): FileContext {
  const dirName = opts.dirName ?? "my-skill";
  const fileName = opts.fileName ?? "SKILL.md";
  return {
    skill: {
      filePath: `/skills/${dirName}/${fileName}`,
      dir: `/skills/${dirName}`,
      dirName,
      fileName,
      root: "/skills",
    },
    parsed: parseSkillText(opts.text),
    config: defaultConfig(),
  };
}

const GOOD = `---
name: my-skill
description: Use when the user wants to do the thing.
---
Body with instructions.`;

// Every rule: a passing case and a failing case.

test("SK001 flags a non-SKILL.md filename", () => {
  assert.equal(sk001Filename.check(ctx({ text: GOOD })).length, 0);
  const f = sk001Filename.check(ctx({ fileName: "skill.md", text: GOOD }));
  assert.equal(f.length, 1);
  assert.ok(f[0]!.suggestion.includes("SKILL.md"));
});

test("SK002 flags malformed YAML with a line and message", () => {
  assert.equal(sk002FrontmatterYaml.check(ctx({ text: GOOD })).length, 0);
  const bad = `---\nname: x\ndescription: "unterminated\n---\nbody`;
  const f = sk002FrontmatterYaml.check(ctx({ text: bad }));
  assert.equal(f.length, 1);
  assert.ok(typeof f[0]!.line === "number");
});

test("SK003 flags a missing name", () => {
  assert.equal(sk003NamePresent.check(ctx({ text: GOOD })).length, 0);
  const noName = `---\ndescription: Use when the user wants a thing.\n---\nbody`;
  assert.equal(sk003NamePresent.check(ctx({ text: noName })).length, 1);
});

test("SK003 stays quiet when the frontmatter itself is broken (SK002 owns it)", () => {
  const bad = `---\nname: "unterminated\n---\nbody`;
  assert.equal(sk003NamePresent.check(ctx({ text: bad })).length, 0);
});

test("SK004 flags a name that differs from the directory", () => {
  assert.equal(sk004NameMatchesDir.check(ctx({ dirName: "my-skill", text: GOOD })).length, 0);
  const f = sk004NameMatchesDir.check(ctx({ dirName: "other-dir", text: GOOD }));
  assert.equal(f.length, 1);
  assert.ok(f[0]!.message.includes("other-dir"));
});

test("SK005 flags names that are not lowercase-hyphenated and suggests a slug", () => {
  const good = `---\nname: caps-mismatch\ndescription: Use when the user wants a thing.\n---\nbody`;
  assert.equal(sk005NameFormat.check(ctx({ dirName: "caps-mismatch", text: good })).length, 0);
  const bad = `---\nname: Caps_Mismatch\ndescription: Use when the user wants a thing.\n---\nbody`;
  const f = sk005NameFormat.check(ctx({ dirName: "caps-mismatch", text: bad }));
  assert.equal(f.length, 1);
  assert.ok(f[0]!.suggestion.includes("caps-mismatch"));
});

test("SK006 flags a missing description", () => {
  assert.equal(sk006DescriptionPresent.check(ctx({ text: GOOD })).length, 0);
  const noDesc = `---\nname: my-skill\n---\nbody`;
  assert.equal(sk006DescriptionPresent.check(ctx({ text: noDesc })).length, 1);
});

test("SK012 flags an empty body", () => {
  assert.equal(sk012BodyPresent.check(ctx({ text: GOOD })).length, 0);
  const noBody = `---\nname: my-skill\ndescription: Use when the user wants a thing.\n---\n`;
  assert.equal(sk012BodyPresent.check(ctx({ text: noBody })).length, 1);
});

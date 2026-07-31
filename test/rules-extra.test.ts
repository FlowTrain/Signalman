import assert from "node:assert/strict";
import { basename, dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { defaultConfig, type RuleConfig } from "../src/config.js";
import { parseSkillText } from "../src/parse.js";
import { sk008DescriptionLength } from "../src/rules/sk008-description-length.js";
import { sk009DomainVocab } from "../src/rules/sk009-domain-vocab.js";
import { sk010NegativeScope } from "../src/rules/sk010-negative-scope.js";
import { sk011Voice } from "../src/rules/sk011-voice.js";
import { sk013BodyNotRestatement } from "../src/rules/sk013-body-not-restatement.js";
import { sk014BrokenReferences } from "../src/rules/sk014-broken-references.js";
import { sk015AbsolutePaths } from "../src/rules/sk015-absolute-paths.js";
import { sk016FrontmatterKeys } from "../src/rules/sk016-frontmatter-keys.js";
import { sk017FileSize } from "../src/rules/sk017-file-size.js";
import type { FileContext } from "../src/rules/types.js";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

function skill(desc: string, body = "Body with real instructions here."): string {
  return `---\nname: s\ndescription: ${JSON.stringify(desc)}\n---\n${body}`;
}

function ctx(text: string, opts: { dir?: string; config?: RuleConfig } = {}): FileContext {
  const dir = opts.dir ?? "/skills/s";
  return {
    skill: { filePath: join(dir, "SKILL.md"), dir, dirName: basename(dir), fileName: "SKILL.md", root: "/" },
    parsed: parseSkillText(text),
    config: opts.config ?? defaultConfig(),
  };
}

test("SK008 flags too-short and too-long descriptions", () => {
  assert.equal(sk008DescriptionLength.check(ctx(skill("Use when the user needs to fill or read a PDF form today."))).length, 0);
  assert.equal(sk008DescriptionLength.check(ctx(skill("Too short."))).length, 1);
  assert.equal(sk008DescriptionLength.check(ctx(skill("a".repeat(600)))).length, 1);
});

test("SK009 flags a description with no domain vocabulary", () => {
  assert.equal(sk009DomainVocab.check(ctx(skill("Use when the user needs to fill or read a PDF form."))).length, 0);
  assert.equal(sk009DomainVocab.check(ctx(skill("A collection of tools and utilities."))).length, 1);
});

test("SK010 nudges a content-ful description with no negative scope, and passes one that has it", () => {
  assert.equal(sk010NegativeScope.check(ctx(skill("Use when the user cleans CSV files."))).length, 1);
  assert.equal(sk010NegativeScope.check(ctx(skill("Use when the user cleans CSV files. Do NOT use for PDFs."))).length, 0);
  // No real content: SK009 owns it, SK010 stays quiet.
  assert.equal(sk010NegativeScope.check(ctx(skill("A tool."))).length, 0);
});

test("SK011 flags mixed second/third person voice", () => {
  assert.equal(sk011Voice.check(ctx(skill("Use when the user cleans data."))).length, 0);
  assert.equal(sk011Voice.check(ctx(skill("Use when you help the user clean data."))).length, 1);
});

test("SK013 flags a body that merely restates the description", () => {
  const d = "Clean messy CSV spreadsheet data by removing duplicate rows and columns.";
  assert.equal(sk013BodyNotRestatement.check(ctx(skill(d, "Load the file, drop blank rows, then save it to disk."))).length, 0);
  assert.equal(sk013BodyNotRestatement.check(ctx(skill(d, d))).length, 1);
});

test("SK014 flags a broken relative link but not an existing one or an absolute one", () => {
  assert.equal(sk014BrokenReferences.check(ctx(skill("Use when x.", "See [x](does-not-exist-xyz/f.md)."), { dir: repoRoot })).length, 1);
  assert.equal(sk014BrokenReferences.check(ctx(skill("Use when x.", "See [r](RULES.md)."), { dir: repoRoot })).length, 0);
  assert.equal(sk014BrokenReferences.check(ctx(skill("Use when x.", "See [a](/abs/p.md)."), { dir: repoRoot })).length, 0);
});

test("SK015 flags absolute and home paths in the body", () => {
  const f = sk015AbsolutePaths.check(ctx(skill("Use when x.", "Read `~/skills/x.md` and `/home/u/y.md`.")));
  assert.equal(f.length, 1);
  assert.equal(sk015AbsolutePaths.check(ctx(skill("Use when x.", "See [x](templates/x.md)."))).length, 0);
});

test("SK016 reports agent-specific frontmatter keys with their owner", () => {
  const text = `---\nname: s\ndescription: "Use when the user does a thing."\nglobs: "**/*.ts"\ncontext: fork\n---\nBody.`;
  const f = sk016FrontmatterKeys.check(ctx(text));
  assert.equal(f.length, 1);
  assert.match(f[0]!.message, /Cursor/);
  assert.match(f[0]!.message, /Claude Code/);
  assert.equal(sk016FrontmatterKeys.check(ctx(skill("Use when the user does a thing."))).length, 0);
});

test("SK017 warns when the file exceeds the configured budget", () => {
  const small = defaultConfig();
  small.rules["SK017"] = { options: { maxBytes: 10 } };
  assert.equal(sk017FileSize.check(ctx(skill("Use when x."), { config: small })).length, 1);
  assert.equal(sk017FileSize.check(ctx(skill("Use when x."))).length, 0); // default 64 KB
});

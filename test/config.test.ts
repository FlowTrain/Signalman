import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { loadConfig } from "../src/config.js";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const fx = join(repoRoot, "test", "fixtures", "config");

test("loadConfig parses every rule-setting form, maxWarnings, include, and exclude", () => {
  const { config, error, path } = loadConfig(repoRoot, join(fx, "valid.json"));
  assert.equal(error, null);
  assert.ok(path && path.endsWith("valid.json"));
  assert.equal(config.maxWarnings, 3);
  assert.deepEqual(config.include, [".claude/skills"]);
  assert.deepEqual(config.exclude, ["**/fixtures/**"]);
  assert.deepEqual(config.rules["SK010"], { off: true });
  assert.deepEqual(config.rules["SK004"], { severity: "error" });
  assert.equal(config.rules["SK008"]?.severity, "warn");
  assert.equal(config.rules["SK008"]?.options?.["min"], 60);
  assert.equal(config.rules["SK102"]?.options?.["threshold"], 0.8);
});

test("loadConfig reports invalid JSON as an error (exit 3 territory)", () => {
  const { error } = loadConfig(repoRoot, join(fx, "bad.json"));
  assert.match(error ?? "", /invalid JSON/);
});

test("loadConfig rejects an unknown severity", () => {
  const { error } = loadConfig(repoRoot, join(fx, "bad-severity.json"));
  assert.match(error ?? "", /SK004/);
});

test("loadConfig errors when an explicit --config path is missing", () => {
  const { error } = loadConfig(repoRoot, join(fx, "does-not-exist.json"));
  assert.match(error ?? "", /not found/);
});

test("loadConfig discovers signalman.config.json upward from the working directory", () => {
  const { config, path } = loadConfig(join(repoRoot, "test", "fixtures", "config-project"), null);
  assert.ok(path && path.endsWith("signalman.config.json"));
  assert.equal(config.maxWarnings, 5);
});

test("loadConfig returns defaults when no config is found", () => {
  const { config, path, error } = loadConfig(repoRoot, null);
  assert.equal(error, null);
  assert.equal(path, null);
  assert.deepEqual(config.rules, {});
  assert.equal(config.maxWarnings, null);
});

test("config exclude removes matching skills end-to-end", () => {
  const bin = join(repoRoot, "bin", "signalman.js");
  const args = ["examples/bad", "--config", join(fx, "exclude-dangling.json")];
  let out = "";
  try {
    out = execFileSync(process.execPath, [bin, ...args], { cwd: repoRoot, encoding: "utf8" });
  } catch (err) {
    out = String((err as { stdout?: string }).stdout ?? ""); // exit 2 (errors present) throws
  }
  assert.doesNotMatch(out, /SK014/); // dangling-references excluded
  assert.match(out, /SK006/); // other skills still linted
});

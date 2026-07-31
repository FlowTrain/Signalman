import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

// Exit codes are the CI contract (spec §7), so exercise them end-to-end through
// the real binary rather than by calling run() in-process.
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const bin = join(repoRoot, "bin", "signalman.js");

function exitCode(args: string[]): number {
  try {
    execFileSync(process.execPath, [bin, ...args], { cwd: repoRoot, stdio: "ignore" });
    return 0;
  } catch (err) {
    const status = (err as { status?: number }).status;
    return typeof status === "number" ? status : 1;
  }
}

test("exit 0 on a clean corpus", () => {
  assert.equal(exitCode(["examples/good"]), 0);
});

test("exit 2 when there are errors", () => {
  assert.equal(exitCode(["examples/bad"]), 2);
});

test("exit 2 with --format json too", () => {
  assert.equal(exitCode(["examples/bad", "--format", "json"]), 2);
});

test("exit 3 on a missing path (Signalman itself cannot run)", () => {
  assert.equal(exitCode(["no/such/path/here"]), 3);
});

test("exit 1 when warnings exceed --max-warnings", () => {
  assert.equal(exitCode(["test/fixtures/warn-only", "--max-warnings", "0"]), 1);
});

test("exit 0 for the same warnings without --max-warnings (warnings don't fail by default)", () => {
  assert.equal(exitCode(["test/fixtures/warn-only"]), 0);
});

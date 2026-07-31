import assert from "node:assert/strict";
import { test } from "node:test";

import { discover } from "../src/discovery.js";
import { slash } from "../src/paths.js";

function projectRootPaths(opts: Parameters<typeof discover>[0]): string[] {
  return discover(opts)
    .roots.filter((r) => r.kind === "project")
    .map((r) => slash(r.path));
}

test("project roots resolve against projectRootBase (the config's directory)", () => {
  const paths = projectRootPaths({
    paths: [],
    projectOnly: true,
    personalOnly: false,
    cwd: "/work/sub",
    home: "/home",
    projectRootBase: "/work",
  });
  assert.ok(paths.some((p) => p.endsWith("/work/.claude/skills")));
  assert.ok(paths.every((p) => !p.includes("/work/sub/")));
});

test("project roots default to cwd when no base is given", () => {
  const paths = projectRootPaths({
    paths: [],
    projectOnly: true,
    personalOnly: false,
    cwd: "/work/sub",
    home: "/home",
  });
  assert.ok(paths.some((p) => p.endsWith("/work/sub/.claude/skills")));
});

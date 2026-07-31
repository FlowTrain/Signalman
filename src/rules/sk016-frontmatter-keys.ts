import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { frontmatterUsable } from "./helpers.js";
import type { FileRule } from "./types.js";

// SK016 — report frontmatter keys that only one agent understands, so authors
// can see their cross-agent portability surface. This is a portability feature,
// not a defect, hence info. The key -> agent mapping lives in one data file
// (data/frontmatter-keys.json) so it's easy to keep current with a PR.
interface KeyMap {
  core: string[];
  byKey: Record<string, string>;
}

const KEY_MAP = loadKeyMap();
const CORE = new Set(KEY_MAP.core);

export const sk016FrontmatterKeys: FileRule = {
  id: "SK016",
  name: "frontmatter-key-portability",
  severity: "info",
  scope: "file",
  docs: "sk016",
  check(ctx) {
    if (!frontmatterUsable(ctx)) return [];

    const agentSpecific: Array<[string, string]> = [];
    const unknown: string[] = [];
    for (const key of ctx.parsed.frontmatterKeys) {
      if (CORE.has(key)) continue;
      const owner = KEY_MAP.byKey[key];
      if (owner) agentSpecific.push([key, owner]);
      else unknown.push(key);
    }
    if (agentSpecific.length === 0 && unknown.length === 0) return [];

    const parts = agentSpecific.map(([k, owner]) => `'${k}' is ${owner}-specific`);
    if (unknown.length > 0) {
      parts.push(`${unknown.map((k) => `'${k}'`).join(", ")} not recognized by any known agent`);
    }
    return [
      {
        file: ctx.skill.filePath,
        message: `Some frontmatter keys are not portable: ${parts.join("; ")}. Other agents ignore them.`,
        suggestion:
          "Core keys (name, description) work across all agents. Keep agent-specific keys only " +
          "if you target that agent — others silently ignore them.",
        data: { agentSpecific: Object.fromEntries(agentSpecific), unknown },
      },
    ];
  },
};

function loadKeyMap(): KeyMap {
  const path = join(dirname(fileURLToPath(import.meta.url)), "../data/frontmatter-keys.json");
  return JSON.parse(readFileSync(path, "utf8")) as KeyMap;
}

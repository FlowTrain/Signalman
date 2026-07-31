import { Buffer } from "node:buffer";

import { ruleOption } from "../config.js";
import type { FileRule } from "./types.js";

// SK017 — some ecosystems cap instruction-file size. Rather than asserting one
// number, warn (as info) when a SKILL.md grows large, since long reference
// material belongs in separate files the skill loads on demand.
export const sk017FileSize: FileRule = {
  id: "SK017",
  name: "file-size-within-budget",
  severity: "info",
  scope: "file",
  docs: "sk017",
  check(ctx) {
    const maxBytes = ruleOption(ctx.config, "SK017", "maxBytes", 65536);
    const bytes = Buffer.byteLength(ctx.parsed.text, "utf8");
    if (bytes <= maxBytes) return [];

    return [
      {
        file: ctx.skill.filePath,
        message: `The SKILL.md is ${Math.round(bytes / 1024)} KB, which may approach some agents' instruction-size limits.`,
        suggestion:
          "Move long reference material into separate files the skill links to, so it loads only " +
          "when needed rather than on every run.",
      },
    ];
  },
};

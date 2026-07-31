import { ruleOption } from "../config.js";
import { frontmatterString, frontmatterUsable } from "./helpers.js";
import type { FileRule } from "./types.js";

// SK008 — the description should sit within a length band. Too short can't
// discriminate between skills; too long dilutes the trigger and risks being
// truncated in the skill listing. Band is configurable (default 40-500).
export const sk008DescriptionLength: FileRule = {
  id: "SK008",
  name: "description-length-within-band",
  severity: "warn",
  scope: "file",
  docs: "sk008",
  check(ctx) {
    if (!frontmatterUsable(ctx)) return [];
    const desc = frontmatterString(ctx, "description");
    if (!desc) return []; // SK006 owns a missing description

    const min = ruleOption(ctx.config, "SK008", "min", 40);
    const max = ruleOption(ctx.config, "SK008", "max", 500);
    const len = desc.length;

    if (len < min) {
      return [
        {
          file: ctx.skill.filePath,
          message: `The description is ${len} characters — too short (under ${min}) to reliably discriminate this skill from others.`,
          suggestion: "Add the specific task and the file types or domain it applies to.",
        },
      ];
    }
    if (len > max) {
      return [
        {
          file: ctx.skill.filePath,
          message: `The description is ${len} characters — over the ${max}-character band, which dilutes the trigger and may be truncated in the skill listing.`,
          suggestion: "Lead with the key use case and move detail into the skill body.",
        },
      ];
    }
    return [];
  },
};

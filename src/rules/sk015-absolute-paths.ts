import { absolutePathRefs } from "./helpers.js";
import type { FileRule } from "./types.js";

// SK015 — absolute paths (`/home/…`, `C:\…`) and home paths (`~/…`) in the body
// don't resolve in most agents, which run the skill from a different machine or
// working directory than the author's.
export const sk015AbsolutePaths: FileRule = {
  id: "SK015",
  name: "no-absolute-or-home-paths",
  severity: "warn",
  scope: "file",
  docs: "sk015",
  check(ctx) {
    const paths = absolutePathRefs(ctx.parsed.body);
    if (paths.length === 0) return [];

    const shown = paths.slice(0, 5).join(", ") + (paths.length > 5 ? " …" : "");
    return [
      {
        file: ctx.skill.filePath,
        message: `The body references absolute or home paths that won't resolve in most agents: ${shown}`,
        suggestion:
          "Reference files by paths relative to the skill directory instead of absolute or `~` paths.",
        data: { paths },
      },
    ];
  },
};

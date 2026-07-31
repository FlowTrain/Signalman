import { ruleOption } from "../config.js";
import { distinctivenessScores } from "../corpus.js";
import type { CorpusRule } from "./types.js";

// SK103 — distinctiveness. A description can be well-formed, specific, and clear
// and still be built entirely from words a dozen other descriptions also use,
// leaving it no discriminating power. Scores come from the shared corpus module;
// this rule flags skills in the bottom decile that are also below an absolute
// floor — being relatively lowest in a corpus of distinctive skills is not
// itself a problem.
export const sk103Distinctiveness: CorpusRule = {
  id: "SK103",
  name: "distinctiveness",
  severity: "warn",
  scope: "corpus",
  docs: "sk103",
  check(ctx) {
    const scored = distinctivenessScores(ctx.entries);
    if (scored.length === 0) return []; // corpus too small to compare

    const floor = ruleOption(ctx.config, "SK103", "floor", 34);
    const ascending = scored.map((s) => s.score).sort((a, b) => a - b);
    const decileCount = Math.max(1, Math.ceil(scored.length * 0.1));
    const decileCutoff = ascending[decileCount - 1] ?? 0;

    return scored
      .filter((s) => s.score <= decileCutoff && s.score < floor)
      .map((s) => ({
        file: s.file,
        message: `Low distinctiveness (${s.score}/100): this description is built mostly from words other skills also use, so it has little power to discriminate.`,
        suggestion:
          "Add vocabulary unique to this skill — specific formats, tasks, or file types that no " +
          "sibling skill mentions.",
        data: { score: s.score },
      }));
  },
};

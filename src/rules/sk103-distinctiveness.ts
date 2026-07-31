import { ruleOption } from "../config.js";
import { TfIdf } from "../text/tfidf.js";
import { describedSkills } from "./corpus-helpers.js";
import type { CorpusRule } from "./types.js";

// SK103 — distinctiveness. A description can be well-formed, specific, and clear
// and still be built entirely from words a dozen other descriptions also use,
// leaving it no discriminating power. This is the mean inverse document
// frequency of its terms, mapped to 0–100. Skills in the bottom decile that are
// also below an absolute floor get warned — being relatively lowest in a corpus
// of distinctive skills is not itself a problem.
export const sk103Distinctiveness: CorpusRule = {
  id: "SK103",
  name: "distinctiveness",
  severity: "warn",
  scope: "corpus",
  docs: "sk103",
  check(ctx) {
    const docs = describedSkills(ctx.entries);
    if (docs.length < 3) return []; // need a corpus to compare against

    const model = new TfIdf(docs.map((d) => d.tokens));
    const n = docs.length;
    // Smoothed idf ranges from 1 (a term in every doc) to ln((n+1)/2)+1 (a unique term).
    const idfMax = Math.log((n + 1) / 2) + 1;
    const denom = idfMax - 1 || 1;

    const scored = docs.map((d) => {
      const terms = [...new Set(d.tokens)];
      const meanIdf = terms.length
        ? terms.reduce((sum, t) => sum + model.idf(t), 0) / terms.length
        : 1;
      const score = clamp(Math.round(((meanIdf - 1) / denom) * 100), 0, 100);
      return { doc: d, score };
    });

    const floor = ruleOption(ctx.config, "SK103", "floor", 34);
    const ascending = scored.map((s) => s.score).sort((a, b) => a - b);
    const decileCount = Math.max(1, Math.ceil(n * 0.1));
    const decileCutoff = ascending[decileCount - 1] ?? 0;

    const findings = [];
    for (const s of scored) {
      if (s.score > decileCutoff || s.score >= floor) continue;
      findings.push({
        file: s.doc.entry.skill.filePath,
        message: `Low distinctiveness (${s.score}/100): this description is built mostly from words other skills also use, so it has little power to discriminate.`,
        suggestion:
          "Add vocabulary unique to this skill — specific formats, tasks, or file types that no " +
          "sibling skill mentions.",
        data: { score: s.score },
      });
    }
    return findings;
  },
};

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

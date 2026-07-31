import { ruleOption } from "../config.js";
import { cosine, sharedTerms, TfIdf, type Vector } from "../text/tfidf.js";
import { describedSkills } from "./corpus-helpers.js";
import type { CorpusRule } from "./types.js";

// SK102 — two descriptions too similar to tell apart compete for the same
// requests, and which skill loads becomes unpredictable. We compute pairwise
// cosine over TF-IDF vectors of the descriptions and name the shared vocabulary,
// because that's the actionable part.
export const sk102TriggerCollision: CorpusRule = {
  id: "SK102",
  name: "trigger-collision",
  severity: "warn",
  scope: "corpus",
  docs: "sk102",
  check(ctx) {
    const docs = describedSkills(ctx.entries);
    if (docs.length < 2) return [];

    const threshold = ruleOption(ctx.config, "SK102", "threshold", 0.75);
    const model = new TfIdf(docs.map((d) => d.tokens));
    const vectors: Vector[] = docs.map((d) => model.vector(d.tokens));

    const findings = [];
    for (let i = 0; i < docs.length; i++) {
      for (let j = i + 1; j < docs.length; j++) {
        const similarity = cosine(vectors[i]!, vectors[j]!);
        if (similarity < threshold) continue;

        const a = docs[i]!;
        const b = docs[j]!;
        const shared = sharedTerms(a.tokens, b.tokens, model).slice(0, 8);
        findings.push({
          file: a.entry.skill.filePath,
          message: `Trigger collision (similarity ${similarity.toFixed(2)}) with '${b.entry.skill.dirName}'. Shared terms: ${shared.join(", ")}. These two will compete for the same requests.`,
          suggestion: "Differentiate their descriptions, or merge the two skills.",
          relatedFiles: [b.entry.skill.filePath],
          data: { similarity, shared, other: b.entry.skill.filePath },
        });
      }
    }
    return findings;
  },
};

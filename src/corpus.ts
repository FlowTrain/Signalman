// Corpus-level distinctiveness scoring, shared by SK103 (which flags the bottom)
// and the report summary (which shows the whole distribution). Distinctiveness
// is the mean inverse document frequency of a description's terms, mapped to
// 0–100: low means the description is built from words the rest of the corpus
// also uses, so it has little power to discriminate.

import { describedSkills } from "./rules/corpus-helpers.js";
import type { SkillEntry } from "./rules/types.js";
import { TfIdf } from "./text/tfidf.js";

export interface SkillScore {
  name: string;
  file: string;
  score: number;
}

export interface DistinctivenessSummary {
  count: number;
  min: number;
  median: number;
  max: number;
  mean: number;
  skills: SkillScore[];
}

/** Distinctiveness score (0–100) for every described skill. Empty for corpora too small to compare. */
export function distinctivenessScores(entries: SkillEntry[]): SkillScore[] {
  const docs = describedSkills(entries);
  if (docs.length < 3) return [];

  const model = new TfIdf(docs.map((d) => d.tokens));
  const n = docs.length;
  // Smoothed idf ranges from 1 (a term in every doc) to ln((n+1)/2)+1 (unique).
  const idfMax = Math.log((n + 1) / 2) + 1;
  const denom = idfMax - 1 || 1;

  return docs.map((d) => {
    const terms = [...new Set(d.tokens)];
    const meanIdf = terms.length
      ? terms.reduce((sum, t) => sum + model.idf(t), 0) / terms.length
      : 1;
    const score = clamp(Math.round(((meanIdf - 1) / denom) * 100), 0, 100);
    return { name: d.entry.skill.dirName, file: d.entry.skill.filePath, score };
  });
}

export function summarizeDistinctiveness(scores: SkillScore[]): DistinctivenessSummary | null {
  if (scores.length === 0) return null;
  const values = scores.map((s) => s.score).sort((a, b) => a - b);
  const mid = Math.floor(values.length / 2);
  const median =
    values.length % 2 === 1 ? values[mid]! : Math.round((values[mid - 1]! + values[mid]!) / 2);
  const mean = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
  return { count: scores.length, min: values[0]!, median, max: values[values.length - 1]!, mean, skills: scores };
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

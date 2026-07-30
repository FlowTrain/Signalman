// Tokeniser for the lexical layer (simulator, SK102, SK103). Hand-rolled: a
// stemming/NLP dependency would break the one-runtime-dependency budget, and the
// tool's whole pitch is that the matching is simple enough to argue with.
//
// The pipeline is deliberately transparent:
//   lowercase -> split on non-word characters -> fold trivial plurals ->
//   drop stopwords and single characters.
// Matching is therefore case- and plural-insensitive, and nothing else. That is
// a smoke test for vocabulary presence, not a model of meaning — stated as such
// in the simulator footer and the README.

// English function words plus the boilerplate that shows up in almost every
// skill description ("use when the user wants to..."). Removing the boilerplate
// keeps "shared trigger terms" (SK102) and "matched terms" (simulator) output
// focused on domain vocabulary rather than connective tissue. Plurals fold to
// singular before this check, so only base forms are listed.
const STOPWORDS = new Set<string>([
  // articles, conjunctions, prepositions, pronouns, auxiliaries
  "a", "an", "and", "are", "as", "at", "be", "been", "being", "but", "by",
  "can", "could", "do", "does", "doing", "done", "for", "from", "had", "has",
  "have", "having", "if", "in", "into", "is", "it", "its", "of", "on", "onto",
  "or", "over", "so", "than", "that", "the", "their", "them", "then", "there",
  "these", "they", "this", "those", "to", "up", "upon", "was", "were", "will",
  "with", "within", "without", "would", "you", "your", "yours", "me", "my",
  "we", "our", "us", "i", "not", "no", "any", "all", "more", "most", "other",
  "some", "only", "also", "such", "via", "per", "each", "about", "across",
  "after", "before", "between", "during", "through",
  // skill-description boilerplate (base forms; plurals fold in above)
  "use", "using", "used", "when", "whenever", "want", "need", "help",
  "user", "skill", "thing", "etc",
]);

/** Split text into normalized lexical tokens. Deterministic and side-effect free. */
export function tokenize(text: string): string[] {
  const tokens: string[] = [];
  // Unicode letters and numbers only; everything else is a separator.
  const matches = text.toLowerCase().match(/[\p{L}\p{N}]+/gu);
  if (!matches) return tokens;
  for (const raw of matches) {
    const t = singularize(raw);
    if (t.length < 2) continue;
    if (STOPWORDS.has(t)) continue;
    tokens.push(t);
  }
  return tokens;
}

/**
 * Fold the most common English plurals to singular so "spreadsheet" and
 * "spreadsheets" count as the same term. Conservative on purpose: words ending
 * in -ss/-us/-is (class, status, analysis) are left alone. Rare mis-folds
 * (series -> sery) are an accepted cost of staying dependency-free and legible.
 */
export function singularize(t: string): string {
  if (t.length <= 3) return t;
  if (t.endsWith("ss") || t.endsWith("us") || t.endsWith("is")) return t;
  if (t.endsWith("ies")) return t.slice(0, -3) + "y"; // categories -> category
  if (
    t.length > 4 &&
    (t.endsWith("ses") || t.endsWith("xes") || t.endsWith("zes") ||
      t.endsWith("ches") || t.endsWith("shes"))
  ) {
    return t.slice(0, -2); // boxes -> box, dishes -> dish
  }
  if (t.endsWith("s")) return t.slice(0, -1); // spreadsheets -> spreadsheet
  return t;
}

/** True when a token would survive tokenisation (used by rules that inspect terms). */
export function isMeaningfulToken(token: string): boolean {
  return tokenize(token).length > 0;
}

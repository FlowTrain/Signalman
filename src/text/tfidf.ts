// TF-IDF vectoriser and cosine similarity. Hand-rolled (~40 lines of maths)
// rather than pulling in a library — this code IS the tool, per soul.md, and it
// must stay auditable.
//
// Definitions used throughout:
//   tf(t, d)  = raw count of term t in document d
//   idf(t)    = ln((N + 1) / (df(t) + 1)) + 1        (smoothed, always >= 1)
//   weight    = tf(t, d) * idf(t)
//   cosine    = dot(a, b) / (||a|| * ||b||)
//
// Smoothed IDF is chosen over the textbook ln(N / df) so that tiny corpora
// (a handful of skills is the common case) never collapse to all-zero vectors,
// and so a term present in every document keeps a small positive weight rather
// than vanishing entirely.

export type Vector = Map<string, number>;

export class TfIdf {
  /** Document frequency: how many documents each term appears in. */
  private readonly df = new Map<string, number>();
  /** Number of documents in the corpus. */
  readonly n: number;

  constructor(documents: string[][]) {
    this.n = documents.length;
    for (const tokens of documents) {
      for (const term of new Set(tokens)) {
        this.df.set(term, (this.df.get(term) ?? 0) + 1);
      }
    }
  }

  /** Document frequency of a term (0 if unseen in the corpus). */
  documentFrequency(term: string): number {
    return this.df.get(term) ?? 0;
  }

  /** Smoothed inverse document frequency. Unseen terms are treated as df = 0. */
  idf(term: string): number {
    const df = this.df.get(term) ?? 0;
    return Math.log((this.n + 1) / (df + 1)) + 1;
  }

  /** TF-IDF weighted vector for a token list, using this corpus's IDF. */
  vector(tokens: string[]): Vector {
    const tf = new Map<string, number>();
    for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
    const vec: Vector = new Map();
    for (const [term, count] of tf) {
      vec.set(term, count * this.idf(term));
    }
    return vec;
  }
}

/** Cosine similarity of two sparse vectors. Returns 0 when either is empty. */
export function cosine(a: Vector, b: Vector): number {
  if (a.size === 0 || b.size === 0) return 0;

  // Iterate the smaller map for the dot product.
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  let dot = 0;
  for (const [term, weight] of small) {
    const other = large.get(term);
    if (other !== undefined) dot += weight * other;
  }
  if (dot === 0) return 0;

  const magnitude = norm(a) * norm(b);
  if (magnitude === 0) return 0;

  // Clamp to [0, 1] to absorb floating-point drift on near-identical vectors.
  return Math.min(1, dot / magnitude);
}

function norm(v: Vector): number {
  let sum = 0;
  for (const weight of v.values()) sum += weight * weight;
  return Math.sqrt(sum);
}

/** Terms shared by two token lists, ranked by combined IDF weight (most distinctive first). */
export function sharedTerms(aTokens: string[], bTokens: string[], model: TfIdf): string[] {
  const a = new Set(aTokens);
  const shared: string[] = [];
  for (const t of new Set(bTokens)) {
    if (a.has(t)) shared.push(t);
  }
  shared.sort((x, y) => model.idf(y) - model.idf(x));
  return shared;
}

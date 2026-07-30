import assert from "node:assert/strict";
import { test } from "node:test";

import { cosine, sharedTerms, TfIdf } from "../../src/text/tfidf.js";

// Ground-truth corpus. Tokens are supplied directly (not via the tokeniser) so
// this test pins the vectoriser maths alone.
//   A = apple banana apple      B = apple cherry      C = banana cherry date
// N = 3.  df: apple 2, banana 2, cherry 2, date 1.
// idf(t) = ln((N+1)/(df+1)) + 1  =>  df2: ln(4/3)+1,  df1: ln(2)+1.
const A = ["apple", "banana", "apple"];
const B = ["apple", "cherry"];
const C = ["banana", "cherry", "date"];
const model = new TfIdf([A, B, C]);

const IDF_DF2 = Math.log(4 / 3) + 1; // 1.2876820724517808
const IDF_DF1 = Math.log(2) + 1; // 1.6931471805599454
const EPS = 1e-12;

function closeTo(actual: number, expected: number, msg?: string): void {
  assert.ok(Math.abs(actual - expected) < EPS, msg ?? `${actual} !~= ${expected}`);
}

test("corpus size and document frequencies", () => {
  assert.equal(model.n, 3);
  assert.equal(model.documentFrequency("apple"), 2);
  assert.equal(model.documentFrequency("date"), 1);
  assert.equal(model.documentFrequency("missing"), 0);
});

test("idf matches the smoothed formula", () => {
  closeTo(model.idf("apple"), IDF_DF2);
  closeTo(model.idf("date"), IDF_DF1);
  // Unseen term: df = 0 => ln(4/1) + 1.
  closeTo(model.idf("zzz"), Math.log(4) + 1);
});

test("vector weights are tf * idf", () => {
  const vA = model.vector(A);
  closeTo(vA.get("apple")!, 2 * IDF_DF2); // 2.5753641449035616
  closeTo(vA.get("banana")!, 1 * IDF_DF2);
  assert.equal(vA.has("cherry"), false);
});

test("cosine of a vector with itself is 1", () => {
  closeTo(cosine(model.vector(A), model.vector(A)), 1);
});

test("cosine of A and B equals the closed form 2/sqrt(10)", () => {
  // dot = (2i)(i) = 2i^2 ; |A| = i*sqrt(5) ; |B| = i*sqrt(2) ; => 2/sqrt(10).
  closeTo(cosine(model.vector(A), model.vector(B)), 2 / Math.sqrt(10));
});

test("cosine matches hand-computed values for A/C and B/C", () => {
  closeTo(cosine(model.vector(A), model.vector(C)), 0.23159229566299991);
  closeTo(cosine(model.vector(B), model.vector(C)), 0.36617957142110741);
});

test("cosine is symmetric", () => {
  const s1 = cosine(model.vector(A), model.vector(C));
  const s2 = cosine(model.vector(C), model.vector(A));
  closeTo(s1, s2);
});

test("cosine is 0 for disjoint and empty vectors", () => {
  const m = new TfIdf([["x"], ["y"]]);
  assert.equal(cosine(m.vector(["x"]), m.vector(["y"])), 0);
  assert.equal(cosine(model.vector(A), model.vector([])), 0);
});

test("sharedTerms returns overlap ranked by idf (most distinctive first)", () => {
  assert.deepEqual(sharedTerms(A, B, model), ["apple"]);
  assert.deepEqual(sharedTerms(A, C, model), ["banana"]);
  // date (df1) is more distinctive than cherry (df2), so it sorts first.
  const shared = sharedTerms(["cherry", "date"], ["cherry", "date"], model);
  assert.deepEqual(shared, ["date", "cherry"]);
});

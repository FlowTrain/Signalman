import assert from "node:assert/strict";
import { test } from "node:test";

import { singularize, tokenize } from "../../src/text/tokenize.js";

test("tokenize lowercases and splits on non-word characters", () => {
  assert.deepEqual(tokenize("Clean up, this MESSY spreadsheet!"), ["clean", "messy", "spreadsheet"]);
});

test("tokenize drops stopwords and boilerplate", () => {
  // "use/when/the/user/wants/to" are all boilerplate or function words.
  assert.deepEqual(tokenize("Use this when the user wants to"), []);
});

test("tokenize drops single characters and keeps short domain terms", () => {
  assert.deepEqual(tokenize("a CSV or an xl file"), ["csv", "xl", "file"]);
});

test("tokenize folds plurals to singular", () => {
  assert.deepEqual(tokenize("spreadsheets columns categories boxes"), [
    "spreadsheet",
    "column",
    "category",
    "box",
  ]);
});

test("tokenize handles unicode letters", () => {
  assert.deepEqual(tokenize("café naïve"), ["café", "naïve"]);
});

test("singularize is conservative on -ss/-us/-is", () => {
  assert.equal(singularize("class"), "class");
  assert.equal(singularize("status"), "status");
  assert.equal(singularize("analysis"), "analysis");
  assert.equal(singularize("css"), "css");
});

test("singularize handles common plural shapes", () => {
  assert.equal(singularize("files"), "file");
  assert.equal(singularize("categories"), "category");
  assert.equal(singularize("dishes"), "dish");
  assert.equal(singularize("boxes"), "box");
  assert.equal(singularize("api"), "api"); // no trailing s, unchanged
});

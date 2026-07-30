import assert from "node:assert/strict";
import { test } from "node:test";

import { simulate, type SkillDoc } from "../src/simulator.js";

const CORPUS: SkillDoc[] = [
  {
    name: "spreadsheet-fixer",
    dirName: "spreadsheet-fixer",
    description: "Fix messy spreadsheets: clean columns and remove duplicate rows in CSV files.",
  },
  { name: "data-cleaner", dirName: "data-cleaner", description: "Clean and normalize data records." },
  { name: "report-writer", dirName: "report-writer", description: "Generate written reports from structured input." },
  { name: "xlsx", dirName: "xlsx", description: "Utilities for Excel workbooks." },
];

test("ranks the description whose vocabulary matches the request first", () => {
  const { rankings } = simulate(CORPUS, "help me clean up this messy spreadsheet");
  assert.equal(rankings[0]!.name, "spreadsheet-fixer");
  // Its matched terms include the request's domain words.
  for (const term of ["spreadsheet", "messy", "clean"]) {
    assert.ok(rankings[0]!.matched.includes(term), `expected match on ${term}`);
  }
});

test("skills with no shared vocabulary score 0 with no matched terms", () => {
  const { rankings } = simulate(CORPUS, "help me clean up this messy spreadsheet");
  const xlsx = rankings.find((r) => r.name === "xlsx")!;
  assert.equal(xlsx.score, 0);
  assert.deepEqual(xlsx.matched, []);
});

test("rankings are sorted by descending score", () => {
  const { rankings } = simulate(CORPUS, "clean messy spreadsheet data");
  for (let i = 1; i < rankings.length; i++) {
    assert.ok(rankings[i - 1]!.score >= rankings[i]!.score);
  }
});

test("flags a name/description gap: request term is in the name but not the description", () => {
  const docs: SkillDoc[] = [
    { name: "pdf-tools", dirName: "pdf-tools", description: "Document helpers." },
    { name: "notes", dirName: "notes", description: "Keep track of ideas." },
  ];
  const { nameGaps } = simulate(docs, "convert my pdf");
  assert.equal(nameGaps.length, 1);
  assert.equal(nameGaps[0]!.name, "pdf-tools");
  assert.deepEqual(nameGaps[0]!.missingTerms, ["pdf"]);
});

test("no name gap when the description already contains the name term", () => {
  const docs: SkillDoc[] = [
    { name: "pdf-tools", dirName: "pdf-tools", description: "Convert and merge pdf documents." },
  ];
  const { nameGaps } = simulate(docs, "convert my pdf");
  assert.deepEqual(nameGaps, []);
});

test("empty corpus produces an empty ranking without throwing", () => {
  const { rankings, nameGaps } = simulate([], "anything");
  assert.deepEqual(rankings, []);
  assert.deepEqual(nameGaps, []);
});

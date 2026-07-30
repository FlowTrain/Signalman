// The fire simulator (spec §6). A plain-English request goes in; a ranking of
// every discovered skill comes out, scored by lexical (TF-IDF cosine) similarity
// between the request and each description, with the matched terms named.
//
// This is the demo the tool lives or dies on, so the compute is separated from
// the rendering: `simulate()` is pure and unit-tested, `renderSimulation()` only
// formats. The lexical-only caveat is printed on every run, unconditionally
// (soul.md) — overclaiming on the one measurable thing would poison the rest.

import type { Colors } from "./color.js";
import { cosine, sharedTerms, TfIdf } from "./text/tfidf.js";
import { tokenize } from "./text/tokenize.js";

export interface SkillDoc {
  /** Display name — frontmatter `name` if present, else the directory name. */
  name: string;
  /** Directory basename, used for the name-vs-description gap check. */
  dirName: string;
  /** Description text; empty string when absent or unparseable. */
  description: string;
}

export interface Ranking {
  name: string;
  score: number;
  /** Request terms found in this description, most distinctive first. */
  matched: string[];
}

/**
 * A skill the user is likely asking for by name whose description won't route
 * it: a request term appears in the skill's name but not its description. This
 * is the tool's thesis made concrete, and the only warning we can raise
 * honestly from lexical data alone.
 */
export interface NameGap {
  name: string;
  /** 1-based rank in the ranking. */
  rank: number;
  /** Request terms present in the skill's name but missing from its description. */
  missingTerms: string[];
}

export interface SimulationResult {
  request: string;
  /** Distinct meaningful terms the request reduced to after tokenisation. */
  requestTerms: string[];
  rankings: Ranking[];
  nameGaps: NameGap[];
}

export function simulate(docs: SkillDoc[], request: string): SimulationResult {
  const corpusTokens = docs.map((d) => tokenize(d.description));
  const model = new TfIdf(corpusTokens);

  const requestTokens = tokenize(request);
  const requestVec = model.vector(requestTokens);
  const requestSet = new Set(requestTokens);

  const scored = docs.map((doc, i) => {
    const descTokens = corpusTokens[i]!;
    const score = cosine(requestVec, model.vector(descTokens));
    const matched = sharedTerms(requestTokens, descTokens, model);
    return { doc, descTokens, score, matched };
  });

  // Rank by score, then name for a stable, readable order.
  scored.sort((a, b) => b.score - a.score || a.doc.name.localeCompare(b.doc.name));

  const rankings: Ranking[] = scored.map((s) => ({
    name: s.doc.name,
    score: s.score,
    matched: s.matched,
  }));

  const nameGaps: NameGap[] = [];
  scored.forEach((s, index) => {
    const nameTokens = new Set(tokenize(`${s.doc.dirName} ${s.doc.name}`));
    const descSet = new Set(s.descTokens);
    const missing: string[] = [];
    for (const term of nameTokens) {
      if (requestSet.has(term) && !descSet.has(term)) missing.push(term);
    }
    if (missing.length > 0) {
      nameGaps.push({ name: s.doc.name, rank: index + 1, missingTerms: missing });
    }
  });

  return { request, requestTerms: [...requestSet], rankings, nameGaps };
}

const CAVEAT_LINE_1 =
  "Lexical match only: this measures whether your descriptions contain the words a";
const CAVEAT_LINE_2 =
  "request uses — not how a model would actually route. A low score means the vocabulary";
const CAVEAT_LINE_3 =
  "is missing, not that the skill is bad.";

/** Render one simulation result. The caveat footer is the caller's responsibility (printed once). */
export function renderSimulation(result: SimulationResult, c: Colors): string {
  const lines: string[] = [];
  lines.push(`Request: ${c.bold(`"${result.request}"`)}`);
  lines.push("");

  if (result.rankings.length === 0) {
    lines.push("  No skills found to simulate against.");
    return lines.join("\n") + "\n";
  }

  const width = Math.min(
    32,
    Math.max(...result.rankings.map((r) => r.name.length)),
  );
  const rankWidth = String(result.rankings.length).length;

  result.rankings.forEach((r, i) => {
    const rank = String(i + 1).padStart(rankWidth) + ".";
    const score = scoreColor(c, r.score)(r.score.toFixed(2));
    const name = fitName(r.name, width);
    const matched =
      r.matched.length > 0 ? c.cyan(r.matched.join(", ")) : c.dim("—");
    lines.push(`  ${rank}  ${score}  ${name}  matched: ${matched}`);
  });

  if (result.nameGaps.length > 0) {
    lines.push("");
    for (const gap of result.nameGaps) {
      const terms = gap.missingTerms.map((t) => `'${t}'`).join(", ");
      // The gap is detected across both the display name and the directory name,
      // so the wording covers both to stay accurate when they differ.
      const plural =
        gap.missingTerms.length === 1 ? "is in its name or directory" : "are in its name or directory";
      lines.push(
        `  ${c.yellow("⚠")}  '${gap.name}' ranked ${ordinal(gap.rank)}. ` +
          `${terms} ${plural} but not its description.`,
      );
    }
  } else if (result.rankings[0]!.score === 0) {
    lines.push("");
    if (result.requestTerms.length === 0) {
      lines.push(
        `  ${c.yellow("⚠")}  This request has no distinctive terms to match on ` +
          `after removing common words.`,
      );
    } else {
      lines.push(`  ${c.yellow("⚠")}  No description contains any term from this request.`);
    }
  }

  return lines.join("\n") + "\n";
}

/** The lexical-only caveat, printed once per invocation regardless of output. */
export function caveatFooter(c: Colors): string {
  return (
    c.dim(CAVEAT_LINE_1) + "\n" + c.dim(CAVEAT_LINE_2) + "\n" + c.dim(CAVEAT_LINE_3) + "\n"
  );
}

/** Pad a name to the column width, or clip it with an ellipsis so columns stay aligned. */
function fitName(name: string, width: number): string {
  if (name.length > width) return name.slice(0, Math.max(0, width - 1)) + "…";
  return name.padEnd(width);
}

function scoreColor(c: Colors, score: number): (s: string) => string {
  if (score >= 0.5) return c.green;
  if (score >= 0.2) return c.yellow;
  return c.dim;
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]!);
}

import { tokenize } from "../text/tokenize.js";
import { frontmatterString, frontmatterUsable } from "./helpers.js";
import type { FileRule } from "./types.js";

// SK007 — the highest-value rule. A description must answer *when to reach for
// this*, not *what this is*. An identity statement ("A tool for spreadsheets")
// gives an agent no condition to match a request against, so the skill silently
// never loads.
//
// The heuristic is deliberately simple and contestable (soul.md): a crisp rule
// an author can argue with beats a classifier they can't. It degrades to `info`
// whenever it is unsure — a false positive at `error` is how linters get
// uninstalled. Detection follows spec §4.1, in order of confidence:
//   1. an explicit condition marker  -> passes
//   2. a bare-noun-phrase identity   -> error (confident)
//   3. neither, one way or another   -> info (uncertain)

// 1. Explicit condition markers: the description says when to use the skill.
const TRIGGER_MARKERS: RegExp[] = [
  /\b(?:use|call|invoke|apply|reach for)\b[^.]{0,40}\bwhen\b/i,
  /\bwhen (?:the user|you|a user|someone|the request|handling|editing|creating|writing|working|asked|reviewing)\b/i,
  /\bwhenever\b/i,
  /\bwhen to use\b/i,
  /\bfor when\b/i,
  /\btrigger(?:s|ed)?\b/i,
  /\bstop and consult\b/i,
];

// 2. "Identity" vocabulary: nouns that name what a thing *is*.
const CAPABILITY =
  "(?:tool|toolkit|kit|utility|utilities|helper|helpers|library|libraries|module|modules|" +
  "collection|set|suite|framework|wrapper|assistant|function|functions|script|scripts|" +
  "command|commands|plugin|plugins|extension|extensions|package|handler|manager|generator|" +
  "integration|interface|api)";
const IDENTITY_OPEN = new RegExp(`^\\s*(?:a|an|the)\\s+${CAPABILITY}\\b`, "i");
const IDENTITY_OPEN_DIRECT = new RegExp(`^\\s*${CAPABILITY}\\b`, "i");
const IDENTITY_TAIL = new RegExp(`\\b${CAPABILITY}\\.?\\s*$`, "i");

// Singular capability tokens, for filtering domain vocabulary out of suggestions.
const CAPABILITY_TOKENS = new Set([
  "tool", "toolkit", "kit", "utility", "helper", "library", "module", "collection", "set",
  "suite", "framework", "wrapper", "assistant", "function", "script", "command", "plugin",
  "extension", "package", "handler", "manager", "generator", "integration", "interface", "api",
]);

// A rough "does the sentence contain an action?" test, so a phrase that ends in a
// capability noun but clearly describes doing something ("Use this to run a
// script") is treated as uncertain rather than confidently wrong.
const ACTION_VERBS = new Set([
  "use", "fill", "clean", "convert", "generate", "create", "edit", "extract", "merge", "write",
  "read", "analyze", "analyse", "format", "deploy", "review", "summarize", "summarise",
  "translate", "build", "run", "parse", "validate", "check", "fix", "remove", "add", "update",
  "draft", "open", "chart", "plot", "scan", "render", "manage", "handle", "process", "transform",
  "normalize", "normalise", "split", "join", "compress", "encrypt", "search", "find", "list",
  "sort", "filter", "rename", "copy", "move", "delete", "install", "configure", "test", "debug",
  "refactor", "lint", "commit", "draft", "download", "upload", "send", "fetch", "load", "save",
  "export", "import", "calculate", "compute", "count", "measure", "draw", "design", "schedule",
  "monitor", "track", "report", "make", "help", "turn", "set",
]);

export const sk007DescriptionTrigger: FileRule = {
  id: "SK007",
  name: "description-states-trigger-condition",
  severity: "error",
  scope: "file",
  docs: "sk007",
  check(ctx) {
    if (!frontmatterUsable(ctx)) return []; // SK002 owns unreadable frontmatter
    const desc = frontmatterString(ctx, "description");
    if (!desc) return []; // SK006 owns a missing description

    if (hasTriggerMarker(desc)) return [];

    const identityLed = IDENTITY_OPEN.test(desc) || IDENTITY_OPEN_DIRECT.test(desc);
    const nounPhrase = IDENTITY_TAIL.test(desc) && !hasActionVerb(desc);

    if (identityLed || nounPhrase) {
      return [
        {
          file: ctx.skill.filePath,
          message:
            "The description states what the skill is, not when to use it, so an agent has no " +
            "condition to match a request against and may never load it.",
          suggestion: rewriteSuggestion(desc, false),
          // Severity left to default (error) so config can still soften it.
        },
      ];
    }

    // Uncertain: no explicit trigger, but not a clear identity statement either.
    // Never error on a guess.
    return [
      {
        file: ctx.skill.filePath,
        severity: "info",
        message:
          "The description doesn't state an explicit trigger condition (“use when …”), " +
          "which weakens how reliably an agent will select this skill.",
        suggestion: rewriteSuggestion(desc, true),
      },
    ];
  },
};

function hasTriggerMarker(desc: string): boolean {
  return TRIGGER_MARKERS.some((re) => re.test(desc));
}

function hasActionVerb(desc: string): boolean {
  const words = desc.toLowerCase().match(/[a-z]+/g) ?? [];
  if (words.some((w) => ACTION_VERBS.has(w))) return true;
  if (/\bto\s+[a-z]+/i.test(desc)) return true; // "to fill", "to clean"
  return words.some((w) => w.length > 4 && w.endsWith("ing")); // a gerund
}

/**
 * Build a suggested rewrite from the author's ACTUAL description (spec: not a
 * generic template). We reuse the phrase that follows the first "for"/"to", or
 * failing that the description's own domain vocabulary, and lead with a trigger.
 */
function rewriteSuggestion(desc: string, soft: boolean): string {
  const lead = soft
    ? "Consider stating when to use it"
    : "Say when to reach for it, not just what it is";
  const rewrite = suggestTrigger(desc);
  if (rewrite) return `${lead}. For example: "${rewrite}"`;
  return `${lead}. Start with "Use when the user …" and name the task and the file types or domain it handles.`;
}

function suggestTrigger(desc: string): string | null {
  const cleaned = desc.trim().replace(/\s+/g, " ");

  const m = cleaned.match(/\b(for|to)\s+(.+?)[.]*$/i);
  if (m) {
    const keyword = m[1]!.toLowerCase();
    const object = lowerFirst(m[2]!.replace(/[.]+$/, "").trim());
    if (keyword === "to") return `Use when the user wants to ${object}.`;
    // keyword === "for": a gerund reads with "is …", a noun with "wants to work with …".
    const firstWord = object.split(/\s+/)[0] ?? "";
    if (/ing$/i.test(firstWord)) return `Use when the user is ${object}.`;
    return `Use when the user wants to work with ${object}.`;
  }

  const domain = domainTerms(cleaned);
  if (domain.length > 0) {
    return `Use when the user wants to work with ${domain.slice(0, 4).join(", ")}.`;
  }
  return null;
}

function domainTerms(desc: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of tokenize(desc)) {
    if (CAPABILITY_TOKENS.has(t) || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

/** Lowercase the first character unless the first word is an acronym (all caps). */
function lowerFirst(s: string): string {
  const firstWord = s.split(/\s+/)[0] ?? "";
  if (firstWord.length > 1 && firstWord === firstWord.toUpperCase()) return s;
  return s.charAt(0).toLowerCase() + s.slice(1);
}

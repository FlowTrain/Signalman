import { readFileSync } from "node:fs";
import { parseDocument } from "yaml";

/** A YAML parse failure, with a best-effort location relative to the whole file. */
export interface FrontmatterError {
  message: string;
  /** 1-based line within the SKILL.md file, when the parser reports a position. */
  line?: number;
  /** 1-based column, when the parser reports one. */
  col?: number;
}

export interface ParsedSkill {
  /** Full file text, retained so rules can report line/column against the source. */
  text: string;
  /** True when an opening `---` frontmatter fence was found at the top of the file. */
  frontmatterPresent: boolean;
  /** Parsed frontmatter as a mapping, or null when it is absent, malformed, or not a map. */
  frontmatter: Record<string, unknown> | null;
  /** Frontmatter keys in document order (useful for portability checks). */
  frontmatterKeys: string[];
  /** Set when the frontmatter block exists but could not be parsed. */
  frontmatterError: FrontmatterError | null;
  /** Markdown body after the closing fence. */
  body: string;
  /** 1-based file line where the body begins (after the closing fence). */
  bodyStartLine: number;
}

const BOM = "﻿";

/**
 * Split a SKILL.md into its frontmatter fence and body without throwing.
 *
 * The format is a YAML block delimited by `---` fences at the very top of the
 * file, followed by Markdown. We are deliberately tolerant: a missing or broken
 * fence is reported as data, never as an exception, so one bad file never aborts
 * a run (spec acceptance criterion 5).
 */
export function parseSkillText(input: string): ParsedSkill {
  const text = input.startsWith(BOM) ? input.slice(BOM.length) : input;
  const lines = text.split(/\r?\n/);

  // Frontmatter must open on the first line.
  if (lines[0]?.trim() !== "---") {
    return {
      text,
      frontmatterPresent: false,
      frontmatter: null,
      frontmatterKeys: [],
      frontmatterError: null,
      body: text,
      bodyStartLine: 1,
    };
  }

  // Find the closing fence.
  let closeIdx = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i]?.trim() === "---") {
      closeIdx = i;
      break;
    }
  }

  if (closeIdx === -1) {
    // Opened but never closed — malformed, but we still return cleanly.
    return {
      text,
      frontmatterPresent: true,
      frontmatter: null,
      frontmatterKeys: [],
      frontmatterError: { message: "Frontmatter block is not closed with a `---` fence.", line: 1 },
      body: "",
      bodyStartLine: lines.length + 1,
    };
  }

  const yamlText = lines.slice(1, closeIdx).join("\n");
  const body = lines.slice(closeIdx + 1).join("\n");
  const bodyStartLine = closeIdx + 2; // line after the closing fence, 1-based

  // The YAML block starts on file line 2 (index 1), so add 1 to map positions.
  const lineOffset = 1;

  const doc = parseDocument(yamlText, { prettyErrors: true });
  if (doc.errors.length > 0) {
    const err = doc.errors[0]!;
    const pos = err.linePos?.[0];
    return {
      text,
      frontmatterPresent: true,
      frontmatter: null,
      frontmatterKeys: [],
      frontmatterError: {
        message: err.message.split("\n")[0]!.trim(),
        line: pos ? pos.line + lineOffset : undefined,
        col: pos?.col,
      },
      body,
      bodyStartLine,
    };
  }

  const value = doc.toJS() as unknown;
  if (value === null || value === undefined) {
    // Empty frontmatter block. Present, but nothing in it.
    return {
      text,
      frontmatterPresent: true,
      frontmatter: {},
      frontmatterKeys: [],
      frontmatterError: null,
      body,
      bodyStartLine,
    };
  }

  if (typeof value !== "object" || Array.isArray(value)) {
    // Frontmatter parsed to a scalar or list rather than a mapping.
    return {
      text,
      frontmatterPresent: true,
      frontmatter: null,
      frontmatterKeys: [],
      frontmatterError: { message: "Frontmatter is not a key/value mapping.", line: 1 + lineOffset },
      body,
      bodyStartLine,
    };
  }

  const frontmatter = value as Record<string, unknown>;
  return {
    text,
    frontmatterPresent: true,
    frontmatter,
    frontmatterKeys: Object.keys(frontmatter),
    frontmatterError: null,
    body,
    bodyStartLine,
  };
}

/** Read and parse a SKILL.md file. Only the file read can throw; propagate it to the caller. */
export function parseSkillFile(path: string): ParsedSkill {
  return parseSkillText(readFileSync(path, "utf8"));
}

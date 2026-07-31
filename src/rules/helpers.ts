// Small shared helpers for rules. Kept deliberately tiny so each rule file stays
// self-contained and readable.

import type { FileContext } from "./types.js";

/**
 * True when the frontmatter parsed into a usable mapping. When it did not (bad
 * YAML, or a non-mapping value), SK002 owns the report and the field-level rules
 * (name/description) should stay quiet rather than pile on.
 */
export function frontmatterUsable(ctx: FileContext): boolean {
  return ctx.parsed.frontmatterError === null;
}

/** A trimmed non-empty string frontmatter value, or null. */
export function frontmatterString(ctx: FileContext, key: string): string | null {
  const value = ctx.parsed.frontmatter?.[key];
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

// Nouns that name what a thing *is* rather than what a user does with it. Shared
// by rules that separate domain vocabulary from generic capability words.
export const CAPABILITY_TOKENS = new Set([
  "tool", "toolkit", "kit", "utility", "helper", "library", "module", "collection", "set",
  "suite", "framework", "wrapper", "assistant", "function", "script", "command", "plugin",
  "extension", "package", "handler", "manager", "generator", "integration", "interface", "api",
]);

/** Targets of Markdown links `[text](target)` in the body. */
export function markdownLinkTargets(body: string): string[] {
  const out: string[] = [];
  for (const m of body.matchAll(/\[[^\]]*\]\(\s*([^)\s]+)\s*\)/g)) out.push(m[1]!);
  return out;
}

/** Absolute (`/a/b`, `C:\a`) and home (`~/a`) paths anywhere in the body — links, code, or prose. */
export function absolutePathRefs(body: string): string[] {
  const found = new Set<string>();
  const patterns = [
    /~\/[^\s`)>\]"']+/g, // ~/foo/bar
    /(?:^|[\s`("'[])(\/[A-Za-z0-9_][^\s`)>\]"']*\/[^\s`)>\]"']*)/g, // /a/b (>= 2 segments)
    /[A-Za-z]:[\\/][^\s`)>\]"']+/g, // C:\foo or C:/foo
  ];
  for (const re of patterns) {
    for (const m of body.matchAll(re)) found.add((m[1] ?? m[0]).trim());
  }
  return [...found];
}

/**
 * Turn any string into a valid lowercase-hyphenated name for use in suggestions.
 * Also enforces the 64-character limit SK005 checks, so a suggested name is never
 * itself a violation, trimming any hyphen left dangling by the cut.
 */
export function slugify(input: string): string {
  const slug = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug.length <= 64 ? slug : slug.slice(0, 64).replace(/-+$/, "");
}

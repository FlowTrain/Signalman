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

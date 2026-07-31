import { ruleOption } from "../config.js";
import { tokenize } from "../text/tokenize.js";
import { CAPABILITY_TOKENS, frontmatterString, frontmatterUsable } from "./helpers.js";
import type { FileRule } from "./types.js";

// SK009 — a description needs concrete domain vocabulary. Built entirely from
// generic words ("a helper that does things"), it has nothing for a request to
// match against, even if it passes every other rule.
export const sk009DomainVocab: FileRule = {
  id: "SK009",
  name: "description-has-domain-vocabulary",
  severity: "warn",
  scope: "file",
  docs: "sk009",
  check(ctx) {
    if (!frontmatterUsable(ctx)) return [];
    const desc = frontmatterString(ctx, "description");
    if (!desc) return []; // SK006 owns a missing description

    const minTerms = ruleOption(ctx.config, "SK009", "minTerms", 1);
    const terms = new Set(tokenize(desc));
    for (const capability of CAPABILITY_TOKENS) terms.delete(capability);

    if (terms.size >= minTerms) return [];
    return [
      {
        file: ctx.skill.filePath,
        message:
          "The description has no concrete domain vocabulary — only generic words — so a request " +
          "has nothing specific to match against.",
        suggestion:
          "Name the specific nouns the skill deals with (formats, file types, tools, domains), " +
          'e.g. "PDF forms", ".xlsx files", "git diffs".',
      },
    ];
  },
};

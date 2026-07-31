# Contributing

Thanks for helping make skill-routing failures loud.

## Setup

```bash
npm install
npm run build   # tsc + copies data/schema into dist
npm test        # Node's built-in test runner
```

Node 20+. TypeScript, ESM. **Exactly one runtime dependency** (a YAML parser) —
this is enforced and intentional. TF-IDF, argument parsing, colour, and glob
matching are hand-rolled; please keep it that way. Dev dependencies are
unconstrained.

## Adding a rule

Rules are ESLint-shaped: one file per rule under `src/rules/`, no shared mutable
state. A file rule runs once per skill; a corpus rule runs once over all skills.

1. Create `src/rules/skNNN-your-rule.ts`:

```ts
import { frontmatterString, frontmatterUsable } from "./helpers.js";
import type { FileRule } from "./types.js";

export const skNNNYourRule: FileRule = {
  id: "SK0NN",
  name: "short-kebab-slug",
  severity: "warn", // "error" | "warn" | "info"
  scope: "file",
  docs: "sk0nn", // RULES.md anchor
  check(ctx) {
    if (!frontmatterUsable(ctx)) return []; // SK002 owns broken frontmatter
    const description = frontmatterString(ctx, "description");
    if (!description || description.includes("good enough")) return [];
    return [
      {
        file: ctx.skill.filePath,
        message: "What is wrong, in one line.",
        suggestion: "A concrete fix — required; a finding without one is rejected.",
      },
    ];
  },
};
```

2. Register it in `src/rules/index.ts` (add to `fileRules` or `corpusRules`).
3. Document it in `RULES.md` with an `<a id="sk0nn"></a>` anchor and a ✗/✓ example.
4. Add a passing and a failing test (see `test/rules.test.ts`).

## Rules for rules

- **Every finding needs a `suggestion`.** "This is wrong" without a fix is not
  acceptable.
- **Never `error` on a guess.** If a heuristic is uncertain, emit `info` and
  explain the reasoning. A false positive at `error` severity is how linters get
  uninstalled — return `severity: "info"` from the finding when unsure.
- **Read-only, always.** Rules (and Signalman as a whole) never write to a
  skill or its directory.
- **Agent-agnostic copy.** `SKILL.md` is read by many agents; don't imply
  Signalman is any single vendor's tool, in code, comments, or output.
- Prefer a crisp, contestable heuristic over a clever classifier nobody can argue
  with. Thresholds belong in the finding's data or in configurable options.

## Tests

Fixture-driven, using Node's built-in runner. Every rule gets a passing and a
failing case. The example corpus in `examples/` doubles as an integration
fixture (`test/examples.test.ts`); keep each `examples/bad/` skill broken in
exactly one way.

```bash
npm test
```

## Data files

The frontmatter key → agent map lives in
[`src/data/frontmatter-keys.json`](src/data/frontmatter-keys.json). Agents add
and rename frontmatter keys over time — PRs that keep this current are especially
welcome.

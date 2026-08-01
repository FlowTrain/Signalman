# Signalman

**A skill's `description` is its only trigger surface.** An agent reads
descriptions to decide which skill to load — nothing else in a `SKILL.md` takes
part in that decision.

So a vague description doesn't produce a badly-behaved skill. It produces a skill
that **never loads at all** — and the symptom is that the agent just seems bad at
the task. Nothing errors. Nothing warns. People rewrite the *body* of a skill
that was never being read.

Signalman makes that silent failure loud.

```
Request: "help me clean up this messy spreadsheet"

   1.  0.42  data-cleaner          matched: clean, messy, spreadsheet
   2.  0.42  spreadsheet-scrubber  matched: messy, clean, spreadsheet
   3.  0.17  identity-not-trigger  matched: spreadsheet
   4.  0.00  pdf-form-filler       matched: —
   …
```

The **fire simulator** ranks every discovered skill against a plain-English
request, by lexical similarity between the request and each `description`. When a
skill you expected to win ranks near the bottom, its description is missing the
words a user would actually type — and now you can see it.

## Why this is cross-agent infrastructure

`SKILL.md` is an open format ([Agent Skills](https://agentskills.io)) read by
many agents — Claude Code, GitHub Copilot, Codex, Cursor, and others —
discovered from project roots (`.claude/skills/`, `.github/skills/`,
`.agents/skills/`) and their personal equivalents (`~/.claude/skills/`,
`~/.copilot/skills/`, `~/.agents/skills/`). A description that can't route is a
cross-agent problem, so Signalman is agent-agnostic: it never assumes which agent
will read your skills.

Signalman judges whether a skill can be **reached**, not whether it's **useful**.
It does not review skill bodies for quality.

## Try it (zero install)

```bash
npx signalman-lint examples/bad
```

That runs against a deliberately-broken example corpus and prints a real report:

```
errors (5)

  SK006   examples/bad/no-description/SKILL.md
          Frontmatter has no 'description'. The description is the only text an
          agent matches against, so this skill can never be selected.
          fix: Add a description that says when to use the skill, e.g. "Use when
          the user wants to …".
          RULES.md#sk006

  SK007   examples/bad/identity-not-trigger/SKILL.md
          The description states what the skill is, not when to use it, so an
          agent has no condition to match a request against and may never load it.
          fix: Say when to reach for it, not just what it is. For example: "Use
          when the user is working with spreadsheets and tabular data."
          RULES.md#sk007

warnings (…)

  SK102   examples/bad/data-cleaner/SKILL.md
          Trigger collision (similarity 0.91) with 'spreadsheet-scrubber'. Shared
          terms: messy, csv, clean, removing, duplicate, row, fixing, column.
          ↔ examples/bad/spreadsheet-scrubber/SKILL.md
          fix: Differentiate their descriptions, or merge the two skills.
```

Every finding says what's wrong, **suggests a concrete fix**, and links to the
rule in [`RULES.md`](RULES.md).

## Usage

```bash
# Lint the conventional skill roots under the current project + your personal ones
npx signalman-lint

# Lint specific paths
npx signalman-lint .claude/skills .github/skills

# Rank skills against a request (the fire simulator)
npx signalman-lint --simulate "convert a pdf to text"

# One request per line, e.g. for regression-testing routing in CI
npx signalman-lint --simulate-from requests.txt

# Machine-readable output
npx signalman-lint --format json
```

Other flags: `--project-only`, `--personal-only`, `--config <path>`,
`--max-warnings <n>`, `--color` / `--no-color`. The installed command is
`signalman`.

With no paths, Signalman scans the conventional roots and **reports which it
scanned and which were absent**, so a clean run is distinguishable from one that
simply found no skills.

## Configuration (optional)

Signalman looks for `signalman.config.json` upward from the working directory, or
pass `--config <path>`. Every threshold has an opinionated default, so config is
only for disagreeing.

```json
{
  "include": [".claude/skills", ".github/skills", ".agents/skills"],
  "exclude": ["**/fixtures/**"],
  "rules": {
    "SK010": "off",
    "SK008": ["warn", { "min": 60, "max": 400 }],
    "SK102": ["warn", { "threshold": 0.8 }]
  },
  "maxWarnings": 0
}
```

- **`rules`** — turn a rule off (`"off"`), change its severity (`"warn"`), or set
  its options (`["warn", { … }]`).
- **`include`** — project roots to scan instead of the defaults.
- **`exclude`** — globs of skills to skip.
- **`maxWarnings`** — fail (exit 1) when warnings exceed this; the
  `--max-warnings` flag overrides it.

## Use it as a publish gate (CI)

Bad frontmatter should never reach a registry. Signalman's exit codes let a
pipeline fail on real problems without failing when the linter itself can't run:

| Code | Meaning |
| ---- | ------- |
| `0` | No findings, or `info` only |
| `1` | Warnings exceeded `--max-warnings` |
| `2` | One or more `error` findings |
| `3` | Signalman itself failed (bad path, unreadable file) |

```yaml
# .github/workflows/skills.yml
- run: npx signalman-lint .claude/skills
  # exit 2 fails the build on un-routable skills; exit 3 (linter broke) is
  # distinguishable if you want to treat it differently.
```

## The rules

Twenty rules across two scopes; full descriptions with ✗/✓ examples in
[`RULES.md`](RULES.md).

- **File rules (SK001–SK017)** — per skill: filename, YAML validity, name/
  description presence and shape, **whether the description states a trigger
  (SK007)**, length, domain vocabulary, negative scope, voice, body content,
  references, path portability, agent-specific keys, and size.
- **Corpus rules (SK101–SK103)** — across skills: duplicate names, **trigger
  collisions** (two descriptions too similar to tell apart), and
  **distinctiveness** (a description built from words every other skill also uses).

## The fire simulator is lexical only

The simulator measures whether your descriptions contain the words a request
uses — **not** how a model actually routes. A low score means the vocabulary is
missing, not that the skill is bad. It says so on every run. It catches the
common case (a description missing the words a user would plausibly type); it
will miss paraphrase.

## Design choices

| Decision | Bought | Paid |
| --- | --- | --- |
| TF-IDF over embeddings | Zero-key, zero-install, instant | Lexical only; misses paraphrase |
| Exactly one runtime dependency (a YAML parser) | `npx` adoption, auditability | Hand-rolled vectoriser, arg parser, colour, glob |
| No auto-fix, ever | Nothing to fear running it | You do the rewriting — and learn the pattern |
| Heuristic SK007 | Explainable and arguable | Has false positives, so it degrades to `info`, never `error`, on a guess |

Signalman is read-only against everything it scans, always. It never writes to a
skills directory.

## Roadmap

- **v1.1** — opt-in embedding-based similarity for the simulator and SK102/SK103, behind an API key.
- **v1.2** — SARIF output for GitHub code scanning.
- **v2.0** — real routing eval: ask a model which skill it would load for a request set and diff against expected, turning the simulator's lexical guess into ground truth.
- **v2.x** — investigate linting always-on instruction files (`AGENTS.md`, etc.) — only if they turn out to have an equivalent silent-failure mode.

Contributions welcome — adding a rule takes about ten minutes; see
[`CONTRIBUTING.md`](CONTRIBUTING.md).

## Requirements

Node 20+. Built with TypeScript, ships as ESM.

## License

MIT

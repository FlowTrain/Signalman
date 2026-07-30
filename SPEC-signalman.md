# SPEC — Signalman: a linter for SKILL.md trigger quality

**Working name:** `signalman` — the operator who sets the signals that decide which train goes
down which track. A skill that never fires is a missed signal.
**Check npm and GitHub for the name before committing to it.** I have not verified it's free.

**Status:** Draft for implementation
**Audience:** public repo, strangers, zero context
**License:** MIT

---

## 1. The Thesis

A skill's `description` frontmatter is its *only* trigger surface. The agent reads descriptions to
decide which skill to load. Nothing else in the file participates in that decision.

So a vague description doesn't produce a badly-behaved skill. It produces a skill that **never
loads at all** — and the symptom is that the agent seems bad at the task. The failure is silent,
attributed to the wrong component, and therefore almost never diagnosed. People rewrite the body
of a skill that was never being read.

Signalman makes that failure loud.

This thesis goes at the top of the README, before installation. It is the reason anyone would care.

### 1.1 Why now

SKILL.md is no longer Claude-specific — Copilot, Codex, and Cursor read the same format, with
skills discovered from `.claude/skills/`, `.github/skills/`, and `.agents/skills/`. That makes a
linter agent-agnostic infrastructure rather than an accessory to one vendor's tool. Position it
that way throughout. Do not write Claude-only copy.

---

## 2. Scope

### 2.1 In scope (v1.0)

- Discover skills across all conventional locations, project and personal.
- Static checks on frontmatter and body (§4).
- Corpus-level checks: trigger collision and distinctiveness (§5).
- The **fire simulator** — plain-English request in, ranked skill list out (§6). This is the
  feature people will actually run.
- Human report, JSON output, meaningful exit codes for CI.
- A deliberately-broken example corpus so `npx signalman examples/` produces interesting output
  with zero setup.

### 2.2 Out of scope (v1.0)

| Out | Why |
|---|---|
| Model-assisted eval of real trigger behaviour | Needs an API key; kills zero-install adoption. Roadmap. |
| Embedding-based similarity | TF-IDF is good enough on short text and needs no key. Roadmap as opt-in. |
| Auto-fix / rewrite suggestions | Suggest a fix in prose; don't write files. Trust is the whole product. |
| SARIF output | Nice for GitHub code scanning, but scope. Roadmap. |
| Linting `AGENTS.md` / `CLAUDE.md` / instruction files | Different problem — those are always-on, not triggered. Stay focused. |

### 2.3 Non-goals

Signalman does not judge whether a skill is *useful*, only whether it can be *reached*. Say that
in the README so nobody files issues asking it to review skill bodies for quality.

---

## 3. Architecture

```
  signalman [paths...] [--format human|json] [--simulate "<request>"]
        │
        ├─ Discovery      → find SKILL.md files across known roots
        ├─ Parse          → frontmatter + body, tolerant of malformed YAML
        ├─ FileRules      → per-skill checks, §4
        ├─ CorpusRules    → cross-skill checks, §5
        ├─ Simulator      → §6, only when --simulate is passed
        └─ Report         → human | json, exit code
```

**Stack:** Node 20+, TypeScript, ESM. One runtime dependency: a YAML parser. Nothing else.

The dependency budget is a feature, not asceticism — `npx signalman` with no install is the
adoption path, and every added dependency is a reason someone doesn't run it. TF-IDF is about
forty lines; do not reach for a library.

**Rule plugin shape.** Every rule is a module exporting the same interface, because a repo meant to
attract contributors needs a contribution surface that takes ten minutes to understand:

```ts
interface Rule {
  id: string;              // 'SK007'
  name: string;            // 'description-states-trigger-condition'
  severity: 'error' | 'warn' | 'info';
  scope: 'file' | 'corpus';
  docs: string;            // anchor into RULES.md
  check(ctx: FileContext | CorpusContext): Finding[];
}
```

ESLint-shaped on purpose. Familiarity is worth more here than elegance.

---

## 4. File Rules

Verify each of these against current docs before implementing — the format has conventions that
have shifted, and this spec should not be trusted over the live SKILL.md documentation. Where a
rule below encodes a threshold, the threshold is a starting guess and belongs in config.

| ID | Rule | Severity | Notes |
|---|---|---|---|
| SK001 | Filename is exactly `SKILL.md` | error | A lowercase `skill.md` is not discovered. Silent. |
| SK002 | Frontmatter parses as YAML | error | Report the parse error verbatim with line number. |
| SK003 | `name` present | error | |
| SK004 | `name` matches containing directory | warn | Mismatch breaks some discovery paths. |
| SK005 | `name` is lowercase-hyphenated | warn | Underscores and spaces are inconsistently handled. |
| SK006 | `description` present and non-empty | error | The headline failure. |
| SK007 | **`description` states a trigger condition, not just an identity** | error | See §4.1. Highest-value rule in the tool. |
| SK008 | `description` length within band | warn | Too short can't discriminate; too long dilutes. Default 40–500 chars, configurable. |
| SK009 | `description` contains concrete domain vocabulary | warn | Zero domain nouns means nothing to match against. |
| SK010 | `description` declares negative scope | info | "Do NOT use for…" is a strong signal. Absence is not a defect, but flagging it teaches the pattern. |
| SK011 | Consistent grammatical voice in `description` | info | Mixed second/third person is a smell. |
| SK012 | Body is non-empty | error | |
| SK013 | Body is not a restatement of the description | warn | High similarity between the two means the skill carries no actual instruction. |
| SK014 | Referenced relative paths in body exist | warn | Broken references degrade silently at runtime. |
| SK015 | No absolute paths or `~/` in body references | warn | These don't resolve in most agents. |
| SK016 | Unknown frontmatter keys reported with owning agent | info | See §4.2 — this is a portability feature, not an error. |
| SK017 | Total file size within budget | info | Some ecosystems cap instruction files. Warn near the limit rather than asserting one number. |

### 4.1 SK007 — the rule that matters

A description must answer *when to reach for this*, not *what this is*.

```
✗  "A tool for working with spreadsheets."
✗  "Spreadsheet utilities and helpers."
✓  "Use when the user wants to open, edit, clean, or chart data in an .xlsx or .csv file."
```

Detection, in order of confidence:

1. Look for explicit condition markers near the start: `use when`, `use this when`, `trigger`,
   `when the user`, `for when`, `invoke when`, `stop and consult`.
2. Absent those, check whether the description opens as a bare noun phrase ("A tool for…",
   "Utilities for…", "Helper that…") — a strong negative signal.
3. Check for at least one verb describing a *user action* rather than a tool capability.

Do not attempt to be clever. A crisp heuristic with a clearly-worded explanation and a rewritten
example in the output beats a sophisticated classifier that people can't argue with. When the
heuristic is uncertain, emit `info` with the reasoning, not `error`.

Every SK007 finding must include a suggested rewrite of the user's actual description. That is
what makes the tool feel worth running rather than worth silencing.

### 4.2 SK016 — cross-agent portability

Some frontmatter keys are agent-specific and ignored elsewhere. Rather than flagging them as
errors, report which agent each key belongs to so the author can see their portability surface:

```
info  SK016  .claude/skills/report-writer/SKILL.md
      Frontmatter key 'context' is Claude Code-specific and ignored by other agents.
      Frontmatter key 'globs' is Cursor-specific and ignored by other agents.
      Core keys (name, description) are portable across all known agents.
```

Maintain the key→agent mapping in a single data file, not scattered through rule code. It will go
stale and someone will PR it.

---

## 5. Corpus Rules

These are the differentiator. Anything can validate YAML.

| ID | Rule | Severity |
|---|---|---|
| SK101 | Duplicate `name` across skills | error |
| SK102 | **Trigger collision** — two descriptions too similar to discriminate | warn |
| SK103 | **Low distinctiveness** — description carries no unique vocabulary | warn |

### 5.1 SK102 — trigger collision

Two skills with semantically overlapping descriptions compete, and which one loads becomes
unpredictable. Compute pairwise cosine similarity over TF-IDF vectors of the description text.
Flag pairs above a configurable threshold (start at 0.75) and report both sides with the
overlapping terms highlighted.

Output must name the shared vocabulary, because that's the actionable part:

```
warn  SK102  trigger collision (similarity 0.82)
      .claude/skills/data-cleaner/SKILL.md
      .claude/skills/spreadsheet-fixer/SKILL.md
      Shared trigger terms: spreadsheet, clean, messy, csv, column
      These two skills will compete. Differentiate their descriptions or merge them.
```

### 5.2 SK103 — distinctiveness score

This is just IDF, and it's the most quietly useful metric in the tool. For each description,
compute the mean inverse document frequency of its terms across the corpus. A description built
entirely from words that appear in most other descriptions has no discriminating power, even if it
passes every file-level rule.

Report as a 0–100 score per skill, and put the corpus distribution in the report summary. Skills in
the bottom decile get a warning. Being able to say "your `description` is made of words every other
skill also uses" is a diagnosis nobody currently has language for.

---

## 6. The Fire Simulator

`signalman --simulate "help me clean up this messy spreadsheet"`

Ranks every discovered skill by TF-IDF similarity between the request and each description, and
prints the ranking with scores and the matched terms.

```
Request: "help me clean up this messy spreadsheet"

  1.  0.71  spreadsheet-fixer      matched: spreadsheet, messy, clean
  2.  0.44  data-cleaner           matched: clean, data
  3.  0.09  report-writer          matched: —
  4.  0.04  xlsx                   matched: —

  ⚠  'xlsx' ranked 4th. Its description doesn't contain 'spreadsheet', 'messy', or 'clean'.
```

**This is the demo.** It's the screenshot in the README and the thing that makes the thesis
concrete rather than abstract. Build it early — before most of §4 — because it validates the
tokeniser and vectoriser that SK102 and SK103 both depend on, and because it's the feature that
determines whether the repo gets traction.

Two honesty requirements, stated in both the output and the README:

- This is lexical similarity, **not** what the model actually does. It's a smoke test for whether
  the vocabulary is present at all, and it catches the common case, which is a description missing
  the words a user would plausibly type.
- Say so in the output footer every single run. Overclaiming here would be the fastest way to lose
  the credibility the tool is trying to build.

`--simulate-from <file>` reads one request per line, for regression-testing a corpus against a set
of expected routings. That's the CI-friendly version and the seam where a real model-backed eval
lands in v2.

---

## 7. Output and Exit Codes

**Human format** (default): grouped by severity, findings sorted worst-first, each with file path,
rule ID, one-line explanation, and a concrete suggestion. Summary footer with counts and the
corpus distinctiveness distribution. Colour when TTY, plain when piped.

**JSON format** (`--format json`): stable schema, one object with `findings[]`, `summary`, and
`corpus` sections. Version the schema from day one.

**Exit codes:**

- `0` — no findings, or findings at `info` only
- `1` — one or more `warn`, and `--max-warnings` exceeded (default: unlimited, so warnings don't
  fail by default)
- `2` — one or more `error`
- `3` — Signalman itself failed (bad config, unreadable path)

Distinguishing 2 from 3 matters for anyone gating a pipeline on this. A publish gate wants to fail
the build on `error` — bad frontmatter never reaches the registry — without failing when the linter
itself can't run.

Document that gating pattern in the README as a use case. It's the reason this gets adopted by
teams rather than individuals, and it's a stronger pitch than "keeps your skills tidy."

---

## 8. Configuration

`signalman.config.json` at the project root, discovered upward from cwd:

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

Every threshold in §4 and §5 is configurable. Ship opinionated defaults and let people disagree
without forking.

---

## 9. Discovery

Scan, in order, deduplicating by real path:

- Explicit paths passed as arguments (if any, skip all defaults)
- Project: `.claude/skills/`, `.github/skills/`, `.agents/skills/`
- Personal: `~/.claude/skills/`, `~/.copilot/skills/`, `~/.agents/skills/`

`--project-only` and `--personal-only` flags. Report which roots were scanned and which were absent
in the summary — a user with zero findings should be able to tell the difference between "clean" and
"found nothing."

---

## 10. Repository Shape

The repo is a pitch as much as a tool. Get these right:

```
README.md              thesis first, install second, screenshot third
RULES.md               one section per rule, with ✗/✓ examples. Findings link here.
examples/
  good/                two skills that pass everything
  bad/                 five skills, each broken differently, one collision pair
src/
  rules/               one file per rule
  data/frontmatter-keys.json
CONTRIBUTING.md        "adding a rule" walkthrough, ~20 lines of real code
```

`examples/bad/` is not optional. `npx signalman examples/bad` must produce a rich, interesting
report on a clean machine with no user skills installed. That's the thirty-second experience that
decides whether someone stars it.

---

## 11. Acceptance Criteria

1. `npx signalman examples/bad` on a clean machine produces findings from at least eight distinct
   rules, including one SK102 collision pair.
2. `npx signalman examples/good` exits 0 with no `error` or `warn`.
3. `--simulate` produces a sane ranking on `examples/`, and the footer states the lexical caveat.
4. Every finding includes a suggested fix. No finding says only that something is wrong.
5. Malformed YAML in one skill does not abort the run — that skill reports SK002 and the rest are
   still linted.
6. `--format json` output validates against the committed schema.
7. Exit code 2 on error, 3 on linter failure, verified by test.
8. One runtime dependency. `npm ls --prod --depth=0` shows exactly one line.
9. README's first screenful states the thesis and does not mention installation.

---

## 12. Roadmap (put this in the README — it recruits contributors)

- **v1.1** Opt-in embedding-based similarity for SK102/SK103 and the simulator, behind an API key.
- **v1.2** SARIF output for GitHub code scanning.
- **v2.0** Real routing eval: given a request set and a corpus, ask a model which skill it would
  load and diff against expected. Turns the simulator's lexical guess into ground truth.
- **v2.x** `AGENTS.md` and instruction-file linting, if the always-on file problem turns out to
  have equivalent silent failure modes. Investigate before committing.

---

## 13. Trade-offs Made Explicit

| Decision | Bought | Paid |
|---|---|---|
| TF-IDF over embeddings | Zero-key, zero-install, instant | Lexical only; misses paraphrase |
| One dependency | `npx` adoption, auditability | Hand-rolled vectoriser to maintain |
| Node over Python | `npx` reach in the agent-tooling ecosystem | Alienates a Python-first audience |
| No auto-fix | Trust; nobody fears running it | Users do the rewriting |
| ESLint-shaped rules | Instant familiarity, easy contribution | Some ceremony for a small tool |
| Heuristic SK007 | Explainable, arguable, cheap | Will have false positives; must degrade to `info` |

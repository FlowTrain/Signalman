# Rules

Every Signalman finding links to its rule here. Each rule says what it checks,
why it matters, its default severity, and shows a failing (✗) and passing (✓)
example. The severities and thresholds shown here are the defaults; per-rule
configuration via `signalman.config.json` is planned (spec §8).

Rules are grouped as **file rules** (checked per skill) and **corpus rules**
(checked across all skills). More rules are documented as they are implemented.

| ID | Rule | Severity |
| --- | --- | --- |
| [SK001](#sk001) | Filename is exactly `SKILL.md` | error |
| [SK002](#sk002) | Frontmatter parses as YAML | error |
| [SK003](#sk003) | `name` present | error |
| [SK004](#sk004) | `name` matches directory | warn |
| [SK005](#sk005) | `name` is lowercase-hyphenated | warn |
| [SK006](#sk006) | `description` present and non-empty | error |
| [SK007](#sk007) | `description` states a trigger condition, not just an identity | error |
| [SK008](#sk008) | `description` length within band (default 40–500) | warn |
| [SK009](#sk009) | `description` has concrete domain vocabulary | warn |
| [SK010](#sk010) | `description` declares negative scope | info |
| [SK011](#sk011) | Consistent grammatical voice in `description` | info |
| [SK012](#sk012) | Body is non-empty | error |
| [SK013](#sk013) | Body is not a restatement of the `description` | warn |
| [SK014](#sk014) | Referenced relative paths exist | warn |
| [SK015](#sk015) | No absolute or `~/` paths in body | warn |
| [SK016](#sk016) | Frontmatter key portability | info |
| [SK017](#sk017) | File size within budget | info |
| [SK018](#sk018) | File in a skills root is not `SKILL.md` (won't be discovered) | warn |
| [SK101](#sk101) | Duplicate `name` across skills | error |
| [SK102](#sk102) | Trigger collision — two descriptions too similar | warn |
| [SK103](#sk103) | Low distinctiveness — description carries no unique vocabulary | warn |

---

## File rules

<a id="sk001"></a>
### SK001 — filename is exactly `SKILL.md`

The entry file must be named `SKILL.md`, exact case. A `skill.md` or `Skill.md`
is not discovered by most agents, so the skill never loads and nothing warns.

- ✗ `my-skill/skill.md`
- ✓ `my-skill/SKILL.md`

<a id="sk002"></a>
### SK002 — frontmatter parses as YAML

The frontmatter block between the `---` fences must parse as a YAML mapping. If
it doesn't, `name` and `description` can't be read and the skill can't be
selected. Signalman reports the parser's message and line.

A common cause is an unquoted value containing a colon.

```yaml
# ✗ the colon after "spreadsheets" starts a second mapping value
description: Fix spreadsheets: clean and normalize them
```
```yaml
# ✓ quote the value
description: "Fix spreadsheets: clean and normalize them"
```

<a id="sk003"></a>
### SK003 — `name` present

A skill needs a `name`. Without one it can't be invoked directly, and some
agents won't register it.

- ✗ frontmatter with only a `description`
- ✓ `name: pdf-form-filler`

<a id="sk004"></a>
### SK004 — `name` matches directory

The `name` should equal the skill's directory name. Several agents key discovery
or the command name off the directory, so a mismatch can make the skill
reachable only under a name its own frontmatter doesn't declare.

- ✗ directory `caps-mismatch/` with `name: something-else`
- ✓ directory `pdf-form-filler/` with `name: pdf-form-filler`

<a id="sk005"></a>
### SK005 — `name` is lowercase-hyphenated

Per the Agent Skills standard, a name is 1–64 characters of lowercase letters,
digits, and single hyphens, with no leading, trailing, or consecutive hyphens.
Capitals, underscores, and spaces are handled inconsistently across agents.

- ✗ `Caps_Mismatch`
- ✓ `caps-mismatch`

<a id="sk006"></a>
### SK006 — `description` present and non-empty

The headline failure. The `description` is the only text an agent matches a
request against. With none, the skill is never selected — and the symptom looks
like the model being bad at the task, not a missing field.

- ✗ frontmatter with a `name` but no `description`
- ✓ `description: Use when the user wants to fill or read a PDF form.`

<a id="sk007"></a>
### SK007 — `description` states a trigger condition

The most important rule. A description is the only text an agent matches a
request against, so it must answer *when to reach for this skill*, not *what the
skill is*. An identity statement gives nothing to match against.

Detection, in order of confidence:

1. **Passes** when the description contains an explicit condition marker —
   `use when`, `when the user`, `whenever`, `trigger`, `for when`, and similar.
2. **Errors** when the description is an identity statement — it opens as a bare
   noun phrase (`A tool for …`, `Utilities for …`) or is a pure noun phrase
   ending in a capability noun (`Spreadsheet utilities and helpers`).
3. **Info** otherwise — no explicit trigger, but not clearly an identity either.
   The heuristic degrades to `info` rather than risk a false `error`.

Every finding suggests a rewrite built from your own description — reusing the
phrase after the first `for`/`to`, or failing that the description's own
vocabulary — rather than a generic template. (A description with no content
words at all falls back to a short prompt to describe the task.)

```yaml
# ✗ says what it is
description: A tool for working with spreadsheets.
```
```yaml
# ✓ says when to use it
description: Use when the user wants to clean, edit, or chart data in an .xlsx or .csv file.
```

<a id="sk008"></a>
### SK008 — `description` length within band

Too short can't discriminate one skill from another; too long dilutes the
trigger and risks being truncated in the skill listing. Default band 40–500
characters, configurable.

- ✗ `description: Spreadsheet tool.`
- ✓ a description that names the task and the file types, in one or two sentences

<a id="sk009"></a>
### SK009 — `description` has concrete domain vocabulary

A description built entirely from generic words has nothing specific for a
request to match against, even if it passes every other rule.

- ✗ `description: A helper that does useful things when needed.`
- ✓ `description: Use when the user needs to fill or read a PDF form.`

<a id="sk010"></a>
### SK010 — `description` declares negative scope

Saying what a skill is *not* for ("Do NOT use for …") is a strong signal that
keeps it from being selected for adjacent tasks. Absence is not a defect, so
this is info, and only nudges descriptions that already have real content.

- ✗ a description with no "not for" boundary
- ✓ `… Do NOT use for scanning or OCR of image-only PDFs.`

<a id="sk011"></a>
### SK011 — consistent grammatical voice

Mixing second person ("you") and third person ("the user") in one description
reads inconsistently. A smell, not a failure — info only.

- ✗ `Use when you want to help the user clean data.`
- ✓ `Use when the user wants to clean data.`

<a id="sk012"></a>
### SK012 — body is non-empty

The Markdown body after the frontmatter must contain instructions. An empty body
means that once the skill is selected and loaded, the agent has nothing to act
on.

- ✗ frontmatter followed by nothing
- ✓ frontmatter followed by the steps the agent should take

<a id="sk013"></a>
### SK013 — body is not a restatement of the `description`

If the body just restates the description, the skill carries no actual
instruction: once loaded, the agent learns nothing it didn't already have from
the trigger text. Flagged when body and description are highly similar
(default ≥ 0.9 cosine, configurable).

- ✗ a body that paraphrases the description and stops
- ✓ a body with the actual steps, examples, and edge cases

<a id="sk014"></a>
### SK014 — referenced relative paths exist

Relative paths the body links to should exist. A broken reference degrades
silently at runtime — the agent follows a link to nothing.

- ✗ `See [the template](templates/missing.md).` when that file is absent
- ✓ a link whose target exists in the skill directory

<a id="sk015"></a>
### SK015 — no absolute or `~/` paths in body

Absolute paths (`/home/…`, `C:\…`) and home paths (`~/…`) don't resolve in most
agents, which run from a different machine or working directory than the author.

- ✗ `` Read `~/skills/shared/util.md`. ``
- ✓ a path relative to the skill directory

<a id="sk016"></a>
### SK016 — frontmatter key portability

Reports frontmatter keys that only one agent understands, so an author can see
their cross-agent portability surface. Not a defect — info. The key→agent map
lives in [`src/data/frontmatter-keys.json`](src/data/frontmatter-keys.json); PRs
to keep it current are welcome.

- Core keys (`name`, `description`, `license`, `compatibility`, `metadata`,
  `allowed-tools`) are portable across all known agents.
- `globs` is Cursor-specific; `context` is Claude Code-specific; and so on.

<a id="sk017"></a>
### SK017 — file size within budget

Some ecosystems cap instruction-file size. Rather than asserting one number,
this warns (as info) when a `SKILL.md` grows large (default 64 KB, configurable),
since long reference material belongs in separate files loaded on demand.

- ✗ a single enormous `SKILL.md`
- ✓ a focused `SKILL.md` that links to `references/` for detail

<a id="sk018"></a>
### SK018 — file in a skills root is not `SKILL.md`

A `.md` file sitting directly in a skills root (like `.claude/skills/`) but not
named `SKILL.md` is never discovered as a skill. Skills live at `<name>/SKILL.md`
— a directory named for the skill, containing `SKILL.md`. A flat file loads as
nothing, and nothing warns: the exact silent failure Signalman exists to surface.
Only files carrying YAML frontmatter are flagged, so notes and READMEs in the
folder are left alone. It defaults to a warning; run with `--max-warnings 0` to
make it fail CI.

- ✗ `.claude/skills/data-cleaner.md`
- ✓ `.claude/skills/data-cleaner/SKILL.md`

---

## Corpus rules

These run across all discovered skills at once. Anything can validate YAML;
these are the checks that reason about a skill's place in a *set*.

<a id="sk101"></a>
### SK101 — duplicate `name` across skills

Two skills with the same `name` collide: only one can be invoked as `/name`, and
which one an agent registers is unpredictable.

- ✗ two skills both named `deploy`
- ✓ `deploy-staging` and `deploy-prod`

<a id="sk102"></a>
### SK102 — trigger collision

Two descriptions too similar to tell apart compete for the same requests. Signalman
computes pairwise cosine similarity over the TF-IDF vectors of the descriptions,
flags pairs above a threshold (default 0.75, configurable), and names the shared
vocabulary — the actionable part.

```
warn  SK102  trigger collision (similarity 0.91) with 'spreadsheet-scrubber'
      examples/bad/data-cleaner/SKILL.md
      Shared terms: messy, csv, clean, removing, duplicate, row, fixing, column
```

Fix by differentiating the two descriptions or merging the skills.

<a id="sk103"></a>
### SK103 — low distinctiveness

A description can be well-formed, specific, and clear and still be built entirely
from words a dozen other descriptions also use — leaving it no discriminating
power. This is the mean inverse document frequency of its terms across the
corpus, reported as a 0–100 score. Skills in the bottom decile that are also
below an absolute floor are warned; being relatively lowest in a corpus of
distinctive skills is not itself a problem.

- ✗ a description whose every word appears across most other skills
- ✓ a description with vocabulary unique to what this skill does

This is the one metric that names a real failure nobody currently has language
for: "your description is made of words every other skill also uses."

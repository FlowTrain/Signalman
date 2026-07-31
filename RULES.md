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
| [SK012](#sk012) | Body is non-empty | error |

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

Every finding suggests a rewrite built from your own description, not a generic
template.

```yaml
# ✗ says what it is
description: A tool for working with spreadsheets.
```
```yaml
# ✓ says when to use it
description: Use when the user wants to clean, edit, or chart data in an .xlsx or .csv file.
```

<a id="sk012"></a>
### SK012 — body is non-empty

The Markdown body after the frontmatter must contain instructions. An empty body
means that once the skill is selected and loaded, the agent has nothing to act
on.

- ✗ frontmatter followed by nothing
- ✓ frontmatter followed by the steps the agent should take

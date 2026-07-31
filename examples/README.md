# Examples

A ready-made corpus so `signalman` produces interesting output with zero setup.

- **`good/`** — two skills that pass every rule. `signalman examples/good` exits 0
  with no errors or warnings.
- **`bad/`** — skills that are each broken in one deliberate way, plus one
  trigger-collision pair. `signalman examples/bad` produces a rich report.

The `bad/` corpus is intentionally broken. Each skill targets a specific rule so
the report is easy to read against `RULES.md`:

| Skill | Targets |
| --- | --- |
| `identity-not-trigger` | SK007 — description states identity, not a trigger |
| `no-description` | SK006 — description missing |
| `empty-body` | SK012 — body is empty |
| `caps-mismatch` | SK004, SK005 — name mismatches directory and is not lowercase-hyphenated |
| `broken-frontmatter` | SK002 — malformed YAML |
| `dangling-references` | SK014, SK015 — missing relative path and absolute/`~` paths |
| `portability-keys` | SK016 — agent-specific frontmatter keys |
| `lowercase-file` | SK001 — file is `skill.md`, not `SKILL.md` |
| `data-cleaner` + `spreadsheet-scrubber` | SK102, SK103 — trigger collision and low distinctiveness |

Nothing here is written to; Signalman only reads.

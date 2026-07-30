# CLAUDE.md — Signalman

Read `SPEC-signalman.md` first. Read `.claude/soul.md` for the reasoning behind the odd
constraints; it will stop you from "improving" the tool in ways that break its point.

## What this is

A linter for SKILL.md files that catches the silent failure where a vague `description` means the
skill never loads at all. Public repo, MIT, strangers are the audience.

## Stack and hard constraints

- Node 20+, TypeScript, ESM.
- **Exactly one runtime dependency: a YAML parser.** This is enforced by acceptance criterion 8.
  Do not add a second one. TF-IDF, cosine similarity, argument parsing, colour output, and glob
  matching all get hand-rolled. They're small.
- Dev dependencies are unconstrained.
- Node's built-in test runner. No Jest, no Vitest.

If you find yourself wanting a dependency, write the forty lines instead and leave a comment
naming what you didn't install.

## Verify before you code

The SKILL.md format and its discovery conventions have shifted, and the spec records what was
believed true when it was written.

- Confirm current frontmatter fields, discovery paths, and the exact filename requirement against
  live documentation before implementing SK001–SK006 and §9.
- Confirm which frontmatter keys belong to which agent before writing `data/frontmatter-keys.json`.
- **Do not invent a field or a path convention.** If you can't confirm it, implement the rule but
  mark the threshold or key list with a `TODO(verify)` comment and tell me.

## Build order

The simulator comes early on purpose — it validates the tokeniser that two other rules depend on,
and it's the feature the repo lives or dies on.

1. Skeleton: CLI arg parsing, discovery (§9), tolerant frontmatter parse. Prints what it found.
2. Tokeniser + TF-IDF + cosine. Unit-test against hand-computed fixtures.
3. **Simulator (§6).** Get the output beautiful. This is the screenshot.
4. `examples/good` and `examples/bad`. Write the bad corpus deliberately — one skill per failure
   mode, plus one collision pair.
5. Rule engine + `Rule` interface + reporter (human format).
6. File rules SK001–SK006, SK012. The unambiguous ones.
7. SK007. Budget real time here; it's the highest-value rule and the easiest to get wrong.
8. Remaining file rules.
9. Corpus rules SK101–SK103.
10. JSON output + schema + exit codes.
11. README, RULES.md, CONTRIBUTING.md.

## Rules for writing rules

- Every finding must include a suggested fix. A finding that only says "this is wrong" fails
  acceptance criterion 4. For SK007 specifically, the suggestion must be a rewrite of the user's
  actual description, not a generic template.
- When a heuristic is uncertain, emit `info` and explain the reasoning. Never `error` on a guess.
  A false positive at `error` severity is how linters get uninstalled.
- Findings link to a `RULES.md` anchor. Write the RULES.md section as you write each rule, not at
  the end.
- One rule per file under `src/rules/`. No shared mutable state between rules.

## Voice

- **Agent-agnostic throughout.** SKILL.md is read by Claude Code, Copilot, Codex, and Cursor. Never
  write copy implying this is a Claude tool. Not in the README, not in error strings, not in
  comments.
- Output copy is direct and non-scolding. The user is not being told off; they're being shown a
  failure mode nobody warned them about.
- The simulator footer states its lexical-only caveat on every run. Do not soften it, do not make
  it conditional, do not move it behind a verbose flag.

## Testing

- Fixture-driven. Every rule gets a passing case and a failing case in `test/fixtures/`.
- Hand-compute the TF-IDF expectations for at least one small corpus so the vectoriser has a
  ground-truth test rather than a snapshot.
- Test that malformed YAML in one file doesn't abort the run (acceptance criterion 5). This is the
  robustness bug most linters ship with.

## Standing rules

1. **Git is host-side.** Do not commit, push, branch, or stage. Draft the commit message and tell
   me; I'll run it.
2. One unit at a time from the build order. Finish, report, stop. Do not present four steps at once.
3. Never write to a user's skills directory. This tool is read-only against everything it scans,
   forever, including any future auto-fix. If you add a write path, you've broken the product.

## Definition of done

All twelve acceptance criteria in §11 of the spec, plus RULES.md covering every implemented rule.
Roadmap items in §12 are not this session.

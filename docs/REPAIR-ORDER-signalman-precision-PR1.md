# REPAIR ORDER — Signalman precision fixes (PR-1: SK015 + SK014)

**For:** a Claude Code session working in the `Signalman` repo. **Self-contained** — assume no prior
conversation. Read this top to bottom, then execute in order.
**Provenance:** a real 42-skill audit (DPE-PM Toolkit, PAIPP-370) ground-truthed Signalman's output.
Two rules fired at ~13–17% precision. Full analysis: `docs/precision-refinement-backlog-2026-09.md`.
**Discipline:** TDD, per the CoC Prime Directive — **write/adjust the fixtures first, watch them fail,
then change the rule, then green.** Do not edit source before the fixtures exist.
**Scope of PR-1:** SK015 and SK014 only. SK008/SK011 are a separate PR (see backlog). Do **not** touch
them here.

---

## 0. Orient (2 min)

```bash
npm ci
npm test          # capture the BASELINE: everything green before you start
```
Rules live in `src/rules/`. Fixtures live in `examples/good/**` and `examples/bad/**`. The fixture
contract (from `test/examples.test.ts`) — you must keep all of these true:
- `examples/good` must produce **0 errors and 0 warnings** (info is allowed).
- `examples/bad` must have **at least one** skill firing each of: SK001, SK002, SK004, SK005, SK006,
  SK007, SK010, SK012, SK014, SK015, SK016, SK102.
- Every finding must carry a non-empty `suggestion`.

So: after your changes, **SK014 and SK015 must still fire somewhere in `examples/bad`**, and your new
`examples/good` skills must be otherwise flawless.

---

## 1. SK014 — skip runtime-fill templates (6 flagged → 1 genuine)

**Root cause (confirmed in source).** `src/rules/sk014-broken-references.ts` flags any relative
markdown-link target that doesn't exist. A link like `[report]({primary_url})` yields target
`{primary_url}`, which is treated as a missing relative path. But `{…}` tokens are intentional
runtime-fill templates. That one blind spot caused 5 of 6 false hits.

### 1a. Fixture first — new GOOD fixture
Create `examples/good/template-output-path/SKILL.md` (a complete, otherwise-clean skill; verify it
raises **no** warn/error):
```markdown
---
name: template-output-path
description: Use when the user wants release notes written to a per-release output file. Names the file from the live version tag at generation time. Do NOT use for editing existing release notes.
---

# Template output path

Generate release notes and write them to the destination for this release.

## Steps

1. Read the version tag for the release being cut.
2. Draft the notes from the merged pull requests since the last tag.
3. Write the result to [the release file](release-notes-{version}.md) — the `{version}` token is
   filled from the live tag at generation time; never leave a literal brace in the rendered output.
```

### 1b. Confirm the RED
`npm test` — the `examples/good has no errors or warnings` test should now **fail** with an SK014 warn
on `release-notes-{version}.md`. That failure proves the bug.

### 1c. The fix (one line)
In `src/rules/sk014-broken-references.ts`, inside the `for` loop, after the `rel === ""` guard:
```ts
      const rel = target.split("#")[0]!.trim();
      if (rel === "") continue;
      if (/\{[^}]*\}/.test(rel)) continue; // runtime-fill template ({version}); not a real path
      if (existsSync(join(ctx.skill.dir, rel))) continue;
```

### 1d. Green
`npm test` — the good fixture passes. Confirm SK014 **still fires** on
`examples/bad/dangling-references` (its `[the template](templates/missing-template.md)` is a genuine
missing path and must remain flagged).

---

## 2. SK015 — only flag machine-specific home paths (39 flagged → ~5 genuine)

**Root cause (confirmed in source).** `src/rules/helpers.ts:absolutePathRefs` flags every `~/…` path,
and the SK015 comment codifies the wrong premise (*"home paths (`~/…`) don't resolve"*). They do — `~`
expands to the runtime home. The remediation's own fix for a real leak was to convert
`/Users/ug8x/…` **into** `~/…` — the exact form SK015 was flagging. Only literal real-username
absolute paths are genuine leaks.

> ⚠️ **Regression trap.** `examples/bad/dangling-references/SKILL.md` currently makes SK015 fire via
> `/home/user/notes/setup.md` and `~/skills/shared/util.md`. Under the new rule **neither is a leak**
> (`user` is a placeholder; `~/` is portable). You MUST add a genuine leak fixture (step 2a) or the
> `examples/bad` SK015 assertion breaks.

### 2a. Fixtures first
**New BAD fixture** — `examples/bad/home-path-leak/SKILL.md` (must fire SK015, and keep a valid
frontmatter so it isn't masked):
```markdown
---
name: home-path-leak
description: Use when demonstrating a skill that hard-codes the author's real home directory, which will not resolve on another machine. Do NOT use for portable references.
---

# Home path leak

Load the client helper from `/Users/ug8x/.claude/plugins/cache/jira-client.js` before running.
```
**New GOOD fixture** — `examples/good/portable-home-path/SKILL.md` (must raise no warn/error):
```markdown
---
name: portable-home-path
description: Use when the user wants an audit report written under their own home directory in a portable way. Writes to a tilde-relative path. Do NOT use for absolute machine-specific paths.
---

# Portable home path

Write the audit report to `~/audit-reports/latest.md` and a placeholder example at
`/Users/<name>/notes/setup.md`.
```
**Adjust the existing fixture** — in `examples/bad/dangling-references/SKILL.md`, the home-path
sentence no longer represents an SK015 leak. Change the description to drop the "absolute or home
location" claim, and either remove the `/home/user/…` + `~/skills/…` sentence or leave it (it will
simply no longer trigger SK015; SK014 still fires on the missing template). Recommended: trim it to
keep the fixture's intent honest — it is now a **SK014-only** fixture.

### 2b. Confirm the RED
`npm test` — expect failures: the new good fixture trips SK015 on `~/audit-reports/…` and
`/Users/<name>/…` under the OLD rule; the `examples/bad` SK015 assertion may still pass only because
of old behavior. Both prove the rule is too broad.

### 2c. The fix — replace `src/rules/sk015-absolute-paths.ts` with:
```ts
import { ruleOption } from "../config.js";
import type { FileRule } from "./types.js";

// SK015 — a literal home directory with a real username (/Users/ug8x/…, /home/ug8x/…,
// C:\Users\bob\…) is machine-specific and won't resolve on another author's box. A `~/…`
// path is portable (expands to the runtime home) and is NOT a leak — it's the fix. A
// placeholder username (/Users/<name>/) is a template, not a leak. Sanctioned internal
// hosts/paths can be allow-listed per repo via SK015.allow (array of substrings).
const HOME_LEAK =
  /(?:^|[\s`("'[])((?:\/(?:Users|home)\/([^/\s]+)\/)|(?:[A-Za-z]:[\\/]Users[\\/]([^\\/\s]+)[\\/]))/g;
const PLACEHOLDER = /^(?:<.*>|your-?name|user(?:name)?|me|you|name|example)$/i;

export const sk015AbsolutePaths: FileRule = {
  id: "SK015",
  name: "no-machine-specific-home-paths",
  severity: "warn",
  scope: "file",
  docs: "sk015",
  check(ctx) {
    const allow = ruleOption<string[]>(ctx.config, "SK015", "allow", []);
    const leaks = new Set<string>();
    for (const m of ctx.parsed.body.matchAll(HOME_LEAK)) {
      const hit = m[1]!.trim();
      const user = (m[2] ?? m[3] ?? "").trim();
      if (PLACEHOLDER.test(user)) continue;             // /Users/<name>/ — a template
      if (allow.some((a) => hit.includes(a))) continue; // sanctioned internal default
      leaks.add(hit);
    }
    if (leaks.size === 0) return [];
    const shown = [...leaks].slice(0, 5).join(", ") + (leaks.size > 5 ? " …" : "");
    return [
      {
        file: ctx.skill.filePath,
        message: `The body hard-codes machine-specific home paths that won't resolve elsewhere: ${shown}`,
        suggestion:
          "Use a `~/`-relative path (portable) or a placeholder like /Users/<name>/. Allow-list sanctioned internal paths via SK015.allow.",
        data: { paths: [...leaks] },
      },
    ];
  },
};
```
Notes for the implementer:
- Confirm the `ruleOption` generic signature matches its use in `src/rules/sk008-description-length.ts`
  (`ruleOption(ctx.config, "SK008", "min", 40)`). If `ruleOption` is not generic, drop the `<string[]>`
  and type the local via `const allow = (ruleOption(ctx.config,"SK015","allow",[]) as string[]);`.
- `absolutePathRefs` in `helpers.ts` may now be unused by SK015. Leave it if another rule/test uses it
  (grep first: `grep -rn absolutePathRefs src test`); only remove it if nothing else references it.
- This narrows SK015 to home-dir leaks — the genuine class. If you later want `/opt`, `/var`, etc.,
  add them back as a **separate info-severity** check; they were not the false-positive driver.

### 2d. Green
`npm test` — good fixtures clean; `examples/bad/home-path-leak` fires SK015; the `examples/bad`
SK015 assertion passes via the new fixture.

---

## 3. Full verification (acceptance)

```bash
npm run build   # or tsc — dist/ must rebuild from src/ if the repo ships compiled JS
npm test        # ALL green, including the three examples.test cases
```
Acceptance criteria:
- [ ] `npm test` fully green.
- [ ] `examples/good` has 0 warn / 0 error; the two new good fixtures included.
- [ ] `examples/bad` still fires SK014 and SK015 (via dangling-references and home-path-leak).
- [ ] SK014 no longer flags `{…}` template targets; SK015 no longer flags `~/…` or placeholder
      usernames; both still catch the genuine cases.
- [ ] **Corpus check (the real proof):** re-run Signalman against the DPE-PM Toolkit corpus (or any
      corpus with `~/`-output-dir skills and `{…}`-template links). SK015 should fall from ~39→~5,
      SK014 from ~6→1.

If `npm run build` isn't a script, check `package.json`; the project compiles `src/**.ts` → `dist/`.
Rebuild before committing so the shipped `dist/` matches source.

---

## 4. Commit (Recall waybill)

```
fix(signalman): SK015/SK014 precision — stop flagging portable ~/ paths and {…} templates

SK014 skipped intentional runtime-fill template targets ({version}); SK015 rewritten to
flag only machine-specific home paths (real-username /Users/x/, /home/x/, C:\Users\x\),
never portable ~/ paths or placeholder usernames, with a per-repo SK015.allow allowlist.
Ground-truthed by the DPE-PM Toolkit audit (SK015 ~13% precision, SK014 ~17%).

Fixtures: +examples/good/template-output-path, +examples/good/portable-home-path,
+examples/bad/home-path-leak; dangling-references retargeted to SK014-only.
All tests green; corpus re-run SK015 39->~5, SK014 6->1.

Work-Item: <ticket or gh:issue — set before committing>
Class: maintenance
Target: rule precision (SK015 ~13%->~100%, SK014 ~17%->~100%)
Opening-SHA: <git rev-parse --short HEAD before the commit>
QMS: Tier4-QMS-v0.1.3
CoC: CoC-v0.1.2
```
`Work-Item` is the only unrecoverable trailer — set it before you commit. If there's no ticket,
`gh:signalman-precision` keeps it honest. `Class: maintenance` (restoring a health metric), so
`Target` is stamped and the planned-work overlay (Plan-Doc/Wave/Phase) is correctly absent.

---

## PR-2 (do NOT do here — separate order)
SK008 raw-fallback (over-length description masked behind a SK002 YAML error) and SK011
field-scope/two-referent narrowing. Details in `docs/precision-refinement-backlog-2026-09.md`.

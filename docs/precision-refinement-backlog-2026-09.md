# Signalman — Precision Refinement Backlog (from the DPE-PM Toolkit remediation)

**Date:** 2026-09-29
**Provenance:** a real 42-skill audit (DPE-PM Toolkit Marketplace, PAIPP-370) where a careful
verifier ground-truthed Signalman's findings against the live repo. That verification is the best
gift a linter can get: it tells us exactly where Signalman cries wolf. Four rules need work; two of
the fixes are one line.

## The honest-signal argument (why this is P0, not polish)

Signalman is Garry at the interchange: respected only because a refusal *means something*. A rule
firing at **13% precision** — wrong six times out of seven — does the opposite of its job: it trains
people to wave the whole inspector through. False reds are as corrosive to trust as false greens.
On this run, the reviewer's pushback (and Drew's, per the norm) was **substantively correct** — the
things they objected to really were false positives, not their sloppiness. Fixing precision here is
fixing the trust the tool runs on.

## Precision scorecard (from the remediation report's own numbers)

| Rule | File | Flagged | Genuine | Precision | Verdict |
|---|---|---:|---:|---:|---|
| SK002 frontmatter YAML | `sk002-frontmatter-yaml.ts` | 1 | 1 | 100% | ✅ keep |
| SK008 description length | `sk008-description-length.ts` | 25 | **27** | 100% + **2 misses** | ⚠️ recall gap |
| SK010 negative scope | `sk010-negative-scope.ts` | ~41 | ~41 | ~100% | ✅ keep |
| SK011 voice | `sk011-voice.ts` | 1 | 0 | **0%** | ❌ mis-scoped |
| SK014 broken references | `sk014-broken-references.ts` | 6 | 1 | **~17%** | ❌ FP storm |
| SK015 absolute paths | `sk015-absolute-paths.ts` | 39 | 5 | **~13%** | ❌ FP storm |

Priority: **SK015 → SK014 → SK008 → SK011.** The first two are where trust is bleeding; both root
causes are confirmed in source below.

---

## SK015 — absolute/home paths (39 flagged, 5 genuine)

**Confirmed root cause.** `helpers.ts:absolutePathRefs` flags every `~/…` path, and the rule comment
even codifies the wrong assumption: *"home paths (`~/…`) don't resolve."* They do — `~` expands to
the runtime user's home. Worse, the remediation's actual **fix** for a genuine leak was to convert
`/Users/ug8x/.claude/…` **into** `~/.claude/…` — i.e. Signalman flags the very form that is the
correct, portable answer. Every `~/audit-reports/`, `~/task-lists/` output dir got flagged; the only
genuine leaks were literal real-username absolute paths (`/Users/ug8x/…`, `C:\Users\<name>\…`).

**Fix — classify, don't blanket-flag:**
1. **Never flag `~/…`** — it's the portable form.
2. **Flag** absolute paths that embed a real home dir: `/Users/<x>/`, `/home/<x>/`, `C:\Users\<x>\`
   — unless `<x>` is an obvious placeholder (`<name>`, `yourname`, `username`, `user`, `me`, `you`).
3. **Config allowlist** for sanctioned internal defaults so an internal tool can declare its own
   correct hosts/paths (`vanguardim.atlassian.net`, the PagePilot endpoint, `127.0.0.1:3128`,
   `~/.aws/credentials`, canonical `~/.claude/…` tool dirs).

**Proposed rule (`sk015-absolute-paths.ts`):**
```ts
import { ruleOption } from "../config.js";
import { absolutePathRefs } from "./helpers.js";
import type { FileRule } from "./types.js";

// SK015 — a literal home directory with a real username (/Users/ug8x/…, C:\Users\bob\…)
// is machine-specific and won't resolve on another author's box. `~/…` is portable
// (expands to the runtime home) and is NOT a leak — it's the fix. Sanctioned internal
// hosts/paths can be allow-listed per repo via SK015.allow.
const HOME_LEAK = /(?:^|[\s`("'[])(\/(?:Users|home)\/([^/\s]+)\/|[A-Za-z]:[\\/]Users[\\/]([^\\/\s]+)[\\/])/g;
const PLACEHOLDER = /^(?:<.*>|your-?name|user(?:name)?|me|you|name|example)$/i;

export const sk015AbsolutePaths: FileRule = {
  id: "SK015",
  name: "no-machine-specific-home-paths",
  severity: "warn",
  scope: "file",
  docs: "sk015",
  check(ctx) {
    const allow: string[] = ruleOption(ctx.config, "SK015", "allow", []);
    const leaks = new Set<string>();
    for (const m of ctx.parsed.body.matchAll(HOME_LEAK)) {
      const hit = m[1]!.trim();
      const user = (m[2] ?? m[3] ?? "").trim();
      if (PLACEHOLDER.test(user)) continue;              // /Users/<name>/ is a template, not a leak
      if (allow.some((a) => hit.includes(a))) continue;  // sanctioned internal default
      leaks.add(hit);
    }
    if (leaks.size === 0) return [];
    const shown = [...leaks].slice(0, 5).join(", ") + (leaks.size > 5 ? " …" : "");
    return [{
      file: ctx.skill.filePath,
      message: `The body hard-codes machine-specific home paths that won't resolve elsewhere: ${shown}`,
      suggestion: "Use a `~/`-relative path (portable) or a placeholder like /Users/<name>/. Allow-list sanctioned internal paths via SK015.allow.",
      data: { paths: [...leaks] },
    }];
  },
};
```
*Note:* this narrows SK015 to home-dir leaks (the genuine class). If you still want to catch other
absolutes (`/opt/…`, `/var/…`), add them back at **info** severity, separately — they were not the
false-positive driver and were not in the genuine set.

**Fixtures to add first (TDD):**
- `examples/good/portable-tilde/SKILL.md` — body uses `~/audit-reports/out.md` → **0 findings**.
- `examples/good/placeholder-home/SKILL.md` — body uses `/Users/<name>/notes` → **0 findings**.
- `examples/bad/home-leak/SKILL.md` — body uses `/Users/ug8x/.claude/x.js` → **1 SK015**.
- `config` test — `SK015.allow: ["pagepilot.i.webt.vanguard.com"]` suppresses that host.

---

## SK014 — broken references (6 flagged, 1 genuine)

**Confirmed root cause.** `sk014-broken-references.ts` walks `markdownLinkTargets` and flags any
relative target that doesn't exist. A link like `[report]({primary_url})` yields target
`{primary_url}` → not matched by `NON_RELATIVE` → treated as a missing relative path → flagged. But
`{…}` tokens are **intentional runtime-fill templates** (a dozen skills use them for output
filenames). That single blind spot produced 5 of the 6 false hits.

**Fix — one line: skip templated targets.**
```ts
      const rel = target.split("#")[0]!.trim();
      if (rel === "") continue;
+     if (/\{[^}]*\}/.test(rel)) continue; // runtime-fill template ({primary_url}), not a real path
      if (existsSync(join(ctx.skill.dir, rel))) continue;
```

**Fixture to add first (TDD):**
- `examples/good/template-tokens/SKILL.md` — body links `[out]({primary_url})` → **0 findings**.
- keep `examples/bad/dangling-references/` green-to-red as-is (real missing path still flagged).

**Recall gap — the *real* SK014 bug it can't see (candidate NEW rule).** The genuine placeholder was
a leftover `{primary_key}` in an **`examples/` demo *output* file** whose sibling tokens were all
filled. SK014 only scans `SKILL.md`, so it cannot catch this. Propose **SK018 (or next free id) —
"filled-example integrity":** in `examples/**`, flag a lingering `{…}` token when the rest of the
file is concrete (siblings filled). Separate rule, separate PR; lower priority than the precision fix.

---

## SK008 — description length (missed 2 / recall gap)

**Confirmed root cause — SK002 masking.** SK008 guards with `if (!frontmatterUsable(ctx)) return []`.
`frontmatterUsable` is false whenever frontmatter fails to parse. `tradeoff-shaper` had the P0 YAML
bug **and** an 803-char description — but because its YAML wouldn't parse, SK008 never measured it.
An over-length description rode in free behind the parse error. That's the "revised to 27 on
verification" gap: the maskees only surface after SK002 is fixed and the audit re-runs.

**Fix — measure length even under a parse error, cross-referencing SK002 (info, no pile-on):**
```ts
    if (!frontmatterUsable(ctx)) {
      // Frontmatter won't parse (SK002 owns that), but an over-long description is
      // independent signal that would otherwise hide until the YAML is fixed.
      const raw = rawDescriptionValue(ctx.parsed /* raw frontmatter text */);
      if (raw && raw.length > ruleOption(ctx.config, "SK008", "max", 500)) {
        return [{
          file: ctx.skill.filePath,
          severity: "info",
          message: `The description is ~${raw.length} characters — over the band. (Confirm after fixing the YAML flagged by SK002.)`,
          suggestion: "Lead with the key use case and move detail into the body.",
        }];
      }
      return [];
    }
```
Requires a small `rawDescriptionValue` helper that pulls the `description:` line(s) from the raw
frontmatter block by text (handles `>`/`|` folded/literal styles by joining following indented
lines). **Alternative, zero-code fix:** document the SK002→description-rule masking in `CLAUDE.md`
and make "re-run after YAML fixes" the operational rule. Recommend the raw-fallback so a second
defect can't ride in free, but the doc note is an acceptable interim.

**Fixture to add first (TDD):**
- `examples/bad/broken-yaml-longdesc/SKILL.md` — unparseable frontmatter **and** a 700-char
  description → SK002 (error) **and** SK008 (info). Proves the maskee surfaces.

---

## SK011 — voice (1 flagged, 0 genuine)

**Confirmed root cause — two flaws.** (1) It checks **only the description** but the reviewer's
concern was body voice; (2) `THIRD_PERSON` includes `they|them|their|the request`, and any
co-occurrence with `you` fires — but **"you" (the agent) vs "the user" (the human) is a valid
two-referent pattern**, not voice-mixing. A skill that instructs Claude ("you") to ask the user is
correct, and SK011 calls it inconsistent.

**Fix (low priority — info severity, low volume):**
- Narrow `THIRD_PERSON` to `\b(the user|users)\b` (drop `they/them/their/the request` — too noisy).
- Add a caveat to the finding + `docs/sk011`: agent-vs-human is legitimate; this is a style nudge,
  not a defect.
- Keep info. Do **not** extend to the body (that's where the two-referent pattern is *most* valid and
  would generate the most noise).

**Fixture:** `examples/good/agent-and-user/SKILL.md` — description "Use when the user asks; then you
generate…" → **0 findings** after the narrowing.

---

## Suggested delivery

Two PRs, precision first:
1. **PR-1 (precision):** SK015 reclassify + SK014 one-liner + their fixtures. This alone lifts the
   two ~13–17% rules to near-100% and is the trust win.
2. **PR-2 (recall + polish):** SK008 raw-fallback + SK011 narrowing + the candidate examples-integrity
   rule, with fixtures.

Each PR: fixtures (failing) first, then the rule change, then `npm test` green — TDD per the CoC
Prime Directive. Re-run Signalman against the DPE-PM corpus as the acceptance check: SK015 should
drop from 39→~5, SK014 from 6→1.

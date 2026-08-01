// Human report (spec §7): findings grouped by severity, worst-first, each with
// file path, rule id, a one-line explanation, a concrete suggestion, and a link
// to its RULES.md anchor. Colour when the destination is a TTY. A summary footer
// reports counts and which roots were scanned versus absent, so a run with zero
// findings can be told apart from a run that found no skills at all (spec §9).

import type { Colors } from "../color.js";
import type { DiscoveryRoot } from "../discovery.js";
import type { LintResult, RuleError } from "../engine.js";
import { displayPath } from "../paths.js";
import type { Finding, Severity } from "../rules/types.js";

export interface ReportContext {
  cwd: string;
  home: string;
  roots: DiscoveryRoot[];
  /** Discovery roots that actually yielded skills, for per-root counts. */
  usedRoots: string[];
  /** Files that were discovered but could not be read (makes the run incomplete). */
  unreadable: string[];
  colors: Colors;
}

const GROUPS: Severity[] = ["error", "warn", "info"];
const GROUP_LABEL: Record<Severity, string> = { error: "errors", warn: "warnings", info: "info" };
const ID_WIDTH = 6;
const INDENT = " ".repeat(2 + ID_WIDTH + 2);

export function renderReport(result: LintResult, ctx: ReportContext): string {
  const c = ctx.colors;
  const out: string[] = [];

  for (const severity of GROUPS) {
    const group = result.findings.filter((f) => f.severity === severity);
    if (group.length === 0) continue;
    out.push(colorFor(c, severity)(`${GROUP_LABEL[severity]} (${group.length})`));
    out.push("");
    for (const f of group) out.push(renderFinding(f, ctx));
  }

  if (result.ruleErrors.length > 0) {
    out.push(c.red("signalman errors (a rule failed to run)"));
    out.push("");
    for (const e of result.ruleErrors) out.push(renderRuleError(e, ctx));
  }

  if (ctx.unreadable.length > 0) {
    out.push(c.red(`could not read (${ctx.unreadable.length})`));
    out.push("");
    for (const p of ctx.unreadable) out.push(`  ${displayPath(p, ctx.cwd, ctx.home)}`);
    out.push(`${INDENT}${c.dim("Discovered but unreadable — results are incomplete.")}`);
    out.push("");
  }

  out.push(renderFooter(result, ctx));
  return out.join("\n") + "\n";
}

function renderFinding(f: Finding, ctx: ReportContext): string {
  const c = ctx.colors;
  const loc = displayPath(f.file, ctx.cwd, ctx.home) + (f.line ? `:${f.line}` : "");
  const id = colorFor(c, f.severity)(c.bold(f.ruleId.padEnd(ID_WIDTH)));
  const lines = [`  ${id}  ${loc}`, `${INDENT}${f.message}`];
  for (const related of f.relatedFiles ?? []) {
    lines.push(`${INDENT}${c.dim("↔ " + displayPath(related, ctx.cwd, ctx.home))}`);
  }
  lines.push(`${INDENT}${c.green("fix:")} ${f.suggestion}`);
  lines.push(`${INDENT}${c.dim(`RULES.md#${f.docs}`)}`);
  lines.push("");
  return lines.join("\n");
}

function renderRuleError(e: RuleError, ctx: ReportContext): string {
  const c = ctx.colors;
  const where = e.file === "(corpus)" ? "(corpus)" : displayPath(e.file, ctx.cwd, ctx.home);
  return (
    `  ${c.bold(e.ruleId.padEnd(ID_WIDTH))}  ${where}\n` +
    `${INDENT}${e.message}\n` +
    `${INDENT}${c.dim("This is a bug in the rule, not a problem with the skill.")}\n`
  );
}

function renderFooter(result: LintResult, ctx: ReportContext): string {
  const c = ctx.colors;
  const lines: string[] = [];

  // Which roots were scanned, and which were absent (clean vs. found-nothing).
  const counts = new Map<string, number>();
  for (const r of ctx.usedRoots) counts.set(r, (counts.get(r) ?? 0) + 1);
  lines.push(c.dim("Scanned roots:"));
  for (const root of ctx.roots) {
    const path = displayPath(root.path, ctx.cwd, ctx.home);
    if (!root.present) {
      lines.push(c.dim(`  -  ${path}  (absent)`));
    } else {
      const n = counts.get(root.path) ?? 0;
      lines.push(c.dim(`  +  ${path}  (${n} skill${n === 1 ? "" : "s"})`));
    }
  }

  lines.push("");
  if (result.skillCount === 0) {
    const { error, warn, info } = result.counts;
    if (ctx.unreadable.length > 0) {
      lines.push(
        c.red(`Could not read ${ctx.unreadable.length} discovered skill${plural(ctx.unreadable.length)}.`),
      );
    } else if (error + warn + info > 0) {
      // No valid skill loaded, but we found files pretending to be skills (SK018).
      // Say so loudly rather than "found nothing" — that silence is the bug.
      const parts = [
        colorFor(c, "error")(`${error} error${plural(error)}`),
        colorFor(c, "warn")(`${warn} warning${plural(warn)}`),
        colorFor(c, "info")(`${info} info`),
      ];
      lines.push(`${parts.join("  ·  ")}  —  and no valid SKILL.md files were discovered.`);
    } else {
      lines.push("No SKILL.md files found under the scanned roots.");
    }
    return lines.join("\n");
  }

  // A run with unreadable files or a crashed rule is incomplete; don't dress it
  // up as a clean pass even when the skills we could read had no findings.
  const incomplete = ctx.unreadable.length > 0 || result.ruleErrors.length > 0;
  const { error, warn, info } = result.counts;
  if (error + warn + info === 0) {
    lines.push(
      incomplete
        ? c.yellow(
            `No issues in the ${result.skillCount} readable skill${plural(result.skillCount)}, ` +
              `but the run was incomplete (see above).`,
          )
        : c.green("✓ No issues found") + ` across ${result.skillCount} skill${plural(result.skillCount)}.`,
    );
  } else {
    const parts = [
      colorFor(c, "error")(`${error} error${plural(error)}`),
      colorFor(c, "warn")(`${warn} warning${plural(warn)}`),
      colorFor(c, "info")(`${info} info`),
    ];
    lines.push(`${parts.join("  ·  ")}  across ${result.skillCount} skill${plural(result.skillCount)}.`);
  }

  const dist = result.corpus.distinctiveness;
  if (dist) {
    lines.push(
      c.dim(
        `Distinctiveness (0–100, higher is more unique): min ${dist.min} · median ${dist.median} · max ${dist.max} across ${dist.count} skills.`,
      ),
    );
  }
  return lines.join("\n");
}

function colorFor(c: Colors, severity: Severity): (s: string) => string {
  if (severity === "error") return c.red;
  if (severity === "warn") return c.yellow;
  return c.cyan;
}

function plural(n: number): string {
  return n === 1 ? "" : "s";
}

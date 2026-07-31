import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { parseArgs, type CliOptions } from "./args.js";
import { makeColors, resolveColor } from "./color.js";
import { defaultConfig, type RuleConfig } from "./config.js";
import { discover, type DiscoveredSkill } from "./discovery.js";
import { lint, type LintResult } from "./engine.js";
import { parseSkillFile } from "./parse.js";
import { displayPath } from "./paths.js";
import { renderReport } from "./report/human.js";
import { renderJson } from "./report/json.js";
import { corpusRules, fileRules } from "./rules/index.js";
import type { SkillEntry } from "./rules/types.js";
import { caveatFooter, renderSimulation, simulate, type SkillDoc } from "./simulator.js";

// Exit codes (spec §7).
const EXIT_OK = 0;
const EXIT_MAX_WARNINGS = 1;
const EXIT_ERRORS = 2;
const EXIT_LINTER_FAILURE = 3;

export function run(argv: string[], cwd: string, home: string): number {
  const opts = parseArgs(argv);

  if (opts.help) {
    printUsage();
    return EXIT_OK;
  }
  if (opts.version) {
    process.stdout.write(`${getVersion()}\n`);
    return EXIT_OK;
  }
  if (opts.errors.length > 0) {
    for (const e of opts.errors) process.stderr.write(`signalman: ${e}\n`);
    process.stderr.write(`Run 'signalman --help' for usage.\n`);
    return EXIT_LINTER_FAILURE;
  }

  // Config-file loading is not wired up yet. Reject --config rather than accept
  // it and silently lint with defaults.
  if (opts.config !== null) {
    process.stderr.write("signalman: --config is not implemented yet.\n");
    return EXIT_LINTER_FAILURE;
  }

  const { skills, roots } = discover({
    paths: opts.paths,
    projectOnly: opts.projectOnly,
    personalOnly: opts.personalOnly,
    cwd,
    home,
  });

  // An explicit path that does not exist is a linter failure, not a lint finding.
  const missingExplicit = roots.filter((r) => r.kind === "explicit" && !r.present);
  if (missingExplicit.length > 0) {
    for (const r of missingExplicit) {
      process.stderr.write(`signalman: path not found: ${displayPath(r.path, cwd, home)}\n`);
    }
    return EXIT_LINTER_FAILURE;
  }

  if (opts.simulate !== null || opts.simulateFrom !== null) {
    return runSimulate(opts, skills, cwd);
  }

  const config = defaultConfig();
  if (opts.maxWarnings !== null) config.maxWarnings = opts.maxWarnings;

  const entries: SkillEntry[] = [];
  const unreadable: string[] = [];
  for (const skill of skills) {
    try {
      entries.push({ skill, parsed: parseSkillFile(skill.filePath) });
    } catch {
      // Discovered but unreadable: track it so the report and exit code reflect
      // an incomplete run rather than silently dropping the file.
      unreadable.push(skill.filePath);
    }
  }

  const result = lint({ entries, config, fileRules, corpusRules });

  if (opts.format === "json") {
    process.stdout.write(renderJson(result, { cwd, home, roots, unreadable }));
    return computeExitCode(result, config, unreadable.length);
  }

  const colors = makeColors(resolveColor(opts.color, process.stdout));
  process.stdout.write(
    renderReport(result, {
      cwd,
      home,
      roots,
      usedRoots: skills.map((s) => s.root),
      unreadable,
      colors,
    }),
  );

  return computeExitCode(result, config, unreadable.length);
}

function computeExitCode(result: LintResult, config: RuleConfig, unreadableCount: number): number {
  // A rule that threw, or a discovered file we could not read, means the run is
  // incomplete — treat it as Signalman failing, not a clean pass or lint result.
  if (result.ruleErrors.length > 0 || unreadableCount > 0) return EXIT_LINTER_FAILURE;
  if (result.counts.error > 0) return EXIT_ERRORS;
  if (config.maxWarnings !== null && result.counts.warn > config.maxWarnings) {
    return EXIT_MAX_WARNINGS;
  }
  return EXIT_OK;
}

function runSimulate(opts: CliOptions, skills: DiscoveredSkill[], cwd: string): number {
  const requests: string[] = [];
  if (opts.simulate !== null) requests.push(opts.simulate);
  if (opts.simulateFrom !== null) {
    let contents: string;
    try {
      contents = readFileSync(resolve(cwd, opts.simulateFrom), "utf8");
    } catch (err) {
      process.stderr.write(`signalman: cannot read --simulate-from file: ${errMessage(err)}\n`);
      return EXIT_LINTER_FAILURE;
    }
    for (const line of contents.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (trimmed !== "") requests.push(trimmed);
    }
  }

  const colors = makeColors(resolveColor(opts.color, process.stdout));

  if (requests.length === 0) {
    // e.g. an empty or whitespace-only --simulate-from file. Say so explicitly
    // rather than printing a bare caveat with no ranking above it.
    process.stdout.write("No requests to simulate.\n\n");
    process.stdout.write(caveatFooter(colors));
    return EXIT_OK;
  }

  const docs = skills.map(toSkillDoc);
  const blocks = requests.map((request) => renderSimulation(simulate(docs, request), colors));
  process.stdout.write(blocks.join("\n"));

  // The lexical-only caveat prints once per invocation, always (soul.md).
  process.stdout.write("\n");
  process.stdout.write(caveatFooter(colors));
  return EXIT_OK;
}

function toSkillDoc(skill: DiscoveredSkill): SkillDoc {
  let description = "";
  let name = skill.dirName;
  try {
    const parsed = parseSkillFile(skill.filePath);
    const d = parsed.frontmatter?.["description"];
    if (typeof d === "string") description = d;
    const n = parsed.frontmatter?.["name"];
    if (typeof n === "string" && n.trim() !== "") name = n.trim();
  } catch {
    // Unreadable/unparseable: leave description empty so it simply scores 0.
  }
  return { name, dirName: skill.dirName, description };
}

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function getVersion(): string {
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    const pkg = JSON.parse(readFileSync(join(here, "../../package.json"), "utf8")) as {
      version?: string;
    };
    return pkg.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

function printUsage(): void {
  process.stdout.write(
    `signalman — a linter for SKILL.md trigger quality

Usage:
  signalman [paths...] [options]

Options:
  --format <human|json>    Output format (default: human)
  --simulate "<request>"   Rank skills against a plain-English request
  --simulate-from <file>   Read one request per line and rank each
  --project-only           Scan only project roots
  --personal-only          Scan only personal roots
  --config <path>          Path to signalman.config.json
  --max-warnings <n>       Fail (exit 1) when warnings exceed n
  --color / --no-color     Force or disable coloured output
  -h, --help               Show this help
  -v, --version            Show version

With no paths, Signalman scans the conventional skill roots
(.claude/skills, .github/skills, .agents/skills and their personal equivalents).
`,
  );
}

// Bootstrap. Kept out of run() so run() stays unit-testable.
const exitCode = run(process.argv.slice(2), process.cwd(), homedir());
process.exitCode = exitCode;

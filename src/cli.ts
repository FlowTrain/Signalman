import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { parseArgs, type CliOptions } from "./args.js";
import { makeColors, resolveColor } from "./color.js";
import { discover, type DiscoveredSkill, type DiscoveryRoot } from "./discovery.js";
import { parseSkillFile, type ParsedSkill } from "./parse.js";
import {
  caveatFooter,
  renderSimulation,
  simulate,
  type SkillDoc,
} from "./simulator.js";

// Exit codes (spec §7). Rules are not wired up yet, so this skeleton only ever
// returns 0 (success) or 3 (Signalman itself could not run).
const EXIT_OK = 0;
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

  reportRoots(roots, skills.map((s) => s.root), cwd, home);

  if (skills.length === 0) {
    process.stdout.write(`\nNo SKILL.md files found under the scanned roots.\n`);
    return EXIT_OK;
  }

  process.stdout.write(`\nDiscovered ${skills.length} skill${skills.length === 1 ? "" : "s"}:\n`);
  for (const skill of skills) {
    let parsed: ParsedSkill;
    try {
      parsed = parseSkillFile(skill.filePath);
    } catch (err) {
      process.stdout.write(
        `  ${skill.dirName}  ${displayPath(skill.filePath, cwd, home)}  (unreadable: ${errMessage(err)})\n`,
      );
      continue;
    }
    const name = pickName(parsed) ?? skill.dirName;
    process.stdout.write(`  ${name}  ${displayPath(skill.filePath, cwd, home)}  ${parseStatus(parsed)}\n`);
  }

  process.stdout.write(
    `\n(This lists discovery and parsing only; lint rules are not wired up yet. ` +
      `Use --simulate "<request>" to rank these skills against a request.)\n`,
  );
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
  const blocks = requests.map((request) =>
    renderSimulation(simulate(docs, request), colors),
  );
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

function reportRoots(roots: DiscoveryRoot[], usedRoots: string[], cwd: string, home: string): void {
  process.stdout.write(`Scanned roots:\n`);
  const counts = new Map<string, number>();
  for (const r of usedRoots) counts.set(r, (counts.get(r) ?? 0) + 1);
  for (const root of roots) {
    if (!root.present) {
      process.stdout.write(`  -  ${displayPath(root.path, cwd, home)}  (absent)\n`);
      continue;
    }
    const n = counts.get(root.path) ?? 0;
    process.stdout.write(`  +  ${displayPath(root.path, cwd, home)}  (${n} skill${n === 1 ? "" : "s"})\n`);
  }
}

function parseStatus(parsed: ParsedSkill): string {
  if (parsed.frontmatterError) {
    const loc = parsed.frontmatterError.line ? ` (line ${parsed.frontmatterError.line})` : "";
    return `frontmatter error: ${parsed.frontmatterError.message}${loc}`;
  }
  if (!parsed.frontmatterPresent) return "no frontmatter";
  return "frontmatter ok";
}

function pickName(parsed: ParsedSkill): string | null {
  const name = parsed.frontmatter?.["name"];
  return typeof name === "string" && name.trim() !== "" ? name : null;
}

/**
 * Human-friendly path: relative to cwd when it stays inside the project, `~/…`
 * for anything under the home directory, otherwise absolute. Always forward
 * slashes so output reads the same on every platform and matches the spec.
 */
function displayPath(p: string, cwd: string, home: string): string {
  const rp = relative(cwd, p);
  if (rp !== "" && !rp.startsWith("..") && !isAbsolute(rp)) return slash(rp);

  const hp = relative(home, p);
  if (hp !== "" && !hp.startsWith("..") && !isAbsolute(hp)) return "~/" + slash(hp);

  return slash(p);
}

function slash(p: string): string {
  return p.replace(/\\/g, "/");
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

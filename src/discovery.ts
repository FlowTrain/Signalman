import { existsSync, readFileSync, readdirSync, realpathSync, statSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";

export interface DiscoveredSkill {
  /** Absolute, real path to the SKILL.md (or case variant) file. */
  filePath: string;
  /** Absolute path to the skill directory (the file's parent). */
  dir: string;
  /** Directory basename — the conventional skill name. */
  dirName: string;
  /** The file's actual basename, e.g. "SKILL.md" or "skill.md" (for SK001 casing). */
  fileName: string;
  /** The discovery root this skill was found under. */
  root: string;
}

export interface DiscoveryRoot {
  /** Absolute path of the root. */
  path: string;
  kind: "project" | "personal" | "explicit";
  present: boolean;
}

export interface DiscoveryResult {
  skills: DiscoveredSkill[];
  roots: DiscoveryRoot[];
  /**
   * Files that look like skills but are not named SKILL.md, so no agent discovers
   * them (SK018). Absolute, real paths. Direct children of a root only.
   */
  nearMisses: string[];
}

export interface DiscoveryOptions {
  /** Explicit positional paths. When present, all default roots are skipped (spec §9). */
  paths: string[];
  projectOnly: boolean;
  personalOnly: boolean;
  cwd: string;
  home: string;
  /** Override the default project roots (from config `include`). */
  projectRoots?: string[];
  /** Base directory project roots resolve against (the config's dir); defaults to cwd. */
  projectRootBase?: string;
}

// Conventional project and personal skill roots (spec §9), verified against
// agentskills.io and the Claude Code / GitHub Copilot discovery docs.
const PROJECT_ROOTS = [".claude/skills", ".github/skills", ".agents/skills"];
const PERSONAL_ROOTS = [".claude/skills", ".copilot/skills", ".agents/skills"];

// Directories never worth walking into.
const IGNORE_DIRS = new Set(["node_modules", ".git"]);

const SKILL_FILE = /^skill\.md$/i;

/** Discover skills across explicit paths or the conventional roots. */
export function discover(opts: DiscoveryOptions): DiscoveryResult {
  const roots: DiscoveryRoot[] = [];

  if (opts.paths.length > 0) {
    for (const p of opts.paths) {
      const abs = resolve(opts.cwd, p);
      roots.push({ path: abs, kind: "explicit", present: existsSync(abs) });
    }
  } else {
    const wantProject = !opts.personalOnly;
    const wantPersonal = !opts.projectOnly;
    if (wantProject) {
      const projectRoots = opts.projectRoots ?? PROJECT_ROOTS;
      const base = opts.projectRootBase ?? opts.cwd;
      for (const r of projectRoots) {
        const abs = resolve(base, r);
        roots.push({ path: abs, kind: "project", present: existsSync(abs) });
      }
    }
    if (wantPersonal) {
      for (const r of PERSONAL_ROOTS) {
        const abs = join(opts.home, r);
        roots.push({ path: abs, kind: "personal", present: existsSync(abs) });
      }
    }
  }

  const seen = new Set<string>(); // real paths of files already collected
  const skills: DiscoveredSkill[] = [];

  for (const root of roots) {
    if (!root.present) continue;
    for (const filePath of collectSkillFiles(root.path)) {
      let real: string;
      try {
        real = realpathSync(filePath);
      } catch {
        real = filePath;
      }
      if (seen.has(real)) continue;
      seen.add(real);
      skills.push({
        filePath: real,
        dir: dirname(real),
        dirName: basename(dirname(real)),
        fileName: basename(filePath),
        root: root.path,
      });
    }
  }

  skills.sort((a, b) => a.filePath.localeCompare(b.filePath));

  // Near-misses: files that look like skills but sit where a directory should be,
  // so nothing discovers them. Skip anything already collected as a real skill.
  const nearMisses: string[] = [];
  const seenNear = new Set<string>();
  for (const root of roots) {
    if (!root.present) continue;
    for (const filePath of collectNearMisses(root.path)) {
      let real: string;
      try {
        real = realpathSync(filePath);
      } catch {
        real = filePath;
      }
      if (seen.has(real) || seenNear.has(real)) continue;
      seenNear.add(real);
      nearMisses.push(real);
    }
  }
  nearMisses.sort((a, b) => a.localeCompare(b));

  return { skills, roots, nearMisses };
}

/**
 * Files in a skills root that look like skills but aren't named SKILL.md, so no
 * agent will discover them. Direct children only — a stray .md deep inside a real
 * skill (references/, assets/) is legitimate. A YAML frontmatter fence is
 * required, so plain notes and READMEs in the folder are not flagged.
 */
function collectNearMisses(start: string): string[] {
  const stat = safeStat(start);
  if (!stat) return [];
  if (stat.isFile()) return isNearMiss(start) ? [start] : [];

  let entries;
  try {
    entries = readdirSync(start, { withFileTypes: true });
  } catch {
    return [];
  }
  const out: string[] = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const full = join(start, entry.name);
    if (isNearMiss(full)) out.push(full);
  }
  return out;
}

function isNearMiss(file: string): boolean {
  const name = basename(file);
  if (!/\.md$/i.test(name)) return false;
  if (SKILL_FILE.test(name)) return false; // a real (or mis-cased) SKILL.md — SK001's job
  if (/^readme\.md$/i.test(name)) return false; // documentation, not a skill attempt
  return hasFrontmatter(file);
}

function hasFrontmatter(file: string): boolean {
  try {
    return /^\uFEFF?---\r?\n/.test(readFileSync(file, "utf8"));
  } catch {
    return false;
  }
}

/** Collect every SKILL.md (any casing) at or below a path, safe against symlink cycles. */
function collectSkillFiles(start: string): string[] {
  const out: string[] = [];
  const visited = new Set<string>();

  const stat = safeStat(start);
  if (!stat) return out;

  // An explicit path may point directly at a SKILL.md file.
  if (stat.isFile()) {
    if (SKILL_FILE.test(basename(start))) out.push(start);
    return out;
  }

  const walk = (dir: string): void => {
    let real: string;
    try {
      real = realpathSync(dir);
    } catch {
      return;
    }
    if (visited.has(real)) return;
    visited.add(real);

    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return; // unreadable directory: skip, never abort
    }

    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (IGNORE_DIRS.has(entry.name)) continue;
        walk(full);
      } else if (entry.isFile() && SKILL_FILE.test(entry.name)) {
        out.push(full);
      }
    }
  };

  walk(start);
  return out;
}

function safeStat(p: string) {
  try {
    return statSync(p);
  } catch {
    return null;
  }
}

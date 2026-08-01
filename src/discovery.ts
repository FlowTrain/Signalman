import { existsSync, readdirSync, realpathSync, statSync } from "node:fs";
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
  return { skills, roots };
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

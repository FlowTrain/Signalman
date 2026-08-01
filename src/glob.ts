// Minimal glob matching for config include/exclude. Hand-rolled rather than
// pulling in `minimatch` — the one-runtime-dependency budget is a feature.
// Supports: `**` (any run of path segments), `*` (any run within a segment),
// `?` (one non-separator char). Paths are matched with forward slashes.

/** Compile a glob to an anchored RegExp. */
export function globToRegExp(glob: string): RegExp {
  let re = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i]!;
    if (c === "*") {
      if (glob[i + 1] === "*") {
        i++; // consume second '*'
        if (glob[i + 1] === "/") {
          i++; // consume trailing '/': `**/` matches zero or more leading segments
          re += "(?:.*/)?";
        } else {
          re += ".*"; // `**` matches anything, separators included
        }
      } else {
        re += "[^/]*"; // `*` stays within a segment
      }
    } else if (c === "?") {
      re += "[^/]";
    } else {
      re += c.replace(/[.+^${}()|[\]\\]/g, "\\$&");
    }
  }
  return new RegExp("^" + re + "$");
}

const cache = new Map<string, RegExp>();

/** True when `path` (forward-slashed) matches the glob. */
export function matchesGlob(path: string, glob: string): boolean {
  let re = cache.get(glob);
  if (!re) {
    re = globToRegExp(glob);
    cache.set(glob, re);
  }
  return re.test(path.replace(/\\/g, "/"));
}

/** True when `path` matches any of the globs. */
export function matchesAnyGlob(path: string, globs: string[]): boolean {
  return globs.some((g) => matchesGlob(path, g));
}

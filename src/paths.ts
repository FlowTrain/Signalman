import { isAbsolute, relative } from "node:path";

/**
 * Human-friendly path: relative to cwd when it stays inside the project, `~/…`
 * for anything under the home directory, otherwise absolute. Always forward
 * slashes so output reads the same on every platform and matches the spec.
 */
export function displayPath(p: string, cwd: string, home: string): string {
  const rp = relative(cwd, p);
  if (rp !== "" && !rp.startsWith("..") && !isAbsolute(rp)) return slash(rp);

  const hp = relative(home, p);
  if (hp !== "" && !hp.startsWith("..") && !isAbsolute(hp)) return "~/" + slash(hp);

  return slash(p);
}

export function slash(p: string): string {
  return p.replace(/\\/g, "/");
}

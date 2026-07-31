// Copy non-TypeScript assets (JSON data and schema) into dist after tsc, since
// the compiler only emits .js. Cross-platform and dependency-free.
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

for (const dir of ["data", "schema"]) {
  const src = join(root, "src", dir);
  if (!existsSync(src)) continue;
  const dest = join(root, "dist", "src", dir);
  mkdirSync(dest, { recursive: true });
  cpSync(src, dest, { recursive: true });
}

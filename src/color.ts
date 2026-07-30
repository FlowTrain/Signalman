// Tiny ANSI colour helper. A dependency like `chalk` or `picocolors` would be a
// second runtime dependency for ~20 lines of escape codes, so we hand-roll it.
// Colour is applied only when the destination is a TTY (or forced), and honours
// the NO_COLOR convention (https://no-color.org).

export interface Colors {
  readonly enabled: boolean;
  bold(s: string): string;
  dim(s: string): string;
  red(s: string): string;
  yellow(s: string): string;
  green(s: string): string;
  cyan(s: string): string;
}

/** Decide whether to emit colour, from the --color/--no-color flag, NO_COLOR, and TTY status. */
export function resolveColor(flag: boolean | null, stream: { isTTY?: boolean }): boolean {
  if (flag !== null) return flag;
  const noColor = process.env["NO_COLOR"];
  if (noColor !== undefined && noColor !== "") return false;
  return Boolean(stream.isTTY);
}

export function makeColors(enabled: boolean): Colors {
  const wrap = (open: number, close: number) => (s: string) =>
    enabled ? `\x1b[${open}m${s}\x1b[${close}m` : s;
  return {
    enabled,
    bold: wrap(1, 22),
    dim: wrap(2, 22),
    red: wrap(31, 39),
    yellow: wrap(33, 39),
    green: wrap(32, 39),
    cyan: wrap(36, 39),
  };
}

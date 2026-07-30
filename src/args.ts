// Hand-rolled argument parsing. A dependency such as `commander` or `yargs`
// would double the install footprint for a tool whose pitch is one runtime
// dependency, so we parse the handful of flags ourselves (spec §3).

export type OutputFormat = "human" | "json";

export interface CliOptions {
  paths: string[];
  format: OutputFormat;
  simulate: string | null;
  simulateFrom: string | null;
  projectOnly: boolean;
  personalOnly: boolean;
  config: string | null;
  maxWarnings: number | null;
  /** null = decide from TTY; true/false = forced by --color / --no-color. */
  color: boolean | null;
  help: boolean;
  version: boolean;
  /** Parse problems (unknown flag, missing value, bad number). Caller exits 3. */
  errors: string[];
}

const VALUE_FLAGS = new Set([
  "--format",
  "--simulate",
  "--simulate-from",
  "--config",
  "--max-warnings",
]);

export function parseArgs(argv: string[]): CliOptions {
  const opts: CliOptions = {
    paths: [],
    format: "human",
    simulate: null,
    simulateFrom: null,
    projectOnly: false,
    personalOnly: false,
    config: null,
    maxWarnings: null,
    color: null,
    help: false,
    version: false,
    errors: [],
  };

  let positionalOnly = false;

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i]!;

    if (positionalOnly) {
      opts.paths.push(token);
      continue;
    }
    if (token === "--") {
      positionalOnly = true;
      continue;
    }

    if (token.startsWith("--")) {
      const eq = token.indexOf("=");
      const name = eq === -1 ? token : token.slice(0, eq);
      let value: string | null = eq === -1 ? null : token.slice(eq + 1);

      if (VALUE_FLAGS.has(name)) {
        if (value === null) {
          const next = argv[i + 1];
          if (next === undefined) {
            opts.errors.push(`Flag ${name} expects a value.`);
            continue;
          }
          value = next;
          i++;
        }
        applyValueFlag(opts, name, value);
        continue;
      }

      switch (name) {
        case "--project-only":
          opts.projectOnly = true;
          break;
        case "--personal-only":
          opts.personalOnly = true;
          break;
        case "--color":
          opts.color = true;
          break;
        case "--no-color":
          opts.color = false;
          break;
        case "--help":
          opts.help = true;
          break;
        case "--version":
          opts.version = true;
          break;
        default:
          opts.errors.push(`Unknown flag: ${name}`);
      }
      continue;
    }

    if (token.startsWith("-") && token.length > 1) {
      switch (token) {
        case "-h":
          opts.help = true;
          break;
        case "-v":
          opts.version = true;
          break;
        default:
          opts.errors.push(`Unknown flag: ${token}`);
      }
      continue;
    }

    opts.paths.push(token);
  }

  if (opts.projectOnly && opts.personalOnly) {
    opts.errors.push("--project-only and --personal-only cannot be used together.");
  }

  return opts;
}

function applyValueFlag(opts: CliOptions, name: string, value: string): void {
  switch (name) {
    case "--format":
      if (value === "human" || value === "json") {
        opts.format = value;
      } else {
        opts.errors.push(`--format must be "human" or "json", got "${value}".`);
      }
      break;
    case "--simulate":
      opts.simulate = value;
      break;
    case "--simulate-from":
      opts.simulateFrom = value;
      break;
    case "--config":
      opts.config = value;
      break;
    case "--max-warnings": {
      const n = Number(value);
      if (!Number.isInteger(n) || n < 0) {
        opts.errors.push(`--max-warnings must be a non-negative integer, got "${value}".`);
      } else {
        opts.maxWarnings = n;
      }
      break;
    }
  }
}

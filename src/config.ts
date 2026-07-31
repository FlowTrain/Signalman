// Configuration model and loader. `signalman.config.json` is discovered upward
// from the working directory (or given with --config). Every threshold in the
// rules lives here with an opinionated default, so people can disagree without
// forking (spec §8).

import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import type { Severity } from "./rules/types.js";

/** Per-rule setting: turn a rule off, override its severity, and pass options. */
export interface RuleSetting {
  off?: boolean;
  severity?: Severity;
  options?: Record<string, unknown>;
}

export interface RuleConfig {
  rules: Record<string, RuleSetting>;
  /** Fail (exit 1) when warnings exceed this. null = never fail on warnings. */
  maxWarnings: number | null;
  /** Project roots to scan instead of the defaults (relative to the config/cwd). */
  include?: string[];
  /** Globs of skills to skip. */
  exclude?: string[];
}

export function defaultConfig(): RuleConfig {
  return { rules: {}, maxWarnings: null };
}

export function isRuleEnabled(config: RuleConfig, ruleId: string): boolean {
  return config.rules[ruleId]?.off !== true;
}

/** A configured severity override for a rule, or null when none is set. */
export function severityOverride(config: RuleConfig, ruleId: string): Severity | null {
  return config.rules[ruleId]?.severity ?? null;
}

/** Read a rule option with a typed fallback. */
export function ruleOption<T>(config: RuleConfig, ruleId: string, key: string, fallback: T): T {
  const value = config.rules[ruleId]?.options?.[key];
  return value === undefined ? fallback : (value as T);
}

export interface LoadResult {
  config: RuleConfig;
  /** Absolute path of the config that was loaded, or null when none was found. */
  path: string | null;
  /** Set when a config was found but could not be read or was invalid (exit 3). */
  error: string | null;
}

const CONFIG_FILENAME = "signalman.config.json";
const SEVERITIES: readonly Severity[] = ["error", "warn", "info"];

/**
 * Load configuration. With an explicit path, that file must exist and be valid;
 * otherwise the nearest `signalman.config.json` at or above cwd is used, and its
 * absence is fine (defaults apply).
 */
export function loadConfig(cwd: string, explicitPath: string | null): LoadResult {
  const config = defaultConfig();

  let filePath: string | null;
  if (explicitPath !== null) {
    filePath = resolve(cwd, explicitPath);
    if (!existsSync(filePath)) {
      return { config, path: null, error: `config file not found: ${explicitPath}` };
    }
  } else {
    filePath = findConfigUp(cwd);
    if (filePath === null) return { config, path: null, error: null };
  }

  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(filePath, "utf8"));
  } catch (err) {
    return { config, path: filePath, error: `invalid JSON in ${filePath}: ${message(err)}` };
  }

  const error = mergeConfig(config, raw);
  return { config, path: filePath, error: error ? `${error} (in ${filePath})` : null };
}

function findConfigUp(cwd: string): string | null {
  let dir = resolve(cwd);
  for (;;) {
    const candidate = resolve(dir, CONFIG_FILENAME);
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) return null; // reached filesystem root
    dir = parent;
  }
}

/** Merge a parsed config object into `config`. Returns an error string, or null on success. */
function mergeConfig(config: RuleConfig, raw: unknown): string | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return "config must be a JSON object";
  }
  const obj = raw as Record<string, unknown>;

  if ("maxWarnings" in obj) {
    const mw = obj["maxWarnings"];
    if (mw === null) config.maxWarnings = null;
    else if (typeof mw === "number" && Number.isInteger(mw) && mw >= 0) config.maxWarnings = mw;
    else return "maxWarnings must be a non-negative integer or null";
  }

  for (const key of ["include", "exclude"] as const) {
    if (key in obj) {
      const value = obj[key];
      if (!Array.isArray(value) || !value.every((v) => typeof v === "string")) {
        return `${key} must be an array of strings`;
      }
      config[key] = value as string[];
    }
  }

  if ("rules" in obj) {
    const rules = obj["rules"];
    if (typeof rules !== "object" || rules === null || Array.isArray(rules)) {
      return "rules must be an object";
    }
    for (const [id, value] of Object.entries(rules as Record<string, unknown>)) {
      const setting = parseRuleSetting(value);
      if (typeof setting === "string") return `rule ${id}: ${setting}`;
      config.rules[id] = setting;
    }
  }

  return null;
}

/** Parse one rule setting. Returns a RuleSetting, or an error string. */
function parseRuleSetting(value: unknown): RuleSetting | string {
  // "off"
  if (value === "off") return { off: true };
  // "error" | "warn" | "info"
  if (typeof value === "string") {
    if (isSeverity(value)) return { severity: value };
    return `unknown value "${value}"`;
  }
  // ["severity", options?]
  if (Array.isArray(value)) {
    const [sev, options] = value;
    if (!isSeverity(sev)) return `first element must be a severity`;
    if (options !== undefined && !isPlainObject(options)) {
      return "second element must be an options object";
    }
    return { severity: sev, ...(options ? { options: options as Record<string, unknown> } : {}) };
  }
  // { off?, severity?, options? }
  if (typeof value === "object" && value !== null) {
    const o = value as Record<string, unknown>;
    const setting: RuleSetting = {};
    if (o["off"] !== undefined) {
      if (typeof o["off"] !== "boolean") return "off must be a boolean";
      setting.off = o["off"];
    }
    if (o["severity"] !== undefined) {
      if (!isSeverity(o["severity"])) return "severity must be error, warn, or info";
      setting.severity = o["severity"];
    }
    if (o["options"] !== undefined) {
      if (!isPlainObject(o["options"])) return "options must be an object";
      setting.options = o["options"] as Record<string, unknown>;
    }
    return setting;
  }
  return "must be a string, array, or object";
}

function isSeverity(value: unknown): value is Severity {
  return typeof value === "string" && (SEVERITIES as readonly string[]).includes(value);
}

/** A non-null, non-array object — arrays are rejected so options stay key/value maps. */
function isPlainObject(value: unknown): boolean {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function message(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

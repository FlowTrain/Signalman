// Configuration model. Loading `signalman.config.json` from disk lands in a
// later unit (spec §8); this defines the shape and the accessors so rules can
// read thresholds and severity overrides today, defaulting cleanly when absent.

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

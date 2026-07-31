---
name: portability-keys
description: Use when demonstrating how Signalman reports frontmatter keys that only one agent understands. Do NOT use for portable core keys.
globs: "**/*.ts"
context: fork
---

# Portability keys

This skill is valid, but `globs` (Cursor) and `context` (Claude Code) are
ignored by other agents. Signalman reports these as info, not as errors.

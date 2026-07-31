---
name: portability-keys
description: Use when you want to see how Signalman reports frontmatter keys that only one agent understands, so authors can see their cross-agent portability surface.
globs: "**/*.ts"
context: fork
---

# Portability keys

This skill is valid, but `globs` (Cursor) and `context` (Claude Code) are
ignored by other agents. Signalman reports these as info, not as errors.

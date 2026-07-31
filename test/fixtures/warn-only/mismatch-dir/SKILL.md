---
name: different-name
description: Use when the user needs a skill that triggers exactly one warning in tests. Do NOT use in production.
---

# Warn only

This fixture exists to produce a single SK004 warning — the name does not match
the directory — and nothing else, so exit-code tests can exercise the
warning-only path.

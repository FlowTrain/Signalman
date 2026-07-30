---
name: lowercase-file
description: Use when showing that a lowercase skill.md filename is silently skipped by most agents, even when everything inside the file is perfectly valid.
---

# Lowercase file

The filename here is `skill.md`, not `SKILL.md`, so most agents never discover
this skill at all. Signalman flags the casing so the failure is not silent.

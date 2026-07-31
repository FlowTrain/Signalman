---
name: git-commit-message
description: Use this when the user asks for a commit message or wants staged changes summarized. Drafts a Conventional Commits subject and body from the diff. Do NOT use for rewriting or squashing existing history.
---

# Git commit message

Draft a commit message for the currently staged changes.

## Steps

1. Read the staged diff with `git diff --cached`.
2. Choose a type (feat, fix, docs, refactor, test, chore) from the dominant change.
3. Write a subject line under 72 characters, in the imperative mood.
4. Add a body that explains what changed and why, wrapped at 72 columns.

## Notes

- Leave history rewriting to the user; this skill only drafts the message text.

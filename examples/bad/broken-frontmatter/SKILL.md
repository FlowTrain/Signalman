---
name: broken-frontmatter
description: "This description opens a quote but never closes it
tags: [alpha, beta
---

# Broken frontmatter

The YAML above is malformed. Signalman reports the parse error with a line
number instead of crashing, and keeps linting every other skill in the run.

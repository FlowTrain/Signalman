# soul.md — Signalman

Why this exists and why it's shaped the way it is. `CLAUDE.md` says what to build; this says what
not to optimise away.

**This file is committed to a public repo.** It contains no employer, client, or programme detail
and it should stay that way. If you're extending it, keep it about the tool.

## The observation the tool is built on

Skill authors debug the wrong file. When a skill doesn't seem to work, the instinct is to rewrite
the body — add detail, add examples, add emphasis. But the body is only read *after* the skill has
been selected, and selection happens entirely on the `description` frontmatter. If the description
is vague, none of that rewriting is ever read by anything.

What makes this pernicious is the shape of the symptom. Nothing errors. Nothing warns. The agent
just behaves as though the skill isn't there, which is indistinguishable from the agent being bad
at the task. So the conclusion people reach is "the model can't do this" when the actual state is
"the model was never told it could."

That gap between the real failure and the perceived failure is the entire product. Everything in
the spec is downstream of it.

## Why the simulator is the centre of gravity

The thesis above is abstract until someone sees their own skill rank fourth against a request it
should obviously win. That moment converts an argument into a diagnosis, and it takes about four
seconds.

This is why the build order puts the simulator third, before nearly all the rules. A repo with
twenty solid lint rules and no simulator is a YAML validator that nobody talks about. A repo with
the simulator and five rules is a tool people screenshot. Ordering reflects that, and if time runs
short the rules get cut, not the simulator.

The honesty requirement around it isn't hedging. Lexical similarity genuinely isn't what the model
does, and anyone technical enough to run this will work that out in a minute. Getting there first —
in the output footer, every run — is what buys the credibility to make the larger claim about
description quality. Overclaiming on the one measurable thing would poison the unmeasurable part.

## Why the dependency budget is a product decision

One runtime dependency isn't minimalism for its own sake. Three things follow from it:

`npx signalman` works with no install, which is the difference between someone trying this and
someone bookmarking it. A tool that diagnoses a problem people don't know they have gets exactly
one chance at a low-friction first run.

Anyone can audit it. This thing reads files across a user's home directory, including their
personal skills. A supply chain of forty transitive packages doing that is a legitimate thing to be
uneasy about, and the read-only, one-dependency posture is the answer.

And it forces the interesting code to be visible. The TF-IDF implementation *is* the tool. Hiding
it behind a library would make the repo less interesting to the exact people it's trying to reach.

## Why distinctiveness scoring is in v1

SK103 looks like the least important rule and is arguably the most novel. Every other check has a
recognisable shape — required field, length bound, naming convention. Distinctiveness is the only
one that says something about a skill's position in a *corpus*, and it names a real problem that
currently has no vocabulary: a description can be well-formed, specific, and clearly written, and
still be built entirely out of words that twelve other descriptions also use.

Nobody has language for that failure right now. Giving it a number and a name is the kind of thing
that makes a tool get cited rather than just used. It costs almost nothing to compute once the
vectoriser exists.

## The read-only constraint is permanent

No auto-fix, ever, including in the roadmap. Two reasons.

Nobody hesitates to run a tool that can't touch anything. Hesitation is fatal for a tool whose
value is in the first run.

And the rewrite is the part where the author actually learns the pattern. A tool that silently
fixes descriptions produces authors who still can't write one. Showing a suggested rewrite next to
theirs teaches; applying it doesn't.

## On the CI-gate framing

The publish-gate use case — fail the build when frontmatter can't route, so a broken skill never
reaches a registry — is what makes this adoptable by teams rather than individuals. It should be
prominent in the README.

It's worth being clear-eyed that this is the pitch with the most commercial-feeling gravity, and
that's exactly why it should stay a documented pattern rather than a feature. The moment there's a
hosted dashboard, an org policy format, or a service, this stops being a small honest tool that
does one thing and starts being a thing that needs a business model. It's better as the former.

## What would make this a bad tool

Watch for these; they're the plausible-sounding wrong turns.

Adding rules that judge skill *quality* rather than *reachability*. Reviewing whether a skill body
gives good instructions is a different, much fuzzier problem, and mixing it in destroys the crisp
claim that makes the tool legible. Reachability only.

Making SK007 clever. A heuristic people can read, disagree with, and configure is worth more than a
classifier that's right more often but can't be argued with. Linter findings need to be
contestable or they get globally disabled.

Expanding to lint always-on instruction files because it seems adjacent. Those don't have the
silent-selection-failure problem — they're always loaded — so the thesis doesn't transfer. It's
listed as a v2 investigation precisely so it gets investigated rather than assumed.

Any of these would make the tool bigger and the point smaller.

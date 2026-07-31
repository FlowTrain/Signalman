// The rule registry. One rule per file in this directory; import and list it
// here. File rules run per skill; corpus rules run once over the whole set.
//
// Rules are added in build-order units 6-9. Until then these arrays are empty
// and the engine simply reports a clean run.

import type { CorpusRule, FileRule } from "./types.js";

export const fileRules: FileRule[] = [];

export const corpusRules: CorpusRule[] = [];

export const allRules: ReadonlyArray<FileRule | CorpusRule> = [...fileRules, ...corpusRules];

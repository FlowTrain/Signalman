// The rule registry. One rule per file in this directory; import and list it
// here. File rules run per skill; corpus rules run once over the whole set.
//
// More rules are added in build-order units 7-9.

import { sk001Filename } from "./sk001-filename.js";
import { sk002FrontmatterYaml } from "./sk002-frontmatter-yaml.js";
import { sk003NamePresent } from "./sk003-name-present.js";
import { sk004NameMatchesDir } from "./sk004-name-matches-dir.js";
import { sk005NameFormat } from "./sk005-name-format.js";
import { sk006DescriptionPresent } from "./sk006-description-present.js";
import { sk007DescriptionTrigger } from "./sk007-description-trigger.js";
import { sk012BodyPresent } from "./sk012-body-present.js";
import type { CorpusRule, FileRule } from "./types.js";

export const fileRules: FileRule[] = [
  sk001Filename,
  sk002FrontmatterYaml,
  sk003NamePresent,
  sk004NameMatchesDir,
  sk005NameFormat,
  sk006DescriptionPresent,
  sk007DescriptionTrigger,
  sk012BodyPresent,
];

export const corpusRules: CorpusRule[] = [];

export const allRules: ReadonlyArray<FileRule | CorpusRule> = [...fileRules, ...corpusRules];

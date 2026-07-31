// The rule registry. One rule per file in this directory; import and list it
// here. File rules run per skill; corpus rules run once over the whole set.
//
// Corpus rules (SK101–SK103) are added in unit 9.

import { sk001Filename } from "./sk001-filename.js";
import { sk002FrontmatterYaml } from "./sk002-frontmatter-yaml.js";
import { sk003NamePresent } from "./sk003-name-present.js";
import { sk004NameMatchesDir } from "./sk004-name-matches-dir.js";
import { sk005NameFormat } from "./sk005-name-format.js";
import { sk006DescriptionPresent } from "./sk006-description-present.js";
import { sk007DescriptionTrigger } from "./sk007-description-trigger.js";
import { sk008DescriptionLength } from "./sk008-description-length.js";
import { sk009DomainVocab } from "./sk009-domain-vocab.js";
import { sk010NegativeScope } from "./sk010-negative-scope.js";
import { sk011Voice } from "./sk011-voice.js";
import { sk012BodyPresent } from "./sk012-body-present.js";
import { sk013BodyNotRestatement } from "./sk013-body-not-restatement.js";
import { sk014BrokenReferences } from "./sk014-broken-references.js";
import { sk015AbsolutePaths } from "./sk015-absolute-paths.js";
import { sk016FrontmatterKeys } from "./sk016-frontmatter-keys.js";
import { sk017FileSize } from "./sk017-file-size.js";
import { sk101DuplicateName } from "./sk101-duplicate-name.js";
import { sk102TriggerCollision } from "./sk102-trigger-collision.js";
import { sk103Distinctiveness } from "./sk103-distinctiveness.js";
import type { CorpusRule, FileRule } from "./types.js";

export const fileRules: FileRule[] = [
  sk001Filename,
  sk002FrontmatterYaml,
  sk003NamePresent,
  sk004NameMatchesDir,
  sk005NameFormat,
  sk006DescriptionPresent,
  sk007DescriptionTrigger,
  sk008DescriptionLength,
  sk009DomainVocab,
  sk010NegativeScope,
  sk011Voice,
  sk012BodyPresent,
  sk013BodyNotRestatement,
  sk014BrokenReferences,
  sk015AbsolutePaths,
  sk016FrontmatterKeys,
  sk017FileSize,
];

export const corpusRules: CorpusRule[] = [
  sk101DuplicateName,
  sk102TriggerCollision,
  sk103Distinctiveness,
];

export const allRules: ReadonlyArray<FileRule | CorpusRule> = [...fileRules, ...corpusRules];

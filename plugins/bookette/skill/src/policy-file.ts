import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { parsePolicyPhrases, policyPhraseRegexes } from './scan';

// The policy list read from a skill directory's own `rules/policy.md`, for the callers that own
// the file: the out/ checker in the runner sandbox, the question-key and platform-statement
// checks, the corpus scanner. Server-only: it reads the filesystem, so it stays out of './scan',
// whose generated default a client bundle carries.

const fileCache = new Map<string, RegExp[]>();

export function policyFilePhrases(skillDir: string): RegExp[] {
  const cached = fileCache.get(skillDir);
  if (cached !== undefined) return cached;
  const path = join(skillDir, 'rules', 'policy.md');
  const regexes = policyPhraseRegexes(parsePolicyPhrases(readFileSync(path, 'utf8')), path);
  fileCache.set(skillDir, regexes);
  return regexes;
}

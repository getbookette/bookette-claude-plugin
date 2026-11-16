import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { parsePolicyPhrases } from '../scan';

// Regenerates src/policy-phrases.generated.ts from rules/policy.md's "Words to avoid" list, so
// the scan's default path carries the list as data where a module-relative file read cannot
// resolve — the web server bundle, whose bundler stands a /ROOT placeholder in for __dirname
// (issue #413; see the scan's comment for what is pinned and what is not). Run it after editing
// the policy file:
//
//   pnpm --filter @bookette/books-skill generate:policy-phrases
//
// The parse is the one `parsePolicyPhrases` shares with the scan and the freshness test; an empty
// or missing list throws here before anything is written.

const packageRoot = join(__dirname, '..', '..');
const policyPath = join(packageRoot, 'rules', 'policy.md');
const targetPath = join(packageRoot, 'src', 'policy-phrases.generated.ts');

const phrases = parsePolicyPhrases(readFileSync(policyPath, 'utf8'));
if (phrases.length === 0) {
  throw new Error(`no "Words to avoid" list found in ${policyPath}`);
}

// The list is words, but quote like a string literal anyway: a future phrase with a quote or a
// backslash must still produce a valid module.
const quote = (phrase: string): string => `'${phrase.replace(/[\\']/g, '\\$&')}'`;

const lines = [
  '// Generated from rules/policy.md ("Words to avoid") by src/scripts/generate-policy-phrases.ts.',
  '// Do not edit by hand: edit the policy file and re-run',
  '//',
  '//   pnpm --filter @bookette/books-skill generate:policy-phrases',
  '//',
  '// test/scan.spec.ts re-parses rules/policy.md and fails when this module drifts from it.',
  'export const POLICY_PHRASES: readonly string[] = [',
  ...phrases.map((phrase) => `  ${quote(phrase)},`),
  '];',
];

writeFileSync(targetPath, `${lines.join('\n')}\n`);
process.stdout.write(`wrote ${String(phrases.length)} phrases to ${targetPath}\n`);

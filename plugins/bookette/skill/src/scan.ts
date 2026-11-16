import { hasIndividualTin } from '@bookette/identifier-scan';

import { POLICY_PHRASES } from './policy-phrases.generated';

// The individual-tax-identifier shapes every gate shares live in @bookette/identifier-scan
// (`hasIndividualTin`): the skill's own out/ checker, the importer's saved-output gate, the reader's
// gate and the committed-corpus scanner call that one function, so a shape one catches, all catch.

/**
 * The byte scan's per-line test: the line as written and with its `\\uXXXX` escapes decoded, each
 * under `mask`, so a JSON writer that escapes non-ASCII (Python's `ensure_ascii`) cannot hide
 * `\\u0661\\u0662\\u0663-...` Arabic-Indic digits as ASCII. The checker's identifier scan and the
 * profile-fact validator both call it, so what one refuses the other refuses.
 */
export function lineCarriesIndividualTin(
  line: string,
  mask: (text: string) => string = (text) => text,
): boolean {
  const decoded = line.replace(/\\u([0-9a-fA-F]{4})/g, (_match, hex: string) =>
    String.fromCharCode(Number.parseInt(hex, 16)),
  );
  return hasIndividualTin(mask(line)) || hasIndividualTin(mask(decoded));
}

// 0011 item 4's banned list ships as data in the skill (`rules/policy.md`, "Words to avoid"), and
// its words live only there: `src/policy-phrases.generated.ts` is derived from that section by
// `src/scripts/generate-policy-phrases.ts` — edit the policy file, then re-run
// `pnpm --filter @bookette/books-skill generate:policy-phrases` — and test/scan.spec.ts re-parses
// `rules/policy.md` and fails when the generated module drifts from it. The generated module lets
// the default path answer from data rather than the filesystem, which the web server bundle needs:
// there Turbopack stands a `/ROOT` placeholder in for `__dirname`, so a module-relative read
// throws and the scan takes the review screen down with it (issue #413). UNVERIFIED: the
// placeholder is the crash as observed in that session's error overlay, not pinned by a test of
// ours — what the suite pins is that the default path never reads the filesystem at all. The
// callers that own the file — the out/ checker in the runner sandbox, the corpus scanner — read it
// through `./policy-file` (`policyFilePhrases`), so this module imports no Node builtin and a
// client bundle may import it. Matched case-insensitively on word boundaries; a missing or empty
// list throws rather than silently scanning nothing — a broken policy file must fail the gate
// that reads it.

/**
 * Parse the "Words to avoid" list out of a policy file: the first line of the section,
 * comma-separated, trimmed, with a trailing period dropped. The generator, the freshness test and
 * `policyFilePhrases` all parse through this one function, so there is one parse.
 */
export function parsePolicyPhrases(policy: string): string[] {
  const section = policy.split(/^## +Words to avoid[^\n]*$/m)[1] ?? '';
  const listLine = section.trimStart().split('\n')[0] ?? '';
  return listLine
    .replace(/\.$/, '')
    .split(/,\s*/)
    .filter((phrase) => phrase !== '')
    .map((phrase) => phrase.trim());
}

export function policyPhraseRegexes(phrases: readonly string[], source: string): RegExp[] {
  if (phrases.length === 0) {
    throw new Error(`no "Words to avoid" list found in ${source}`);
  }
  return phrases.map((phrase) => {
    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
    return new RegExp(`(?<!\\w)${escaped}(?!\\w)`, 'i');
  });
}

let generatedPhrases: RegExp[] | undefined;

/** The generated list's regexes. Reads no file: a skill dir's own list is `policyFilePhrases`. */
export function bannedPolicyPhrases(): RegExp[] {
  generatedPhrases ??= policyPhraseRegexes(POLICY_PHRASES, 'rules/policy.md');
  return generatedPhrases;
}

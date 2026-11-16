// The one gate for a string a person types that a books run will carry (issues #733 and #898): a
// short-term rental's services note, and a declared entity's name, address and activity. Every
// scan here but the bidirectional one is one the sandbox's checker or the importer's byte scan
// also runs over the staged and resolved profile, and that one only refuses more, so a value this
// accepts can never make a later run reject. Pure and filesystem-free, so a client bundle may
// import it.
//
// A rental's listings (issue #1387) take the same gate with the listings field's one exception
// (`gateListingText`): the one 10 to 19 digit run after a platform word is not a long digit run.
// Neither the checker nor the byte scan reads a staged listing with the long-run check: the
// checker scans a model-written question, finding and resolved-profile note, trip and home, and
// the byte scan tests the individual-TIN shapes alone, which the exception leaves in force.

import { gateDerivedText, gateListingText, hasUrlShape } from '@bookette/identifier-scan';

import { bannedPolicyPhrases, lineCarriesIndividualTin } from './scan';

/** Why a typed string is refused. The code names the reason and never carries the text. */
export type PersonTextProblem = 'malformed' | 'too_long' | 'url' | 'identifier' | 'policy';

const LINE_FEED = 0x0a;

function hasControlCharacter(text: string, allowLineFeed = false): boolean {
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    if (allowLineFeed && code === LINE_FEED) continue;
    if (allowLineFeed && (code === 0x2028 || code === 0x2029)) return true;
    if (code < 0x20 || (code >= 0x7f && code <= 0x9f)) return true;
  }
  return false;
}

// The bidirectional controls — the overrides and embeddings (U+202A to U+202E), the isolates
// (U+2066 to U+2069) and the marks (U+200E, U+200F, U+061C) — reorder what a reader sees, so a
// name carrying one could be stored as something other than what the person read and confirmed
// (0123 item 3). Only these: every other format character (a joiner in an emoji sequence, a
// non-joiner in Persian) is legitimate name text, and the duplicate fold strips it
// (`entityNameKey`).
export const BIDI_CONTROL = /[\u061C\u200E\u200F\u202A-\u202E\u2066-\u2069]/;

/**
 * The platforms a rental's listing may name before its listing id: the platform names of every
 * tax year's `rules/ty<year>/platform_statements/` files, spelled here because a client bundle
 * reads no files (issue #413); test/declared-entity.spec.ts pins the two equal.
 */
export const LISTING_PLATFORMS: readonly string[] = ['Airbnb', 'DoorDash', 'Lyft', 'Uber', 'Vrbo'];

/**
 * The problem with an already-trimmed typed string, or null when it may be stored. `maxLength`
 * counts UTF-16 code units, the length the form's own bound counts. Nothing here logs.
 */
export function personTextProblem(text: string, maxLength: number): PersonTextProblem | null {
  return textProblem(text, maxLength, gateDerivedText);
}

/**
 * {@link personTextProblem} for one of a rental's listings (issue #1387): the same checks, with
 * the identifier gate's listings exception for the one 10 to 19 digit run after a word of
 * {@link LISTING_PLATFORMS}. Only the listings field calls it.
 */
export function listingTextProblem(text: string, maxLength: number): PersonTextProblem | null {
  return textProblem(text, maxLength, (value) => gateListingText(value, LISTING_PLATFORMS));
}

/**
 * A typed paragraph as stored: every CRLF read as LF, the one line-break shape
 * {@link paragraphTextProblem} accepts, with the spaces around each break cut, the breaks around
 * the text cut away and any run of blank lines held to one, so "x", "x\n" and "a\n \nb" against
 * "a\n\nb" are one question and no run of breaks stores a page of blank lines. A lone CR stays
 * and is refused, and a trailing space with no break stays as typed.
 */
export function normalizeLineBreaks(text: string): string {
  return text
    .replaceAll('\r\n', '\n')
    .replace(/[ \t]*\n[ \t]*/g, '\n')
    .replace(/^\n+|\n+$/g, '')
    .replace(/\n{3,}/g, '\n\n');
}

/**
 * {@link personTextProblem} for a paragraph (issue #1756): the same checks, but a line feed is
 * text, not a control character, so a question over several lines can be recorded; U+2028 and
 * U+2029, the other line separators, are refused. The caller passes the text through
 * {@link normalizeLineBreaks} first. Only an accountant open item's text calls it; every other
 * typed string refuses a line break as before. The scans read the text as typed and with each
 * break read as nothing and as a hyphen, so a masked last four split across a break (the byte
 * scan reads the break as a literal `\n`) is caught as one on a line is.
 */
export function paragraphTextProblem(text: string, maxLength: number): PersonTextProblem | null {
  const whole = textProblem(text, maxLength, gateDerivedText, true);
  if (whole !== null || !text.includes('\n')) return whole;
  for (const joiner of ['', '-']) {
    const joined = textProblem(text.replaceAll('\n', joiner), maxLength, gateDerivedText);
    if (joined !== null) return joined;
  }
  return null;
}

function textProblem(
  text: string,
  maxLength: number,
  gate: (text: string) => string | null,
  allowLineFeed = false,
): PersonTextProblem | null {
  // Postgres refuses a NUL (a control character) or an unpaired surrogate in text and jsonb
  // (issue #787's class), and a string of spaces or zero-width characters records nothing.
  if (
    !text.isWellFormed() ||
    hasControlCharacter(text, allowLineFeed) ||
    BIDI_CONTROL.test(text) ||
    !/[\p{L}\p{N}]/u.test(text)
  ) {
    return 'malformed';
  }
  if (text.length > maxLength) return 'too_long';
  if (hasUrlShape(text)) return 'url';
  if (gate(text) === null) return 'identifier';
  // The import's byte scan reads the value as the importer writes it (one JSON line, escapes
  // decoded too) and also matches a masked last-four shape (XXX-XX-1234), which the gate above
  // lets through.
  if (lineCarriesIndividualTin(JSON.stringify(text))) return 'identifier';
  // The checker scans model-adjacent text for the policy list (0011 item 4), and an entity's name
  // reaches questions and findings; a value it would refuse must never be recorded.
  if (bannedPolicyPhrases().some((phrase) => phrase.test(text))) return 'policy';
  return null;
}

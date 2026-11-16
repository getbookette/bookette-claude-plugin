// The one document-status vocabulary of out/documents.json (issue #1042, decision record 0097):
// SKILL.md step 2's status line, check_outputs' schema gate and the personal tool's completeness
// review read these words from here. Pure code with no imports, like ledger-status.ts.

export const DOCUMENT_STATUSES = [
  'booked',
  'listed_only',
  'register_only',
  'support',
  'unreadable',
  'personal',
  'needs_review',
] as const;

/** The status of a document that restates another, written `near_duplicate_of: <file>`. */
export const NEAR_DUPLICATE_STATUS_PREFIX = 'near_duplicate_of:';

export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number] | 'near_duplicate_of';

/** The status word, `near_duplicate_of` for a restatement naming its file, or null for anything
 *  outside the vocabulary (a restatement naming no file included). */
export function documentStatus(value: unknown): DocumentStatus | null {
  if (typeof value !== 'string') return null;
  if (value.startsWith(NEAR_DUPLICATE_STATUS_PREFIX)) {
    return value.slice(NEAR_DUPLICATE_STATUS_PREFIX.length).trim() === ''
      ? null
      : 'near_duplicate_of';
  }
  return (DOCUMENT_STATUSES as readonly string[]).includes(value)
    ? (value as DocumentStatus)
    : null;
}

/** The document types whose lines carry no printed date of their own: an information return for
 *  the tax year, booked on its last day (issue #1042) — a 1099-NEC, a 1099-MISC, a K-1 (which
 *  books no line since #1161, kept for the reader's dateless list) and the mortgage interest
 *  statement (Form 1098), whose line the review screen says is dated the same way (issue
 *  #1084). A 1099-K prints each month's gross, and `form_1099_other` covers forms that print a
 *  date (a 1099-S's closing date, a 1099-B's sale dates), so neither is one. The reader's
 *  `DATELESS_FORM_DOC_TYPES` is this list. */
export const YEAR_FORM_DOC_TYPES = [
  'form_1099_nec',
  'form_1099_misc',
  'schedule_k1',
  'mortgage_interest_statement',
] as const;

/** Whether a documents.json `doc_type` is a tax-year form (`YEAR_FORM_DOC_TYPES`). */
export function isYearForm(docType: unknown): boolean {
  return (
    typeof docType === 'string' && (YEAR_FORM_DOC_TYPES as readonly string[]).includes(docType)
  );
}

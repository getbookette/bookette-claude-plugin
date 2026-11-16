/** Why the reader leaves a page out of a reading (decision record 0129 item 3): the three words
 *  reference/reader-document.md names, one bullet each, pinned by its spec. Import-free, so the
 *  reader's schema and the browser code that reaches it pull in nothing else. */
export const BOILERPLATE_REASONS = ['agreement_text', 'blank', 'continuation_no_figures'] as const;
export type BoilerplateReason = (typeof BOILERPLATE_REASONS)[number];

/**
 * The accountant's treatment-choice items (task 15.3, issue #1376), worded once for the report and
 * the workbook (issue #1652): an advice request the chat recorded, which prints the fixed title and
 * body, and a tie item, a category pick that crossed a treatment tie, which prints code's sentence
 * about its line over the same body. No model text reaches either: the tie is a name the code
 * knows, and the line's date and cents are the ledger's own, rendered here.
 */
import { hasUrlShape, scanForIdentifiers } from '@bookette/identifier-scan';

import { TREATMENT_TIE_NAMES } from './categories';
import type { TreatmentTieName } from './categories';
import { formatOwnCurrency } from './money';

/** The advice item's title, on the report's row and the workbook's. */
export const ADVICE_ITEM_TITLE = 'A treatment choice was asked in chat';

/** The body every treatment-choice item carries. */
export const ADVICE_ITEM_BODY =
  'Recorded for your accountant. Bookette did not choose a treatment.';

/** The group's title, plural over its count: it holds the chat's advice requests and its tie
 *  items, both choices the accountant makes. */
export const ADVICE_GROUP_TITLE = 'Treatment choices left to your accountant';

/** The tie item's question to the accountant, by the tie the pick crossed. */
const TIE_ITEM_QUESTION: Readonly<Record<TreatmentTieName, string>> = {
  'improvement or repair': 'is an improvement or a repair',
  'meal methods': 'is a meal, and if so which meal method applies',
};

/** The line a tie item is about, as the ledger now holds it. */
export interface TieItemLine {
  readonly vendor: string | null;
  readonly transactionDate: string;
  readonly amountCents: number;
  readonly currency: string;
}

/**
 * A tie item's sentence, worded from the line as it now stands: "Whether the Home Depot line of
 * 2026-04-12 ($240.00 USD) is an improvement or a repair". A vendor carrying an identifier or a
 * link shape (Review's display gate), or none, is "the line of …". Null when the stored tie is not
 * one the code knows.
 */
export function categoryTieSentence(line: TieItemLine, tie: string): string | null {
  const known = TREATMENT_TIE_NAMES.find((name) => name === tie);
  if (known === undefined) return null;
  const shown =
    line.vendor === null || scanForIdentifiers(line.vendor) !== null || hasUrlShape(line.vendor)
      ? null
      : line.vendor;
  const subject = shown === null ? 'the line' : `the ${shown} line`;
  return `Whether ${subject} of ${line.transactionDate} (${formatOwnCurrency(line.amountCents, line.currency)}) ${TIE_ITEM_QUESTION[known]}`;
}

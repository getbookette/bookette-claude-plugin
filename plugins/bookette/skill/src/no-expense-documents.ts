// The report's and the workbook's open item for a rental that shows income and no document for a
// cost (issue #1468): derived by code from the placed entries at read time, never a finding, so it
// goes the moment a cost document or a tax payment books. Pure: both surfaces pass the same shape.

/** The title of the group; the workbook's block and the report's group share it. */
export const NO_EXPENSE_DOCUMENTS_TITLE = 'Rentals with income and no expense documents';

/** The item's sentence for one place: the gap stated plainly, with no figure and no treatment. */
export function noExpenseDocumentsSentence(place: string): string {
  return `${place} shows income and no document for a cost`;
}

/** One figure Abacus placed on a schedule line: a ledger line by its id, a property-tax payment's
 *  piece, or a depreciation booking. */
export type PlacedEntry =
  | { readonly kind: 'ledger'; readonly ledgerId: string }
  | { readonly kind: 'tax_payment' }
  | { readonly kind: 'depreciation' };

export interface PlacedLine {
  readonly income: boolean;
  readonly entries: readonly PlacedEntry[];
}

export interface PlacedPlace {
  readonly entityId: number;
  readonly name: string;
  /** Whether the place is a rental (a residential or a short-term one); the caller translates its
   *  own kind word. */
  readonly rental: boolean;
  readonly lines: readonly PlacedLine[];
}

/** What the caller knows of a live ledger line: the document it was read from and its vendor. */
export interface LiveLine {
  readonly document: string | null;
  readonly vendor: string | null;
}

/**
 * The persisted line shape both stores carry (`calculation_steps.steps[0]` and the books'
 * `entities[].lines[code]`): `{label, total_cents, income, entries: [{usd_cents, ledger_id |
 * depreciation | tax}]}`, read by the rules of the web's `stepOf` and `entryOf`: a line without a
 * label, whole-cent total, income flag and entries reads as no line; an entry without whole
 * cents, with other than exactly one key, or a tax piece without a date, as no entry. Both surfaces read
 * through this one function.
 */
export function placedLineOf(raw: unknown): PlacedLine | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const { label, total_cents: total, income, entries } = raw as Record<string, unknown>;
  if (
    typeof label !== 'string' ||
    typeof total !== 'number' ||
    !Number.isInteger(total) ||
    typeof income !== 'boolean' ||
    !Array.isArray(entries)
  ) {
    return null;
  }
  const placed: PlacedEntry[] = [];
  for (const entry of entries as unknown[]) {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) continue;
    const fields = entry as Record<string, unknown>;
    const cents = fields['usd_cents'];
    if (typeof cents !== 'number' || !Number.isInteger(cents)) continue;
    const keys = ['ledger_id', 'depreciation', 'tax'].filter(
      (key) => typeof fields[key] === 'string',
    );
    if (keys.length !== 1) continue;
    if (keys[0] === 'tax') {
      if (typeof fields['date'] === 'string') placed.push({ kind: 'tax_payment' });
    } else if (keys[0] === 'ledger_id') {
      placed.push({ kind: 'ledger', ledgerId: fields['ledger_id'] as string });
    } else placed.push({ kind: 'depreciation' });
  }
  return { income, entries: placed };
}

/** A vendor folded as the report folds one (`sharedVendor`): trimmed and case-folded; null if empty. */
function foldedVendor(vendor: string | null): string | null {
  const folded = vendor?.trim().toLowerCase();
  return folded === undefined || folded === '' ? null : folded;
}

/**
 * The live rentals that have a placed income line and no cost evidence, in input order. The rule:
 * only entries Abacus placed count, so a settled, unclassified or out-of-year line is neither
 * income nor expense, as in every total; a ledger id `lineOf` does not know (a line deleted since
 * the import) is neither. A placed expense line is a cost document unless its document also books
 * the place's income and its vendor equals the vendor of an income line on that same document: a
 * payout's fee lines name the platform as its income does (UNVERIFIED: nothing enforces that for a
 * hand-read export, so a fee line booked under another vendor spelling counts as a cost and hides
 * the item, a miss and never a false statement), while a plumber, a tax office or a
 * cleaner on an owner statement or a bank export is a cost. A line with no document is a cost. A
 * tax payment piece on the place closes the gap; depreciation is no document.
 */
export function rentalsWithIncomeAndNoCostDocument(
  places: readonly PlacedPlace[],
  lineOf: (ledgerId: string) => LiveLine | undefined,
): readonly { readonly entityId: number; readonly name: string }[] {
  const liveLines = (line: PlacedLine): LiveLine[] =>
    line.entries.flatMap((entry) => {
      const live = entry.kind === 'ledger' ? lineOf(entry.ledgerId) : undefined;
      return live === undefined ? [] : [live];
    });
  return places
    .filter((place) => {
      if (!place.rental) return false;
      const income = place.lines.filter((line) => line.income).flatMap(liveLines);
      if (income.length === 0) return false;
      const incomeByDocument = new Set(
        income.flatMap((live) => {
          const vendor = foldedVendor(live.vendor);
          return live.document === null || vendor === null
            ? []
            : [`${live.document}\u0000${vendor}`];
        }),
      );
      const expenses = place.lines.filter((line) => !line.income);
      if (expenses.some((line) => line.entries.some((entry) => entry.kind === 'tax_payment'))) {
        return false;
      }
      return !expenses.flatMap(liveLines).some((live) => {
        const vendor = foldedVendor(live.vendor);
        return (
          live.document === null ||
          vendor === null ||
          !incomeByDocument.has(`${live.document}\u0000${vendor}`)
        );
      });
    })
    .map((place) => ({ entityId: place.entityId, name: place.name }));
}

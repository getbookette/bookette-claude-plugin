// The out/export_rows.json file the books agent declares each card or bank export row in
// (decision record 0174): the dispositions it may give a row, and the window its anchors use. The
// rows are numbered by the reading's transactions or, for an export read from its file, by the
// table its entry declares (0177, `export-table.ts`).

/** How many days apart an export row and the line or document figure it is checked against may be
 *  dated: a card posts days after the purchase, a folio's charge after checkout. */
export const EXPORT_ROW_WINDOW_DAYS = 7;

/** The file under out/ the books agent declares each export row's disposition in. */
export const EXPORT_ROWS_FILE = 'export_rows.json';

/** The words an export row may be declared by. */
export const EXPORT_ROW_DISPOSITIONS = [
  'booked',
  'restated_by',
  'support',
  'personal',
  'transfer',
  'foreign',
] as const;
export type ExportRowDisposition = (typeof EXPORT_ROW_DISPOSITIONS)[number];

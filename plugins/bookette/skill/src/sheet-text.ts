// The sheet reader's CSV half (`read_sheet.js`), import-free beyond node:fs so check_outputs can
// read an original export the way the agent's own reader prints it without loading exceljs.
import { readFileSync } from 'node:fs';

/** A CSV export's text as the sheet reader prints it: the file itself. */
export function readCsvText(path: string): string {
  return readFileSync(path, 'utf8');
}

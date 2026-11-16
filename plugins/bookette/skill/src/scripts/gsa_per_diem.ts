/**
 * Converts GSA's per-diem master rates file into one `conus_mie` window of a rules year's
 * `per_diem.json` (issue #989). Pure at the core: the sheet's rows in, the window out. The CLI is
 * the refresh path a person runs after downloading the file; nothing fetches it at build or
 * test time.
 *
 * Usage: node dist/scripts/gsa_per_diem.js <master.xlsx> <effective_from> <effective_to>
 * The master file is `https://www.gsa.gov/system/files/FY<yyyy>_PerDiemMasterRatesFile.xlsx`;
 * fiscal year <yyyy> runs from <yyyy-1>-10-01 to <yyyy>-09-30. The window prints as JSON on
 * stdout, to be placed in `rules/ty<year>/per_diem.json`'s `conus_mie` list, with the file named in
 * that year's `manifest.json`.
 *
 * The conversion: the header row names the STATE, DESTINATION, COUNTY and M&IE columns; the row
 * after it is the standard CONUS rate; each later row is one destination season. A destination
 * cell naming several cities (`Eureka / Arcata / McKinleyville`) is one key per city,
 * `<City>, <ST>`, in the file's order; the county cell is kept verbatim; a destination's later
 * seasons must repeat its M&IE and county. The first and last day is 75 percent of the M&IE (the
 * GSA M&IE breakdown tiers), exact at the cent.
 */
import { Workbook, type CellValue } from 'exceljs';

import { cellText } from './read_sheet';

export interface MieRate {
  mie: string;
  first_last_day: string;
}

export interface ConusWindow {
  effective_from: string;
  effective_to: string;
  standard: MieRate;
  locations: Record<string, MieRate & { county: string }>;
}

/** Whole cents from an M&IE cell, refusing anything that is not a non-negative cent amount. */
function centsOf(value: CellValue, where: string): number {
  const text = cellText(value).trim();
  if (!/^\d+(\.\d{1,2})?$/.test(text)) {
    throw new Error(`the master file's ${where} M&IE is not a dollar amount`);
  }
  const [dollars = '0', fraction = ''] = text.split('.');
  return Number(dollars) * 100 + Number(fraction.padEnd(2, '0'));
}

function money(cents: number): string {
  return `${String(Math.floor(cents / 100))}.${String(cents % 100).padStart(2, '0')}`;
}

function rateOf(cents: number, where: string): MieRate {
  if ((cents * 3) % 4 !== 0) {
    throw new Error(`the master file's ${where} M&IE has no first and last day at the cent`);
  }
  return { mie: money(cents), first_last_day: money((cents * 3) / 4) };
}

/** The window the master file's rows (each row's cells, first column first) describe. */
export function conusWindow(
  rows: readonly (readonly CellValue[])[],
  effectiveFrom: string,
  effectiveTo: string,
): ConusWindow {
  const texts = rows.map((row) => row.map((cell) => cellText(cell)));
  const headerAt = texts.findIndex(
    (row) => row.includes('DESTINATION') && row.some((cell) => cell.includes('M&IE')),
  );
  const header = texts[headerAt];
  if (header === undefined) {
    throw new Error('the master file has no header row naming DESTINATION and M&IE');
  }
  const column = (match: (cell: string) => boolean, name: string): number => {
    const index = header.findIndex(match);
    if (index === -1) throw new Error(`the master file's header has no ${name} column`);
    return index;
  };
  const state = column((cell) => cell === 'STATE', 'STATE');
  const destination = column((cell) => cell === 'DESTINATION', 'DESTINATION');
  const county = column((cell) => cell.startsWith('COUNTY'), 'COUNTY');
  const mie = column((cell) => cell.includes('M&IE'), 'M&IE');

  const standardRow = rows[headerAt + 1];
  if (standardRow === undefined) throw new Error('the master file has no standard CONUS row');
  const standard = rateOf(centsOf(standardRow[mie] ?? null, 'standard'), 'standard');

  const locations: ConusWindow['locations'] = {};
  for (const row of rows.slice(headerAt + 2)) {
    const st = cellText(row[state] ?? null).trim();
    const cities = cellText(row[destination] ?? null).trim();
    if (st === '' || cities === '') continue;
    const where = `${cities}, ${st}`;
    const entry = {
      ...rateOf(centsOf(row[mie] ?? null, where), where),
      county: cellText(row[county] ?? null),
    };
    for (const city of cities.split('/')) {
      const key = `${city.trim()}, ${st}`;
      const prior = locations[key];
      if (prior === undefined) {
        locations[key] = entry;
      } else if (prior.mie !== entry.mie || prior.county !== entry.county) {
        throw new Error(`the master file's seasons for ${key} disagree on the M&IE or county`);
      }
    }
  }
  return { effective_from: effectiveFrom, effective_to: effectiveTo, standard, locations };
}

/** The first worksheet's rows, each row's cells from the first column, empty rows skipped. */
export async function readMasterRows(path: string): Promise<CellValue[][]> {
  const workbook = new Workbook();
  await workbook.xlsx.readFile(path);
  const sheet = workbook.worksheets[0];
  if (sheet === undefined) throw new Error('the master file has no worksheet');
  const rows: CellValue[][] = [];
  sheet.eachRow((row) => {
    rows.push((row.values as CellValue[]).slice(1));
  });
  return rows;
}

async function main(argv: string[]): Promise<void> {
  const [path, from, to] = argv;
  if (path === undefined || from === undefined || to === undefined) {
    throw new Error('usage: gsa_per_diem.js <master.xlsx> <effective_from> <effective_to>');
  }
  const window = conusWindow(await readMasterRows(path), from, to);
  process.stdout.write(`${JSON.stringify(window, null, 2)}\n`);
}

if (require.main === module) {
  main(process.argv.slice(2)).catch((error: unknown) => {
    process.stderr.write(`${(error as Error).message}\n`);
    process.exitCode = 1;
  });
}

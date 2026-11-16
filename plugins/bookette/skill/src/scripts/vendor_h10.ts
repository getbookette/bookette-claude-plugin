/**
 * Vendors the Federal Reserve H.10 Data Download wide CSV into the rules tree (ADR 0018, plan
 * task 10.9). Pure at the core: the wide text in, the per-currency csv files, the sources.json
 * map, the manifest entries and the currency-map ids out. The CLI is the refresh path a person
 * runs after downloading the file; the committed snapshots are what lookups read, never a live
 * fetch.
 *
 * Usage: node dist/scripts/vendor_h10.js <rules_dir> <wide_csv> <retrieval_date>
 * rules_dir is a tax year's rules directory, rules/ty<year>; run it once for each year the
 * skill carries, from the one download. The retrieval date lands only in the manifest's
 * `fetched`; the per-file citation is dateless so a refresh does not rewrite goldens.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { isValidDay } from '../dates';

export type FxQuote = 'units_per_usd' | 'usd_per_unit';

export interface VendoredH10 {
  files: Record<string, string>; // 'h10_aud.csv' -> full csv text ('date,rate\n…\n')
  sources: Record<string, { file: string; quote: FxQuote; source: string }>; // ISO -> sources.json entry
  manifestEntries: Record<string, { source_url: string; fetched: string }>; // 'fx/h10_aud.csv'… and 'fx/sources.json'
  seriesByIso: Record<string, { seriesId: string; description: string }>; // for currencies.json upkeep
  omissions: string[]; // series ids whose in-range rows are all ND
}

// The window covers tax year 2025 onward, so a 2025 folder's receipts convert: rows earlier than
// it are dropped. It opens a week before the year because 2025-01-01 is an ND holiday: the
// seven-day look-back from New Year's Day must reach the last December 2024 rows, so every day of
// 2025 prices (rules.spec), and each later New Year ND holiday walks back over retained rows.
export const VENDOR_FROM = '2024-12-24';

const H10_SOURCE_URL = 'https://www.federalreserve.gov/datadownload/choose.aspx?rel=h10';

// The download's Currency row also names a code, but the ISO comes only from this map: a series
// the map does not name stops the vendor, so a Fed reshuffle cannot silently mislabel a currency.
const SERIES_TO_ISO: Record<string, string> = {
  'RXI$US_N.B.AL': 'AUD',
  'RXI$US_N.B.EU': 'EUR',
  'RXI$US_N.B.NZ': 'NZD',
  'RXI$US_N.B.UK': 'GBP',
  'RXI_N.B.BZ': 'BRL',
  'RXI_N.B.CA': 'CAD',
  'RXI_N.B.CH': 'CNY',
  'RXI_N.B.DN': 'DKK',
  'RXI_N.B.HK': 'HKD',
  'RXI_N.B.IN': 'INR',
  'RXI_N.B.JA': 'JPY',
  'RXI_N.B.MA': 'MYR',
  'RXI_N.B.MX': 'MXN',
  'RXI_N.B.NO': 'NOK',
  'RXI_N.B.SF': 'ZAR',
  'RXI_N.B.SI': 'SGD',
  'RXI_N.B.KO': 'KRW',
  'RXI_N.B.SL': 'LKR',
  'RXI_N.B.SD': 'SEK',
  'RXI_N.B.SZ': 'CHF',
  'RXI_N.B.TA': 'TWD',
  'RXI_N.B.TH': 'THB',
  'RXI_N.B.VES': 'VEB',
};

export function vendorH10(wide: string, retrieved: string): VendoredH10 {
  if (!isValidDay(retrieved)) throw new Error(`not a valid date: ${retrieved}`);
  const rows = parseCsv(wide).filter((row) => !(row.length === 1 && row[0] === ''));
  const descriptionRow = requireLabelRow(rows, 'Series Description');
  const periodRow = requireLabelRow(rows, 'Time Period');
  if (periodRow.index <= descriptionRow.index) {
    throw new Error('the H.10 download carries "Time Period" before "Series Description"');
  }
  const descriptions = descriptionRow.cells;
  const seriesIds = periodRow.cells;
  const width = seriesIds.length;
  if (descriptions.length !== width) {
    throw new Error(
      `the H.10 download's "Series Description" and "Time Period" rows differ in length`,
    );
  }

  interface Series {
    iso: string;
    seriesId: string;
    description: string;
    quote: FxQuote;
    rates: { day: string; rate: string }[];
    numericInRange: number;
  }
  const series: Series[] = [];
  const byIso = new Map<string, Series>();
  for (let column = 0; column < width; column += 1) {
    const seriesId = seriesIds[column];
    if (seriesId === undefined) throw new Error('the H.10 download has an unnamed series column');
    const iso = SERIES_TO_ISO[seriesId];
    if (iso === undefined) {
      throw new Error(
        `unknown H.10 series ${seriesId}: extend the series map in src/scripts/vendor_h10.ts`,
      );
    }
    if (byIso.has(iso)) throw new Error(`the H.10 download names ${iso} in two columns`);
    const entry: Series = {
      iso,
      seriesId,
      description: descriptions[column] ?? '',
      quote: seriesId.startsWith('RXI$US_') ? 'usd_per_unit' : 'units_per_usd',
      rates: [],
      numericInRange: 0,
    };
    series.push(entry);
    byIso.set(iso, entry);
  }

  let previousDay: string | null = null;
  for (const row of rows.slice(periodRow.index + 1)) {
    const day = row[0];
    if (day === undefined || !isValidDay(day) || row.length !== width + 1) {
      throw new Error(`unexpected row in the H.10 download: ${row.join(',')}`);
    }
    if (previousDay !== null && day <= previousDay) {
      throw new Error(`the H.10 download's dates are not strictly ascending at ${day}`);
    }
    previousDay = day;
    if (day < VENDOR_FROM) continue;
    for (const [index, entry] of series.entries()) {
      const cell = row[index + 1];
      if (cell === undefined) throw new Error(`the H.10 download's ${day} row is short`);
      if (cell === 'ND') continue;
      if (!/^\d+(\.\d+)?$/.test(cell) || Number(cell) <= 0) {
        throw new Error(`unexpected rate cell in the H.10 download: ${cell}`);
      }
      entry.rates.push({ day, rate: cell });
      entry.numericInRange += 1;
    }
  }

  const kept = series.filter((entry) => entry.numericInRange > 0);
  const files: Record<string, string> = {};
  const sources: Record<string, { file: string; quote: FxQuote; source: string }> = {};
  for (const entry of [...kept].sort((a, b) => a.iso.localeCompare(b.iso))) {
    const file = `h10_${entry.iso.toLowerCase()}.csv`;
    files[file] = `date,rate\n` + entry.rates.map((row) => `${row.day},${row.rate}\n`).join('');
    sources[entry.iso] = {
      file,
      quote: entry.quote,
      source: `Federal Reserve H.10, series ${entry.seriesId} (${entry.description})`,
    };
  }
  const manifestEntries: Record<string, { source_url: string; fetched: string }> = {};
  for (const file of Object.keys(files).sort()) {
    manifestEntries[`fx/${file}`] = { source_url: H10_SOURCE_URL, fetched: retrieved };
  }
  manifestEntries['fx/sources.json'] = { source_url: H10_SOURCE_URL, fetched: retrieved };
  const seriesByIso: Record<string, { seriesId: string; description: string }> = {};
  for (const iso of [...byIso.keys()].sort()) {
    const entry = byIso.get(iso);
    if (entry !== undefined)
      seriesByIso[iso] = { seriesId: entry.seriesId, description: entry.description };
  }
  return {
    files,
    sources,
    manifestEntries,
    seriesByIso,
    omissions: series.filter((entry) => entry.numericInRange === 0).map((entry) => entry.seriesId),
  };
}

interface LabelRow {
  index: number;
  cells: string[];
}

function requireLabelRow(rows: string[][], label: string): LabelRow {
  const index = rows.findIndex((row) => row[0] === label);
  if (index === -1) throw new Error(`the H.10 download carries no "${label}" row`);
  const cells = rows[index];
  if (cells === undefined) throw new Error(`the H.10 download carries no "${label}" row`);
  return { index, cells: cells.slice(1) };
}

/** RFC 4180-shaped CSV: a quoted field may hold commas, quotes (doubled) and newlines. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i] ?? '';
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

export interface ManifestSource {
  source_url: string;
  fetched: string;
}

/**
 * The manifest's rebuilt `files` map: the vendored entries in, the new key order out. The
 * `fx/h10_*.csv` entries land at the first old `fx/h10_*.csv` key's position — or, when the
 * manifest names no h10 file but does name `fx/sources.json`, immediately before it; a
 * scaffold naming neither gets the entries appended at the end, so the rebuild can never
 * silently no-op. Old h10 keys the new set does not carry are dropped, and in
 * `fx/sources.json` and `fx/currencies.json` only the H.10 choose-URL entry's `fetched`
 * moves — a second source, Treasury or README, passes through untouched.
 */
export function rebuildManifest(
  files: Record<string, ManifestSource[]>,
  entries: Record<string, ManifestSource>,
  retrieved: string,
): Record<string, ManifestSource[]> {
  const oldKeys = Object.keys(files).filter((key) => /^fx\/h10_.+\.csv$/.test(key));
  const newH10Entries = Object.entries(entries)
    .filter(([key]) => /^fx\/h10_.+\.csv$/.test(key))
    .sort(([a], [b]) => (a < b ? -1 : 1));
  const sourcesEntry = entries['fx/sources.json'];
  if (sourcesEntry === undefined) {
    throw new Error('rebuildManifest carries no "fx/sources.json" entry');
  }
  const insertBefore =
    oldKeys[0] ?? (Object.hasOwn(files, 'fx/sources.json') ? 'fx/sources.json' : null);
  const rebuilt: Record<string, ManifestSource[]> = {};
  for (const [key, value] of Object.entries(files)) {
    if (key === insertBefore) {
      for (const [name, entry] of newH10Entries) {
        rebuilt[name] = [entry];
      }
    }
    if (key === 'fx/sources.json' || key === 'fx/currencies.json') {
      rebuilt[key] = value.map((entry) =>
        entry.source_url === H10_SOURCE_URL
          ? { source_url: entry.source_url, fetched: retrieved }
          : entry,
      );
    } else if (!oldKeys.includes(key)) {
      rebuilt[key] = value;
    }
  }
  if (insertBefore === null) {
    for (const [name, entry] of newH10Entries) {
      rebuilt[name] = [entry];
    }
    rebuilt['fx/sources.json'] = [sourcesEntry];
  }
  return rebuilt;
}

function main(argv: string[]): void {
  const [rulesDir, widePath, retrieved] = argv;
  if (rulesDir === undefined || widePath === undefined || retrieved === undefined) {
    throw new Error('usage: vendor_h10.js <rules_dir> <wide_csv> <retrieval_date>');
  }
  const vendored = vendorH10(readFileSync(widePath, 'utf8'), retrieved);
  const fxDir = join(rulesDir, 'fx');

  const manifestPath = join(rulesDir, 'manifest.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
    files: Record<string, ManifestSource[]>;
  };
  const files = rebuildManifest(manifest.files, vendored.manifestEntries, retrieved);

  const currenciesPath = join(fxDir, 'currencies.json');
  const currencies = JSON.parse(readFileSync(currenciesPath, 'utf8')) as Record<
    string,
    { h10_series: string; treasury_name: string }
  >;
  const resolved: [string, string][] = [];
  for (const iso of Object.keys(currencies)) {
    const series = vendored.seriesByIso[iso];
    if (series === undefined) {
      throw new Error(`the H.10 download carries no series for currency-map entry ${iso}`);
    }
    resolved.push([iso, series.seriesId]);
  }

  // Every read, parse and validation has passed; only here does anything on disk move.
  for (const [name, text] of Object.entries(vendored.files)) {
    writeFileSync(join(fxDir, name), text);
  }
  writeFileSync(join(fxDir, 'sources.json'), `${JSON.stringify(vendored.sources, null, 2)}\n`);
  manifest.files = files;
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  for (const [iso, seriesId] of resolved) {
    const entry = currencies[iso];
    if (entry !== undefined) entry.h10_series = seriesId;
  }
  writeFileSync(currenciesPath, `${JSON.stringify(currencies, null, 2)}\n`);

  console.log(
    `wrote ${String(Object.keys(vendored.files).length)} fx csv files and fx/sources.json`,
  );
  const descriptionById = new Map(
    Object.values(vendored.seriesByIso).map((series) => [series.seriesId, series.description]),
  );
  for (const seriesId of vendored.omissions) {
    console.log(
      `omitted (no numeric rate in range): ${seriesId} (${descriptionById.get(seriesId) ?? ''})`,
    );
  }
  for (const [iso, seriesId] of resolved) {
    console.log(`currencies.json ${iso} -> ${seriesId}`);
  }
}

if (require.main === module) {
  main(process.argv.slice(2));
}

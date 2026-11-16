/**
 * Hash, de-duplicate and count pages for every file in <workspace>/inbox, and on an incremental
 * run name the cross-batch duplicate candidates: every confirmed digest row that names a staged
 * reading's document, and every one a staged page total or transaction row matches by absolute
 * cents within three days (issue #910).
 *
 * Usage: node dist/scripts/inventory.js <workspace>
 * Writes <workspace>/out/inventory.json. The first file by modification time wins
 * when two files have the same SHA-256; later copies count 0 pages.
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  createReadStream,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { basename, extname, join, relative } from 'node:path';
import { pipeline } from 'node:stream/promises';

import { Workbook, type CellValue } from 'exceljs';

import { listFiles } from '../files';
import { readingTotalCents } from '../money';
import { lineCarriesIndividualTin } from '../scan';
import { cellText } from './read_sheet';

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.heic']);

export type Row = {
  file: string;
  sha256: string;
  bytes: number;
  extension: string;
  pages: number | null;
  duplicate_of: string | null;
};

/**
 * One match between a staged reading and a row of the confirmed digest (`confirmed/summaries.json`'s
 * `items` or `held`), so the agent judges the candidate without reading the digest. `doc` names
 * the document the way `pipeline start` does: the inbox path the reading pairs with, or the
 * reading's stem. `matched` says why the row is named: `source` when the row's `source_file`
 * names the staged document itself (the digest already carries it, whatever its figures now
 * read — the disagreement and correction rule's case); `amount` when a page's total or one
 * transaction row equals the digest amount in absolute cents and falls within three days of the
 * digest date (a card posts a purchase a few days after the receipt), or has no readable date;
 * `date` only when the two are the same day; `vendor` only when both sides spell the vendor the
 * same ignoring case and surrounding space. `page` and `transaction` name the figure that matched
 * (`transaction` is the row's index in the page's `transactions`, null for the page's own total;
 * both null for a source-only match), `date` and `amount` are the reading's prints and
 * `digest_date` and `digest_amount` the digest's. The reading's vendor is the row's description
 * for a transaction, else the page's `vendor_or_payer`; a vendor that carries an individual-TIN
 * shape is nulled before the inventory is written, so no file code writes can fail the
 * identifier scan.
 */
export type PossibleDuplicate = {
  doc: string;
  page: number | null;
  transaction: number | null;
  date: string | null;
  amount: string | null;
  vendor: string | null;
  digest_id: string;
  digest_date: string;
  digest_amount: string;
  digest_vendor: string | null;
  digest_source_file: string | null;
  digest_held: boolean;
  matched: ('source' | 'amount' | 'date' | 'vendor')[];
};

export type Inventory = {
  rows: Row[];
  totals: Record<string, number>;
  possible_duplicates: PossibleDuplicate[];
};

type Json = Record<string, unknown>;

function record(value: unknown): Json | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Json)
    : null;
}

function strOrNull(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

/** The reading the layout pairs with an inbox file: its basename with the extension as .json. */
export function readingNameOf(file: string): string {
  const name = basename(file);
  return `${name.slice(0, name.length - extname(name).length)}.json`;
}

/** The basename without its last extension: `inbox/doc_1` → `doc_1`, `IMG_2041.json` → `IMG_2041`. */
export function stemOf(file: string): string {
  const name = basename(file);
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(0, dot) : name;
}

/**
 * Whether two names name one document: `inbox/doc_1`, `doc_1` and `doc_1.json` are one, as are
 * `inbox/IMG_2041.png` and its reading `IMG_2041.json` — the spellings a digest `source_file`,
 * a ledger change and a staged reading use for the same document (check_outputs's batch token).
 */
export function sameDocument(a: string, b: string): boolean {
  return stemOf(a) === stemOf(b);
}

/** One row of the confirmed digest, items and held alike, as `pipeline digest` prints it. */
export type DigestRow = {
  id: string;
  date: string;
  vendor: string | null;
  amount: string;
  source_file: string | null;
  answer_keys: string[];
  schedule: string | null;
  line: string | null;
  tied: boolean;
  held: boolean;
};

/** The staged digest's rows in file order, items before held; null when none is staged. */
export function digestRows(workspace: string): DigestRow[] | null {
  const path = join(workspace, 'confirmed', 'summaries.json');
  if (!existsSync(path)) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
  const digest = record(parsed);
  const rows: DigestRow[] = [];
  for (const [key, held] of [
    ['items', false],
    ['held', true],
  ] as const) {
    const list = digest?.[key];
    if (!Array.isArray(list)) continue;
    for (const raw of list) {
      const row = record(raw);
      const id = strOrNull(row?.['id']);
      const date = strOrNull(row?.['date']);
      const amount = strOrNull(row?.['amount']);
      if (row === null || id === null || date === null || amount === null) continue;
      const keys = row['answer_keys'];
      rows.push({
        id,
        date,
        vendor: strOrNull(row['vendor']),
        amount,
        source_file: strOrNull(row['source_file']),
        answer_keys: Array.isArray(keys)
          ? keys.filter((entry): entry is string => typeof entry === 'string')
          : [],
        schedule: strOrNull(row['schedule']),
        line: strOrNull(row['line']),
        tied: row['tied'] === true,
        held,
      });
    }
  }
  return rows;
}

/**
 * An amount as absolute cents, whatever its print: the reader's exact-print decimal with an
 * optional minus or parentheses, or a person's `$1,280.00`. Null when it is not a number. A
 * card export prints a purchase as `-47.90` where the digest carries `47.90`, so the sign never
 * decides a match.
 */
export function absoluteCents(value: string): bigint | null {
  const cents = readingTotalCents(value.replace(/[$,\s]/g, ''));
  return cents === null ? null : cents < 0n ? -cents : cents;
}

/**
 * A printed date as ISO, or null: `2026-06-03`, US `6/3/2026` and `06/03/26`, and a row's `6/3`
 * without a year under `anchor`'s year (the page's document date as ISO) — or the year before
 * when that lands after the anchor, since a January statement's `12/28` rows are December's. The
 * reader copies a date as printed and the digest's is Postgres's ISO date, so both normalize
 * before they compare.
 */
export function isoDate(text: string, anchor: string | null = null): string | null {
  const trimmed = text.trim();
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(trimmed);
  const us = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2}|\d{4}))?$/.exec(trimmed);
  let year: number;
  let month: number;
  let day: number;
  if (iso !== null) {
    [year, month, day] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  } else if (us !== null) {
    month = Number(us[1]);
    day = Number(us[2]);
    const printed = us[3];
    if (printed === undefined) {
      if (anchor === null) return null;
      year = Number(anchor.slice(0, 4));
      const under = calendarDay(year, month, day);
      return under !== null && under > anchor ? calendarDay(year - 1, month, day) : under;
    }
    year = printed.length === 2 ? 2000 + Number(printed) : Number(printed);
  } else {
    return null;
  }
  return calendarDay(year, month, day);
}

/** The ISO date of a calendar day, or null when the month has no such day. */
function calendarDay(year: number, month: number, day: number): string | null {
  if (!Number.isInteger(year) || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const at = new Date(Date.UTC(year, month - 1, day));
  if (at.getUTCMonth() !== month - 1 || at.getUTCDate() !== day) return null;
  return at.toISOString().slice(0, 10);
}

function dayOf(iso: string): number {
  return Math.round(Date.parse(`${iso}T00:00:00Z`) / 86_400_000);
}

/**
 * How many days a card may post a purchase after the receipt's date and still be named as the
 * same one. UNVERIFIED: that card networks post within three days is a belief about them, not a
 * tested fact; the eval's near-duplicate rows are what test the window. Amount alone across the
 * year would name every recurring charge, and a later posting is the agent's `--amount` lookup.
 */
const POSTING_WINDOW_DAYS = 3;

function sameVendor(a: string | null, b: string | null): boolean {
  return a !== null && b !== null && a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** Reading text, or null when it carries an individual-TIN shape (never written to out/). */
function safeText(value: string | null): string | null {
  return value === null || lineCarriesIndividualTin(JSON.stringify(value)) ? null : value;
}

type Figure = {
  page: number;
  transaction: number | null;
  date: string | null;
  iso: string | null;
  amount: string;
  cents: bigint;
  vendor: string | null;
};

/**
 * The figures one staged page carries: each transaction row, then its own total — last, so a
 * statement's rows claim the digest rows they restate before the page total can.
 */
function pageFigures(page: Json, number: number): Figure[] {
  const fields = record(page['fields']);
  if (fields === null) return [];
  const vendor = strOrNull(fields['vendor_or_payer']);
  const figures: Figure[] = [];
  const pageDate = strOrNull(fields['document_date']);
  const pageIso = pageDate === null ? null : isoDate(pageDate);
  const push = (
    transaction: number | null,
    date: string | null,
    amount: string | null,
    rowVendor: string | null,
  ): void => {
    const cents = amount === null ? null : absoluteCents(amount);
    if (amount === null || cents === null) return;
    const iso = date === null ? null : isoDate(date, pageIso);
    figures.push({ page: number, transaction, date, iso, amount, cents, vendor: rowVendor });
  };
  const transactions = Array.isArray(fields['transactions']) ? fields['transactions'] : [];
  for (const [index, raw] of transactions.entries()) {
    const row = record(raw);
    push(
      index,
      strOrNull(row?.['date']),
      strOrNull(row?.['amount']),
      strOrNull(row?.['description']) ?? vendor,
    );
  }
  push(null, pageDate, strOrNull(fields['total']), vendor);
  return figures;
}

/**
 * How far a figure is from a digest row in days when its amount admits the row — 0 for the same
 * day or when either date is unreadable — or null when the row is not a match.
 */
function figureDistance(figure: Figure, row: DigestRow): number | null {
  const cents = absoluteCents(row.amount);
  if (cents === null || cents !== figure.cents) return null;
  const rowIso = isoDate(row.date);
  if (figure.iso === null || rowIso === null) return 0;
  const days = Math.abs(dayOf(figure.iso) - dayOf(rowIso));
  return days <= POSTING_WINDOW_DAYS ? days : null;
}

/** The nearest digest row a figure admits among those not yet taken, digest order breaking ties. */
function nearestRow(figure: Figure, digest: DigestRow[], taken: Set<string>): DigestRow | null {
  let best: { row: DigestRow; days: number } | null = null;
  for (const row of digest) {
    if (taken.has(row.id)) continue;
    const days = figureDistance(figure, row);
    if (days !== null && (best === null || days < best.days)) best = { row, days };
  }
  return best === null ? null : best.row;
}

/** The staged readings under extractions/, by file name, each with its pages; non-readings skipped. */
function stagedReadings(workspace: string): { name: string; pages: Json[] }[] {
  const extractions = join(workspace, 'extractions');
  if (!existsSync(extractions)) return [];
  const readings: { name: string; pages: Json[] }[] = [];
  for (const name of readdirSync(extractions)
    .filter((entry) => entry.endsWith('.json'))
    .sort()) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(readFileSync(join(extractions, name), 'utf8'));
    } catch {
      continue;
    }
    const reading = record(parsed);
    if (reading === null || !Array.isArray(reading['pages'])) continue;
    readings.push({ name, pages: reading['pages'].map((raw) => record(raw) ?? {}) });
  }
  return readings;
}

/**
 * The cross-batch duplicate candidates of an incremental run: for each staged reading, every
 * digest row whose `source_file` names the document, then every digest row a page total or a
 * transaction row admits by amount and date — figures and rows paired one to one, each figure
 * taking the same-day row first and else the nearest, so two same-day charges name two rows and
 * never one row twice. A first run has none.
 */
export function possibleDuplicates(workspace: string, rows: Row[]): PossibleDuplicate[] {
  const digest = digestRows(workspace);
  if (digest === null || digest.length === 0) return [];
  const docByReading = new Map(rows.map((row) => [readingNameOf(row.file), row.file]));
  const candidates: PossibleDuplicate[] = [];
  for (const { name, pages } of stagedReadings(workspace)) {
    const doc = docByReading.get(name) ?? name.slice(0, -'.json'.length);
    const entries = new Map<string, PossibleDuplicate>();
    const entryFor = (row: DigestRow): PossibleDuplicate => {
      const existing = entries.get(row.id);
      if (existing !== undefined) return existing;
      const entry: PossibleDuplicate = {
        doc,
        page: null,
        transaction: null,
        date: null,
        amount: null,
        vendor: null,
        digest_id: row.id,
        digest_date: row.date,
        digest_amount: row.amount,
        digest_vendor: safeText(row.vendor),
        digest_source_file: row.source_file,
        digest_held: row.held,
        matched: [],
      };
      entries.set(row.id, entry);
      return entry;
    };
    for (const row of digest) {
      if (row.source_file !== null && sameDocument(row.source_file, name)) {
        entryFor(row).matched.push('source');
      }
    }
    const taken = new Set<string>();
    const figures = pages.flatMap((page, index) =>
      pageFigures(page, typeof page['page'] === 'number' ? page['page'] : index + 1),
    );
    for (const figure of figures) {
      const row = nearestRow(figure, digest, taken);
      if (row === null) continue;
      taken.add(row.id);
      const entry = entryFor(row);
      entry.page = figure.page;
      entry.transaction = figure.transaction;
      entry.date = figure.date;
      entry.amount = figure.amount;
      entry.vendor = safeText(figure.vendor);
      entry.matched.push('amount');
      if (figure.iso !== null && figure.iso === isoDate(row.date)) entry.matched.push('date');
      if (sameVendor(figure.vendor, row.vendor)) entry.matched.push('vendor');
    }
    // A source-only entry shows the reading's first vendor, so the agent sees both names.
    for (const entry of entries.values()) {
      if (entry.vendor === null) entry.vendor = safeText(figures[0]?.vendor ?? null);
      candidates.push(entry);
    }
  }
  return candidates;
}

async function sha256(path: string): Promise<string> {
  const hash = createHash('sha256');
  await pipeline(createReadStream(path), hash);
  return hash.digest('hex');
}

function pdfPages(path: string): number | null {
  const run = spawnSync('pdfinfo', [path], { timeout: 30_000 });
  if (run.error || run.status !== 0) return null;
  const line = run.stdout
    .toString()
    .split('\n')
    .find((candidate) => candidate.startsWith('Pages:'));
  return line === undefined ? null : Number(line.split(/\s+/)[1]);
}

/** Visible, non-empty worksheets. */
async function sheetPages(path: string): Promise<number | null> {
  const workbook = new Workbook();
  try {
    await workbook.xlsx.readFile(path);
  } catch {
    return null;
  }
  let count = 0;
  for (const sheet of workbook.worksheets) {
    if (sheet.state !== 'visible') continue;
    // The flag rides an object because control-flow analysis narrows a bare let.
    const state = { populated: false };
    // A row has content when any cell renders non-empty - the same definition
    // read_sheet uses to print rows, so a page the agent can read is a page.
    const hasContent = (values: unknown): boolean => {
      const cells: unknown[] = Array.isArray(values)
        ? values.slice(1)
        : typeof values === 'object' && values !== null
          ? Object.values(values)
          : [];
      return cells.some((cell) => cellText(cell as CellValue).trim() !== '');
    };
    sheet.eachRow((row) => {
      if (!state.populated && hasContent(row.values)) state.populated = true;
    });
    if (state.populated) count += 1;
  }
  return count;
}

/** Frames in a TIFF, from the IFD chain in the header. */
export function tiffPages(buffer: Buffer): number {
  if (buffer.length < 8) return 1;
  const littleEndian = buffer.subarray(0, 2).toString('latin1') === 'II';
  const magic = littleEndian ? buffer.readUInt16LE(2) : buffer.readUInt16BE(2);
  if (magic !== 42) return 1;
  const read16 = (offset: number): number =>
    littleEndian ? buffer.readUInt16LE(offset) : buffer.readUInt16BE(offset);
  const read32 = (offset: number): number =>
    littleEndian ? buffer.readUInt32LE(offset) : buffer.readUInt32BE(offset);
  let ifd = read32(4);
  let frames = 0;
  const seen = new Set<number>();
  while (ifd !== 0 && !seen.has(ifd) && ifd + 2 <= buffer.length) {
    seen.add(ifd);
    frames += 1;
    const next = ifd + 2 + read16(ifd) * 12;
    if (next + 4 > buffer.length) break;
    ifd = read32(next);
  }
  return frames;
}

async function countPages(path: string): Promise<number | null> {
  const extension = extname(path).toLowerCase();
  if (extension === '.pdf') return pdfPages(path);
  if (extension === '.xlsx' || extension === '.xlsm') return sheetPages(path);
  if (extension === '.tif' || extension === '.tiff') return tiffPages(readFileSync(path));
  if (IMAGE_EXTENSIONS.has(extension) || extension === '.csv') return 1;
  return null;
}

export async function inventory(workspace: string): Promise<Inventory> {
  const inbox = join(workspace, 'inbox');
  const files = listFiles(inbox).map((path) => ({ path, mtime: statSync(path).mtimeMs }));
  files.sort((a, b) => a.mtime - b.mtime || (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  const firstByHash = new Map<string, string>();
  const rows: Row[] = [];
  for (const { path } of files) {
    const relativePath = relative(workspace, path);
    const extension = extname(path).toLowerCase();
    // A TIFF is read once for both the hash and the frame count.
    const buffer = extension === '.tif' || extension === '.tiff' ? readFileSync(path) : null;
    const digest = buffer ? createHash('sha256').update(buffer).digest('hex') : await sha256(path);
    const duplicateOf = firstByHash.get(digest) ?? null;
    if (duplicateOf === null) firstByHash.set(digest, relativePath);
    const pages = duplicateOf !== null ? 0 : buffer ? tiffPages(buffer) : await countPages(path);
    const row: Row = {
      file: relativePath,
      sha256: digest,
      bytes: statSync(path).size,
      extension,
      pages,
      duplicate_of: duplicateOf,
    };
    rows.push(row);
  }
  const totals = {
    files: rows.length,
    unique: firstByHash.size,
    duplicates: rows.filter((row) => row.duplicate_of !== null).length,
    pages: rows.reduce((sum, row) => sum + (row.pages ?? 0), 0),
  };
  return { rows, totals, possible_duplicates: possibleDuplicates(workspace, rows) };
}

/** The inventory, written to out/inventory.json — the CLI's work, shared with `pipeline start`. */
export async function writeInventory(workspace: string): Promise<Inventory> {
  const result = await inventory(workspace);
  mkdirSync(join(workspace, 'out'), { recursive: true });
  writeFileSync(
    join(workspace, 'out', 'inventory.json'),
    JSON.stringify(
      {
        files: result.rows,
        totals: result.totals,
        possible_duplicates: result.possible_duplicates,
      },
      null,
      2,
    ),
  );
  return result;
}

async function main(argv: string[]): Promise<void> {
  const workspace = argv[0];
  if (workspace === undefined) throw new Error('usage: inventory.js <workspace>');
  const { totals } = await writeInventory(workspace);
  console.log(JSON.stringify(totals));
}

if (require.main === module) {
  void main(process.argv.slice(2));
}

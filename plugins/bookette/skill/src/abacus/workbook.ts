/**
 * The accountant's workbook (issue #1041): books.xlsx, rendered from Abacus's books exactly as
 * books.json carries them, beside renderMarkdown, for the personal tool's folder and the SaaS
 * alike. Four sheets:
 *
 * - Lines: one row per figure Abacus placed on a schedule line or K-1 box (a ledger line, the
 *   register's depreciation, a property-tax piece, the chosen home-office reading), then the
 *   ledger lines no place takes yet, then any ledger line no slot carries (a line-30 line the
 *   chosen home-office reading replaced), its line left blank so no total counts it. The amount is
 *   the entry's own USD cents, shown in dollars in the cell only. The lines dated outside the tax
 *   year follow (decision record 0148), each with the line it would have taken and its amount as
 *   printed; the In year column reads No on them and every total's SUMIFS requires Yes.
 * - Schedules: one block per place, each line's and box's total as a SUMIFS over Lines, the
 *   income, expense and net totals re-adding those cells, then the side-by-side comparisons the
 *   books carry for the place, as they carry them and labelled as books.md labels them.
 * - Checks: one row per Schedules total, the total minus Abacus's own figure written as a
 *   constant, rounded to cents: every row is 0.00 exactly when the workbook's sums agree with
 *   Abacus. A count of the ledger lines against Abacus's closes it.
 * - Open items: the questions still open, the placements Bookette made without asking (when the
 *   inputs carry them: the SaaS hand-off does, issue #1384), the findings for the accountant, the
 *   person's own questions for their accountant (when the inputs carry them, issue #1382), the
 *   lines dated outside the tax year, and each 1099 received beside the income booked to its
 *   payer, with the difference as a formula. Every formula carries its result, so a viewer that
 *   does not recalculate shows the figure the formula yields.
 * - Schedules also lists the charitable contributions after the places: listed, never summed.
 *
 * The formulas only re-add Abacus's figures, or compare a document's figure against them; no
 * formula yields a figure that is booked (decision record 0011, its 2026-10-13 amendment), and
 * every re-added total has its Checks row. Every string a model, a document or a person wrote
 * passes the display gate (`gateDerivedText`, the review screen's and the personal tool's), and
 * every one in Bookette's own voice the policy-phrase scan too; a name copied as printed and a
 * file path pass the display gate alone (0011 items 4 and 7). A hit is replaced by a fixed
 * placeholder, never echoed.
 */
import { gateDerivedText } from '@bookette/identifier-scan';
import { Workbook, type CellValue, type Worksheet } from 'exceljs';

import {
  ADVICE_GROUP_TITLE,
  ADVICE_ITEM_BODY,
  ADVICE_ITEM_TITLE,
  categoryTieSentence,
} from '../advice-items';
import type { TieItemLine } from '../advice-items';
import { endedMonthWords } from '../ended-month';
import { NO_EXPENSE_DOCUMENTS_TITLE, noExpenseDocumentsSentence } from '../no-expense-documents';
import { PLACED_GROUP_TITLE, placedLine } from '../question-keys';
import { fmtCents, readingTotalCents } from '../money';
import { bannedPolicyPhrases } from '../scan';
import type { BooksResult } from './compose';
import { asArray, asObject, text, type Json } from './values';
import { parseVehicleBandStep } from '../comparison-words';
import { vehicleMilesWords, vehicleUseEntities } from './vehicles';

/** What a string carrying an identifier or a link reads as. The personal tool's own placeholder
 *  (apps/tui `WITHHELD`), pinned equal by its spec. */
export const WORKBOOK_WITHHELD = '[withheld: identifier or link]';
/** What a string carrying a word the policy keeps out of the books reads as. */
export const WORKBOOK_WORDING_WITHHELD = '[withheld: wording]';

export const WORKBOOK_SHEETS = ['Lines', 'Schedules', 'Checks', 'Open items'] as const;

/** One question still open for the person, as its prompt and its options' labels. */
export interface WorkbookQuestion {
  readonly prompt: string;
  readonly options: readonly string[];
}

/** One placement Bookette made without asking (issue #1384, decision record 0150): the question
 *  as it would have been asked, and the name of the place its lines still book on, null when a
 *  move took them elsewhere (`stillPlacedOn`); the row reads "Placed on <place>" or "Placed, since
 *  moved" (`placedLine`), as the report's does. */
export interface WorkbookPlacement {
  readonly prompt: string;
  readonly place: string | null;
}

/** One treatment choice left to the accountant (issue #1652), the report's ADVICE group: an
 *  advice request the chat recorded, or a tie item with the tie's name and its line as the ledger
 *  now holds it. The workbook words both (`adviceItemCells`), never from stored text. */
export type WorkbookAdviceItem =
  | { readonly kind: 'request' }
  | { readonly kind: 'tie'; readonly tie: string; readonly line: TieItemLine };

/** One finding for the accountant: its kind's title, its message and what it is about. */
export interface WorkbookFinding {
  readonly title: string;
  readonly message: string;
  /** Ledger ids and cited documents' paths, kept as printed through the name gate, and a trip
   *  cited by its key (`trip:<key>`, a run's spelling), word-scanned as a trip's name is. */
  readonly cites: readonly string[];
  /** The name of the trip the finding is about: no name a document prints, so it is word-scanned. */
  readonly trip?: string;
}

/** One K-1 box as transcribed: its number and code as the form prints them, and its amount in
 *  whole cents (null when the transcription is not a figure). */
export interface WorkbookFormBox {
  readonly box: string;
  readonly cents: number | null;
}

/** One form received, as its reading carries it: the form (a 1099's or a K-1's `doc_type`), the
 *  payer, the document and the amount the form shows (whole cents, null when the reading carries
 *  none, and always null for a K-1). A K-1 also carries the tax year it is for and its boxes as
 *  transcribed (issue #1161): nothing is booked from a K-1, so it is listed, never compared. */
export interface WorkbookForm {
  readonly form: string;
  readonly payer: string | null;
  readonly document: string | null;
  readonly amountCents: number | null;
  readonly taxYear?: string | null;
  readonly boxes?: readonly WorkbookFormBox[];
}

/** A K-1 as its documents.json entry's or its reading's `fields` carry it (issue #1161): the payer,
 *  the tax year (four digits, else null) and each `form_boxes` entry in the order transcribed. */
export function k1FormOf(fields: Record<string, unknown>, document: string | null): WorkbookForm {
  const payer = fields['vendor_or_payer'];
  const year = fields['tax_year'];
  const yearText = typeof year === 'number' ? String(year) : year;
  const rawBoxes = fields['form_boxes'];
  const boxes: WorkbookFormBox[] = [];
  if (typeof rawBoxes === 'object' && rawBoxes !== null && !Array.isArray(rawBoxes)) {
    for (const [box, amount] of Object.entries(rawBoxes as Record<string, unknown>)) {
      const read =
        typeof amount === 'string' || typeof amount === 'number'
          ? readingTotalCents(String(amount))
          : null;
      boxes.push({ box, cents: read === null ? null : Number(read) });
    }
  }
  // In the form's order: box 9a after box 8, never after box 20 (a JSON object lists its
  // integer-like keys first).
  const order = (box: string): number => Number.parseInt(box, 10);
  boxes.sort((a, b) => {
    const [x, y] = [order(a.box), order(b.box)];
    if (Number.isNaN(x) || Number.isNaN(y)) {
      return Number.isNaN(x) ? (Number.isNaN(y) ? 0 : 1) : -1;
    }
    return x - y || a.box.localeCompare(b.box);
  });
  return {
    form: 'schedule_k1',
    payer: typeof payer === 'string' && payer.trim() !== '' ? payer : null,
    document,
    amountCents: null,
    taxYear: typeof yearText === 'string' && /^\d{4}$/.test(yearText) ? yearText : null,
    boxes,
  };
}

/** One charitable contribution as stored (decision record 0068): listed for the accountant, never
 *  booked. The amounts are the receipt's own, in its own currency; the document is the receipt's
 *  organized copy, relative to the workbook. */
export interface WorkbookDonation {
  readonly organization: string;
  readonly date: string;
  readonly amountCents: number;
  readonly currency: string;
  readonly form: 'cash' | 'non_cash';
  readonly goodsServicesCents: number | null;
  readonly document: string | null;
  /** The receipt as the run cited it, shown as a name when no organized copy resolved. */
  readonly source: string;
}

export interface WorkbookInputs {
  /** Abacus's books, as books.json carries them. */
  readonly books: BooksResult;
  /** The ledger the books were built from, for each line's date, vendor, description, status,
   *  kind, trip and source document; its amounts are never read. */
  readonly ledger: readonly unknown[];
  /** Each ledger line's organized copy, as a path relative to the workbook's own folder
   *  (`documents/<place>/<name>`); a line without one shows its source path as text. */
  readonly documentLinks?: ReadonlyMap<string, string>;
  /** Each source a books row cites with no ledger line (a property-tax piece, a staged payment, a
   *  home cost, a donation with no resolved receipt), keyed by the cited file's stem (the SaaS's
   *  `doc_<id>`), as its organized copy's path; a source without one shows as text. */
  readonly sourceLinks?: ReadonlyMap<string, string>;
  readonly questions?: readonly WorkbookQuestion[];
  /** The placements Bookette made without asking, the report's same group; absent, the section is
   *  not printed (the personal tool stages no review mode, so its runs ask every placement). */
  readonly placed?: readonly WorkbookPlacement[];
  readonly findings?: readonly WorkbookFinding[];
  /** The treatment choices left to the accountant (issue #1652), in the report's order. Absent,
   *  the block is not printed (the personal tool's chat records none). */
  readonly adviceItems?: readonly WorkbookAdviceItem[];
  /** The person's own questions for their accountant (issue #1382), each under its place's name.
   *  Absent, the block is not printed (the personal tool stages none). */
  readonly personItems?: readonly { readonly placeName: string; readonly message: string }[];
  /** The rentals with income and no document for a cost (issue #1468), by name, derived by
   *  `rentalsWithIncomeAndNoCostDocument`. Absent, the block is not printed (the personal tool
   *  derives none). */
  readonly rentalsWithoutCostDocuments?: readonly string[];
  readonly forms?: readonly WorkbookForm[];
  /** Each trip's name by the books' trip key (`trip_<id>`), as the Report titles it; a trip
   *  absent here shows its key. */
  readonly tripNames?: ReadonlyMap<string, string>;
  /** The stored contributions listing, the Report's same rows; absent, the books' own
   *  `donations` are listed (the personal tool stores none apart from them). */
  readonly donations?: readonly WorkbookDonation[];
  /**
   * A place the person said ended, keyed by the books entity key, the column's `YYYY-MM-01`
   * (or `YYYY-MM`). One text row on that place's Schedules block, after its comparisons: no
   * amount, no formula, and no Checks row (issue #899).
   */
  readonly endedOn?: ReadonlyMap<string, string>;
}

/** A cell of the model: text, a money figure in cents, a count, a formula, or a link. */
export type WorkbookCell =
  | { readonly t: 'text'; readonly v: string; readonly wrap?: true }
  | { readonly t: 'money'; readonly cents: number }
  | { readonly t: 'count'; readonly v: number }
  | {
      readonly t: 'formula';
      readonly f: string;
      readonly money: boolean;
      /** The value a reader without recalculation shows: Abacus's own figure, or none. */
      readonly result: number | null;
    }
  | { readonly t: 'link'; readonly text: string; readonly target: string }
  | null;

export interface WorkbookRow {
  readonly cells: readonly WorkbookCell[];
  readonly bold?: boolean;
}

export interface WorkbookSheet {
  readonly name: (typeof WORKBOOK_SHEETS)[number];
  readonly widths: readonly number[];
  readonly rows: readonly WorkbookRow[];
}

// --- Strings -------------------------------------------------------------------------------

// C0 and C1 controls and the bidirectional controls: never valid in the sheet's XML, and never
// allowed to reorder what the accountant reads.
// eslint-disable-next-line no-control-regex -- the control characters are the match.
const CONTROL = /[\u0000-\u001f\u007f-\u009f؜‎‏‪-‮⁦-⁩]/g;

function carriesPolicyPhrase(value: string): boolean {
  return bannedPolicyPhrases().some((phrase) => phrase.test(value));
}

/** A model-, document- or person-written string as a cell shows it: controls spaced out, the
 *  display gate and the policy-phrase scan passed, else the fixed placeholder. */
export function workbookText(value: unknown): string {
  if (value === null || value === undefined) return '';
  const raw = typeof value === 'string' ? value : text(value);
  const safe = raw.replace(CONTROL, ' ');
  if (gateDerivedText(safe) === null) return WORKBOOK_WITHHELD;
  return carriesPolicyPhrase(safe) ? WORKBOOK_WORDING_WITHHELD : safe;
}

// CONTROL without the line feed, which a paragraph keeps.
const CONTROL_BUT_LINE_FEED =
  // eslint-disable-next-line no-control-regex -- the control characters are the match.
  /[\u0000-\u0009\u000b-\u001f\u007f-\u009f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/g;

/** A person's paragraph (an open item's words, issue #1756) as a cell shows it: {@link
 *  workbookText}, but its line feeds stay. */
export function workbookParagraph(value: string): string {
  const safe = value.replace(CONTROL_BUT_LINE_FEED, ' ');
  if (gateDerivedText(safe) === null) return WORKBOOK_WITHHELD;
  return carriesPolicyPhrase(safe) ? WORKBOOK_WORDING_WITHHELD : safe;
}

/** Every character that pairs into emphasis, code, a link or image, a table row or raw HTML. */
const MARKDOWN_INLINE = /[\\`*_[\]|<]/g;

/** A person's words as open-items.md text: each pairing character backslash-escaped, so no
 *  stretch of them renders as markup. The fixed withheld sentences are code's own and print as
 *  they are. */
function markdownText(value: string): string {
  if (value === WORKBOOK_WITHHELD || value === WORKBOOK_WORDING_WITHHELD) return value;
  return value.replace(MARKDOWN_INLINE, '\\$&');
}

/** A later line of a person's paragraph in open-items.md: indented under its bullet, with its
 *  leading indentation dropped, its words escaped by {@link markdownText} and its first character
 *  (or the stop of a leading number) escaped when it would start a heading, list, quote, fence,
 *  setext rule or table delimiter, so no line of the person's words opens block structure. */
function markdownContinuation(line: string): string {
  const bare = line.trimStart();
  if (bare === '') return '';
  const escaped = markdownText(bare)
    .replace(/^[#>+\-=~:]/, '\\$&')
    .replace(/^(\d+)([.)])/, '$1\\$2');
  return `  ${escaped}`;
}

/** A name copied as a document prints it (a vendor, a payer, a donation's organization, a place's
 *  name), and every file path the workbook shows (an organized copy's path, built from the
 *  vendor; an inbox path, the person's own file name; a finding's cited document): controls
 *  spaced out and the display gate passed, else the fixed placeholder. It is kept as printed,
 *  outside the policy-phrase scan, so the books match the document and a path opens its file
 *  (0011 item 4: the founder's rulings of 2026-10-13 for the names, 2026-11-09 for the paths). */
export function workbookName(value: unknown): string {
  if (value === null || value === undefined) return '';
  const safe = (typeof value === 'string' ? value : text(value)).replace(CONTROL, ' ');
  return gateDerivedText(safe) === null ? WORKBOOK_WITHHELD : safe;
}

// --- Cells ---------------------------------------------------------------------------------

const textCell = (value: unknown): WorkbookCell => ({ t: 'text', v: workbookText(value) });
const paragraphCell = (value: string): WorkbookCell => ({
  t: 'text',
  v: workbookParagraph(value),
  wrap: true,
});
const nameCell = (value: unknown): WorkbookCell => ({ t: 'text', v: workbookName(value) });
const fixed = (value: string): WorkbookCell => ({ t: 'text', v: value });

/** What a finding is about, as the sheet and open-items.md both list it. */
function findingAbout(finding: WorkbookFinding): string {
  const cites = finding.cites.map((cite) =>
    cite.startsWith('trip:') ? workbookText(cite) : workbookName(cite),
  );
  return (finding.trip === undefined ? cites : [...cites, workbookText(finding.trip)]).join(', ');
}
const money = (cents: number): WorkbookCell => ({ t: 'money', cents });

/** A figure as Abacus wrote it: its integer cents, else its decimal string read to cents, else
 *  the words the books use for no figure. */
function figure(cents: unknown, amount: unknown, none = 'not computed'): WorkbookCell {
  if (typeof cents === 'number' && Number.isSafeInteger(cents)) return money(cents);
  if (typeof amount === 'string') {
    const read = readingTotalCents(amount);
    if (read !== null) return money(Number(read));
  }
  return fixed(none);
}

/** A vehicle's priced mileage bands, one row per band step Abacus wrote: the vehicle, the period,
 *  the miles, the rate and the band's cents, which add to the vehicle's standard figure exactly. */
function vehicleBandRows(vehicle: Json): WorkbookCell[][] {
  return asArray(vehicle.steps).flatMap((step) => {
    const band = typeof step === 'string' ? parseVehicleBandStep(step) : null;
    return band === null
      ? []
      : [
          [
            textCell(vehicle.vehicle),
            fixed(`${band.from} to ${band.to}`),
            fixed(band.miles),
            fixed(band.rate),
            money(band.cents),
          ],
        ];
  });
}

/** A slot's total in cents: `total_cents`, else its `total` string read to cents. */
function slotCents(slot: Json): number {
  if (typeof slot.total_cents === 'number') return slot.total_cents;
  const read = readingTotalCents(text(slot.total));
  if (read === null) throw new Error('a books slot carries no readable total');
  return Number(read);
}

/** Dollars as a formula constant: `1234.56`, a negative one in parentheses. */
function dollarsConstant(cents: number): string {
  const formatted = fmtCents(BigInt(cents));
  return cents < 0 ? `(${formatted})` : formatted;
}

/** A SUMIFS/COUNTIFS criterion matching `value` exactly: `=` first, so a leading `<`, `>` or `=`
 *  is part of the value, the wildcards escaped with `~`, and the quotes doubled for the formula's
 *  string literal. UNVERIFIED: this is Excel's documented criteria reading; the spec's evaluator
 *  implements the same reading, and no spreadsheet application ran it. */
export function exactCriterion(value: string): string {
  return `"=${value.replace(/[~*?]/g, '~$&').replace(/"/g, '""')}"`;
}

function columnLetter(index: number): string {
  let n = index + 1;
  let letters = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    letters = String.fromCharCode(65 + rem) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return letters;
}

/** A path relative to the workbook as a hyperlink target: each segment percent-encoded, so a
 *  space, `#` or `%` in an organized name stays part of the path. UNVERIFIED: that Excel and
 *  LibreOffice resolve a percent-encoded relative target against the workbook's own folder is
 *  their documented behaviour, not run here. */
function linkTarget(path: string): string {
  return path
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

// --- Lines ---------------------------------------------------------------------------------

/** The Lines sheet's columns, in order; the formulas name them by these letters. */
export const LINES_COLUMNS = [
  'Place no.',
  'Place',
  'Schedule',
  'Line',
  'Line label',
  'Date',
  'Vendor',
  'Description',
  'Amount',
  'Status',
  'Kind',
  'Entry',
  'Trip',
  'Source document',
  'Ledger id',
  'In year',
] as const;

const col = (name: (typeof LINES_COLUMNS)[number]): string => {
  const letter = columnLetter(LINES_COLUMNS.indexOf(name));
  return `Lines!$${letter}:$${letter}`;
};

export const LEDGER_LINE_ENTRY = 'Ledger line';

/** The In year column's two words (decision record 0148): Yes on every figure the books count, No
 *  on a line dated outside the tax year, which every total's SUMIFS leaves out. */
export const IN_YEAR = 'Yes';
export const NOT_IN_YEAR = 'No';

/** The In year word of a ledger line by its date's year against the books' tax year. */
function inYearWord(item: Json, taxYear: unknown): string {
  return typeof item.date === 'string' && item.date.slice(0, 4) === String(taxYear)
    ? IN_YEAR
    : NOT_IN_YEAR;
}

/** The words a settled line (issue #1153) carries in place of "Not yet assigned": the person
 *  answered that its figure is already inside the income column, so it is in no total and no
 *  place waits for it. Its Kind cell is left blank, so no income SUMIFS (the 1099 comparison)
 *  re-adds it. */
export const SETTLED_WORDS = 'Already inside the income column, not booked again';
export const SETTLED_REASON = 'the person said this figure is already inside the income column';

/** A settled line's amount cell: its printed figure, money when USD, else the figure and its
 *  currency as text, since a settled line is never converted. */
function settledAmountCell(row: Json): WorkbookCell {
  const currency = text(row.currency);
  const cents = readingTotalCents(text(row.amount));
  if (currency === 'USD' && cents !== null) return money(Number(cents));
  return textCell(`${text(row.amount)} ${currency}`);
}

interface PlaceRef {
  readonly no: string;
  readonly name: string;
  readonly schedule: string;
}

/** The ledger row with the slot's kind added only when the row stores none of its own. */
function storedKindWins(row: Json, slotKind: string | null): Json {
  const stores = typeof row.kind === 'string' && row.kind !== '';
  return stores || slotKind === null ? row : { ...row, kind: slotKind };
}

function ledgerById(ledger: readonly unknown[]): Map<string, Json> {
  const byId = new Map<string, Json>();
  for (const raw of ledger) {
    const item = asObject(raw);
    if (typeof item.id === 'string' && !byId.has(item.id)) byId.set(item.id, item);
  }
  return byId;
}

function sourceCell(
  id: string | null,
  source: unknown,
  links: ReadonlyMap<string, string>,
): WorkbookCell {
  const link = id === null ? undefined : links.get(id);
  if (link !== undefined) return copyLinkCell(link);
  return source === null || source === undefined ? null : nameCell(source);
}

/** An organized copy's path as a hyperlink. A copy's path and an inbox path are names: the
 *  organized name is built from the vendor as printed, and the inbox path is the person's own
 *  file name, so they pass the name gate. */
function copyLinkCell(link: string): WorkbookCell {
  const shown = workbookName(link);
  return shown === link ? { t: 'link', text: shown, target: linkTarget(link) } : fixed(shown);
}

/** The copy `sourceLinks` maps a cited source to, by its file name's stem: `doc_884`,
 *  `doc_884.json` and `extractions/doc_884.json` all find the `doc_884` copy. */
function sourceLinkOf(
  source: unknown,
  sourceLinks: ReadonlyMap<string, string>,
): string | undefined {
  if (typeof source !== 'string') return undefined;
  return sourceLinks.get(source.slice(source.lastIndexOf('/') + 1).replace(/\.[^.]*$/, ''));
}

/** The document a books row names by its `source_file` alone (a property-tax piece, a staged
 *  payment, a home cost): its organized copy's link when `sourceLinks` maps it, else the source
 *  as text. */
function citedSourceCell(source: unknown, sourceLinks: ReadonlyMap<string, string>): WorkbookCell {
  const link = sourceLinkOf(source, sourceLinks);
  if (link !== undefined) return copyLinkCell(link);
  return source === null || source === undefined ? null : nameCell(source);
}

function ledgerRow(
  place: PlaceRef | null,
  line: string | null,
  label: string,
  item: Json,
  cents: number,
  links: ReadonlyMap<string, string>,
  placeName: string,
  inYear: string,
): WorkbookRow {
  const id = typeof item.id === 'string' ? item.id : null;
  return {
    cells: [
      place === null ? null : fixed(place.no),
      fixed(placeName),
      place === null ? textCell(item.schedule) : fixed(place.schedule),
      line === null ? null : fixed(line),
      fixed(label),
      textCell(item.date),
      nameCell(item.vendor),
      textCell(item.description),
      money(cents),
      textCell(item.status),
      textCell(item.kind),
      fixed(LEDGER_LINE_ENTRY),
      textCell(item.trip),
      sourceCell(id, item.source_file, links),
      id === null ? null : fixed(id),
      fixed(inYear),
    ],
  };
}

function linesSheet(
  inputs: WorkbookInputs,
  places: ReadonlyMap<string, PlaceRef>,
): { sheet: WorkbookSheet; ledgerRows: number } {
  const { books } = inputs;
  const links = inputs.documentLinks ?? new Map<string, string>();
  const sourceLinks = inputs.sourceLinks ?? new Map<string, string>();
  const byId = ledgerById(inputs.ledger);
  const shownIds = new Set<string>();
  const rows: WorkbookRow[] = [{ cells: LINES_COLUMNS.map(fixed), bold: true }];
  let ledgerRows = 0;
  for (const raw of asArray(books.entities)) {
    const entity = asObject(raw);
    const place = places.get(text(entity.key));
    if (place === undefined) continue;
    // A ledger row's stored kind (the personal tool's) is its Kind; a row that stores none (the
    // SaaS ledger keeps none) takes the books' income-line classification, and a K-1 box has none.
    const slots: [string, Json, string, string | null][] = [
      ...Object.entries(asObject(entity.lines)).map(
        ([line, slot]): [string, Json, string, string | null] => [
          line,
          asObject(slot),
          text(asObject(slot).label),
          asObject(slot).income === true ? 'income' : 'expense',
        ],
      ),
      ...Object.entries(asObject(entity.k1_boxes)).map(
        ([box, slot]): [string, Json, string, string | null] => [
          box,
          asObject(slot),
          `Box ${box}`,
          null,
        ],
      ),
    ];
    for (const [line, slot, label, kind] of slots) {
      const shownLabel = workbookText(label);
      for (const rawEntry of asArray(slot.entries)) {
        const entry = asObject(rawEntry);
        const cents = typeof entry.usd_cents === 'number' ? entry.usd_cents : 0;
        if (typeof entry.ledger_id === 'string') {
          shownIds.add(entry.ledger_id);
          ledgerRows += 1;
          rows.push(
            ledgerRow(
              place,
              line,
              shownLabel,
              storedKindWins(byId.get(entry.ledger_id) ?? { id: entry.ledger_id }, kind),
              cents,
              links,
              place.name,
              // The books place only the year's lines (decision record 0148).
              IN_YEAR,
            ),
          );
          continue;
        }
        const [entryWord, description, date, source] =
          typeof entry.depreciation === 'string'
            ? ['Depreciation', entry.depreciation, null, null]
            : typeof entry.tax === 'string'
              ? ['Property tax', `Parcel ${entry.tax}`, entry.date, entry.source_file]
              : ['Booked figure', null, null, null];
        rows.push({
          cells: [
            fixed(place.no),
            fixed(place.name),
            fixed(place.schedule),
            fixed(line),
            fixed(shownLabel),
            date === null ? null : textCell(date),
            null,
            description === null ? null : textCell(description),
            money(cents),
            null,
            fixed(kind ?? 'expense'),
            fixed(entryWord),
            null,
            citedSourceCell(source, sourceLinks),
            null,
            fixed(IN_YEAR),
          ],
        });
      }
    }
  }
  for (const raw of asArray(books.unassigned)) {
    const row = asObject(raw);
    const id = text(row.id);
    const cents = readingTotalCents(text(row.usd));
    if (cents === null) continue;
    shownIds.add(id);
    ledgerRows += 1;
    const item = byId.get(id) ?? { id };
    rows.push(
      ledgerRow(
        null,
        null,
        '',
        item,
        Number(cents),
        links,
        'Not yet assigned',
        inYearWord(item, books.tax_year),
      ),
    );
  }
  // A settled line (issue #1153) is the person's answer, not work left: it says so.
  for (const raw of asArray(books.settled)) {
    const row = asObject(raw);
    const id = text(row.id);
    shownIds.add(id);
    ledgerRows += 1;
    const settledItem = { ...(byId.get(id) ?? { id }), kind: null };
    const settledRow = ledgerRow(
      null,
      null,
      '',
      settledItem,
      0,
      links,
      SETTLED_WORDS,
      inYearWord(settledItem, books.tax_year),
    );
    // Its printed amount (never converted, issue #1153): USD as money, else as printed text.
    const amountAt = LINES_COLUMNS.indexOf('Amount');
    rows.push({
      ...settledRow,
      cells: settledRow.cells.map((cell, at) => (at === amountAt ? settledAmountCell(row) : cell)),
    });
  }
  // A line dated outside the tax year (decision record 0148): the place and line it would have
  // taken, its amount as printed (never converted), and No in the In year column, so no total's
  // SUMIFS re-adds it while the ledger count still does.
  for (const raw of asArray(books.outside_year)) {
    const row = asObject(raw);
    // A tax payment or a home cost dated outside the year is no ledger line: the Open items block
    // lists it, and no total ever counted it.
    if (row.kind !== 'line') continue;
    const id = text(row.id);
    shownIds.add(id);
    ledgerRows += 1;
    const entityKey = typeof row.entity === 'string' ? row.entity : null;
    const place = entityKey === null ? undefined : places.get(entityKey);
    const line = typeof row.line === 'string' ? row.line : null;
    const outsideRow = ledgerRow(
      place ?? null,
      line,
      workbookText(row.label),
      { ...row, ...(byId.get(id) ?? {}) },
      0,
      links,
      place?.name ?? 'Not yet assigned',
      NOT_IN_YEAR,
    );
    const amountAt = LINES_COLUMNS.indexOf('Amount');
    rows.push({
      ...outsideRow,
      cells: outsideRow.cells.map((cell, at) => (at === amountAt ? settledAmountCell(row) : cell)),
    });
  }
  // A line the run's rates cannot price (decision record 0159): carried with its amount as
  // printed, on the place and line it will take, and counted by no total. The line is in the
  // year, so its In year cell says Yes and its amount rides a text cell, which a SUMIFS sum
  // range skips. UNVERIFIED: the skip is Excel's own sum-range behavior, not checked against
  // Excel here; the evaluator test pins the checks sheet re-adding to zero.
  for (const raw of asArray(books.unpriced)) {
    const row = asObject(raw);
    const id = text(row.id);
    shownIds.add(id);
    ledgerRows += 1;
    const entityKey = typeof row.entity === 'string' ? row.entity : null;
    const place = entityKey === null ? undefined : places.get(entityKey);
    const line = typeof row.line === 'string' ? row.line : null;
    const unpricedRow = ledgerRow(
      place ?? null,
      line,
      workbookText(row.label),
      { ...row, ...(byId.get(id) ?? {}) },
      0,
      links,
      place?.name ?? 'Not yet assigned',
      IN_YEAR,
    );
    const amountAt = LINES_COLUMNS.indexOf('Amount');
    rows.push({
      ...unpricedRow,
      cells: unpricedRow.cells.map((cell, at) => (at === amountAt ? settledAmountCell(row) : cell)),
    });
  }
  // A ledger line no slot carries, should the books place one nowhere: listed, its line blank,
  // counted by the ledger check and by no total.
  for (const [id, item] of byId) {
    if (shownIds.has(id)) continue;
    const entityKey = typeof item.entity === 'string' ? item.entity : null;
    const place = entityKey === null ? undefined : places.get(entityKey);
    const read = readingTotalCents(text(item.amount));
    ledgerRows += 1;
    rows.push({
      cells: [
        null,
        fixed(place?.name ?? 'Not yet assigned'),
        textCell(item.schedule),
        null,
        fixed('not on a schedule line in the books'),
        textCell(item.date),
        nameCell(item.vendor),
        textCell(item.description),
        read === null ? null : textCell(`${text(item.amount)} ${text(item.currency)}`),
        textCell(item.status),
        textCell(item.kind),
        fixed(LEDGER_LINE_ENTRY),
        textCell(item.trip),
        sourceCell(id, item.source_file, links),
        fixed(id),
        fixed(inYearWord(item, books.tax_year)),
      ],
    });
  }
  return {
    sheet: {
      name: 'Lines',
      widths: [9, 28, 9, 6, 34, 11, 28, 40, 14, 12, 10, 22, 14, 48, 10, 8],
      rows,
    },
    ledgerRows,
  };
}

// --- Schedules and Checks ------------------------------------------------------------------

interface Checked {
  readonly place: PlaceRef;
  readonly what: string;
  readonly cell: string;
  readonly cents: number;
  readonly count?: boolean;
}

function sumifs(place: PlaceRef, line: string): string {
  return `SUMIFS(${col('Amount')},${col('Place no.')},${exactCriterion(place.no)},${col('Line')},${exactCriterion(line)},${col('In year')},${exactCriterion(IN_YEAR)})`;
}

/** The comparisons a place's block shows: each a heading, a header row, its rows and its note. */
/** A vehicle row's Miles cell: the year's stated business miles the row carries, when it states
 *  any, ahead of the source words (`vehicleMilesWords`); the words alone otherwise. */
function vehicleMilesCell(vehicle: Json): string {
  const words = vehicleMilesWords(vehicle);
  const stated = typeof vehicle.business_miles === 'string' ? vehicle.business_miles : '';
  if (vehicle.miles_source !== 'stated' || !/^\d+(\.\d+)?$/.test(stated) || Number(stated) === 0) {
    return words;
  }
  const [whole = '', fraction] = stated.split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${fraction === undefined ? grouped : `${grouped}.${fraction}`} miles, ${words}`;
}

function comparisonBlocks(
  books: BooksResult,
  key: string,
  tripNames: WorkbookInputs['tripNames'],
): WorkbookRow[] {
  const rows: WorkbookRow[] = [];
  const mine = (field: string): Json[] =>
    asArray(books[field])
      .map(asObject)
      .filter((row) => text(row.entity) === key);
  const block = (
    heading: string,
    header: readonly string[],
    body: readonly (readonly WorkbookCell[])[],
    note: unknown,
  ): void => {
    if (body.length === 0) return;
    rows.push({ cells: [] }, { cells: [fixed(heading)], bold: true });
    rows.push({ cells: header.map(fixed), bold: true });
    for (const cells of body) rows.push({ cells });
    if (typeof note === 'string' && note !== '') rows.push({ cells: [textCell(note)] });
  };
  const depreciation = mine('depreciation');
  block(
    'Depreciation',
    ['Asset', 'This year', 'Prior accumulated', 'Accumulated', 'Remaining basis'],
    depreciation.map((d) =>
      d.computed === false
        ? [
            textCell(d.asset),
            fixed(
              d.personal_property === true
                ? 'not booked: personal property'
                : 'not computed: no rule for its class',
            ),
          ]
        : [
            textCell(d.asset),
            figure(d.amount_cents, d.amount),
            figure(d.prior_accumulated_cents, null),
            figure(d.accumulated_cents, null),
            figure(d.remaining_basis_cents, null),
          ],
    ),
    null,
  );
  // A trip on one calendar day has one reading and no choice (task 37.8, 0011's #1375 note), so
  // it is no comparison: its meals stay on the Lines sheet, and this block lists it nowhere.
  const trips = mine('trips').filter((trip) => trip.per_diem_applies !== false);
  const limit = text(trips[0]?.meal_limit_pct ?? '50');
  block(
    'Trip meals, both methods',
    ['Trip', 'Actual meals', `At ${limit}%`, 'M&IE per diem', `At ${limit}%`, 'Complete'],
    trips.map((trip) => [
      textCell(tripNames?.get(text(trip.trip)) ?? trip.trip),
      figure(trip.actual_meals_cents, trip.actual_meals),
      figure(trip.actual_meals_at_limit_cents, trip.actual_meals_at_limit),
      figure(trip.mie_per_diem_cents, trip.mie_per_diem),
      figure(trip.mie_per_diem_at_limit_cents, trip.mie_per_diem_at_limit),
      trip.per_diem_complete === true
        ? fixed('yes')
        : textCell(`missing ${asArray(trip.missing_rates).map(text).join(', ')}`),
    ]),
    trips[0]?.note,
  );
  // A car prints on the sheet of each place that uses it (decision record 0189).
  const vehicles = asArray(books.vehicles)
    .map(asObject)
    .filter((vehicle) => vehicleUseEntities(vehicle).includes(key));
  block(
    'Vehicles, both methods',
    ['Vehicle', 'Miles', 'Standard mileage', 'Actual cost', 'Band cover', 'Not available when'],
    vehicles.map((vehicle) => [
      textCell(vehicle.description ?? vehicle.vehicle),
      fixed(vehicleMilesCell(vehicle)),
      figure(vehicle.standard_mileage_cents, vehicle.standard_mileage),
      figure(vehicle.actual_cost_cents, vehicle.actual_cost),
      fixed(vehicle.standard_complete === true ? 'yes' : 'no'),
      textCell(asArray(vehicle.unavailable_reasons).map(text).join(', ') || '-'),
    ]),
    vehicles[0]?.note,
  );
  // The priced bands in a block of their own, so no column of the vehicles table counts a band
  // beside the figure it adds to.
  block(
    'Standard mileage by band',
    ['Vehicle', 'Period', 'Miles', 'Rate (cents)', 'Band amount'],
    vehicles.flatMap(vehicleBandRows),
    null,
  );
  const rentalUse = mine('rental_use');
  const flag = (value: unknown): WorkbookCell =>
    fixed(value === null || value === undefined ? '-' : value === true ? 'yes' : 'no');
  const days = (value: unknown): WorkbookCell =>
    typeof value === 'number' ? { t: 'count', v: value } : fixed('-');
  block(
    'Short-term rental days',
    [
      'Rental days',
      'Personal days',
      'Stays',
      'Under 15 rental days',
      'Over 14 personal days',
      'Over 10% of rental days',
      'Residence test',
      'Average stay at most 7',
      'Average stay at most 30',
      'Operating by days',
      'Interest and taxes by days',
      'Interest and taxes by year',
      'Services note',
    ],
    rentalUse.map((row) => [
      days(row.fair_rental_days),
      days(row.personal_use_days),
      days(row.stay_count),
      flag(row.rental_under_15),
      flag(row.personal_over_14),
      flag(row.personal_over_10_pct),
      flag(row.residence_test),
      flag(row.average_at_most_7),
      flag(row.average_at_most_30),
      figure(row.operating_allocated_cents, row.operating_allocated, '-'),
      figure(row.interest_taxes_days_cents, row.interest_taxes_days, '-'),
      figure(row.interest_taxes_year_cents, row.interest_taxes_year, '-'),
      textCell(row.services_note),
    ]),
    rentalUse[0]?.note,
  );
  const homeOffice = mine('home_office');
  block(
    'Business use of home, both methods',
    ['Office sq ft', 'Home sq ft', 'Simplified', 'Regular'],
    homeOffice.map((row) => [
      textCell(row.office_sq_ft),
      row.home_sq_ft === null ? fixed('-') : textCell(row.home_sq_ft),
      figure(row.simplified_cents, row.simplified),
      figure(row.regular_cents, row.regular),
    ]),
    homeOffice[0]?.note,
  );
  const improvement = mine('improvement_repair');
  block(
    'Improvement or repair, both readings',
    ['Line', 'Tag', 'Repair, this year', 'Capitalized, year one', 'Class'],
    improvement.map((row) => [
      textCell(row.ledger_id),
      textCell(row.tag),
      figure(row.repair_cents, row.repair),
      figure(row.capitalized_cents, row.capitalized),
      row.class === null || row.class === undefined
        ? fixed('not established')
        : textCell(`${text(row.class)} (${text(row.recovery_years)} years)`),
    ]),
    improvement[0]?.note,
  );
  const expensing = mine('expense_macrs');
  block(
    'Expensing or MACRS, both readings',
    [
      'Asset',
      'Placed in service',
      'Expensed, year one',
      'MACRS, year one',
      'Convention',
      'Limits passed',
    ],
    expensing.map((row) => [
      textCell(row.asset),
      textCell(row.placed_in_service),
      figure(row.expensed_cents, row.expensed),
      figure(row.macrs_cents, row.macrs),
      row.convention === null || row.convention === undefined
        ? fixed('-')
        : textCell(row.convention),
      textCell(asArray(row.over_limits).map(text).join(', ') || '-'),
    ]),
    expensing[0]?.note,
  );
  return rows;
}

export const DONATIONS_HEADING = 'Charitable contributions';
export const DONATIONS_NOTE = 'Listed for your accountant; not part of Schedule C or E books.';

/** A stored donation's amount in its own currency: money when USD, else the figure and its
 *  currency as text, never converted. */
function donationAmountCell(cents: number, currency: string): WorkbookCell {
  return currency === 'USD' ? money(cents) : textCell(`${fmtCents(BigInt(cents))} ${currency}`);
}

/** The contributions listing's rows: the stored rows when the inputs carry them (the SaaS
 *  hand-off, the Report's same listing), else the books' own `donations` (the personal tool).
 *  Each is listed only: no total, no formula, no Checks row. */
function donationRows(
  books: BooksResult,
  stored: WorkbookInputs['donations'],
  sourceLinks: ReadonlyMap<string, string>,
): WorkbookCell[][] {
  if (stored !== undefined) {
    return stored.map((entry) => [
      nameCell(entry.organization),
      textCell(entry.date),
      donationAmountCell(entry.amountCents, entry.currency),
      fixed(entry.form === 'non_cash' ? 'Non-cash' : 'Cash'),
      entry.goodsServicesCents === null
        ? fixed('-')
        : donationAmountCell(entry.goodsServicesCents, entry.currency),
      entry.document === null
        ? citedSourceCell(entry.source, sourceLinks)
        : copyLinkCell(entry.document),
    ]);
  }
  return asArray(books.donations)
    .map(asObject)
    .map((entry) => [
      nameCell(entry.organization),
      textCell(entry.date),
      textCell(`${text(entry.amount)} ${text(entry.currency)}`),
      textCell(entry.form),
      textCell(entry.goods_services_amount),
      entry.source_file === null || entry.source_file === undefined
        ? null
        : nameCell(entry.source_file),
    ]);
}

function schedulesSheet(
  books: BooksResult,
  places: readonly [string, PlaceRef][],
  endedOn: WorkbookInputs['endedOn'],
  tripNames: WorkbookInputs['tripNames'],
  donationInputs: WorkbookInputs['donations'],
  sourceLinks: ReadonlyMap<string, string>,
): { sheet: WorkbookSheet; checked: Checked[] } {
  const rows: WorkbookRow[] = [
    { cells: [textCell(books.label)], bold: true },
    {
      cells: [
        fixed(
          'Each total re-adds the Lines sheet with SUMIFS; the Checks sheet compares every one with the books.',
        ),
      ],
    },
  ];
  const checked: Checked[] = [];
  // The spreadsheet row the next pushed row lands on.
  const at = (): number => rows.length + 1;
  const entities = new Map(
    asArray(books.entities).map((raw) => [text(asObject(raw).key), asObject(raw)]),
  );
  for (const [key, place] of places) {
    const entity = entities.get(key) ?? {};
    rows.push(
      { cells: [] },
      {
        cells: [fixed(place.no), fixed(place.name), fixed(`Schedule ${place.schedule}`)],
        bold: true,
      },
    );
    const lines = Object.entries(asObject(entity.lines));
    const boxes = Object.entries(asObject(entity.k1_boxes));
    if (lines.length === 0 && boxes.length === 0) {
      rows.push({ cells: [fixed('Nothing booked to this place yet.')] });
    }
    if (lines.length > 0) {
      rows.push({ cells: ['Line', 'Label', 'Total', 'Income line'].map(fixed), bold: true });
      const incomeCells: string[] = [];
      const expenseCells: string[] = [];
      for (const [line, rawSlot] of lines) {
        const slot = asObject(rawSlot);
        const cents = slotCents(slot);
        const row = at();
        rows.push({
          cells: [
            fixed(line),
            textCell(slot.label),
            { t: 'formula', f: sumifs(place, line), money: true, result: cents / 100 },
            fixed(slot.income === true ? 'yes' : ''),
          ],
        });
        (slot.income === true ? incomeCells : expenseCells).push(`C${String(row)}`);
        checked.push({
          place,
          what: `Line ${line}, ${workbookText(slot.label)}`,
          cell: `Schedules!C${String(row)}`,
          cents,
        });
      }
      if (typeof entity.income_total_cents === 'number') {
        const totals: [string, string, number][] = [
          [
            'Income',
            incomeCells.length === 0 ? '0' : `SUM(${incomeCells.join(',')})`,
            entity.income_total_cents,
          ],
          [
            'Expenses',
            expenseCells.length === 0 ? '0' : `SUM(${expenseCells.join(',')})`,
            Number(entity.expense_total_cents),
          ],
        ];
        const first = at();
        for (const [what, formula, cents] of totals) {
          const row = at();
          rows.push({
            cells: [
              null,
              fixed(what),
              { t: 'formula', f: formula, money: true, result: cents / 100 },
            ],
            bold: true,
          });
          checked.push({ place, what, cell: `Schedules!C${String(row)}`, cents });
        }
        const net = at();
        const netCents = Number(entity.net_cents);
        rows.push({
          cells: [
            null,
            fixed('Net'),
            {
              t: 'formula',
              f: `C${String(first)}-C${String(first + 1)}`,
              money: true,
              result: netCents / 100,
            },
          ],
          bold: true,
        });
        checked.push({ place, what: 'Net', cell: `Schedules!C${String(net)}`, cents: netCents });
      }
    }
    if (boxes.length > 0) {
      rows.push({ cells: ['K-1 box', '', 'Total'].map(fixed), bold: true });
      for (const [box, rawSlot] of boxes) {
        const cents = slotCents(asObject(rawSlot));
        const row = at();
        rows.push({
          cells: [
            fixed(box),
            fixed(`Box ${box}`),
            { t: 'formula', f: sumifs(place, box), money: true, result: cents / 100 },
          ],
        });
        checked.push({ place, what: `K-1 box ${box}`, cell: `Schedules!C${String(row)}`, cents });
      }
    }
    rows.push(...comparisonBlocks(books, key, tripNames));
    const ended = endedOn?.get(key);
    if (ended !== undefined) {
      // One text row. It is not a total, so it is not pushed onto Checks.
      rows.push({ cells: [fixed(`Ended ${endedMonthWords(ended)}`)] });
    }
  }
  const unassigned = asArray(books.unassigned).map(asObject);
  if (unassigned.length > 0) {
    rows.push({ cells: [] }, { cells: [fixed('Not yet assigned')], bold: true });
    rows.push({ cells: ['Ledger id', 'Amount', 'Reason'].map(fixed), bold: true });
    for (const row of unassigned) {
      rows.push({
        cells: [
          textCell(row.id),
          figure(null, row.usd, '-'),
          fixed(row.reason === 'no entity' ? 'not yet assigned' : workbookText(row.reason)),
        ],
      });
    }
  }
  const settledLines = asArray(books.settled).map(asObject);
  if (settledLines.length > 0) {
    rows.push({ cells: [] }, { cells: [fixed(SETTLED_WORDS)], bold: true });
    rows.push({ cells: ['Ledger id', 'Amount', 'Reason'].map(fixed), bold: true });
    for (const row of settledLines) {
      rows.push({ cells: [textCell(row.id), settledAmountCell(row), fixed(SETTLED_REASON)] });
    }
  }
  const donations = donationRows(books, donationInputs, sourceLinks);
  if (donations.length > 0) {
    rows.push(
      { cells: [] },
      { cells: [fixed(DONATIONS_HEADING)], bold: true },
      { cells: [fixed(DONATIONS_NOTE)] },
      {
        cells: ['Organization', 'Date', 'Amount', 'Form', 'Goods or services', 'Receipt'].map(
          fixed,
        ),
        bold: true,
      },
    );
    for (const cells of donations) rows.push({ cells });
  }
  return {
    sheet: {
      name: 'Schedules',
      widths: [10, 44, 16, 14, 16, 16, 16, 16, 16, 16, 16, 16, 30],
      rows,
    },
    checked,
  };
}

function checksSheet(
  books: BooksResult,
  checked: readonly Checked[],
  ledgerRows: number,
): WorkbookSheet {
  const rows: WorkbookRow[] = [
    {
      cells: [
        fixed(
          'Every difference is 0.00 when the workbook re-adds the Lines sheet to the books. The books figure is written as a constant; the formulas only re-add it.',
        ),
      ],
    },
    {
      cells: ['Place no.', 'Place', 'Total', 'Workbook', 'Books', 'Difference'].map(fixed),
      bold: true,
    },
  ];
  for (const check of checked) {
    rows.push({
      cells: [
        fixed(check.place.no),
        fixed(check.place.name),
        fixed(check.what),
        { t: 'formula', f: check.cell, money: true, result: check.cents / 100 },
        money(check.cents),
        {
          t: 'formula',
          f: `ROUND(${check.cell}-${dollarsConstant(check.cents)},2)`,
          money: true,
          result: 0,
        },
      ],
    });
  }
  const ledgerItems = Number(asObject(books.checks).ledger_items ?? ledgerRows);
  const count = `COUNTIFS(${col('Entry')},${exactCriterion(LEDGER_LINE_ENTRY)})`;
  rows.push({
    cells: [
      null,
      fixed('All places'),
      fixed('Ledger lines'),
      { t: 'formula', f: count, money: false, result: ledgerItems },
      { t: 'count', v: ledgerItems },
      { t: 'formula', f: `${count}-${String(ledgerItems)}`, money: false, result: 0 },
    ],
  });
  return { name: 'Checks', widths: [9, 28, 40, 16, 16, 14], rows };
}

// --- Open items ----------------------------------------------------------------------------

/** A form's doc_type as its title: `form_1099_nec` reads `1099-NEC`, `schedule_k1` reads `K-1`. */
export function formTitle(docType: string): string {
  if (docType === 'schedule_k1') return 'K-1';
  const match = /^form_1099_([a-z]+)$/.exec(docType);
  if (match === null) return '1099';
  return match[1] === 'other' ? '1099' : `1099-${(match[1] ?? '').toUpperCase()}`;
}

// The longest criterion Excel's SUMIFS takes. UNVERIFIED: the 255-character limit is Excel's
// documented one, not checked here; a payer past it is shown without the comparison.
const CRITERION_LIMIT = 255;

/** The Open items block of what is dated outside the tax year (decision record 0148). */
export const OUTSIDE_YEAR_HEADING = 'Outside the tax year';
export const OUTSIDE_YEAR_NOTE =
  'Dated outside the tax year: listed for your accountant, with its amount as printed, and counted in no total.';

/** The Open items block of the lines the run's rates cannot price (decision record 0159): the
 *  books list them only when one is unpriced, so the block prints beside the outside-year block
 *  when they do and never otherwise. */
export const NO_RATE_HEADING = 'No exchange rate on record';
export const NO_RATE_NOTE =
  'The rules data had no exchange rate for that currency on that date: listed with its amount as printed, and counted in no total.';

/** The Open items block of the person's own questions (issue #1382), the report group's title. */
export const PERSON_QUESTIONS_HEADING = 'Questions you asked';

/** A treatment-choice item as the block shows it, worded as the report words it: a tie item's
 *  sentence over the advice body, else the advice title over the same body. The tie sentence is
 *  code copy over the ledger's date and cents and a vendor through the display gate, so it passes
 *  the name gate, not the policy scan a vendor sits outside. */
function adviceItemWords(item: WorkbookAdviceItem): {
  readonly item: string;
  readonly detail: string;
} {
  const tie = item.kind === 'tie' ? categoryTieSentence(item.line, item.tie) : null;
  return {
    item: tie === null ? ADVICE_ITEM_TITLE : workbookName(tie),
    detail: ADVICE_ITEM_BODY,
  };
}

/** One books outside_year row as the block shows it: its date, what it is, its document, and its
 *  amount and currency as recorded. */
interface OutsideYearEntry {
  readonly date: string;
  /** The gated vendor of a line; a payment's parcels or a cost's kind, in code words. */
  readonly subject: string;
  /** The gated document: a line's organized copy or source, a payment's or a cost's source. */
  readonly document: string | null;
  /** The document's cell: a line's hyperlinked copy, as the Lines sheet shows it, else its name. */
  readonly documentCell: WorkbookCell;
  readonly row: Json;
}

/**
 * The books' outside_year rows, by kind: a line read with its ledger line's own descriptive fields
 * where the ledger carries them (the product's gated vendor and source), a staged property-tax
 * payment as its parcels and payment document, a home cost as its kind and source. The amount is
 * always the books row's own.
 */
function outsideYearEntries(inputs: WorkbookInputs): OutsideYearEntry[] {
  const byId = ledgerById(inputs.ledger);
  const links = inputs.documentLinks ?? new Map<string, string>();
  const sourceLinks = inputs.sourceLinks ?? new Map<string, string>();
  const named = (value: unknown): string | null =>
    value === null || value === undefined ? null : workbookName(value);
  const cited = (source: unknown): string | null =>
    named(sourceLinkOf(source, sourceLinks) ?? source);
  return asArray(inputs.books.outside_year).map((raw) => {
    const row = asObject(raw);
    if (row.kind === 'tax_payment') {
      return {
        date: workbookText(row.date),
        subject: `Property tax, parcel ${workbookText(asArray(row.parcels).map(text).join(', '))}`,
        document: cited(row.payment_source),
        documentCell: citedSourceCell(row.payment_source, sourceLinks),
        row,
      };
    }
    if (row.kind === 'home_cost') {
      return {
        date: workbookText(row.date),
        // The closed kind as words: `real_estate_taxes` reads "real estate taxes".
        subject: `Home cost, ${workbookText(row.cost_kind).replaceAll('_', ' ')}`,
        document: cited(row.source_file),
        documentCell: citedSourceCell(row.source_file, sourceLinks),
        row,
      };
    }
    const id = text(row.id);
    const item = byId.get(id) ?? {};
    const vendor = typeof item.vendor === 'string' ? item.vendor : row.vendor;
    const source = typeof item.source_file === 'string' ? item.source_file : row.source_file;
    return {
      date: workbookText(row.date),
      subject: named(vendor) ?? 'no vendor recorded',
      document: named(links.get(id) ?? source),
      documentCell: sourceCell(id, source, links),
      row,
    };
  });
}

/**
 * The books' unpriced rows (decision record 0159) as the block shows them: a line read with its
 * ledger line's own descriptive fields where the ledger carries them (the product's gated vendor
 * and source), its amount always the books row's own.
 */
function unpricedEntries(inputs: WorkbookInputs): OutsideYearEntry[] {
  const byId = ledgerById(inputs.ledger);
  const links = inputs.documentLinks ?? new Map<string, string>();
  const named = (value: unknown): string | null =>
    value === null || value === undefined ? null : workbookName(value);
  return asArray(inputs.books.unpriced).map((raw) => {
    const row = asObject(raw);
    const id = text(row.id);
    const item = byId.get(id) ?? {};
    const vendor = typeof item.vendor === 'string' ? item.vendor : row.vendor;
    const source = typeof item.source_file === 'string' ? item.source_file : row.source_file;
    return {
      date: workbookText(row.date),
      subject: named(vendor) ?? 'no vendor recorded',
      document: named(links.get(id) ?? source),
      documentCell: sourceCell(id, source, links),
      row,
    };
  });
}

/**
 * What a payer's income SUMIFS evaluates to over the Lines rows written: the money cells whose
 * Vendor equals the payer (case-insensitively, as an `=` criterion compares), whose Kind is income
 * and whose In year is Yes, in cents, with how many lines that is. The cell's cached result, so a reader that does not
 * recalculate shows the figure the formula yields; it re-adds Abacus's own entries and is never
 * booked. UNVERIFIED: that this equals Excel's own SUMIFS for every payer (Excel's case folding
 * outside ASCII, a payer Excel reads as a number); the spec pins it against the spec's evaluator,
 * and a recalculating application replaces it on open (`fullCalcOnLoad`).
 */
function payerIncome(
  linesRows: readonly WorkbookRow[],
  payer: string,
): { cents: number; lines: number } {
  const at = (name: (typeof LINES_COLUMNS)[number]): number => LINES_COLUMNS.indexOf(name);
  const word = (cell: WorkbookCell | undefined): string =>
    cell !== null && cell !== undefined && cell.t === 'text' ? cell.v.toLowerCase() : '';
  let cents = 0;
  let lines = 0;
  for (const row of linesRows.slice(1)) {
    const amount = row.cells[at('Amount')];
    if (amount === null || amount === undefined || amount.t !== 'money') continue;
    if (word(row.cells[at('Vendor')]) !== payer.toLowerCase()) continue;
    if (word(row.cells[at('Kind')]) !== 'income') continue;
    if (word(row.cells[at('In year')]) !== IN_YEAR.toLowerCase()) continue;
    cents += amount.cents;
    lines += 1;
  }
  return { cents, lines };
}

function openItemsSheet(inputs: WorkbookInputs, linesRows: readonly WorkbookRow[]): WorkbookSheet {
  const rows: WorkbookRow[] = [];
  const questions = inputs.questions ?? [];
  rows.push({ cells: [fixed('Questions still open')], bold: true });
  if (questions.length === 0) rows.push({ cells: [fixed('None.')] });
  else rows.push({ cells: ['No.', 'Question', 'Options'].map(fixed), bold: true });
  questions.forEach((question, index) => {
    rows.push({
      cells: [
        { t: 'count', v: index + 1 },
        textCell(question.prompt),
        fixed(question.options.map((option) => workbookText(option)).join('; ')),
      ],
    });
  });
  if (inputs.placed !== undefined) {
    rows.push({ cells: [] }, { cells: [fixed(PLACED_GROUP_TITLE)], bold: true });
    if (inputs.placed.length === 0) rows.push({ cells: [fixed('None.')] });
    else rows.push({ cells: ['No.', 'Question', 'Place'].map(fixed), bold: true });
    inputs.placed.forEach((placement, index) => {
      rows.push({
        cells: [
          { t: 'count', v: index + 1 },
          textCell(placement.prompt),
          fixed(placedLine(placement.place === null ? null : workbookName(placement.place))),
        ],
      });
    });
  }
  const findings = inputs.findings ?? [];
  rows.push({ cells: [] }, { cells: [fixed('For your accountant')], bold: true });
  if (findings.length === 0) rows.push({ cells: [fixed('None.')] });
  else rows.push({ cells: ['No.', 'Item', 'Detail', 'About'].map(fixed), bold: true });
  findings.forEach((finding, index) => {
    rows.push({
      cells: [
        { t: 'count', v: index + 1 },
        textCell(finding.title),
        textCell(finding.message),
        fixed(findingAbout(finding)),
      ],
    });
  });
  // The treatment choices left to the accountant (issue #1652), the report's ADVICE group, worded
  // by code; absent, no block, the placements' own rule.
  if (inputs.adviceItems !== undefined) {
    const adviceItems = inputs.adviceItems;
    rows.push({ cells: [] }, { cells: [fixed(ADVICE_GROUP_TITLE)], bold: true });
    if (adviceItems.length === 0) rows.push({ cells: [fixed('None.')] });
    else rows.push({ cells: ['No.', 'Item', 'Detail'].map(fixed), bold: true });
    adviceItems.forEach((advice, index) => {
      const words = adviceItemWords(advice);
      rows.push({
        cells: [{ t: 'count', v: index + 1 }, fixed(words.item), fixed(words.detail)],
      });
    });
  }
  // The person's own questions (issue #1382), each under its place: the words as the person wrote
  // them, through the same gate every string in the sheet takes. Absent, the block is not printed
  // (the personal tool stages none), the placements' own rule.
  if (inputs.personItems !== undefined) {
    const personItems = inputs.personItems;
    rows.push({ cells: [] }, { cells: [fixed(PERSON_QUESTIONS_HEADING)], bold: true });
    if (personItems.length === 0) rows.push({ cells: [fixed('None.')] });
    else rows.push({ cells: ['No.', 'Question', 'About'].map(fixed), bold: true });
    personItems.forEach((item, index) => {
      rows.push({
        cells: [
          { t: 'count', v: index + 1 },
          paragraphCell(item.message),
          nameCell(item.placeName),
        ],
      });
    });
  }
  if (inputs.rentalsWithoutCostDocuments !== undefined) {
    rows.push({ cells: [] }, { cells: [fixed(NO_EXPENSE_DOCUMENTS_TITLE)], bold: true });
    if (inputs.rentalsWithoutCostDocuments.length === 0) rows.push({ cells: [fixed('None.')] });
    else rows.push({ cells: ['No.', 'Item'].map(fixed), bold: true });
    inputs.rentalsWithoutCostDocuments.forEach((place, index) => {
      rows.push({
        cells: [
          { t: 'count', v: index + 1 },
          nameCell(noExpenseDocumentsSentence(workbookName(place))),
        ],
      });
    });
  }
  const outside = outsideYearEntries(inputs);
  rows.push({ cells: [] }, { cells: [fixed(OUTSIDE_YEAR_HEADING)], bold: true });
  if (outside.length === 0) {
    rows.push({ cells: [fixed('None.')] });
  } else {
    rows.push({ cells: [fixed(OUTSIDE_YEAR_NOTE)] });
    rows.push({ cells: ['Date', 'Item', 'Document', 'Amount'].map(fixed), bold: true });
  }
  for (const entry of outside) {
    rows.push({
      cells: [
        fixed(entry.date),
        fixed(entry.subject),
        entry.documentCell,
        settledAmountCell(entry.row),
      ],
    });
  }
  const unpriced = unpricedEntries(inputs);
  if (unpriced.length > 0) {
    rows.push({ cells: [] }, { cells: [fixed(NO_RATE_HEADING)], bold: true });
    rows.push({ cells: [fixed(NO_RATE_NOTE)] });
    rows.push({ cells: ['Date', 'Item', 'Document', 'Amount'].map(fixed), bold: true });
    for (const entry of unpriced) {
      rows.push({
        cells: [
          fixed(entry.date),
          fixed(entry.subject),
          entry.documentCell,
          settledAmountCell(entry.row),
        ],
      });
    }
  }
  const allForms = inputs.forms ?? [];
  const forms = allForms.filter((form) => form.form !== 'schedule_k1');
  const k1s = allForms.filter((form) => form.form === 'schedule_k1');
  rows.push({ cells: [] }, { cells: [fixed('Forms received')], bold: true });
  if (allForms.length === 0) {
    rows.push({ cells: [fixed('None.')] });
  } else if (forms.length > 0) {
    rows.push({
      cells: [
        fixed(
          'The amount on the form is as read from the document; the income booked to the payer re-adds the Lines sheet; the difference compares them and is never booked.',
        ),
      ],
    });
    rows.push({
      cells: [
        'Form',
        'Payer',
        'Document',
        'On the form',
        'Income booked to the payer',
        'Difference',
        'Note',
      ].map(fixed),
      bold: true,
    });
  }
  const payerGroups = new Map<string, WorkbookForm[]>();
  for (const form of forms) {
    const payer = form.payer === null ? '' : workbookName(form.payer);
    const key = payer === '' ? `\u0000${String(payerGroups.size)}` : payer.toLowerCase();
    payerGroups.set(key, [...(payerGroups.get(key) ?? []), form]);
  }
  for (const group of payerGroups.values()) {
    const first = group[0];
    if (first === undefined) continue;
    const payer = first.payer === null ? '' : workbookName(first.payer);
    const criterion = exactCriterion(payer);
    const comparable =
      payer !== '' && payer !== WORKBOOK_WITHHELD && criterion.length - 2 <= CRITERION_LIMIT;
    const booked = `SUMIFS(${col('Amount')},${col('Vendor')},${criterion},${col('Kind')},${exactCriterion('income')},${col('In year')},${exactCriterion(IN_YEAR)})`;
    const income = comparable ? payerIncome(linesRows, payer) : { cents: 0, lines: 0 };
    const noIncomeNote =
      comparable && income.lines === 0
        ? 'No income under this payer name is booked to a schedule; the names may not match, or its lines may not be placed yet.'
        : null;
    const several = group.length > 1;
    const firstRow = rows.length + 1;
    for (const form of group) {
      const row = rows.length + 1;
      rows.push({
        cells: [
          fixed(formTitle(form.form)),
          form.payer === null ? fixed('payer not read') : fixed(workbookName(form.payer)),
          form.document === null ? null : nameCell(form.document),
          form.amountCents === null ? fixed('not read') : money(form.amountCents),
          several || !comparable
            ? fixed('-')
            : { t: 'formula', f: booked, money: true, result: income.cents / 100 },
          !several && comparable && form.amountCents !== null
            ? {
                t: 'formula',
                f: `D${String(row)}-E${String(row)}`,
                money: true,
                result: (form.amountCents - income.cents) / 100,
              }
            : fixed('-'),
          several && comparable
            ? fixed(`${String(group.length)} forms from this payer; compared together below.`)
            : noIncomeNote === null
              ? null
              : fixed(noIncomeNote),
        ],
      });
    }
    if (!several || !comparable) continue;
    const row = rows.length + 1;
    const formsCents = group.reduce((sum, form) => sum + (form.amountCents ?? 0), 0);
    const unread = group.some((form) => form.amountCents === null);
    rows.push({
      cells: [
        fixed(`All ${String(group.length)} forms`),
        fixed(payer),
        null,
        {
          t: 'formula',
          f: `SUM(${group.map((_, index) => `D${String(firstRow + index)}`).join(',')})`,
          money: true,
          result: formsCents / 100,
        },
        { t: 'formula', f: booked, money: true, result: income.cents / 100 },
        !unread
          ? {
              t: 'formula',
              f: `D${String(row)}-E${String(row)}`,
              money: true,
              result: (formsCents - income.cents) / 100,
            }
          : fixed('-'),
        unread
          ? fixed('A form here was not read, so the total is not compared.')
          : noIncomeNote === null
            ? null
            : fixed(noIncomeNote),
      ],
      bold: true,
    });
  }
  if (k1s.length > 0) {
    if (forms.length > 0) rows.push({ cells: [] });
    rows.push({
      cells: [
        fixed(
          'Each K-1 is listed as transcribed from the form, for your accountant; nothing is booked from it.',
        ),
      ],
    });
    rows.push({
      cells: ['Form', 'Payer', 'Document', 'Tax year', 'Box', 'On the form'].map(fixed),
      bold: true,
    });
  }
  for (const k1 of k1s) {
    const lead = [
      fixed(formTitle(k1.form)),
      k1.payer === null ? fixed('payer not read') : nameCell(k1.payer),
      k1.document === null ? null : nameCell(k1.document),
      fixed(k1.taxYear ?? 'not read'),
    ];
    const boxes = k1.boxes ?? [];
    if (boxes.length === 0) rows.push({ cells: [...lead, fixed('-'), fixed('not read')] });
    for (const box of boxes) {
      rows.push({
        cells: [
          ...lead,
          textCell(box.box),
          box.cents === null ? fixed('not read') : money(box.cents),
        ],
      });
    }
  }
  return { name: 'Open items', widths: [10, 36, 60, 30, 22, 16, 60], rows };
}

// --- The workbook --------------------------------------------------------------------------

/** Each profile place as the workbook names it: its number (`P1`, in the books' order), its
 *  gated name and its schedule. */
function placesOf(books: BooksResult): [string, PlaceRef][] {
  return asArray(books.entities).map((raw, index): [string, PlaceRef] => {
    const entity = asObject(raw);
    return [
      text(entity.key),
      {
        no: `P${String(index + 1)}`,
        name: workbookName(entity.name),
        schedule: workbookText(entity.schedule),
      },
    ];
  });
}

/** The workbook as sheets of cells: pure, so a test reads exactly what is written. */
export function workbookModel(inputs: WorkbookInputs): WorkbookSheet[] {
  const placeList = placesOf(inputs.books);
  const places = new Map(placeList);
  const lines = linesSheet(inputs, places);
  const schedules = schedulesSheet(
    inputs.books,
    placeList,
    inputs.endedOn,
    inputs.tripNames,
    inputs.donations,
    inputs.sourceLinks ?? new Map<string, string>(),
  );
  return [
    lines.sheet,
    schedules.sheet,
    checksSheet(inputs.books, schedules.checked, lines.ledgerRows),
    openItemsSheet(inputs, lines.sheet.rows),
  ];
}

const MONEY_FORMAT = '#,##0.00;-#,##0.00';

function cellValue(cell: WorkbookCell): CellValue {
  if (cell === null) return null;
  switch (cell.t) {
    case 'text':
      return cell.v;
    case 'money':
      return cell.cents / 100;
    case 'count':
      return cell.v;
    case 'formula':
      return cell.result === null ? { formula: cell.f } : { formula: cell.f, result: cell.result };
    case 'link':
      return { text: cell.text, hyperlink: cell.target };
  }
}

function writeSheet(worksheet: Worksheet, sheet: WorkbookSheet): void {
  sheet.widths.forEach((width, index) => {
    worksheet.getColumn(index + 1).width = width;
  });
  sheet.rows.forEach((row, rowIndex) => {
    const target = worksheet.getRow(rowIndex + 1);
    row.cells.forEach((cell, cellIndex) => {
      if (cell === null) return;
      const written = target.getCell(cellIndex + 1);
      written.value = cellValue(cell);
      if (cell.t === 'text' && cell.wrap === true) written.alignment = { wrapText: true };
      if (cell.t === 'money' || (cell.t === 'formula' && cell.money)) {
        written.numFmt = MONEY_FORMAT;
      }
    });
    if (row.bold === true) target.font = { bold: true };
  });
}

/** books.xlsx's bytes: the four sheets, recalculated by the spreadsheet when it opens. */
export async function renderWorkbook(inputs: WorkbookInputs): Promise<Buffer> {
  const workbook = new Workbook();
  workbook.creator = 'Bookette';
  // Every formula is evaluated afresh on open, so what the accountant reads is the spreadsheet's
  // own re-addition, never only the cached figure written here. UNVERIFIED: that Excel and
  // LibreOffice recalculate on open under fullCalcOnLoad, and that they evaluate these formulas
  // as the spec's evaluator does; no spreadsheet application ran them (this machine's LibreOffice
  // has no Calc component).
  workbook.calcProperties.fullCalcOnLoad = true;
  for (const sheet of workbookModel(inputs)) {
    writeSheet(workbook.addWorksheet(sheet.name), sheet);
  }
  const bytes = await workbook.xlsx.writeBuffer();
  return Buffer.from(bytes);
}

/** open-items.md: the Open items sheet's questions, findings, treatment choices, the person's own
 *  questions, lines dated outside the tax year and 1099s as text, with the same gate; the form's amount as read, and the comparison left to
 *  the workbook's formula. */
export function renderOpenItems(inputs: WorkbookInputs): string {
  const lines: string[] = [
    '# Open items for your accountant',
    '',
    `_${workbookText(inputs.books.label)}_`,
    '',
    '## Questions still open',
    '',
  ];
  const questions = inputs.questions ?? [];
  if (questions.length === 0) lines.push('None.');
  questions.forEach((question, index) => {
    lines.push(`${String(index + 1)}. ${workbookText(question.prompt)}`);
    for (const option of question.options) lines.push(`   - ${workbookText(option)}`);
  });
  if (inputs.placed !== undefined) {
    lines.push('', `## ${PLACED_GROUP_TITLE}`, '');
    if (inputs.placed.length === 0) lines.push('None.');
    inputs.placed.forEach((placement, index) => {
      const place = placedLine(placement.place === null ? null : workbookName(placement.place));
      lines.push(`${String(index + 1)}. ${workbookText(placement.prompt)}`, `   - ${place}`);
    });
  }
  lines.push('', '## For your accountant', '');
  const findings = inputs.findings ?? [];
  if (findings.length === 0) lines.push('None.');
  for (const finding of findings) {
    const cited = findingAbout(finding);
    const about = cited === '' ? '' : ` (${cited})`;
    lines.push(`- ${workbookText(finding.title)}: ${workbookText(finding.message)}${about}`);
  }
  // The treatment choices left to the accountant (issue #1652), worded as the sheet words them.
  if (inputs.adviceItems !== undefined) {
    lines.push('', `## ${ADVICE_GROUP_TITLE}`, '');
    if (inputs.adviceItems.length === 0) lines.push('None.');
    for (const advice of inputs.adviceItems) {
      const words = adviceItemWords(advice);
      lines.push(`- ${words.item}: ${words.detail}`);
    }
  }
  // The person's own questions (issue #1382), each under its place, through the same gate;
  // absent, no section, the placements' own rule.
  const personItems = inputs.personItems;
  if (personItems !== undefined) {
    lines.push('', `## ${PERSON_QUESTIONS_HEADING}`, '');
    if (personItems.length === 0) lines.push('None.');
    for (const item of personItems) {
      // The place leads, so no line of the person's words is the one it hangs on.
      const [first = '', ...later] = workbookParagraph(item.message).split('\n');
      lines.push(
        `- About ${markdownText(workbookName(item.placeName))}: ${markdownText(first)}`,
        ...later.map(markdownContinuation),
      );
    }
  }
  if (inputs.rentalsWithoutCostDocuments !== undefined) {
    lines.push('', `## ${NO_EXPENSE_DOCUMENTS_TITLE}`, '');
    if (inputs.rentalsWithoutCostDocuments.length === 0) lines.push('None.');
    for (const place of inputs.rentalsWithoutCostDocuments) {
      lines.push(`- ${workbookName(noExpenseDocumentsSentence(workbookName(place)))}`);
    }
  }
  lines.push('', `## ${OUTSIDE_YEAR_HEADING}`, '');
  const outside = outsideYearEntries(inputs);
  if (outside.length === 0) lines.push('None.');
  else lines.push(OUTSIDE_YEAR_NOTE, '');
  for (const entry of outside) {
    const document = entry.document === null ? '' : `, ${entry.document}`;
    lines.push(
      `- ${entry.date}, ${entry.subject}${document}: ${workbookText(entry.row.amount)} ${workbookText(entry.row.currency)}`,
    );
  }
  // The unpriced lines (decision record 0159), beside the outside-year block: the books list
  // them only when one is unpriced, so the section prints then and never otherwise.
  const unpriced = unpricedEntries(inputs);
  if (unpriced.length > 0) {
    lines.push('', `## ${NO_RATE_HEADING}`, '', NO_RATE_NOTE, '');
    for (const entry of unpriced) {
      const document = entry.document === null ? '' : `, ${entry.document}`;
      lines.push(
        `- ${entry.date}, ${entry.subject}${document}: ${workbookText(entry.row.amount)} ${workbookText(entry.row.currency)}`,
      );
    }
  }
  lines.push('', '## Forms received', '');
  const allForms = inputs.forms ?? [];
  const forms = allForms.filter((form) => form.form !== 'schedule_k1');
  if (allForms.length === 0) lines.push('None.');
  for (const form of forms) {
    const amount = form.amountCents === null ? 'not read' : fmtCents(BigInt(form.amountCents));
    const payer = form.payer === null ? 'payer not read' : workbookName(form.payer);
    const document = form.document === null ? '' : `, ${workbookName(form.document)}`;
    lines.push(`- ${formTitle(form.form)} from ${payer}${document}: ${amount} on the form`);
  }
  if (forms.length > 0) {
    lines.push(
      '',
      "books.xlsx's Open items sheet sets each form beside the income booked to its payer.",
    );
  }
  const k1s = allForms.filter((form) => form.form === 'schedule_k1');
  if (forms.length > 0 && k1s.length > 0) lines.push('');
  for (const k1 of k1s) {
    const payer = k1.payer === null ? 'payer not read' : workbookName(k1.payer);
    const document = k1.document === null ? '' : `, ${workbookName(k1.document)}`;
    const boxes = (k1.boxes ?? []).map(
      (box) =>
        `box ${workbookText(box.box)} ${box.cents === null ? 'not read' : fmtCents(BigInt(box.cents))}`,
    );
    lines.push(
      `- ${formTitle(k1.form)} from ${payer}${document}, tax year ${k1.taxYear ?? 'not read'}: ${boxes.length === 0 ? 'no boxes read' : boxes.join('; ')}`,
    );
  }
  if (k1s.length > 0) {
    lines.push('', 'Each K-1 is listed as transcribed from the form; nothing is booked from it.');
  }
  return `${lines.join('\n')}\n`;
}

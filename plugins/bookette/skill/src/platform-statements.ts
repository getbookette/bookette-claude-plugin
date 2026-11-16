// The platform payout-statement figures (epic #1017, issue #1106): the one pure
// function that turns a matched statement grid into the books' figures — gross,
// net, and one sum per books kind — with every cell read through money.ts and
// no arithmetic of its own (decision records 0019 item 1 and 0033: code computes
// spreadsheet figures, never a model estimate). The agent runs it as
// `platform_statement.js` over one staged reading, and the output gate re-runs
// it in-process over the same grid, so a rules correction applies on the next
// computation with no cached total and the import check is the same re-run 0033
// requires. Its rules input is the rules data of rules/tyNNNN/platform_statements/
// (issue #1108), whose closed vocabularies are shared from the checker's own
// module — never a second list.
//
// Nothing here writes, prints or throws into a caller's face: the figure
// function answers a typed result, and the one caller that must never fail (the
// read job's pre-reserve match) gets a total function whose every failure is a
// null. Rejection messages name the rules data and cell addresses — a missing
// column by its rules name, an unexpected column by count, a cell by row and
// column name — never a grid value, a guest name or an amount (invariant 6).
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { fmtCents, parseDec, toCents } from './money';
import { rulesDirOfYear } from './rules-year';
import {
  CARRIED_KINDS,
  CONFIDENCES,
  KINDS,
  NET_CELLS_ROW_CLASSES,
  RECONCILE_EQUALS,
  RECONCILE_REASONS,
  RECONCILE_TERM_SIGNS,
  ROW_CLASSES,
} from './scripts/check_platform_statements';

/** One declared statement column: the facts the figure function reads. */
export type StatementColumn = {
  readonly name: string;
  readonly kind: string;
  readonly confidence: string;
};

/** A gross or net reference: the columns it sums, scoped to row classes when named. A gross
 *  block's `carries` names the columns whose money its cells already hold on its rows (issues
 *  #1150, #1151): Airbnb's Host Fee, summed into the gross, and the cleaning fee inside Amount;
 *  Uber's fees, taxes, tolls and tip inside the fare. Empty when it names none, and on a net. */
export type StatementReference = {
  readonly columns: readonly string[];
  readonly rows: readonly string[] | null;
  readonly carries: readonly string[];
};

/** The rows grammar: the discriminator column and its value-to-class map. */
export type StatementRows = {
  readonly column: string;
  readonly classes: Readonly<Record<string, string>>;
};

/** Why a document's identity is not closed (issue #1107): no component columns compose the
 *  net, the statement states its net outright, or the document declares no net at all. */
export type StatementReconcileReason = 'no-component-identity' | 'stated-net' | 'no-net';

/** One term of a closed identity: a column's cells over the row classes it scopes to (all rows
 *  when it names none), negated when the sign is negative. */
export type StatementReconcileTerm = {
  readonly column: string;
  readonly rows: readonly string[] | null;
  readonly sign: 'positive' | 'negative';
};

/** The document's declared identity (#1107): closed, its terms must sum to the net block's own
 *  cents (`equals: "net"`) or to zero (`equals: "zero"`); unclosed, the reason the Report reads. */
export type StatementReconcile =
  | {
      readonly closed: true;
      readonly equals: 'net' | 'zero';
      readonly terms: readonly StatementReconcileTerm[];
    }
  | { readonly closed: false; readonly reason: StatementReconcileReason };

/** One declared anchor (#1107): a summary document whose gross should equal the history
 *  document's gross plus the deposit money its claim rows carry. */
export type StatementAnchor = {
  readonly name: string;
  readonly summary: string;
  readonly history: string;
  readonly claimRow: string;
};

/** One declared document of a platform statements file, as the function reads it. */
export type StatementDocument = {
  readonly name: string;
  readonly columns: readonly StatementColumn[];
  readonly gross: StatementReference | null;
  readonly net: StatementReference | null;
  readonly rows: StatementRows | null;
  readonly reconcile: StatementReconcile;
};

/** One platform file's loaded documents. Each file expands to one entry per declared document
 *  (the shape the match and figure callers read); the file-level `payers` and `anchors` ride on
 *  every entry, so a parsed file's pairs carry everything the pure checks need. */
export type StatementFile = {
  readonly platform: string;
  readonly payers: readonly string[];
  readonly document: StatementDocument;
  readonly anchors: readonly StatementAnchor[];
};

/** One stored statement grid: the header row first, cells exactly as parsed. */
export type StatementGrid = readonly (readonly string[])[];

/** The money kinds a kind figure sums; `metadata` columns are text and never sum. */
const SUMMED_KINDS: readonly string[] = KINDS.filter((kind) => kind !== 'metadata');

/** The kinds a kind figure prints beside gross and net. Gross-side money reports through the
 *  gross block and the row-class re-keys alone — a `gross-component` column outside the gross
 *  block (the payout summary's convenience revenue column beside its declared 1099-K columns)
 *  would print a second gross and book the same money twice, so its earning-row residues print
 *  no figure. `net` is emitted last, after the kinds. */
const PRINTED_KINDS: readonly string[] = SUMMED_KINDS.filter(
  (kind) => kind !== 'gross-component' && kind !== 'net',
);

type Json = Record<string, unknown>;

function isRecord(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringList(value: unknown): readonly string[] | null {
  if (!Array.isArray(value)) return null;
  return value.every((entry): entry is string => typeof entry === 'string') ? value : null;
}

function referenceOf(raw: unknown): StatementReference | null {
  if (raw === undefined) return null;
  if (!isRecord(raw)) throw new Error('a gross or net reference must be an object');
  const columns = stringList(raw['columns']);
  if (columns === null || columns.length === 0) {
    throw new Error('a gross or net reference must name columns');
  }
  const rows = raw['rows'] === undefined ? null : stringList(raw['rows']);
  if (raw['rows'] !== undefined && rows === null) {
    throw new Error('a gross or net rows scope must be a list of row classes');
  }
  const carries = raw['carries'] === undefined ? [] : stringList(raw['carries']);
  if (
    carries === null ||
    (raw['carries'] !== undefined && carries.length === 0) ||
    new Set(carries).size !== carries.length
  ) {
    throw new Error('a gross carries list must name its columns, each once');
  }
  return { columns, rows, carries };
}

/** Reads a document's reconcile block, failing closed on any shape the reconciliation cannot
 *  trust; the rules checker gates the same facts at build time. */
function reconcileOf(raw: unknown): StatementReconcile {
  if (raw === undefined) throw new Error('a statement document must carry a reconcile block');
  if (!isRecord(raw)) throw new Error('a reconcile block must be an object');
  if (raw['closed'] === true) {
    const equals = raw['equals'];
    if (typeof equals !== 'string' || !RECONCILE_EQUALS.includes(equals)) {
      throw new Error('a closed reconcile must equal net or zero');
    }
    if (!Array.isArray(raw['terms']) || raw['terms'].length === 0) {
      throw new Error('a closed reconcile must carry at least one term');
    }
    const terms = raw['terms'].map((entry): StatementReconcileTerm => {
      if (!isRecord(entry)) throw new Error('a reconcile term must be an object');
      const column = entry['column'];
      if (typeof column !== 'string' || column === '') {
        throw new Error('a reconcile term must name a column');
      }
      const rows = entry['rows'] === undefined ? null : stringList(entry['rows']);
      if (entry['rows'] !== undefined && rows === null) {
        throw new Error('a reconcile rows scope must be a list of row classes');
      }
      const sign = entry['sign'];
      if (typeof sign !== 'string' || !RECONCILE_TERM_SIGNS.includes(sign)) {
        throw new Error('a reconcile term sign is outside the known reconcile term signs');
      }
      return { column, rows, sign: sign as 'positive' | 'negative' };
    });
    return { closed: true, equals: equals as 'net' | 'zero', terms };
  }
  if (raw['closed'] === false) {
    const reason = raw['reason'];
    if (typeof reason !== 'string' || !RECONCILE_REASONS.includes(reason)) {
      throw new Error('an unclosed reconcile carries a reason outside the known unclosed reasons');
    }
    return { closed: false, reason: reason as StatementReconcileReason };
  }
  throw new Error('a reconcile block must carry a boolean closed');
}

/** The non-empty string the anchor fact carries, or the typed throw. */
function nonEmptyStringOf(value: unknown, message: string): string {
  if (typeof value !== 'string' || value === '') throw new Error(message);
  return value;
}

/** Reads a document's anchors, each a named pairing of two declared documents and the history
 *  row value whose deposit money the anchor claims. */
function anchorsOf(raw: unknown, label: string): readonly StatementAnchor[] {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) throw new Error(`${label} anchors must be a list`);
  return raw.map((entry): StatementAnchor => {
    if (!isRecord(entry)) throw new Error('an anchor must be an object');
    return {
      name: nonEmptyStringOf(entry['name'], 'an anchor must carry a name'),
      summary: nonEmptyStringOf(entry['summary'], 'an anchor must carry a summary document'),
      history: nonEmptyStringOf(entry['history'], 'an anchor must carry a history document'),
      claimRow: nonEmptyStringOf(entry['claim_row'], 'an anchor must carry a claim_row value'),
    };
  });
}

/** Reads a file's 1099-K issuer phrases, a non-empty list of non-empty strings. */
function payersOf(raw: unknown, label: string): readonly string[] {
  if (
    !Array.isArray(raw) ||
    raw.length === 0 ||
    !raw.every((entry): entry is string => typeof entry === 'string' && entry !== '')
  ) {
    throw new Error(`${label} must carry payers as a non-empty list of non-empty strings`);
  }
  return raw;
}

/** Reads one document object of a statements file, failing closed on any shape the figure
 *  function cannot trust; the rules checker gates the same facts at build time. */
function documentOf(raw: unknown): StatementDocument {
  if (!isRecord(raw) || typeof raw['name'] !== 'string' || raw['name'] === '') {
    throw new Error('a statement document must carry a name');
  }
  if (!Array.isArray(raw['columns'])) throw new Error('a statement document must declare columns');
  const columns: StatementColumn[] = raw['columns'].map((entry) => {
    if (!isRecord(entry)) throw new Error('a column must be an object');
    const { name, kind, confidence } = entry;
    if (typeof name !== 'string' || name === '') throw new Error('a column must carry a name');
    if (typeof kind !== 'string' || !KINDS.includes(kind)) {
      throw new Error(`column ${name} carries a kind outside the known column kinds`);
    }
    if (typeof confidence !== 'string' || !CONFIDENCES.includes(confidence)) {
      throw new Error(`column ${name} carries a confidence outside the known confidences`);
    }
    return { name, kind, confidence };
  });
  let rows: StatementRows | null = null;
  if (raw['rows'] !== undefined) {
    if (!isRecord(raw['rows']) || typeof raw['rows']['column'] !== 'string') {
      throw new Error('the rows block must name its discriminator column');
    }
    if (!isRecord(raw['rows']['classes']) || Object.keys(raw['rows']['classes']).length === 0) {
      throw new Error('the rows block must map at least one value to a class');
    }
    const classes: Record<string, string> = {};
    for (const [value, klass] of Object.entries(raw['rows']['classes'])) {
      if (typeof klass !== 'string' || !ROW_CLASSES.includes(klass)) {
        throw new Error('the rows block maps a value to a row class outside the known set');
      }
      classes[value] = klass;
    }
    rows = { column: raw['rows']['column'], classes };
  }
  const gross = referenceOf(raw['gross']);
  const net = referenceOf(raw['net']);
  if (net !== null && net.carries.length > 0) throw new Error('a net block carries nothing');
  for (const name of gross?.carries ?? []) {
    const kind = columns.find((column) => column.name === name)?.kind;
    if (kind === undefined || !CARRIED_KINDS.includes(kind)) {
      throw new Error(`the gross carries ${name}, which is no declared column of a carried kind`);
    }
  }
  // The same fail-closed refusal the rules checker carries (#1360): a refund, adjustment or
  // deposit row books only its net cells (issues #1154, #1359), so a document that classes one
  // but reads no net anywhere would have those cells read and summed into nothing.
  if (
    rows !== null &&
    NET_CELLS_ROW_CLASSES.some((klass) => Object.values(rows.classes).includes(klass)) &&
    !columns.some((column) => column.kind === 'net') &&
    net === null
  ) {
    throw new Error(
      'a document that classes refund, adjustment or deposit rows but declares no net-kind column and no net reference; their money would sum into nothing',
    );
  }
  return {
    name: raw['name'],
    columns,
    gross,
    net,
    rows,
    reconcile: reconcileOf(raw['reconcile']),
  };
}

/** One parsed statements file's (platform, document) pairs, each carrying the file's payers and
 *  anchors, failing closed on any shape the loaders cannot trust. The label names the file in
 *  errors — a file name for the directory load, an index for already-parsed input — and never a
 *  value inside it. */
function statementFilePairsOf(value: unknown, label: string): readonly StatementFile[] {
  if (!isRecord(value) || typeof value['platform'] !== 'string' || value['platform'] === '') {
    throw new Error(`${label} must name its platform`);
  }
  if (!Array.isArray(value['documents'])) throw new Error(`${label} must declare documents`);
  const platform: string = value['platform'];
  const payers = payersOf(value['payers'], label);
  const anchors = anchorsOf(value['anchors'], label);
  return value['documents'].map((raw) => ({
    platform,
    payers,
    document: documentOf(raw),
    anchors,
  }));
}

/**
 * The statement files' pairs from JSON values already in memory — the shape one
 * `platform_statements/*.json` file parses to, one value per file. The Report's static-import
 * path calls this: it reads no directory and touches no `node:fs` call, and validates exactly
 * what `loadStatementDocuments` validates, with the same failure discipline (a throw naming the
 * file-shape fact, never a value).
 */
export function statementFilesFromParsed(files: readonly unknown[]): readonly StatementFile[] {
  return files.flatMap((value, index) =>
    statementFilePairsOf(value, `statement file ${String(index)}`),
  );
}

/**
 * Every document the year's `platform_statements/` directory declares, file order. Throws when
 * the directory is unreadable or a file does not parse into the declared shape — the callers
 * that must not fail catch everything, and the checker gates the same files at build time.
 */
export function loadStatementDocuments(rulesDir: string): readonly StatementFile[] {
  const dir = join(rulesDir, 'platform_statements');
  const loaded: StatementFile[] = [];
  for (const name of readdirSync(dir).sort()) {
    if (!name.endsWith('.json')) continue;
    const file = JSON.parse(readFileSync(join(dir, name), 'utf8')) as unknown;
    loaded.push(...statementFilePairsOf(file, name));
  }
  return loaded;
}

/** The named document of the named platform, or null when the rules data declares no such one. */
export function statementDocumentOf(
  rulesDir: string,
  platform: string,
  documentName: string,
): StatementDocument | null {
  for (const file of loadStatementDocuments(rulesDir)) {
    if (file.platform === platform && file.document.name === documentName) return file.document;
  }
  return null;
}

/**
 * The deterministic reading's block, as the read job writes it into
 * `fields.platform_statement` and staging copies verbatim. This is the wider
 * non-wire schema the design names: it validates what code stored, and is never
 * sent to `complete` — the wire schemas carry no `platform_statement`, so a
 * model reading cannot persist one. The grid is the cell rows, header row first,
 * exactly as parsed — or, for a mapped reading (0175), projected onto the layout's
 * own header names; no figure, hash or confidence is stored beside it.
 */
export type StatementBlock = {
  readonly platform: string;
  readonly document: string;
  readonly grid: readonly (readonly string[])[];
};

/** The block a staged reading carries, or null when the value is not exactly that shape: the
 *  three keys and nothing else, every cell a string — the validator is the fail-closed check
 *  that what reached staging is what the read job writes. */
export function statementBlockOf(value: unknown): StatementBlock | null {
  if (!isRecord(value)) return null;
  const keys = Object.keys(value).sort();
  if (keys.length !== 3 || keys[0] !== 'document' || keys[1] !== 'grid' || keys[2] !== 'platform') {
    return null;
  }
  const { platform, document, grid } = value;
  if (typeof platform !== 'string' || platform === '') return null;
  if (typeof document !== 'string' || document === '') return null;
  if (!Array.isArray(grid)) return null;
  const rows: string[][] = [];
  for (const row of grid) {
    if (!Array.isArray(row)) return null;
    if (!row.every((cell): cell is string => typeof cell === 'string')) return null;
    rows.push(row);
  }
  return { platform, document, grid: rows };
}

/**
 * The one prepared page of an uploaded spreadsheet as the cell grid its reader sees: the rows
 * under the single `## Sheet:` heading, header row first, cells exactly as parsed. The worker's
 * match reads the first data line as the header row, so the heading and the trailing-field drops
 * the preparer makes are the two shapes this must survive; a text with no heading, a second one
 * (a multi-sheet workbook) or no data row is no grid.
 */
export function parseStatementGrid(preparedText: string): readonly (readonly string[])[] | null {
  const lines = preparedText.split('\n').filter((line) => line !== '');
  if (lines.length < 2 || !lines[0]?.startsWith('## Sheet:')) return null;
  if (lines.slice(1).some((line) => line.startsWith('## Sheet:'))) return null;
  return lines.slice(1).map((line) => line.split('\t'));
}

/** The header row's cells, trimmed — the comparison key the rules column names match. */
function headerOf(grid: readonly (readonly string[])[]): readonly string[] {
  return (grid[0] ?? []).map((cell) => cell.trim());
}

/**
 * The document whose declared column-name set is exactly the grid's header set, or null — the
 * identification the read job runs before its model call. Set equality, order and extra columns
 * alike; a near match is `statementHeaderCandidates`' to weigh (decision record 0175).
 */
export function matchStatementDocument(
  grid: readonly (readonly string[])[],
  documents: readonly StatementFile[],
): StatementFile | null {
  // A grid of the header alone is no export, and matches nothing.
  if (grid.length < 2) return null;
  const header = headerOf(grid);
  if (new Set(header).size !== header.length) return null;
  const names = new Set(header);
  for (const file of documents) {
    const declared = file.document.columns.map((column) => column.name);
    if (
      declared.length === header.length &&
      declared.every((name) => names.has(name)) &&
      names.size === declared.length
    ) {
      return file;
    }
  }
  return null;
}

/**
 * The read job's total match: the year's documents, the grid, and the exact header-set match, or
 * null in every other case — an uncarried year, an unreadable or malformed rules file, a text
 * that is not one headed sheet, a multi-page document, no match, and a grid the same rules do not
 * read whole: one whose rows the grammar does not class or whose summed cells are not plain
 * decimals claims no deterministic reading, because the check-time recompute over that grid would
 * only degrade it — the degrade is the founder's rules-drift re-read, not a path an upload
 * selects by one cell. Every failure is a null: the caller takes today's model path, and a throw
 * here would be a bug, not a fallback.
 */
export function statementMatchOf(
  preparedText: string,
  year: number,
  skillDir: string,
): StatementBlock | null {
  const grid = parseStatementGrid(preparedText);
  if (grid === null) return null;
  const rules = rulesDirOfYear(year, skillDir);
  if (!rules.ok) return null;
  let documents: readonly StatementFile[];
  try {
    documents = loadStatementDocuments(rules.dir);
  } catch {
    return null;
  }
  const matched = matchStatementDocument(grid, documents);
  if (matched === null) return null;
  if (!computeStatementFigures(grid, matched.document).ok) return null;
  return { platform: matched.platform, document: matched.document.name, grid };
}

/**
 * One document a sheet may be under renamed headers (decision record 0175): the anchor holds —
 * more than half the document's declared column names print verbatim in the header row — but the
 * header set is not exactly the declared set. `matched` are the declared names the header prints;
 * `columns` the declared names it does not, which a mapping must account for each; `headers` the
 * sheet's headers no declared name equals, which a mapping assigns a column or leaves out.
 */
export type StatementHeaderCandidate = {
  readonly file: StatementFile;
  readonly matched: readonly string[];
  readonly columns: readonly string[];
  readonly headers: readonly string[];
};

/**
 * Every document the anchor admits for a grid that matched none exactly, file order. The anchor
 * is the platform's own words: a strict majority of the document's declared column names must
 * print verbatim, so a mapping can rename only a minority of a layout and a different platform's
 * export that shares a few generic names (Payout Date, Net Payout) is never a candidate. A grid
 * of the header alone, or one with a repeated header, admits nothing, as in the exact match.
 */
export function statementHeaderCandidates(
  grid: StatementGrid,
  documents: readonly StatementFile[],
): readonly StatementHeaderCandidate[] {
  if (grid.length < 2) return [];
  const header = headerOf(grid);
  const names = new Set(header);
  if (names.size !== header.length) return [];
  const candidates: StatementHeaderCandidate[] = [];
  for (const file of documents) {
    const declared = file.document.columns.map((column) => column.name);
    const matched = declared.filter((name) => names.has(name));
    if (matched.length * 2 <= declared.length) continue;
    const columns = declared.filter((name) => !names.has(name));
    const headers = header.filter((name) => !declared.includes(name));
    // No unmatched header is the exact match, which needs no mapping; a declared column with no
    // unmatched header left to be it can never be mapped.
    if (headers.length === 0 || columns.length > headers.length) continue;
    const candidate = { file, matched, columns, headers };
    // No answer could be admitted, so the layout is never offered to a billed call.
    if (lacksSeveralMoneyColumns(candidate)) continue;
    candidates.push(candidate);
  }
  return candidates;
}

/**
 * The read job's total candidate lookup, beside `statementMatchOf`: the grid and the documents
 * the anchor admits, or null in every case that admits none — an uncarried year, an unreadable
 * rules file, a text that is not one headed sheet, or no candidate. A throw would be a bug, not a
 * fallback: every null returns the read job to its reader call.
 */
export function statementHeaderCandidatesOf(
  preparedText: string,
  year: number,
  skillDir: string,
): { grid: StatementGrid; candidates: readonly StatementHeaderCandidate[] } | null {
  const grid = parseStatementGrid(preparedText);
  if (grid === null) return null;
  const rules = rulesDirOfYear(year, skillDir);
  if (!rules.ok) return null;
  let documents: readonly StatementFile[];
  try {
    documents = loadStatementDocuments(rules.dir);
  } catch {
    return null;
  }
  const candidates = statementHeaderCandidates(grid, documents);
  return candidates.length === 0 ? null : { grid, candidates };
}

/**
 * What code settles before any mapping call (decision record 0175): when the sheet has one
 * candidate and prints all of its declared names, only adding headers, code reads it alone under
 * the same gates as a mapping, since a mapping could only answer null for each added header. Any
 * other candidate set is the model's to weigh.
 */
export function supersetStatementReading(
  grid: StatementGrid,
  candidates: readonly StatementHeaderCandidate[],
):
  | { readonly kind: 'ask' }
  | { readonly kind: 'refused'; readonly refusal: StatementHeaderRefusal }
  | { readonly kind: 'read'; readonly block: StatementBlock } {
  const [only, another] = candidates;
  if (only === undefined || another !== undefined || only.columns.length > 0) {
    return { kind: 'ask' };
  }
  const mapped = mappedStatementBlock(
    grid,
    only,
    only.headers.map((header) => ({ header, column: null })),
  );
  return mapped.ok
    ? { kind: 'read', block: mapped.block }
    : { kind: 'refused', refusal: mapped.refusal };
}

/** A cell that reads as an amount once its money dressing is set aside, so money left out of a
 *  mapping is still seen; a bare count or numeric id reads as one too (the restrictive side). */
function holdsAmount(cell: string): boolean {
  const bare = cell
    .trim()
    .replace(/(^|[\s\d.()])(?:[A-Z]{3}|CR|DR)(?=[\s\d.()]|$)/g, '$1')
    .replace(/[\p{Sc}\s,]/gu, '')
    .replace(/^\((.*)\)$/, '-$1')
    .replace(/[−–]/g, '-')
    .replace(/^([^-].*)-$/, '-$1')
    .replace(/^([+-]?)[A-Z]{1,2}(?=[\d.])/, '$1');
  return /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(bare);
}

/** A cell that prints nothing: blank, or a dash or N/A placeholder. */
function printsNothing(cell: string): boolean {
  return /^(?:[-–—]*|n\/?a)$/i.test(cell.trim());
}

/** Whether a candidate lacks more than one column of a money kind: neither the figures nor a
 *  same-signed identity term could tell two such columns swapped. */
function lacksSeveralMoneyColumns(candidate: StatementHeaderCandidate): boolean {
  const kinds = new Map(
    candidate.file.document.columns.map((column) => [column.name, column.kind]),
  );
  return candidate.columns.filter((name) => kinds.get(name) !== 'metadata').length > 1;
}

/** One entry of a model's header mapping: a sheet header and the declared column it is, or null
 *  for a header the document has no column for. */
export type StatementHeaderMapping = {
  readonly header: string;
  readonly column: string | null;
};

/** Why a mapping was refused; the codes name the gate, never a header, a cell or an amount. */
export type StatementHeaderRefusal =
  | 'headers-not-the-unmatched-set'
  | 'column-not-unmatched'
  | 'column-mapped-twice'
  | 'column-left-unmapped'
  | 'unmapped-column-holds-amounts'
  | 'renames-several-money-columns'
  | 'unmapped-column-blank'
  | 'amounts-under-metadata'
  | 'figures-refused'
  | 'identity-mismatch';

/**
 * The block a model's mapping yields under one candidate, every gate in code (decision record
 * 0175): the mapping lists exactly the candidate's unmatched headers, each once; every column it
 * names is one of the candidate's unmatched declared columns, none twice; every unmatched column
 * is named; the document lacks at most one column of a money kind, since neither the figures nor
 * a same-signed identity term could tell two swapped money columns apart; no column left out
 * holds an amount, and none prints nothing on every row while a money column is lacking, because
 * it could be the lacking one a wrong answer passed over; no header holding amounts is named a
 * metadata column, which never sums; and the
 * projected grid — the header row in the document's own names, the columns the document does not
 * declare left out, every other cell exactly as parsed — computes and, when the document's
 * identity is closed, closes. The stored grid is the projection, so every consumer
 * recomputes it against the unchanged document exactly as it does an exact match's.
 */
export function mappedStatementBlock(
  grid: StatementGrid,
  candidate: StatementHeaderCandidate,
  mapping: readonly StatementHeaderMapping[],
):
  | { readonly ok: true; readonly block: StatementBlock }
  | { readonly ok: false; readonly refusal: StatementHeaderRefusal } {
  const document = candidate.file.document;
  if (lacksSeveralMoneyColumns(candidate)) {
    return { ok: false, refusal: 'renames-several-money-columns' };
  }
  const kinds = new Map(document.columns.map((column) => [column.name, column.kind]));
  const lacksMoney = candidate.columns.some((name) => kinds.get(name) !== 'metadata');
  const listed = mapping.map((entry) => entry.header);
  if (
    listed.length !== candidate.headers.length ||
    new Set(listed).size !== listed.length ||
    !listed.every((header) => candidate.headers.includes(header))
  ) {
    return { ok: false, refusal: 'headers-not-the-unmatched-set' };
  }
  const renamed = new Map<string, string>(candidate.matched.map((name) => [name, name]));
  for (const { header, column } of mapping) {
    if (column === null) continue;
    if (!candidate.columns.includes(column)) return { ok: false, refusal: 'column-not-unmatched' };
    if ([...renamed.values()].includes(column))
      return { ok: false, refusal: 'column-mapped-twice' };
    renamed.set(header, column);
  }
  if (renamed.size !== candidate.file.document.columns.length) {
    return { ok: false, refusal: 'column-left-unmapped' };
  }
  // A column the document does not declare is left out only when it holds no amount: money in a
  // column the rules data has no kind for would silently drop out of every figure.
  const header = headerOf(grid);
  for (const [index, name] of header.entries()) {
    if (renamed.has(name)) continue;
    const cells = grid.slice(1).map((row) => cellOf(row, index));
    if (cells.some(holdsAmount)) return { ok: false, refusal: 'unmapped-column-holds-amounts' };
    if (lacksMoney && cells.every(printsNothing)) {
      return { ok: false, refusal: 'unmapped-column-blank' };
    }
  }
  // A metadata column never sums, so a renamed header holding amounts may not become one.
  for (const { header: name, column } of mapping) {
    if (column === null || kinds.get(column) !== 'metadata') continue;
    const index = header.indexOf(name);
    if (grid.slice(1).some((row) => holdsAmount(cellOf(row, index)))) {
      return { ok: false, refusal: 'amounts-under-metadata' };
    }
  }
  const kept = header.flatMap((name, index) => {
    const column = renamed.get(name);
    return column === undefined ? [] : [{ index, column }];
  });
  // A row the preparer's trailing drops shortened stays as short: only cells it carries are kept.
  const projected = grid.map((row, rowIndex) =>
    rowIndex === 0
      ? kept.map(({ column }) => column)
      : kept.filter(({ index }) => index < row.length).map(({ index }) => cellOf(row, index)),
  );
  if (!computeStatementFigures(projected, document).ok) {
    return { ok: false, refusal: 'figures-refused' };
  }
  if (reconcileStatement(projected, document)?.kind === 'mismatch') {
    return { ok: false, refusal: 'identity-mismatch' };
  }
  return {
    ok: true,
    block: { platform: candidate.file.platform, document: document.name, grid: projected },
  };
}

/** One printed figure: its books key, its amount as the books carry it, and the UNVERIFIED mark
 *  derived from the summed columns' rules confidence at print time (review F5: nothing boolean
 *  is stored). */
export type StatementFigure = {
  readonly key: string;
  readonly amount: string;
  readonly unverified: boolean;
};

/** Why the figures could not be computed; the message never carries a grid value. */
export type StatementFigureProblem =
  | { readonly code: 'statement_grid_mismatch'; readonly message: string }
  | { readonly code: 'statement_cell_malformed'; readonly message: string }
  | { readonly code: 'statement_row_unclassed'; readonly message: string };

export type StatementFiguresResult =
  | { readonly ok: true; readonly figures: readonly StatementFigure[] }
  | { readonly ok: false; readonly problem: StatementFigureProblem };

/** A running sum and whether any column that fed it renders UNVERIFIED. */
class FigureSum {
  cents = 0n;
  unverified = false;
}

/** The cells a block sums: one entry per (column, row class) pair, a wildcard when the block
 *  scopes to no classes and sums every row. The exclusion that keeps a summed cell out of the
 *  kind figures is this pair set — never a whole column, so a gross column's money in a class
 *  outside the blocks (Airbnb's Resolution Adjustment) survives as its own figure. */
function excludedPairs(document: StatementDocument): Set<string> {
  const pairs = new Set<string>();
  for (const block of [document.gross, document.net]) {
    if (block === null) continue;
    for (const column of block.columns) {
      if (block.rows === null) {
        pairs.add(`${column}\u0000*`);
      } else {
        for (const klass of block.rows) pairs.add(`${column}\u0000${klass}`);
      }
    }
  }
  return pairs;
}

/** The figure key one non-excluded (column, row) pair sums into: the row class decides — a
 *  payout row nets, and a refund, adjustment or deposit row's net cells (kind net, or a column
 *  the net reference names) are the money that books, into the class's own figure — and an
 *  earning (or unscoped) row keeps the column's own kind. The net-cells-only gate lives in the
 *  kind loop (issues #1154, #1359), before this key is read. */
function figureKeyOf(klass: string | null, kind: string): string {
  if (klass === 'payout') return 'net';
  if (klass === 'deposit') return 'deposit';
  if (klass === 'refund' || klass === 'adjustment') return 'refund';
  return kind;
}

/** A grid cell by column position: a row the preparer's trailing drops shortened reads blank. */
function cellOf(row: readonly string[], index: number): string {
  return row[index] ?? '';
}

/** A summed cell in cents: blank contributes zero; anything parseDec refuses is the typed
 *  malformed-cell rejection, naming the address (grid row, rules column name) and no value. */
function cellCents(
  row: readonly string[],
  index: number,
  columnName: string,
  gridRow: number,
): bigint | StatementFigureProblem {
  const cell = cellOf(row, index).trim();
  if (cell === '') return 0n;
  try {
    return toCents(parseDec(cell));
  } catch {
    return {
      code: 'statement_cell_malformed',
      message: `row ${String(gridRow)} column ${columnName} is not a plain decimal`,
    };
  }
}

/**
 * The figures of one matched statement grid over its rules document. Gross and net are exactly
 * what the document's blocks name — columns over the row classes the block scopes to, all rows
 * when it names none — and each remaining books-kind sum takes the (column, row class) pairs no
 * block summed, keyed by the row class: a refund or adjustment row books only its net cells into
 * the refund figure, and a deposit row only its net cells into the deposit figure (a column of
 * kind net, or one the net reference names — the row's other printed columns are that money's
 * breakdown, issues #1154, #1359), a payout row nets, and an earning (or unscoped) row keeps the
 * column's own kind. A column the gross block carries
 * is money already inside the gross
 * on the rows it scopes: there a pass-through prints nothing and a fee or platform-remitted tax
 * sums into the fee figure. Blank cells a sum touches contribute zero; a summed cell that is
 * not a plain decimal, and a row whose discriminator value the grammar does not class, are the
 * typed rejections. Order and shape are fixed: gross, then the money kinds in vocabulary order
 * that summed to anything, then net — the reconciliation figure, and the ones with no booking in
 * this reader beside them (deposit, fee-traveler-side, tax-platform-remitted), every amount a
 * `fmtCents` string. Of the two typed rejections, the malformed cell is visited everywhere
 * before the unclassed row answers: every summed cell of the grid is read first, so a row the
 * grammar does not class cannot choose the degrade over a malformed cell a later row carries.
 */
export function computeStatementFigures(
  grid: readonly (readonly string[])[],
  document: StatementDocument,
): StatementFiguresResult {
  if (grid.length === 0) {
    return {
      ok: false,
      problem: {
        code: 'statement_grid_mismatch',
        message: 'the stored grid carries no header row',
      },
    };
  }
  // The header check first: a grid whose columns no longer match its named document (a rules
  // correction) is the mismatch the gate degrades on, before any cell is read.
  const header = headerOf(grid);
  const positions = new Map<string, number>();
  for (const [index, name] of header.entries()) {
    if (!positions.has(name)) positions.set(name, index);
  }
  const declared = document.columns.map((column) => column.name);
  const missing = declared.filter((name) => !positions.has(name));
  const unexpected = header.filter((name) => !declared.includes(name)).length;
  if (missing.length > 0 || unexpected > 0) {
    const parts: string[] = [];
    if (missing.length > 0) parts.push(`is missing columns: ${missing.join(', ')}`);
    if (unexpected > 0) parts.push(`carries ${String(unexpected)} unexpected column(s)`);
    return {
      ok: false,
      problem: {
        code: 'statement_grid_mismatch',
        message: `the stored grid ${parts.join(' and ')}`,
      },
    };
  }
  const columnIndex = new Map(document.columns.map((column) => [column.name, column]));
  const rowsBlock = document.rows;
  const discriminator = rowsBlock === null ? -1 : (positions.get(rowsBlock.column) ?? -1);
  const excluded = excludedPairs(document);
  // The first row the grammar does not class, held while every summed cell is visited: a
  // malformed cell anywhere is the document misread (the typed invariant), so it wins over the
  // unclassed row's degrade, which a later row must not be able to choose. The classing itself is
  // total either way — an unclassed row's cells are never summed.
  let unclassed: StatementFigureProblem | null = null;
  const unclassedProblem = (gridIndex: number): StatementFigureProblem => ({
    code: 'statement_row_unclassed',
    message: `row ${String(gridIndex + 1)} carries a ${rowsBlock?.column ?? ''} the rules data does not class`,
  });

  // Block figures: exactly the declared columns over the declared classes.
  const sums = new Map<string, FigureSum>();
  const take = (key: string, cents: bigint, unverified: boolean): void => {
    const sum = sums.get(key);
    if (sum === undefined) sums.set(key, { cents, unverified });
    else {
      sum.cents += cents;
      sum.unverified = sum.unverified || unverified;
    }
  };
  for (const block of [document.gross, document.net]) {
    if (block === null) continue;
    const key = block === document.gross ? 'gross' : 'net';
    const inScope = (klass: string | null): boolean =>
      block.rows === null || (klass !== null && block.rows.includes(klass));
    for (const [gridIndex, row] of grid.entries()) {
      if (gridIndex === 0) continue;
      let klass: string | null = null;
      if (rowsBlock !== null) {
        const value = cellOf(row, discriminator).trim();
        const mapped: string | undefined = rowsBlock.classes[value];
        if (mapped === undefined) {
          if (unclassed === null) unclassed = unclassedProblem(gridIndex);
          continue;
        }
        klass = mapped;
      }
      if (!inScope(klass)) continue;
      for (const columnName of block.columns) {
        const column = columnIndex.get(columnName);
        if (column === undefined) continue;
        const cents = cellCents(row, positions.get(columnName) ?? -1, columnName, gridIndex + 1);
        if (typeof cents !== 'bigint') return { ok: false, problem: cents };
        take(key, cents, column.confidence !== 'documented');
      }
    }
  }

  // Kind figures: every (column, row class) pair no block summed, keyed by the row class.
  const carried = new Set(document.gross?.carries ?? []);
  const grossRows = document.gross?.rows ?? null;
  const inGross = (klass: string | null): boolean =>
    grossRows === null || (klass !== null && grossRows.includes(klass));
  const netColumns = new Set(document.net?.columns ?? []);
  for (const [gridIndex, row] of grid.entries()) {
    if (gridIndex === 0) continue;
    let klass: string | null = null;
    if (rowsBlock !== null) {
      const value = cellOf(row, discriminator).trim();
      const mapped: string | undefined = rowsBlock.classes[value];
      if (mapped === undefined) {
        if (unclassed === null) unclassed = unclassedProblem(gridIndex);
        continue;
      }
      klass = mapped;
    }
    for (const column of document.columns) {
      if (column.kind === 'metadata') continue;
      // A carried column on a row the gross scopes (issues #1150, #1151): its money is inside the
      // gross figure already, so a pass-through prints nothing (the gross books it), and a fee or
      // platform-remitted tax prints as the fee figure, the expense that takes back out what the
      // platform kept — even when the gross block sums the column itself (Airbnb's Host Fee).
      // Every carried cell is still read, so a malformed one is the typed rejection either way.
      if (carried.has(column.name) && inGross(klass)) {
        const cents = cellCents(row, positions.get(column.name) ?? -1, column.name, gridIndex + 1);
        if (typeof cents !== 'bigint') return { ok: false, problem: cents };
        if (column.kind !== 'pass-through') take('fee', cents, column.confidence !== 'documented');
        continue;
      }
      // A block's exclusion: the (column, class) pairs it sums, and the whole column when the
      // block scopes to no classes.
      if (
        excluded.has(`${column.name}\u0000${klass ?? '*'}`) ||
        excluded.has(`${column.name}\u0000*`)
      ) {
        continue;
      }
      const cents = cellCents(row, positions.get(column.name) ?? -1, column.name, gridIndex + 1);
      if (typeof cents !== 'bigint') return { ok: false, problem: cents };
      // A refund, adjustment or deposit row books its money once (issues #1154, #1359): only the
      // row's net cells sum into its class's figure — a column of kind net, or one the net
      // reference names (the Resolution Adjustment's Amount) — because the row's other printed
      // columns are that same money's breakdown (the fee mirrors a refund row prints, the fare
      // and tip inside an adjustment's Total, the escrow mirrors a damage-deposit row prints in
      // Deposit Amount and Refundable Deposit beside the payout), and re-keying them booked the
      // row once per column. Every cell is still read, so a malformed one stays the typed
      // rejection.
      if (klass !== null && NET_CELLS_ROW_CLASSES.includes(klass)) {
        if (column.kind === 'net' || netColumns.has(column.name)) {
          take(figureKeyOf(klass, column.kind), cents, column.confidence !== 'documented');
        }
        continue;
      }
      // The re-key is the row class's: a payout row's money is the net figure whatever column
      // carries it. An earning (or unscoped) row keeps the column's own kind —
      // except the two block-owned kinds, whose earning-row residues are the convenience repeats
      // of block money (a per-row total beside the payout that nets them) and would print a
      // second net beside the block's.
      const key = figureKeyOf(klass, column.kind);
      if (key === column.kind && (column.kind === 'gross-component' || column.kind === 'net')) {
        continue;
      }
      take(key, cents, column.confidence !== 'documented');
    }
  }

  if (unclassed !== null) return { ok: false, problem: unclassed };

  const figures: StatementFigure[] = [];
  const emit = (key: string): void => {
    const sum = sums.get(key);
    // The gross figure prints whatever it summed; a kind figure that touched only blanks and
    // excluded pairs prints nothing — a 0.00 line books nothing and names nothing.
    if (sum === undefined || (key !== 'gross' && key !== 'net' && sum.cents === 0n)) return;
    figures.push({ key, amount: fmtCents(sum.cents), unverified: sum.unverified });
  };
  emit('gross');
  for (const kind of PRINTED_KINDS) {
    emit(kind);
  }
  emit('net');
  return { ok: true, figures };
}

/**
 * The per-statement net reconciliation (issue #1107): the typed outcome of the document's
 * declared identity over the stored grid. Pure — it walks the grid with the same cell reader
 * `computeStatementFigures` walks (`parseDec`/`toCents` through money.ts), never the import
 * gate's allowed-figure set, and writes nothing. A `matched` identity books no figure and a
 * `mismatch` carries figure keys alone — never a cent, a person or a grid value (invariant 6).
 *
 * The outcome is `null` — no outcome — when `computeStatementFigures` refuses the grid
 * (`statement_grid_mismatch`, `statement_cell_malformed`, `statement_row_unclassed`): the
 * run-time degrade notice already carries a refused grid, so the reconciliation adds nothing
 * to it, and an unclosed document over a refused grid is no row either. An empty in-scope grid
 * that computes `{ ok: true, figures: [] }` on a closed document is a `mismatch` naming `net`,
 * whatever the identity compares against, and so is a closed equals-net identity whose recompute
 * printed no net figure at all: a payout-less grid's net block never sums, and its zero must
 * never match a zero term sum and vanish a live statement from the Report.
 */
export function reconcileStatement(
  grid: StatementGrid,
  document: StatementDocument,
): StatementReconcileOutcome | null {
  const figures = computeStatementFigures(grid, document);
  if (!figures.ok) return null;
  const reconcile = document.reconcile;
  if (!reconcile.closed) return { kind: 'unclosed', reason: reconcile.reason };

  const positions = positionsOf(grid);
  const walked = walkedRows(grid, document, positions);
  const columnIndex = new Map(document.columns.map((column) => [column.name, column]));
  let termsCents = 0n;
  const kindCents = new Map<string, bigint>();
  for (const term of reconcile.terms) {
    const column = columnIndex.get(term.column);
    if (column === undefined) return null; // The checker refuses such rules data; never reached.
    const sign = term.sign === 'negative' ? -1n : 1n;
    for (const { klass, row, gridIndex } of walked) {
      if (term.rows !== null && (klass === null || !term.rows.includes(klass))) continue;
      const cents = cellCents(row, positions.get(term.column) ?? -1, term.column, gridIndex + 1);
      if (typeof cents !== 'bigint') return null; // The recompute refused; never reached.
      const signed = cents * sign;
      termsCents += signed;
      const key = outcomeKeyOf(klass, column.kind);
      kindCents.set(key, (kindCents.get(key) ?? 0n) + signed);
    }
  }
  const kinds = outcomeKinds(kindCents, reconcile.equals);
  // A grid whose figure recompute prints nothing carries no evidence either way: the mismatch,
  // not a matched bill on a blank grid, and the kinds name the net it would have taken.
  if (figures.figures.length === 0) return { kind: 'mismatch', kinds: ['net'] };
  if (reconcile.equals === 'net') {
    if (document.net === null) return null; // The checker refuses such rules data; never reached.
    // A closed identity the net figure never printed is no matched statement: with no payout
    // row the net block never sums, and referenceCents' zero would match a zero term sum. A
    // payout row that sums 0.00 still prints the net figure (the emit guard exempts net from
    // the zero-skip) and matches below.
    if (!figures.figures.some((figure) => figure.key === 'net')) {
      return { kind: 'mismatch', kinds };
    }
    const netCents = referenceCents(walked, positions, document.net);
    return termsCents === netCents ? { kind: 'matched' } : { kind: 'mismatch', kinds };
  }
  return termsCents === 0n ? { kind: 'matched' } : { kind: 'mismatch', kinds };
}

/** The reconciliation outcome: matched, mismatched by figure key with no cents anywhere, or the
 *  declared reason the identity is not closed at all. */
export type StatementReconcileOutcome =
  | { readonly kind: 'matched' }
  | { readonly kind: 'mismatch'; readonly kinds: readonly string[] }
  | { readonly kind: 'unclosed'; readonly reason: StatementReconcileReason };

/** The header's column positions, first occurrence wins — the map the figure function builds. */
function positionsOf(grid: StatementGrid): Map<string, number> {
  const positions = new Map<string, number>();
  for (const [index, name] of headerOf(grid).entries()) {
    if (!positions.has(name)) positions.set(name, index);
  }
  return positions;
}

/** The grid's data rows with their assigned class, walked the way `computeStatementFigures`
 *  walks them. Called only after the recompute accepted the grid, so a row the grammar does not
 *  class is never reached — the skip is the defensive arm, not a silent path. */
function walkedRows(
  grid: StatementGrid,
  document: StatementDocument,
  positions: Map<string, number>,
): readonly { klass: string | null; row: readonly string[]; gridIndex: number }[] {
  const rowsBlock = document.rows;
  const discriminator = rowsBlock === null ? -1 : (positions.get(rowsBlock.column) ?? -1);
  const walked: { klass: string | null; row: readonly string[]; gridIndex: number }[] = [];
  for (const [gridIndex, row] of grid.entries()) {
    if (gridIndex === 0) continue;
    let klass: string | null = null;
    if (rowsBlock !== null) {
      const mapped: string | undefined = rowsBlock.classes[cellOf(row, discriminator).trim()];
      if (mapped === undefined) continue; // The recompute refused such a grid; never reached.
      klass = mapped;
    }
    walked.push({ klass, row, gridIndex });
  }
  return walked;
}

/** The cents one declared reference block sums over the walked rows — the net block's own
 *  cents, not the printed `net` figure key, which also absorbs payout-class money re-keyed from
 *  other columns. */
function referenceCents(
  walked: readonly { klass: string | null; row: readonly string[]; gridIndex: number }[],
  positions: Map<string, number>,
  block: StatementReference,
): bigint {
  let total = 0n;
  for (const { klass, row, gridIndex } of walked) {
    if (block.rows !== null && (klass === null || !block.rows.includes(klass))) continue;
    for (const columnName of block.columns) {
      const cents = cellCents(row, positions.get(columnName) ?? -1, columnName, gridIndex + 1);
      if (typeof cents !== 'bigint') continue; // The recompute refused; never reached.
      total += cents;
    }
  }
  return total;
}

/** The outcome kind one (row class, column kind) pair reports: the same re-keying the figure
 *  function prints, with a gross-component column reported as the `gross` figure it feeds. */
function outcomeKeyOf(klass: string | null, kind: string): string {
  const key = figureKeyOf(klass, kind);
  return key === 'gross-component' ? 'gross' : key;
}

/** The outcome kinds in figure order: gross first, the money kinds in vocabulary order, net
 *  last — the order the printed figures carry, so an outcome reads beside them. */
const OUTCOME_KIND_ORDER: readonly string[] = ['gross', ...PRINTED_KINDS, 'net'];

/** A mismatch's kinds: the closed terms' keys that summed anything, plus `net` whenever the
 *  identity compares against it, deduplicated and in figure order — no cents anywhere. */
function outcomeKinds(
  kindCents: ReadonlyMap<string, bigint>,
  equals: 'net' | 'zero',
): readonly string[] {
  const kinds = new Set<string>();
  if (equals === 'net') kinds.add('net');
  for (const [key, cents] of kindCents) {
    if (cents !== 0n) kinds.add(key);
  }
  return [...kinds].sort((a, b) => OUTCOME_KIND_ORDER.indexOf(a) - OUTCOME_KIND_ORDER.indexOf(b));
}

/**
 * The retained-deposit anchor (issue #1107): the summary document's gross should equal the
 * history document's gross plus the deposit-kind money the history's claim rows carry. Pure,
 * over already-loaded grids. Several extractions of the same document name sum their grosses —
 * the Report feeds every extraction it re-read. `anchored` when the equality holds to the cent;
 * `open` when both sides emitted grosses and it fails (the kinds name the two figures, never a
 * cent or a winner); `absent` when either document is undeclared, either side fed no grid that
 * emitted gross, or either grid's recompute was refused — a missing side is never stored as
 * zero. No outcome carries a cent.
 */
export function anchorStatements(
  documents: readonly StatementFile[],
  anchor: StatementAnchor,
  summaryGrids: readonly StatementGrid[],
  historyGrids: readonly StatementGrid[],
): StatementAnchorOutcome {
  const summary = documentOfName(documents, anchor.summary);
  const history = documentOfName(documents, anchor.history);
  if (summary === null || history === null) return { kind: 'absent', name: anchor.name };
  const summaryGross = emittedGrossCents(summaryGrids, summary);
  if (summaryGross === null) return { kind: 'absent', name: anchor.name };
  const historyGross = emittedGrossCents(historyGrids, history);
  if (historyGross === null) return { kind: 'absent', name: anchor.name };
  const retained = retainedCentsOf(historyGrids, history, anchor.claimRow);
  if (summaryGross === historyGross + retained) {
    return { kind: 'anchored', name: anchor.name };
  }
  return { kind: 'open', name: anchor.name, kinds: ANCHOR_KINDS };
}

/** The anchor's kinds: the two figures the open row shows side by side. */
const ANCHOR_KINDS: readonly string[] = ['gross', 'deposit'];

/** The anchor outcome: anchored, open by figure kind, or absent — no outcome carries a cent. */
export type StatementAnchorOutcome =
  | { readonly kind: 'anchored'; readonly name: string }
  | { readonly kind: 'open'; readonly name: string; readonly kinds: readonly string[] }
  | { readonly kind: 'absent'; readonly name: string };

/** The named document across the loaded files, or null when the rules declare no such one. */
function documentOfName(
  documents: readonly StatementFile[],
  name: string,
): StatementDocument | null {
  for (const file of documents) {
    if (file.document.name === name) return file.document;
  }
  return null;
}

/** The sum of the `gross` figure across every grid of one document, or null when any grid's
 *  recompute was refused or emitted no gross — an extraction that printed no gross is a missing
 *  side, never a zero. */
function emittedGrossCents(
  grids: readonly StatementGrid[],
  document: StatementDocument,
): bigint | null {
  if (grids.length === 0) return null;
  let total: bigint | null = null;
  for (const grid of grids) {
    const figures = computeStatementFigures(grid, document);
    if (!figures.ok) return null;
    const gross = figures.figures.find((figure) => figure.key === 'gross');
    if (gross === undefined) return null;
    total = (total ?? 0n) + toCents(parseDec(gross.amount));
  }
  return total;
}

/** The deposit-kind cells the claim rows carry: history rows whose discriminator value equals
 *  the anchor's claim_row, their deposit-kind columns summed. A blank cell contributes zero;
 *  the recompute has already read every non-metadata cell of every classed row, so the parse
 *  cannot refuse here — the skip is the defensive arm. */
function retainedCentsOf(
  grids: readonly StatementGrid[],
  document: StatementDocument,
  claimRow: string,
): bigint {
  const rowsBlock = document.rows;
  if (rowsBlock === null) return 0n;
  const deposits = document.columns
    .filter((column) => column.kind === 'deposit')
    .map((column) => column.name);
  if (deposits.length === 0) return 0n;
  let total = 0n;
  for (const grid of grids) {
    const positions = positionsOf(grid);
    const discriminator = positions.get(rowsBlock.column) ?? -1;
    for (const [gridIndex, row] of grid.entries()) {
      if (gridIndex === 0) continue;
      if (cellOf(row, discriminator).trim() !== claimRow) continue;
      for (const name of deposits) {
        const cents = cellCents(row, positions.get(name) ?? -1, name, gridIndex + 1);
        if (typeof cents === 'bigint') total += cents;
      }
    }
  }
  return total;
}

/** One code-read statement extraction's recomputed figures, as the coverage reads them: the
 *  extraction's `platform_statement.platform`, its recomputed `gross` cents (null when the
 *  recompute refused or printed no gross), and the full set of printed figure cents for the
 *  uniqueness rule. */
export type StatementExtractionFigures = {
  readonly id: string;
  readonly platform: string;
  readonly grossCents: bigint | null;
  readonly printedCents: readonly bigint[];
};

/** One candidate booked line (issue #1107): the fields the coverage join reads. `vendor` is
 *  carried and never read — attribution is the extraction join alone, never vendor text. */
export type BookedLineCandidate = {
  readonly vendor: string;
  readonly amountCents: bigint;
  readonly status: string;
  readonly currency: string;
  readonly sourceExtractionId: string | null;
  readonly income: boolean;
};

/** One form 1099-K reading: its payer string as the page prints it, and each page's
 *  `form_boxes["1a"]` value in page order, raw — the parse is here, never a coercion. */
export type Form1099KReading = {
  readonly payer: string;
  readonly pages: readonly string[];
};

/** One coverage row: the two readings, the unsigned distance between them, and the open
 *  sentence when they differ or no booked gross was computed. The sentence names no amount.
 *  A joined row's payer is the rules platform string; an unmatched row's is the form's own. */
export type Form1099KCoverageRow = {
  readonly payer: string;
  readonly platform: string | null;
  readonly formCents: bigint;
  readonly bookedCents: bigint | null;
  readonly distanceCents: bigint | null;
  readonly open: boolean;
  readonly openSentence: string | null;
};

/** Both figures are shown for your accountant; the sentence carries neither (invariant 5). */
const DIFFER_SENTENCE =
  'Form 1099-K box 1a and booked gross disagree; both figures are shown for your accountant and Bookette chooses neither.';
const UNBOOKED_SENTENCE =
  'No booked gross was computed for this payer, so the form has no counterpart figure to compare against.';

/**
 * The year-wide 1099-K coverage (issue #1107): one row per rules platform whose payers list
 * carries some form's payer (trimmed, case-folded), against the booked gross the extraction
 * join alone attributes — vendor text is never read. Every joining form's Box 1a (its lowest
 * parseable page; a formatted value skipped, never coerced) sums into the platform's row, so
 * two live forms compare once against the whole booked gross and a duplicate doubles the form
 * side and opens. A payer no platform claims is its own row — such forms group by payer string
 * and sum the same way — with a null booked gross. Pure: it reads the passed readings and cents
 * and nothing else, and no row carries a sentence with a figure.
 */
export function coverForm1099K(
  files: readonly StatementFile[],
  extractions: readonly StatementExtractionFigures[],
  lines: readonly BookedLineCandidate[],
  forms: readonly Form1099KReading[],
): readonly Form1099KCoverageRow[] {
  const rows: Form1099KCoverageRow[] = [];
  const joinedPayers = new Set<string>();
  const seenPlatforms = new Set<string>();
  for (const file of files) {
    // The loaded files are (platform, document) pairs — one per declared document — so each
    // platform is processed once; its payers ride identically on every pair.
    if (seenPlatforms.has(file.platform)) continue;
    seenPlatforms.add(file.platform);
    let formCents: bigint | null = null;
    for (const form of forms) {
      const payer = form.payer.trim();
      if (!file.payers.some((phrase) => phrase.trim().toLowerCase() === payer.toLowerCase())) {
        continue;
      }
      const cents = box1aCentsOf(form.pages);
      if (cents === null) continue; // No parseable Box 1a: contributes nothing, never coerced.
      joinedPayers.add(payer.toLowerCase());
      formCents = (formCents ?? 0n) + cents;
    }
    if (formCents === null) continue; // No form with a parseable Box 1a joins this platform.
    const bookedCents = bookedGrossOf(file.platform, extractions, lines);
    const distanceCents = bookedCents === null ? null : distanceOf(formCents, bookedCents);
    const open = bookedCents === null || distanceCents !== 0n;
    rows.push({
      payer: file.platform,
      platform: file.platform,
      formCents,
      bookedCents,
      distanceCents,
      open,
      openSentence: open ? (bookedCents === null ? UNBOOKED_SENTENCE : DIFFER_SENTENCE) : null,
    });
  }
  // A payer no rules platform claims is its own row: its forms sum the same way, the booked
  // side stays null. First appearance order, and a payer whose every form lacks a parseable
  // Box 1a produces no row at all.
  const seen = new Set<string>();
  for (const form of forms) {
    const payer = form.payer.trim();
    const folded = payer.toLowerCase();
    if (joinedPayers.has(folded) || seen.has(folded)) continue;
    seen.add(folded);
    let formCents: bigint | null = null;
    for (const candidate of forms) {
      if (candidate.payer.trim().toLowerCase() !== folded) continue;
      const cents = box1aCentsOf(candidate.pages);
      if (cents === null) continue;
      formCents = (formCents ?? 0n) + cents;
    }
    if (formCents === null) continue;
    rows.push({
      payer,
      platform: null,
      formCents,
      bookedCents: null,
      distanceCents: null,
      open: true,
      openSentence: UNBOOKED_SENTENCE,
    });
  }
  return rows;
}

/** The first page whose `1a` parses as the reader's plain decimal — the lowest page index wins,
 *  so a later copy of the same form never adds. A formatted value is skipped, never coerced. */
export function box1aCentsOf(pages: readonly string[]): bigint | null {
  for (const value of pages) {
    try {
      return toCents(parseDec(value));
    } catch {
      continue; // Not the reader's decimal shape; the next page may carry a parseable one.
    }
  }
  return null;
}

/** The unsigned distance between the two readings, integer subtraction. */
function distanceOf(formCents: bigint, bookedCents: bigint): bigint {
  return formCents > bookedCents ? formCents - bookedCents : bookedCents - formCents;
}

/** A platform's booked gross: the sum of the candidate lines that are confirmed, USD, income,
 *  joined to one of the platform's gross-emitting extractions, whose amount equals that
 *  extraction's recomputed gross and no other printed figure of it. No gross-emitting
 *  extraction is a null booked gross — never a zero; gross figures no line matched is a zero. */
function bookedGrossOf(
  platform: string,
  extractions: readonly StatementExtractionFigures[],
  lines: readonly BookedLineCandidate[],
): bigint | null {
  const joinable = new Map(
    extractions
      .filter((extraction) => extraction.platform === platform && extraction.grossCents !== null)
      .map((extraction) => [extraction.id, extraction]),
  );
  if (joinable.size === 0) return null;
  let total = 0n;
  for (const line of lines) {
    if (line.status !== 'CONFIRMED') continue;
    if (line.currency !== 'USD') continue;
    if (!line.income) continue; // An expense line never counts, whatever its amount equals.
    if (line.sourceExtractionId === null) continue;
    const extraction = joinable.get(line.sourceExtractionId);
    const gross = extraction?.grossCents;
    if (extraction === undefined || gross === null) continue;
    if (line.amountCents !== gross) continue;
    let printed = 0;
    for (const cents of extraction.printedCents) {
      if (cents === line.amountCents) printed += 1;
    }
    if (printed !== 1) continue; // Another printed figure shares the cents; the match is not unique.
    total += line.amountCents;
  }
  return total;
}

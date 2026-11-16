/**
 * Gate the platform statement rules data in rules/tyNNNN/platform_statements/
 * (epic #1017 step 2, issue #1105).
 *
 * Per file, each reported with a typed code and named by file and path, never
 * echoing a matched value:
 *
 * 1. Schema (`schema`): the file is a JSON object carrying exactly the declared
 *    keys - fail-closed on unknown keys, so a schema addition for the reader
 *    (#1106) is a small, deliberate checker change. A document declares
 *    non-empty columns; every column a name, a kind, a confidence and an
 *    optional sign from the closed vocabularies; provenance a non-empty list
 *    of { url, what } entries. The file also carries `payers` (issue #1107),
 *    a non-empty list of non-empty issuer phrases, and may carry `anchors`.
 * 2. References (`invariant`): every gross/net column reference names a
 *    declared column of the same document; every row class a gross or net
 *    reference names is one the document's rows block assigns; a gross
 *    block's `carries` names declared columns of a carried kind, once each,
 *    and a net block carries nothing (issues #1150, #1151); a segment's
 *    rows and columns name declared row values and columns; `sign: "varies"`
 *    carries a sign_note; a document that classes refund, adjustment or
 *    deposit rows declares a net-kind column or a net reference, so those
 *    rows' only booking cells are read and their money cannot sum into
 *    nothing (issue #1360). Every document carries a `reconcile` block (#1107):
 *    a closed one whose terms name declared columns and assigned row classes,
 *    or an unclosed one with a reason from the closed vocabulary; an anchor's
 *    summary and history name declared documents and its claim_row a value the
 *    history document's rows block assigns.
 * 3. Provenance (`provenance`): non-empty per file, and its URL set equals the
 *    file's manifest.json source_url set, so the two provenance homes cannot
 *    drift.
 * 4. Policy (`policy`): the free-text strings - provenance `what` and
 *    `sign_note` - carry no word from rules/policy.md's list, and neither does
 *    the directory README's prose, line by line with backticked spans stripped
 *    (a name in backticks is the platform label copied verbatim). Verbatim
 *    platform column, document, segment and row-value names are labels, not
 *    prose, and are exempt.
 *
 * Exits 1 on any problem. Makes no network call and reads only the rules tree.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { policyFilePhrases } from '../policy-file';

export type StatementProblemCode = 'schema' | 'invariant' | 'provenance' | 'policy';
export type StatementProblem = { code: StatementProblemCode; message: string };

// The closed vocabularies. Kinds are books roles, decoupled from gross/net
// membership: a column's kind says what it is to the books, while the gross and
// net references say which columns and row classes compose each figure. Shared
// with the one consumer of the same vocabularies, the statement figure function
// in src/platform-statements.ts — exported here so no second list can drift
// (issue #1106); SIGNS stays private to this checker.
export const KINDS = [
  'gross-component',
  'fee',
  'fee-traveler-side',
  'pass-through',
  'tax-platform-remitted',
  'tax-seller-remitted',
  'withholding',
  'incentive',
  'refund',
  'deposit',
  'net',
  'metadata',
];
export const CONFIDENCES = ['documented', 'partial', 'recalled'];
const SIGNS = ['positive', 'negative', 'varies'];
export const BASES = ['sum-of-components', 'stated-column'];
export const ROW_CLASSES = ['earning', 'refund', 'adjustment', 'payout', 'deposit'];
// The row classes whose rows book only their net cells (issues #1154, #1359): the figure
// function's kind loop gates through this list, and the loader and this checker refuse a
// document that assigns one of them but reads no net anywhere, so the rows' money cannot sum
// into nothing (issue #1360).
export const NET_CELLS_ROW_CLASSES = ['refund', 'adjustment', 'deposit'];
// The reconcile block's closed vocabularies (issue #1107), shared with the
// statement module's loader and reconciliation the way the column vocabularies
// above are.
export const RECONCILE_REASONS = ['no-component-identity', 'stated-net', 'no-net'];
export const RECONCILE_EQUALS = ['net', 'zero'];
export const RECONCILE_TERM_SIGNS = ['positive', 'negative'];
// The kinds a gross block may name as carried (issues #1150, #1151): money whose cells sit inside
// the gross block's cells on its rows. The figure function prints a carried pass-through nothing
// (the gross already books it) and a carried fee or platform-remitted tax as the fee figure (the
// platform kept it out of the gross), so only these three kinds have a carried meaning.
export const CARRIED_KINDS = ['fee', 'tax-platform-remitted', 'pass-through'];

const TOP_KEYS = ['platform', 'documents', 'provenance', 'payers', 'anchors'];
const DOCUMENT_KEYS = ['name', 'columns', 'gross', 'net', 'rows', 'segments', 'reconcile'];
const RECONCILE_CLOSED_KEYS = ['closed', 'equals', 'terms'];
const RECONCILE_OPEN_KEYS = ['closed', 'reason'];
const TERM_KEYS = ['column', 'rows', 'sign'];
const ANCHOR_KEYS = ['name', 'summary', 'history', 'claim_row'];
const COLUMN_KEYS = ['name', 'kind', 'confidence', 'sign', 'sign_note'];
const REFERENCE_KEYS = ['basis', 'columns', 'rows', 'carries'];
const ROWS_KEYS = ['column', 'classes'];
const SEGMENT_KEYS = ['name', 'rows', 'columns'];
const PROVENANCE_KEYS = ['url', 'what'];

type Json = Record<string, unknown>;

function isPlainObject(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string')
    : [];
}

/** The rows block's two faces: the discriminator values it names, the classes it assigns. */
type RowMap = { values: Set<string>; classes: Set<string> };

const NO_ROWS: RowMap = { values: new Set(), classes: new Set() };

class Problems {
  readonly list: StatementProblem[] = [];

  add(code: StatementProblemCode, path: string, message: string): void {
    this.list.push({ code, message: `${path} ${message}` });
  }

  /** Fails closed on an unknown key, naming the key and never a value. */
  keys(raw: Json, allowed: readonly string[], required: readonly string[], path: string): boolean {
    const unknown = Object.keys(raw).filter((key) => !allowed.includes(key));
    if (unknown.length > 0) {
      this.add('schema', path, `carries unknown keys: ${unknown.sort().join(', ')}`);
    }
    const missing = required.filter((key) => !(key in raw));
    if (missing.length > 0) {
      this.add('schema', path, `is missing keys: ${missing.sort().join(', ')}`);
      return false;
    }
    return unknown.length === 0;
  }
}

/**
 * Checks every platform statements file under every rules year the skill
 * carries against the declared schema, its internal references, its manifest
 * provenance and the policy wording list.
 */
export function checkPlatformStatements(skillDir: string): StatementProblem[] {
  const rulesDir = join(skillDir, 'rules');
  let years: string[];
  try {
    years = readdirSync(rulesDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && /^ty\d{4}$/.test(entry.name))
      .map((entry) => entry.name)
      .sort();
  } catch {
    return [{ code: 'schema', message: `${rulesDir} is not a readable directory` }];
  }
  const problems = new Problems();
  const files: { path: string; value: Json; sources: string[] }[] = [];
  const readmes: { path: string; lines: string[] }[] = [];
  for (const year of years) {
    collectYear(join(rulesDir, year), year, problems, files, readmes);
  }
  if (files.length === 0 && readmes.length === 0) return [];
  const banned = policyFilePhrases(skillDir);
  for (const file of files) checkFile(file, banned, problems);
  for (const readme of readmes) scanReadme(readme, banned, problems);
  return problems.list;
}

/**
 * The directory README is a rules file whose prose paraphrases platform help
 * text, so its lines are scanned too - with backticked spans stripped first,
 * because a name in backticks is the platform label copied verbatim, the same
 * exemption the JSON data's structural fields get. Names the file and line,
 * never the matched word.
 */
function scanReadme(
  readme: { path: string; lines: string[] },
  banned: readonly RegExp[],
  problems: Problems,
): void {
  for (const [index, line] of readme.lines.entries()) {
    policyScan(
      line.replace(/`[^`]*`/g, ' '),
      `${readme.path}:${String(index + 1)}`,
      banned,
      problems,
    );
  }
}

/** Loads one year's statements files with the manifest sources each must match. */
function collectYear(
  yearDir: string,
  year: string,
  problems: Problems,
  files: { path: string; value: Json; sources: string[] }[],
  readmes: { path: string; lines: string[] }[],
): void {
  const dir = join(yearDir, 'platform_statements');
  let names: string[];
  try {
    names = readdirSync(dir)
      .filter((name) => name.endsWith('.json'))
      .sort();
  } catch {
    return; // The year carries no platform statements; nothing to check.
  }
  try {
    const lines = readFileSync(join(dir, 'README.md'), 'utf8').split('\n');
    readmes.push({ path: `${year}/platform_statements/README.md`, lines });
  } catch {
    // The year carries no README; nothing to scan.
  }
  const manifest = loadManifest(yearDir, year, problems);
  for (const name of names) {
    const key = `platform_statements/${name}`;
    const path = `${year}/${key}`;
    let value: unknown;
    try {
      value = JSON.parse(readFileSync(join(dir, name), 'utf8')) as unknown;
    } catch {
      problems.add('schema', path, 'does not parse as JSON');
      continue;
    }
    if (!isPlainObject(value)) {
      problems.add('schema', path, 'must be a JSON object');
      continue;
    }
    files.push({ path, value, sources: manifest.get(key) ?? [] });
    if (!manifest.has(key)) {
      problems.add('provenance', path, 'is not listed in manifest.json with source_url entries');
    }
  }
}

/** The year manifest's files map, as platform_statements keys -> source_url lists. */
function loadManifest(yearDir: string, year: string, problems: Problems): Map<string, string[]> {
  const sources = new Map<string, string[]>();
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(join(yearDir, 'manifest.json'), 'utf8')) as unknown;
  } catch {
    problems.add('provenance', `${year}/manifest.json`, 'does not parse as JSON');
    return sources;
  }
  if (!isPlainObject(parsed) || !isPlainObject(parsed['files'])) {
    problems.add('provenance', `${year}/manifest.json`, 'does not name its files');
    return sources;
  }
  for (const [key, value] of Object.entries(parsed['files'])) {
    if (!Array.isArray(value)) continue;
    const urls: string[] = [];
    for (const entry of value) {
      if (isPlainObject(entry) && typeof entry['source_url'] === 'string') {
        urls.push(entry['source_url']);
      }
    }
    sources.set(key, urls);
  }
  return sources;
}

function checkFile(
  file: { path: string; value: Json; sources: string[] },
  banned: readonly RegExp[],
  problems: Problems,
): void {
  const { path, value } = file;
  if (!problems.keys(value, TOP_KEYS, ['platform', 'documents', 'provenance', 'payers'], path)) {
    return;
  }
  if (typeof value['platform'] !== 'string' || value['platform'].trim() === '') {
    problems.add('schema', `${path} platform`, 'must be a non-empty string');
  }
  const documents = checkDocuments(value, path, problems, banned);
  checkAnchors(value['anchors'], documents, path, problems);
  checkPayers(value['payers'], path, problems);
  checkProvenance(value, file, problems, banned);
}

function checkDocuments(
  value: Json,
  path: string,
  problems: Problems,
  banned: readonly RegExp[],
): Map<string, Set<string>> {
  const declared = new Map<string, Set<string>>();
  const documents = value['documents'];
  if (!Array.isArray(documents) || documents.length === 0) {
    problems.add('schema', `${path} documents`, 'must be a non-empty list');
    return declared;
  }
  for (const [index, raw] of documents.entries()) {
    const at = `${path} documents ${String(index)}`;
    if (!isPlainObject(raw)) {
      problems.add('schema', at, 'must be an object');
      continue;
    }
    if (!problems.keys(raw, DOCUMENT_KEYS, ['name', 'columns', 'reconcile'], at)) continue;
    const name = raw['name'];
    if (typeof name !== 'string' || name.trim() === '') {
      problems.add('schema', `${at} name`, 'must be a non-empty string');
    }
    const columns = declaredColumns(raw['columns'], at, problems, banned);
    const rows = declaredRowMap(raw['rows'], columns, at, problems);
    if (typeof name === 'string' && name.trim() !== '' && !declared.has(name)) {
      declared.set(name, rows.values);
    }
    checkReference(raw['gross'], 'gross', columns, rows.classes, at, problems);
    checkReference(raw['net'], 'net', columns, rows.classes, at, problems);
    if (
      NET_CELLS_ROW_CLASSES.some((klass) => rows.classes.has(klass)) &&
      ![...columns.values()].some((column) => column['kind'] === 'net') &&
      raw['net'] === undefined
    ) {
      problems.add(
        'invariant',
        at,
        'classes refund, adjustment or deposit rows but declares no net-kind column and no net reference; their money would sum into nothing',
      );
    }
    checkSegments(raw['segments'], columns, rows.values, at, problems);
    checkReconcile(raw['reconcile'], columns, rows.classes, raw['net'] !== undefined, at, problems);
  }
  return declared;
}

/** A document's declared columns, by name, each checked against the schema. */
function declaredColumns(
  raw: unknown,
  at: string,
  problems: Problems,
  banned: readonly RegExp[],
): Map<string, Json> {
  const columns = new Map<string, Json>();
  if (!Array.isArray(raw) || raw.length === 0) {
    problems.add('schema', `${at} columns`, 'must be a non-empty list');
    return columns;
  }
  for (const [index, item] of raw.entries()) {
    const columnAt = `${at} columns ${String(index)}`;
    if (!isPlainObject(item)) {
      problems.add('schema', columnAt, 'must be an object');
      continue;
    }
    if (!problems.keys(item, COLUMN_KEYS, ['name', 'kind', 'confidence'], columnAt)) continue;
    const name = item['name'];
    if (typeof name !== 'string' || name.trim() === '') {
      problems.add('schema', `${columnAt} name`, 'must be a non-empty string');
    } else if (columns.has(name)) {
      problems.add('schema', columnAt, 'repeats an earlier column name');
    } else {
      columns.set(name, item);
    }
    if (typeof item['kind'] !== 'string' || !KINDS.includes(item['kind'])) {
      problems.add('schema', `${columnAt} kind`, 'is outside the known column kinds');
    }
    if (typeof item['confidence'] !== 'string' || !CONFIDENCES.includes(item['confidence'])) {
      problems.add('schema', `${columnAt} confidence`, 'is outside the known confidences');
    }
    const sign = item['sign'];
    if (sign !== undefined && (typeof sign !== 'string' || !SIGNS.includes(sign))) {
      problems.add('schema', `${columnAt} sign`, 'is outside the known signs');
    }
    if (sign === 'varies') {
      const note = item['sign_note'];
      if (typeof note !== 'string' || note.trim() === '') {
        problems.add(
          'invariant',
          `${columnAt} sign_note`,
          'is required when sign is "varies": name what the column varies by',
        );
      } else {
        policyScan(note, `${columnAt} sign_note`, banned, problems);
      }
    } else if (item['sign_note'] !== undefined) {
      const note = item['sign_note'];
      if (typeof note !== 'string' || note.trim() === '') {
        problems.add('schema', `${columnAt} sign_note`, 'must be a non-empty string when present');
      } else {
        policyScan(note, `${columnAt} sign_note`, banned, problems);
      }
    }
  }
  return columns;
}

/** A document's rows block: the discriminator column and its value-to-class map. */
function declaredRowMap(
  raw: unknown,
  columns: Map<string, Json>,
  at: string,
  problems: Problems,
): RowMap {
  if (raw === undefined) return NO_ROWS;
  const rowsAt = `${at} rows`;
  if (!isPlainObject(raw) || !problems.keys(raw, ROWS_KEYS, ['column', 'classes'], rowsAt)) {
    return NO_ROWS;
  }
  if (typeof raw['column'] !== 'string' || !columns.has(raw['column'])) {
    problems.add('invariant', `${rowsAt} column`, 'names no declared column of its document');
  }
  const map = raw['classes'];
  if (!isPlainObject(map) || Object.keys(map).length === 0) {
    problems.add('schema', `${rowsAt} classes`, 'must be a non-empty object');
    return NO_ROWS;
  }
  const rows: RowMap = { values: new Set(Object.keys(map)), classes: new Set() };
  for (const klass of Object.values(map)) {
    if (typeof klass !== 'string' || !ROW_CLASSES.includes(klass)) {
      problems.add(
        'schema',
        `${rowsAt} classes`,
        'maps a value to a row class outside the known set',
      );
      continue;
    }
    rows.classes.add(klass);
  }
  return rows;
}

/** A gross or net reference: stated basis, declared columns, carried row classes. */
function checkReference(
  raw: unknown,
  label: 'gross' | 'net',
  columns: Map<string, Json>,
  classes: Set<string>,
  at: string,
  problems: Problems,
): void {
  if (raw === undefined) return;
  const refAt = `${at} ${label}`;
  if (!isPlainObject(raw)) {
    problems.add('schema', refAt, 'must be an object');
    return;
  }
  if (!problems.keys(raw, REFERENCE_KEYS, ['basis', 'columns'], refAt)) return;
  checkCarries(raw, label, columns, refAt, problems);
  if (typeof raw['basis'] !== 'string' || !BASES.includes(raw['basis'])) {
    problems.add('schema', `${refAt} basis`, 'is outside the known bases');
  }
  const named = stringList(raw['columns']);
  if (
    !Array.isArray(raw['columns']) ||
    raw['columns'].length === 0 ||
    named.length !== raw['columns'].length
  ) {
    problems.add('schema', `${refAt} columns`, 'must be a non-empty list of column names');
  } else {
    if (raw['basis'] === 'stated-column' && named.length !== 1) {
      problems.add(
        'schema',
        refAt,
        'declares basis "stated-column" but names more than one column',
      );
    }
    if (new Set(named).size !== named.length) {
      problems.add(
        'invariant',
        `${refAt} columns`,
        'repeats a column name; a doubled summand would be counted twice',
      );
    }
    for (const [index, name] of named.entries()) {
      if (!columns.has(name)) {
        problems.add(
          'invariant',
          `${refAt} columns ${String(index)}`,
          'names no declared column of its document',
        );
      }
    }
  }
  if (raw['rows'] === undefined) return;
  const namedClasses = stringList(raw['rows']);
  if (!Array.isArray(raw['rows']) || namedClasses.length !== raw['rows'].length) {
    problems.add('schema', `${refAt} rows`, 'must be a list of row classes');
    return;
  }
  for (const [index, klass] of namedClasses.entries()) {
    if (!ROW_CLASSES.includes(klass)) {
      problems.add('schema', `${refAt} rows ${String(index)}`, 'is outside the known row classes');
    } else if (!classes.has(klass)) {
      problems.add(
        'invariant',
        `${refAt} rows ${String(index)}`,
        "is a row class its document's rows block assigns to no value",
      );
    }
  }
}

/** A gross block's `carries` list: declared columns of a carried kind, each named once. */
function checkCarries(
  raw: Json,
  label: 'gross' | 'net',
  columns: Map<string, Json>,
  refAt: string,
  problems: Problems,
): void {
  if (raw['carries'] === undefined) return;
  const carriesAt = `${refAt} carries`;
  if (label === 'net') {
    problems.add('schema', carriesAt, 'is a gross-block key; a net block carries nothing');
    return;
  }
  const named = stringList(raw['carries']);
  if (
    !Array.isArray(raw['carries']) ||
    raw['carries'].length === 0 ||
    named.length !== raw['carries'].length
  ) {
    problems.add('schema', carriesAt, 'must be a non-empty list of column names');
    return;
  }
  if (new Set(named).size !== named.length) {
    problems.add('invariant', carriesAt, 'repeats a column name');
  }
  for (const [index, name] of named.entries()) {
    const kind = columns.get(name)?.['kind'];
    if (kind === undefined) {
      problems.add(
        'invariant',
        `${carriesAt} ${String(index)}`,
        'names no declared column of its document',
      );
    } else if (typeof kind !== 'string' || !CARRIED_KINDS.includes(kind)) {
      problems.add(
        'invariant',
        `${carriesAt} ${String(index)}`,
        'names a column of a kind a gross cannot carry',
      );
    }
  }
}

function checkSegments(
  raw: unknown,
  columns: Map<string, Json>,
  rowValues: Set<string>,
  at: string,
  problems: Problems,
): void {
  if (raw === undefined) return;
  if (!Array.isArray(raw)) {
    problems.add('schema', `${at} segments`, 'must be a list');
    return;
  }
  for (const [index, item] of raw.entries()) {
    const segmentAt = `${at} segments ${String(index)}`;
    if (!isPlainObject(item) || !problems.keys(item, SEGMENT_KEYS, ['name'], segmentAt)) continue;
    if (typeof item['name'] !== 'string' || item['name'].trim() === '') {
      problems.add('schema', `${segmentAt} name`, 'must be a non-empty string');
    }
    for (const [field, known, emptyNote] of [
      ['rows', rowValues, "names no value its document's rows block declares"],
      ['columns', new Set(columns.keys()), 'names no declared column of its document'],
    ] as const) {
      if (item[field] === undefined) continue;
      const named = stringList(item[field]);
      if (!Array.isArray(item[field]) || named.length !== item[field].length) {
        problems.add('schema', `${segmentAt} ${field}`, 'must be a list of names');
        continue;
      }
      if (new Set(named).size !== named.length) {
        problems.add('invariant', `${segmentAt} ${field}`, 'repeats a name');
      }
      for (const [entryIndex, name] of named.entries()) {
        if (!known.has(name)) {
          problems.add('invariant', `${segmentAt} ${field} ${String(entryIndex)}`, emptyNote);
        }
      }
    }
  }
}

/** A document's reconcile block (#1107): a closed identity whose terms name declared columns
 *  and assigned row classes, or an unclosed one with a reason from the closed vocabulary. A
 *  closed identity that equals the net names a net block to compare against. */
function checkReconcile(
  raw: unknown,
  columns: Map<string, Json>,
  classes: Set<string>,
  hasNetBlock: boolean,
  at: string,
  problems: Problems,
): void {
  if (!isPlainObject(raw)) {
    problems.add('schema', `${at} reconcile`, 'must be an object');
    return;
  }
  if (raw['closed'] === true) {
    if (!problems.keys(raw, RECONCILE_CLOSED_KEYS, RECONCILE_CLOSED_KEYS, `${at} reconcile`)) {
      return;
    }
    if (typeof raw['equals'] !== 'string' || !RECONCILE_EQUALS.includes(raw['equals'])) {
      problems.add('schema', `${at} reconcile equals`, 'is outside the known reconcile equals');
    } else if (raw['equals'] === 'net' && !hasNetBlock) {
      problems.add(
        'invariant',
        `${at} reconcile`,
        'declares equals "net" but its document declares no net block to compare against',
      );
    }
    const terms = raw['terms'];
    if (!Array.isArray(terms) || terms.length === 0) {
      problems.add('schema', `${at} reconcile terms`, 'must be a non-empty list');
      return;
    }
    for (const [index, term] of terms.entries()) {
      const termAt = `${at} reconcile terms ${String(index)}`;
      if (!isPlainObject(term) || !problems.keys(term, TERM_KEYS, ['column', 'sign'], termAt)) {
        continue;
      }
      if (typeof term['column'] !== 'string' || term['column'].trim() === '') {
        problems.add('schema', `${termAt} column`, 'must be a non-empty string');
      } else if (!columns.has(term['column'])) {
        problems.add('invariant', `${termAt} column`, 'names no declared column of its document');
      }
      if (typeof term['sign'] !== 'string' || !RECONCILE_TERM_SIGNS.includes(term['sign'])) {
        problems.add('schema', `${termAt} sign`, 'is outside the known reconcile term signs');
      }
      if (term['rows'] === undefined) continue;
      const namedClasses = stringList(term['rows']);
      if (!Array.isArray(term['rows']) || namedClasses.length !== term['rows'].length) {
        problems.add('schema', `${termAt} rows`, 'must be a list of row classes');
        continue;
      }
      for (const [classIndex, klass] of namedClasses.entries()) {
        if (!ROW_CLASSES.includes(klass)) {
          problems.add(
            'schema',
            `${termAt} rows ${String(classIndex)}`,
            'is outside the known row classes',
          );
        } else if (!classes.has(klass)) {
          problems.add(
            'invariant',
            `${termAt} rows ${String(classIndex)}`,
            "is a row class its document's rows block assigns to no value",
          );
        }
      }
    }
    return;
  }
  if (raw['closed'] === false) {
    if (!problems.keys(raw, RECONCILE_OPEN_KEYS, RECONCILE_OPEN_KEYS, `${at} reconcile`)) return;
    if (typeof raw['reason'] !== 'string' || !RECONCILE_REASONS.includes(raw['reason'])) {
      problems.add('schema', `${at} reconcile reason`, 'is outside the known unclosed reasons');
    }
    return;
  }
  problems.add('schema', `${at} reconcile closed`, 'must be true or false');
}

/** The file's anchors (#1107): each names declared summary and history documents, and its
 *  claim_row a value the history document's rows block declares - a platform label, the way
 *  segment row values are, so it is exempt from the policy scan. */
function checkAnchors(
  raw: unknown,
  declared: Map<string, Set<string>>,
  at: string,
  problems: Problems,
): void {
  if (raw === undefined) return;
  if (!Array.isArray(raw) || raw.length === 0) {
    problems.add('schema', `${at} anchors`, 'must be a non-empty list');
    return;
  }
  for (const [index, item] of raw.entries()) {
    const anchorAt = `${at} anchors ${String(index)}`;
    if (!isPlainObject(item) || !problems.keys(item, ANCHOR_KEYS, ANCHOR_KEYS, anchorAt)) continue;
    for (const field of ['name', 'summary', 'history', 'claim_row'] as const) {
      if (typeof item[field] !== 'string' || item[field].trim() === '') {
        problems.add('schema', `${anchorAt} ${field}`, 'must be a non-empty string');
      }
    }
    for (const [field, emptyNote] of [
      ['summary', 'names no declared document of its file'],
      ['history', 'names no declared document of its file'],
    ] as const) {
      const name = item[field];
      if (typeof name === 'string' && name.trim() !== '' && !declared.has(name)) {
        problems.add('invariant', `${anchorAt} ${field}`, emptyNote);
      }
    }
    const claimRow = item['claim_row'];
    const history = item['history'];
    if (
      typeof claimRow === 'string' &&
      claimRow.trim() !== '' &&
      typeof history === 'string' &&
      !declared.get(history)?.has(claimRow)
    ) {
      problems.add(
        'invariant',
        `${anchorAt} claim_row`,
        "names no value the history document's rows block declares",
      );
    }
  }
}

/** The file's 1099-K issuer phrases (#1107): a non-empty list of non-empty strings. A payer is
 *  the platform label copied verbatim off the cited page, so it is exempt from the policy scan. */
function checkPayers(raw: unknown, at: string, problems: Problems): void {
  const payers = raw;
  if (
    !Array.isArray(payers) ||
    payers.length === 0 ||
    !payers.every((entry) => typeof entry === 'string' && entry.trim() !== '')
  ) {
    problems.add('schema', `${at} payers`, 'must be a non-empty list of non-empty strings');
  }
}

function checkProvenance(
  value: Json,
  file: { path: string; sources: string[] },
  problems: Problems,
  banned: readonly RegExp[],
): void {
  const raw = value['provenance'];
  const at = `${file.path} provenance`;
  if (!Array.isArray(raw) || raw.length === 0) {
    problems.add('provenance', at, 'must be a non-empty list of { url, what } entries');
    return;
  }
  const urls: string[] = [];
  for (const [index, item] of raw.entries()) {
    const entryAt = `${at} ${String(index)}`;
    if (!isPlainObject(item) || !problems.keys(item, PROVENANCE_KEYS, ['url', 'what'], entryAt)) {
      continue;
    }
    const url = item['url'];
    if (typeof url !== 'string' || !url.startsWith('https://')) {
      problems.add('schema', `${entryAt} url`, 'must be an https URL');
    } else {
      urls.push(url);
    }
    const what = item['what'];
    if (typeof what !== 'string' || what.trim() === '') {
      problems.add('schema', `${entryAt} what`, 'must be a non-empty string');
    } else {
      policyScan(what, `${entryAt} what`, banned, problems);
    }
  }
  const fromFile = [...new Set(urls)].sort();
  const fromManifest = [...new Set(file.sources)].sort();
  if (
    fromFile.length !== fromManifest.length ||
    fromFile.some((url, index) => url !== fromManifest[index])
  ) {
    problems.add(
      'provenance',
      file.path,
      `carries ${String(fromFile.length)} provenance URL(s) while manifest.json lists ${String(fromManifest.length)} source_url(s) for it; the two sets must be equal`,
    );
  }
}

/** Names the path only, never the matched word. */
function policyScan(text: string, at: string, banned: readonly RegExp[], problems: Problems): void {
  for (const phrase of banned) {
    if (phrase.test(text)) {
      problems.add('policy', at, 'carries a word from the policy wording list');
      return;
    }
  }
}

function main(): void {
  const skillDir = join(__dirname, '..', '..');
  const problems = checkPlatformStatements(skillDir);
  if (problems.length > 0) {
    console.log('check_platform_statements failed; fix the named files and run again:');
    for (const match of problems) console.log(`  [${match.code}] ${match.message}`);
    process.exitCode = 1;
    return;
  }
  console.log('check_platform_statements: platform statement rules data clean');
}

if (require.main === module) {
  main();
}

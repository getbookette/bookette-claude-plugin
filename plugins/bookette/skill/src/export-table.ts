// A card or bank export's column roles, and the rows code reads with them (decision record 0177).
// A model that reads the sheet (the books agent in the personal tool, the reader in the SaaS)
// declares the table: which printed header row opens the rows, which field holds each role, how
// a date and a decimal print, and which sign means money out. Code reads every date and amount
// from the cells, and refuses a table its own figures contradict. No header word list decides a
// role.

/** How a date column prints a day: month first, day first or year first. */
export const DATE_ORDERS = ['MDY', 'DMY', 'YMD'] as const;
export type DateOrder = (typeof DATE_ORDERS)[number];

/** Which sign or column means money out: a negative amount, a positive amount (many card exports
 *  print a charge positive), or a debit column of its own. */
export const MONEY_OUT = ['negative', 'positive', 'debit_column'] as const;
export type MoneyOut = (typeof MONEY_OUT)[number];

export const TABLE_ROLES = [
  'date',
  'posted',
  'description',
  'amount',
  'debit',
  'credit',
  'balance',
  'currency',
  'account',
] as const;
export type TableRole = (typeof TABLE_ROLES)[number];

export type ExportTable = {
  /** The header row's cells as printed, or null when the export prints no header. */
  readonly header: readonly string[] | null;
  /** Each role's 0-based field position in a transaction record, or null. */
  readonly columns: Readonly<Record<TableRole, number | null>>;
  readonly date_order: DateOrder;
  readonly decimal_mark: '.' | ',';
  readonly money_out: MoneyOut;
};

/** Why code refuses a declared table. A code never carries a cell's value. */
export const TABLE_PROBLEMS = [
  'table_header_absent',
  'table_column_out_of_range',
  'table_roles',
  'table_no_rows',
  'table_date_unreadable',
  'table_amount_unreadable',
  'table_dates_unsorted',
  'table_debit_credit_both',
  'table_balance_mismatch',
  'table_sign_contradicts_balance',
  'table_amount_is_running_balance',
] as const;
export type TableProblem = (typeof TABLE_PROBLEMS)[number];

/** One transaction row as code read it under a table. */
export type TableRow = {
  /** The record's 0-based position among the sheet's records. */
  readonly record: number;
  readonly iso: string;
  /** Signed integer cents: money in positive, money out negative. */
  readonly cents: bigint;
  /** The cents as the cells sign them, before `money_out`: a credit column positive and a debit
   *  column negative. A key that must not move when a later table declares the sign otherwise. */
  readonly printedCents: bigint;
  readonly description: string;
  readonly currency: string;
  readonly account: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** A declared table as code reads it, or null when its shape is not one. */
export function exportTableOf(value: unknown): ExportTable | null {
  if (!isRecord(value)) return null;
  const header = value['header'];
  if (header !== null && !(Array.isArray(header) && header.every((x) => typeof x === 'string'))) {
    return null;
  }
  const columns = value['columns'];
  if (!isRecord(columns)) return null;
  const read: Partial<Record<TableRole, number | null>> = {};
  for (const role of TABLE_ROLES) {
    const at = columns[role] ?? null;
    if (at !== null && !(typeof at === 'number' && Number.isInteger(at) && at >= 0)) return null;
    read[role] = at;
  }
  const order = value['date_order'];
  const mark = value['decimal_mark'];
  const out = value['money_out'];
  if (!DATE_ORDERS.includes(order as DateOrder)) return null;
  if (mark !== '.' && mark !== ',') return null;
  if (!MONEY_OUT.includes(out as MoneyOut)) return null;
  return {
    header: header as readonly string[] | null,
    columns: read as Record<TableRole, number | null>,
    date_order: order as DateOrder,
    decimal_mark: mark,
    money_out: out as MoneyOut,
  };
}

/** RFC 4180 records: quoted fields keep commas, newlines and doubled quotes; CRLF or LF ends a
 *  record; a byte-order mark is dropped. */
export function parseCsv(text: string): string[][] {
  const records: string[][] = [];
  let record: string[] = [];
  let field = '';
  let quoted = false;
  const source = text.startsWith('﻿') ? text.slice(1) : text;
  for (let index = 0; index < source.length; index++) {
    const char = source[index] ?? '';
    if (quoted) {
      if (char !== '"') field += char;
      else if (source[index + 1] === '"') {
        field += '"';
        index += 1;
      } else quoted = false;
    } else if (char === '"') quoted = true;
    else if (char === ',') {
      record.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && source[index + 1] === '\n') index += 1;
      record.push(field);
      records.push(record);
      record = [];
      field = '';
    } else field += char;
  }
  if (field !== '' || record.length > 0) {
    record.push(field);
    records.push(record);
  }
  return records;
}

/** The heading line code writes above each sheet of a workbook's tabbed text and of every
 *  prepared spreadsheet page (packages/parsers `pageText`). */
export const SHEET_HEADING = '## Sheet:';

/** A sheet's records: a CSV's RFC 4180 records, or the sheet reader's tabbed lines for a workbook,
 *  each `## Sheet:` heading kept as a one-cell record that bounds its sheet. */
export function sheetRecords(text: string, tabbed: boolean): string[][] {
  if (!tabbed) return parseCsv(text);
  return text
    .split(/\r?\n/)
    .filter((line) => line.trim() !== '')
    .map((line) => (line.startsWith(SHEET_HEADING) ? [line] : line.split('\t')));
}

const isSheetHeading = (record: readonly string[]): boolean =>
  record.length === 1 && (record[0] ?? '').startsWith(SHEET_HEADING);

/** The record ranges of each sheet, its heading left out: a CSV is one sheet. */
function sheetsOf(records: readonly (readonly string[])[]): { from: number; to: number }[] {
  const sheets: { from: number; to: number }[] = [];
  let from = 0;
  for (let at = 0; at <= records.length; at++) {
    if (at < records.length && !isSheetHeading(records[at] ?? [])) continue;
    if (at > from) sheets.push({ from, to: at });
    from = at + 1;
  }
  return sheets;
}

/** A cell an export prints for nothing: blank, a dash or N/A. */
const NOTHING = /^(?:[-\u2013\u2014]+|n\/?a)?$/i;

function calendarDay(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const at = new Date(Date.UTC(year, month - 1, day));
  if (at.getUTCMonth() !== month - 1 || at.getUTCDate() !== day) return null;
  return at.toISOString().slice(0, 10);
}

/** A time of day printed after a date (`10:32`, `, 10:32 p.m.`, `10:32:07 -0500`, `T10:32:00Z`,
 *  `10:32 EST`). The date is read as printed; the time is never converted. */
const TIME_OF_DAY =
  /,?[ T]\d{1,2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:\s?[AaPp]\.?[Mm]\.?)?(?:\s?(?:Z|(?:UTC|GMT)?[+-]\d{1,2}(?::?\d{2})?|[A-Z]{2,4}))?$/;

/** A cell's date as ISO under a date order (`/`, `.` or `-` between the parts; a two-digit year
 *  is this century's; a time of day after it is set aside), or null. */
export function tableDate(cell: string, order: DateOrder): string | null {
  const text = cell.trim().replace(TIME_OF_DAY, '');
  if (order === 'YMD') {
    const ymd = /^(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})$/.exec(text);
    return ymd === null ? null : calendarDay(Number(ymd[1]), Number(ymd[2]), Number(ymd[3]));
  }
  const parts = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/.exec(text);
  if (parts === null) return null;
  const [first, second, third] = [parts[1] ?? '', parts[2] ?? '', parts[3] ?? ''];
  const year = third.length === 2 ? 2000 + Number(third) : Number(third);
  return order === 'MDY'
    ? calendarDay(year, Number(first), Number(second))
    : calendarDay(year, Number(second), Number(first));
}

const GROUPED: Record<'.' | ',', RegExp> = {
  '.': /^(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?$/,
  ',': /^(?:\d{1,3}(?:\.\d{3})+|\d+)(?:,\d{1,2})?$/,
};

/** Whether any record carries a cell that is a date in some order: a sheet with none has no
 *  transaction row under any table. */
export function hasDatedRecord(records: readonly (readonly string[])[]): boolean {
  return records.some((record) =>
    record.some((cell) => DATE_ORDERS.some((order) => tableDate(cell, order) !== null)),
  );
}

/** A cell's amount as signed integer cents, with its money dressing set aside (a currency sign or
 *  code, spaces, thousands separators, parentheses, a leading or trailing minus); null otherwise. */
export function tableCents(cell: string, mark: '.' | ','): bigint | null {
  let text = cell
    .trim()
    .replace(/\b[A-Z]{3}\b/g, '')
    .replace(/[$€£¥\s]/g, '')
    .replace(/−/g, '-');
  if (text === '') return null;
  let negative = false;
  if (/^\(.*\)$/.test(text)) {
    negative = true;
    text = text.slice(1, -1);
  }
  if (text.startsWith('-')) {
    negative = !negative;
    text = text.slice(1);
  } else if (text.startsWith('+')) text = text.slice(1);
  if (text.endsWith('-')) {
    negative = !negative;
    text = text.slice(0, -1);
  }
  if (!GROUPED[mark].test(text)) return null;
  const plain = mark === '.' ? text.replace(/,/g, '') : text.replace(/\./g, '').replace(',', '.');
  const [whole = '', fraction = ''] = plain.split('.');
  const cents = BigInt(whole) * 100n + BigInt(`${fraction}00`.slice(0, 2));
  return negative ? -cents : cents;
}

const trimmed = (cells: readonly string[]): string[] => cells.map((cell) => cell.trim());

function sameCells(a: readonly string[], b: readonly string[]): boolean {
  const left = trimmed(a);
  const right = trimmed(b);
  while (left.length > 0 && left.at(-1) === '') left.pop();
  while (right.length > 0 && right.at(-1) === '') right.pop();
  return left.length === right.length && left.every((cell, index) => cell === right[index]);
}

function sorted(isos: readonly string[]): boolean {
  let up = true;
  let down = true;
  for (let index = 1; index < isos.length; index++) {
    const [before, after] = [isos[index - 1] ?? '', isos[index] ?? ''];
    if (after < before) up = false;
    if (after > before) down = false;
  }
  return up || down;
}

/**
 * Whether `balances` runs as a balance of `amounts` (money in raising it) in either print order,
 * with `sign` -1 when it runs only with every amount's sign flipped. A row may print no balance
 * (null), as a bank printing one per day does: two printed balances then differ by the rows
 * between them. Needs `least` printed balances.
 */
function runsAsBalance(
  balances: readonly (bigint | null)[],
  amounts: readonly bigint[],
  sign: 1n | -1n,
  least: number,
  order: PrintOrder,
): boolean {
  const printed = balances.flatMap((value, at) => (value === null ? [] : [{ at, value }]));
  if (printed.length < least) return false;
  const sum = (from: number, to: number): bigint =>
    amounts.slice(from, to).reduce((total, cents) => total + cents, 0n);
  let ascending = true;
  let descending = true;
  for (let index = 1; index < printed.length; index++) {
    const [before, after] = [printed[index - 1], printed[index]];
    if (before === undefined || after === undefined) continue;
    if (after.value - before.value !== sign * sum(before.at + 1, after.at + 1)) ascending = false;
    if (before.value - after.value !== sign * sum(before.at, after.at)) descending = false;
    if (!ascending && !descending) break;
  }
  return (order !== 'descending' && ascending) || (order !== 'ascending' && descending);
}

/** Which way a sheet prints its rows, from their dates: oldest first, newest first, or either
 *  when every row shares one day. */
type PrintOrder = 'ascending' | 'descending' | 'either';

function printOrderOf(isos: readonly string[]): PrintOrder {
  const first = isos[0] ?? '';
  const last = isos.at(-1) ?? '';
  return first < last ? 'ascending' : first > last ? 'descending' : 'either';
}

/**
 * The transaction rows a declared table reads from a sheet's records, and every problem code with
 * the table. A row is a record below the header whose date cell is a date in some order; each
 * must read under the table, so a footer, a preamble line or a repeated header is passed over and
 * a wrong date order or amount column is refused rather than read short.
 */
export function readExportTable(
  records: readonly (readonly string[])[],
  table: ExportTable,
): { rows: TableRow[]; header: number | null; problems: TableProblem[] } {
  const problems = new Set<TableProblem>();
  const { columns } = table;
  const debitCredit = columns.debit !== null || columns.credit !== null;
  if (
    columns.date === null ||
    (columns.amount === null) === !debitCredit ||
    (table.money_out === 'debit_column') !== debitCredit
  ) {
    return { rows: [], header: null, problems: ['table_roles'] };
  }
  let header: number | null = null;
  if (table.header !== null) {
    const cells = table.header;
    const at = records.findIndex((record) => sameCells(record, cells));
    if (at < 0) return { rows: [], header, problems: ['table_header_absent'] };
    header = at;
  }
  // A table reads its own sheet, then every later sheet that repeats its header (a statement
  // continued over sheets); a sheet that does not, such as a summary, is passed over. A headerless
  // table reads its first sheet.
  const sheets = sheetsOf(records);
  const own =
    header === null ? 0 : sheets.findIndex(({ from, to }) => header >= from && header < to);
  const spans: { from: number; to: number }[] = [];
  const ownSheet = sheets[own];
  if (ownSheet !== undefined) {
    spans.push({ from: header === null ? ownSheet.from : header + 1, to: ownSheet.to });
  }
  const cells = table.header;
  if (cells !== null) {
    for (const sheet of sheets.slice(own + 1)) {
      const repeat = records
        .slice(sheet.from, sheet.to)
        .findIndex((record) => sameCells(record, cells));
      if (repeat >= 0) spans.push({ from: sheet.from + repeat + 1, to: sheet.to });
    }
  }
  const width = [
    ...(header === null ? [] : [records[header] ?? []]),
    ...spans.flatMap(({ from, to }) => records.slice(from, to)),
  ].reduce((widest, record) => Math.max(widest, record.length), 0);
  if (TABLE_ROLES.some((role) => (columns[role] ?? -1) >= width)) {
    return { rows: [], header, problems: ['table_column_out_of_range'] };
  }
  const dateAt = columns.date;
  const field = (record: readonly string[], role: TableRole): string => {
    const at = columns[role];
    return at === null ? '' : (record[at] ?? '');
  };
  const money = (record: readonly string[], role: TableRole): bigint | null =>
    tableCents(field(record, role), table.decimal_mark);
  const rows: TableRow[] = [];
  const read: (readonly string[])[] = [];
  for (const { from, to } of spans)
    for (let index = from; index < to; index++) {
      const record = records[index] ?? [];
      const cell = record[dateAt] ?? '';
      if (!DATE_ORDERS.some((order) => tableDate(cell, order) !== null)) continue;
      const iso = tableDate(cell, table.date_order);
      if (iso === null) {
        problems.add('table_date_unreadable');
        continue;
      }
      let printed: bigint | null;
      if (!debitCredit) printed = money(record, 'amount');
      else {
        const debit = money(record, 'debit');
        const credit = money(record, 'credit');
        const abs = (value: bigint | null): bigint =>
          value === null || value >= 0n ? (value ?? 0n) : -value;
        // A cell that prints something it cannot read is unreadable, never a zero beside the other.
        const unread = (role: TableRole, value: bigint | null): boolean =>
          value === null && !NOTHING.test(field(record, role).trim());
        if ((debit ?? 0n) !== 0n && (credit ?? 0n) !== 0n) problems.add('table_debit_credit_both');
        printed =
          (debit === null && credit === null) || unread('debit', debit) || unread('credit', credit)
            ? null
            : abs(credit) - abs(debit);
      }
      if (printed === null) {
        problems.add('table_amount_unreadable');
        continue;
      }
      const cents = table.money_out === 'positive' ? -printed : printed;
      rows.push({
        record: index,
        iso,
        cents,
        printedCents: printed,
        description: field(record, 'description').trim(),
        currency: field(record, 'currency').trim(),
        account: field(record, 'account').trim(),
      });
      read.push(record);
    }
  if (rows.length === 0) problems.add('table_no_rows');
  const isos = rows.map((row) => row.iso);
  if (!sorted(isos)) {
    for (const order of DATE_ORDERS) {
      if (order === table.date_order) continue;
      const other = read.map((record) => tableDate(record[dateAt] ?? '', order));
      const readsEvery = (isos: readonly (string | null)[]): isos is readonly string[] =>
        isos.every((iso) => iso !== null);
      if (readsEvery(other) && sorted(other)) {
        problems.add('table_dates_unsorted');
      }
    }
  }
  const amounts = rows.map((row) => row.cents);
  if (columns.balance !== null && rows.length > 0) {
    const balances = read.map((record) => money(record, 'balance'));
    const balanceUnreadable = read.some(
      (record, at) => balances[at] === null && !NOTHING.test(field(record, 'balance').trim()),
    );
    if (balanceUnreadable || balances.every((value) => value === null)) {
      problems.add('table_balance_mismatch');
    } else if (balances.filter((value) => value !== null).length >= 2) {
      // Two printed balances already bound the rows between them.
      const order = printOrderOf(isos);
      if (!runsAsBalance(balances, amounts, 1n, 2, order)) {
        problems.add(
          runsAsBalance(balances, amounts, -1n, 2, order)
            ? 'table_sign_contradicts_balance'
            : 'table_balance_mismatch',
        );
      }
    }
  }
  const amountColumns = [columns.amount, columns.debit, columns.credit].filter(
    (at): at is number => at !== null,
  );
  // A constant column carries no running signal: a rent deposit printed every month beside a
  // fee column of zeros is no running balance.
  const varies = (values: readonly bigint[]): boolean =>
    values.some((value) => value !== values[0]);
  for (const at of amountColumns) {
    const column = read.map((record) => tableCents(record[at] ?? '', table.decimal_mark) ?? 0n);
    if (!varies(column)) continue;
    for (let other = 0; other < width; other++) {
      if (other === at) continue;
      const cells = read.map((record) => tableCents(record[other] ?? '', table.decimal_mark));
      if (cells.some((value) => value === null)) continue;
      const known = cells as bigint[];
      if (!varies(known)) continue;
      if (
        runsAsBalance(column, known, 1n, 3, 'either') ||
        runsAsBalance(column, known, -1n, 3, 'either')
      ) {
        problems.add('table_amount_is_running_balance');
      }
    }
  }
  return { rows, header, problems: TABLE_PROBLEMS.filter((code) => problems.has(code)) };
}

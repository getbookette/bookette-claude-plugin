/**
 * The schedules: the ledger placed onto each entity's Schedule C or E lines and K-1 boxes, a line
 * with no entity listed as unassigned, and the per-entity report with its line totals. Every
 * other module that books a figure (the register's depreciation, a property-tax piece, the chosen
 * home-office reading) books it onto these same lines, never into the ledger.
 */
import { ledgerTagOf } from '../capital-costs';
import { isValidDay } from '../dates';
import { addCents, fmtCents, parseDec, type Dec } from '../money';
import type { TaggedLine } from '../scripts/capital_costs';
import { FxError } from '../scripts/fx';
import { fxFactsOf, fxUsedRow, type Convert, type FxFacts } from './fx-use';
import { asArray, asObject, named, strOrNull, text, type Json } from './values';

/**
 * One placed figure on a line or K-1 box: a ledger item, the register's depreciation booking,
 * or a property-tax payment's piece for one parcel (issue #110) - never a ledger row, so it
 * carries the payment's date and source beside the parcel it names.
 */
export type Entry =
  | { ledger_id: string; usd_cents: number; fx: FxFacts | null }
  | { depreciation: string; usd_cents: number; fx: null }
  | {
      tax: string;
      usd_cents: number;
      date: string;
      source_file: string | null;
      steps: string[];
    };
export type Slot = { label: string; total: bigint; entries: Entry[] };
export type BoxSlot = { total: bigint; entries: Entry[] };
export type Book = {
  key: string;
  name: unknown;
  kind: unknown;
  schedule: unknown;
  lines: Map<string, Slot>;
  k1_boxes: Map<string, BoxSlot>;
};

/** A figure another module books onto an entity's schedule line, beside the ledger's own. */
export interface LineBooking {
  readonly entity: string;
  readonly line: string;
  readonly cents: bigint;
  readonly entry: Entry;
}

/** One empty book per profile entity, in the profile's order. */
export function openBooks(entities: ReadonlyMap<string, Json>): Map<string, Book> {
  const books = new Map<string, Book>();
  for (const [key, entity] of entities) {
    books.set(key, {
      key,
      name: entity.name,
      kind: entity.kind,
      schedule: entity.schedule,
      lines: new Map(),
      k1_boxes: new Map(),
    });
  }
  return books;
}

export function requireBook(books: ReadonlyMap<string, Book>, key: string): Book {
  const book = books.get(key);
  if (book === undefined) throw new Error(`unknown entity ${key}`);
  return book;
}

/** The schedule line's label in the rules file, or the empty string. */
export function lineLabel(scheduleLines: Json, schedule: string | null, line: string): string {
  return text(asObject(scheduleLines[schedule ?? ''])[line]);
}

/** The schedule's income lines; a schedule with no income_lines entry (K-1) classifies nothing. */
export function incomeLinesOf(scheduleLines: Json, schedule: string | null): string[] {
  return schedule === 'C' || schedule === 'E'
    ? (asArray(asObject(scheduleLines.income_lines)[schedule]) as string[])
    : [];
}

/** Add one entry to a line, opening the line under `label` when the book has no entry on it. */
export function addToLine(
  book: Book,
  line: string,
  label: string,
  cents: bigint,
  entry: Entry,
): void {
  const slot = book.lines.get(line) ?? { label, total: 0n, entries: [] };
  slot.total = addCents(slot.total, cents);
  slot.entries.push(entry);
  book.lines.set(line, slot);
}

/** Book each figure onto its entity's line, in order, labelled by the entity's schedule. */
export function bookOnLines(
  books: ReadonlyMap<string, Book>,
  scheduleLines: Json,
  bookings: readonly LineBooking[],
): void {
  for (const booking of bookings) {
    const book = requireBook(books, booking.entity);
    const label = lineLabel(scheduleLines, strOrNull(book.schedule), booking.line);
    addToLine(book, booking.line, label, booking.cents, booking.entry);
  }
}

export interface LedgerInputs {
  readonly ledger: readonly Json[];
  readonly taxYear: number;
  readonly entities: ReadonlyMap<string, Json>;
  readonly trips: ReadonlyMap<string, Json>;
  readonly vehicles: ReadonlyMap<string, Json>;
  readonly scheduleLines: Json;
  readonly convert: Convert;
}

export interface LedgerPlacement {
  readonly books: Map<string, Book>;
  /** The distinct ledger ids read. */
  readonly ledgerItems: number;
  readonly unassigned: Json[];
  /** The lines the person settled (issue #1153), each `{id, amount, currency}` as printed, in
   *  ledger order: in no total, no book and the unassigned block neither. */
  readonly settled: Json[];
  readonly fxUsed: Json[];
  /** Meal ids by trip key, `_no_trip` for a meal on no trip, in ledger order. */
  readonly mealsByTrip: Map<string, string[]>;
  readonly usdByMeal: Map<string, bigint>;
  /** The improvement-or-repair comparison's inputs (issue #691): every expense line booked on a
   *  property or business whose tag says capital or repair, in ledger order. */
  readonly taggedLines: TaggedLine[];
  /** The vehicle comparison's inputs (issue #110): each profile vehicle's attributed lines. */
  readonly vehicleLines: Map<string, { id: string; cents: bigint }[]>;
  /** Lines naming a vehicle the profile does not carry. */
  readonly strayVehicleLines: string[];
  /** The lines dated outside the tax year (decision record 0148), in ledger order: each with its
   *  printed amount and currency, the place and the schedule line it would have taken, and in no
   *  book, no total and no comparison's inputs. */
  readonly outsideYear: Json[];
  /** The in-year lines the run's rates cannot price (decision record 0159), in ledger order:
   *  each with its printed amount and currency, the place and the schedule line it will take,
   *  and in no book, no total, no rate row and no comparison's inputs. */
  readonly unpriced: Json[];
  readonly ledgerTotal: bigint;
  readonly placedTotal: bigint;
  readonly errors: string[];
}

/**
 * Every ledger item converted to USD and placed on its entity's line or K-1 box, or unassigned.
 * The tax year is a cut (decision record 0148): a line whose date falls in another year is checked
 * like any other and then listed in `outsideYear` with the place and line it would have taken,
 * never converted, placed, totalled or handed to a comparison. A settled line (issue #1153) is
 * settled first, whatever its date: it is in no total either way, and listing it twice would show
 * one figure in two places. An in-year line whose currency no rate on record covers (decision
 * record 0159) is checked like any other and then listed in `unpriced` with the place and line it
 * will take, carried with its printed amount and counted in nothing.
 */
export function placeLedger(inputs: LedgerInputs): LedgerPlacement {
  const { ledger, taxYear, entities, trips, vehicles, scheduleLines, convert } = inputs;
  const errors: string[] = [];
  const books = openBooks(entities);
  const seenIds = new Set<string>();
  const unassigned: Json[] = [];
  const settled: Json[] = [];
  const outsideYear: Json[] = [];
  const unpriced: Json[] = [];
  const fxUsed: Json[] = [];
  const mealsByTrip = new Map<string, string[]>();
  const usdByMeal = new Map<string, bigint>();
  const taggedLines: TaggedLine[] = [];
  const vehicleLines = new Map<string, { id: string; cents: bigint }[]>();
  const strayVehicleLines: string[] = [];
  let ledgerTotal = 0n;
  let placedTotal = 0n;

  for (const item of ledger) {
    const itemId = strOrNull(item.id);
    if (!itemId || seenIds.has(itemId)) {
      errors.push(`missing or duplicate id: ${named(itemId)}`);
      continue;
    }
    seenIds.add(itemId);
    let amount: Dec;
    let day = '';
    try {
      amount = parseDec(text(item.amount));
      day = text(item.date);
      if (!isValidDay(day)) throw new Error('bad date');
    } catch {
      errors.push(`${itemId}: bad amount or date`);
      continue;
    }
    const kind = strOrNull(item.kind);
    // A settled line (issue #1153) is the person's answer that its figure is already inside the
    // income column: listed for the record with its printed amount and currency, never converted
    // (so a foreign line with no rate does not stop the build, and no rate row shows a rate it
    // never used), never placed and counted in no total.
    if (item.settled === true) {
      settled.push({
        id: itemId,
        amount: text(item.amount),
        currency: strOrNull(item.currency) ?? 'USD',
      });
      continue;
    }
    // A line dated outside the tax year is never converted either: it is in no total, so a rate
    // its date lacks does not stop the build, and its register row carries the amount as printed.
    // Its vehicle citation is still checked: one the profile does not carry warns like any other,
    // while one it carries attributes nothing, so no vehicle comparison counts the line.
    const inYear = Number(day.slice(0, 4)) === taxYear;
    const listOutside = (entity: string | null, schedule: string | null, line: string | null) => {
      const vehicleKey = strOrNull(item.vehicle);
      if (vehicleKey !== null && !vehicles.has(vehicleKey)) strayVehicleLines.push(itemId);
      outsideYear.push({
        kind: 'line',
        id: itemId,
        date: day,
        vendor: strOrNull(item.vendor),
        description: strOrNull(item.description),
        source_file: strOrNull(item.source_file),
        amount: text(item.amount),
        currency: strOrNull(item.currency) ?? 'USD',
        entity,
        schedule,
        line,
        label: line === null ? '' : lineLabel(scheduleLines, schedule, line),
      });
    };
    // The unpriced row (decision record 0159) mirrors the outside-year line's shape: its vehicle
    // citation is checked like any other line's, warned when stray and never attributed, so no
    // vehicle comparison counts the line.
    const listUnpriced = (entity: string | null, schedule: string | null, line: string | null) => {
      const vehicleKey = strOrNull(item.vehicle);
      if (vehicleKey !== null && !vehicles.has(vehicleKey)) strayVehicleLines.push(itemId);
      unpriced.push({
        id: itemId,
        date: day,
        vendor: strOrNull(item.vendor),
        amount: text(item.amount),
        currency: strOrNull(item.currency) ?? 'USD',
        entity,
        schedule,
        line,
        label: line === null ? '' : lineLabel(scheduleLines, schedule, line),
      });
    };
    let cents = 0n;
    let info: Json | null = null;
    // A rate neither the run's snapshot nor the rules data has does not stop the build (decision
    // record 0159): the line is carried unpriced through the placement checks below and listed
    // where it would have been placed. A broken snapshot or any other failure is still an error.
    let unpricedLine = false;
    if (inYear) {
      try {
        const converted = convert(strOrNull(item.currency) ?? 'USD', day, amount);
        cents = converted.cents;
        info = converted.info;
      } catch (error) {
        if (error instanceof FxError && (error.code === 'no_rate' || error.code === 'no_source')) {
          unpricedLine = true;
        } else {
          errors.push(`${itemId}: ${(error as Error).message}`);
          continue;
        }
      }
      if (!unpricedLine) {
        if (info) fxUsed.push(fxUsedRow(itemId, text(item.amount), cents, info));
        ledgerTotal = addCents(ledgerTotal, cents);
      }
    }
    // Every placed figure carries its USD cents and, when the amount was converted,
    // the conversion facts the fx_used row carries.
    const fx = fxFactsOf(text(item.amount), info);
    const line = item.line === null || item.line === undefined ? null : text(item.line);

    // A line names its vehicle by the profile's key (issue #110); the attribution is the
    // vehicle comparison's input and changes no placement. An in-year line with no entity never
    // reaches the placement below, so it resolves its citation there first - attributed, or
    // warned like any other dropped-vehicle citation - and a line dated outside the tax year
    // resolves its own in `listOutside` above (warned when stray, never attributed).
    const attributeVehicle = (id: string): void => {
      const vehicleKey = strOrNull(item.vehicle);
      if (vehicleKey === null) return;
      if (vehicles.has(vehicleKey)) {
        vehicleLines.set(vehicleKey, [...(vehicleLines.get(vehicleKey) ?? []), { id, cents }]);
      } else {
        strayVehicleLines.push(id);
      }
    };
    const entityKey = strOrNull(item.entity);
    // Status does not decide placement (issue #314): confirmed, flagged and unclassified all
    // place, and only a line with no entity is unassigned - its word is not a reason.
    if (entityKey === null) {
      if (!inYear) {
        listOutside(null, strOrNull(item.schedule), line);
        continue;
      }
      if (unpricedLine) {
        listUnpriced(null, strOrNull(item.schedule), line);
        continue;
      }
      unassigned.push({ id: itemId, usd: fmtCents(cents), reason: 'no entity' });
      placedTotal = addCents(placedTotal, cents);
      attributeVehicle(itemId);
      continue;
    }
    const entity = entities.get(entityKey);
    if (!entity) {
      errors.push(`${itemId}: unknown entity ${entityKey}`);
      continue;
    }
    const schedule = strOrNull(item.schedule);
    const entitySchedule = strOrNull(entity.schedule);
    if (schedule !== entitySchedule) {
      errors.push(
        `${itemId}: schedule ${named(schedule)} does not match entity ${named(entityKey)} (${named(entitySchedule)})`,
      );
      continue;
    }

    if (schedule === 'K1') {
      if (kind !== 'k1_income') {
        errors.push(`${itemId}: K1 entity items must be kind k1_income`);
        continue;
      }
      if (line === null) {
        errors.push(`${itemId}: K1 items require the box number in line`);
        continue;
      }
      if (!inYear) {
        listOutside(entityKey, schedule, line);
        continue;
      }
      if (unpricedLine) {
        listUnpriced(entityKey, schedule, line);
        continue;
      }
      const book = requireBook(books, entityKey);
      const box: BoxSlot = book.k1_boxes.get(line) ?? { total: 0n, entries: [] };
      box.total = addCents(box.total, cents);
      box.entries.push({ ledger_id: itemId, usd_cents: Number(cents), fx });
      book.k1_boxes.set(line, box);
      placedTotal = addCents(placedTotal, cents);
      continue;
    }

    const scheduleTable = asObject(scheduleLines[schedule ?? '']);
    if (line === null || !Object.hasOwn(scheduleTable, line)) {
      errors.push(`${itemId}: line ${named(line)} is not a Schedule ${named(schedule)} line`);
      continue;
    }
    const isIncomeLine = (
      asArray(asObject(scheduleLines.income_lines)[schedule ?? '']) as string[]
    ).includes(line);
    if ((kind === 'income') !== isIncomeLine) {
      errors.push(`${itemId}: kind ${named(kind)} does not fit line ${named(line)}`);
      continue;
    }
    const tripKey = strOrNull(item.trip);
    if (tripKey !== null && !trips.has(tripKey)) {
      errors.push(`${itemId}: unknown trip ${named(tripKey)}`);
      continue;
    }
    if (!inYear) {
      listOutside(entityKey, schedule, line);
      continue;
    }
    if (unpricedLine) {
      listUnpriced(entityKey, schedule, line);
      continue;
    }

    addToLine(requireBook(books, entityKey), line, text(scheduleTable[line]), cents, {
      ledger_id: itemId,
      usd_cents: Number(cents),
      fx,
    });
    placedTotal = addCents(placedTotal, cents);
    const tag = ledgerTagOf(item.tag);
    if (tag !== null && kind === 'expense' && cents > 0n) {
      taggedLines.push({ id: itemId, entity: entityKey, date: day, cents, tag });
    }
    if (item.meal === true) {
      const bucket = tripKey ?? '_no_trip';
      mealsByTrip.set(bucket, [...(mealsByTrip.get(bucket) ?? []), itemId]);
      usdByMeal.set(itemId, cents);
    }
    // The placed line's own citation: the same resolution the early exit above runs.
    attributeVehicle(itemId);
  }

  return {
    books,
    ledgerItems: seenIds.size,
    unassigned,
    settled,
    outsideYear,
    unpriced,
    fxUsed,
    mealsByTrip,
    usdByMeal,
    taggedLines,
    vehicleLines,
    strayVehicleLines,
    ledgerTotal,
    placedTotal,
    errors,
  };
}

/** Form order for Schedule line codes: shorter first, then lexicographic. */
function lineOrder(a: string, b: string): number {
  return a.length - b.length || (a < b ? -1 : a > b ? 1 : 0);
}

/** The entity's classified totals: income lines against everything else. */
function bookTotals(
  book: Book,
  incomeLines: readonly string[],
): { income: bigint; expenses: bigint } {
  let income = 0n;
  let expenses = 0n;
  for (const [line, slot] of book.lines) {
    if (incomeLines.includes(line)) income = addCents(income, slot.total);
    else expenses = addCents(expenses, slot.total);
  }
  return { income, expenses };
}

/**
 * The combined figures the report's tables persist beside the per-entity rows (issue #1112):
 * the year's organized expenses over every Schedule C and E entity, and the Schedule E
 * worksheet's own combined column — each line's total across the rental entities, the combined
 * line 20 and the combined line 26. Computed here, from the same bigints the per-entity totals
 * hold, so the report screen reads them and never sums. Shaped as books.json writes it.
 */
export function combinedTotals(
  books: ReadonlyMap<string, Book>,
  scheduleLines: Json,
): { expense_total_cents: number; schedule_e_totals: Json } {
  let expenseTotal = 0n;
  const eLines = new Map<string, bigint>();
  let eExpenses = 0n;
  let eNets = 0n;
  for (const book of books.values()) {
    const schedule = strOrNull(book.schedule);
    if (schedule !== 'C' && schedule !== 'E') continue;
    const incomeLines = incomeLinesOf(scheduleLines, schedule);
    const { income, expenses } = bookTotals(book, incomeLines);
    expenseTotal = addCents(expenseTotal, expenses);
    if (schedule !== 'E') continue;
    eExpenses = addCents(eExpenses, expenses);
    eNets = addCents(eNets, income - expenses);
    for (const [line, slot] of book.lines) {
      eLines.set(line, addCents(eLines.get(line) ?? 0n, slot.total));
    }
  }
  const lineTotalsCents: Record<string, number> = {};
  for (const line of [...eLines.keys()].sort(lineOrder)) {
    const total = eLines.get(line) ?? 0n;
    lineTotalsCents[line] = Number(total);
  }
  return {
    expense_total_cents: Number(expenseTotal),
    schedule_e_totals: {
      line_totals_cents: lineTotalsCents,
      expense_total_cents: Number(eExpenses),
      net_cents: Number(eNets),
    },
  };
}

/** Each entity's report: its fields, its lines in line order, its K-1 boxes, its totals. */
export function entityReports(books: ReadonlyMap<string, Book>, scheduleLines: Json): Json[] {
  const reports: Json[] = [];
  for (const book of books.values()) {
    // The income-lines classification the entity totals below apply, read once so each line can
    // carry its own flag.
    const schedule = strOrNull(book.schedule);
    const incomeLines = incomeLinesOf(scheduleLines, schedule);
    const lines: Json = {};
    for (const line of [...book.lines.keys()].sort(lineOrder)) {
      const slot = book.lines.get(line) ?? { label: '', total: 0n, entries: [] };
      // total_cents is the same number the formatted string renders: a JSON-safe number, because
      // every cent total Abacus holds fits far below 2^53, so Number(bigint) is exact here.
      lines[line] = {
        label: slot.label,
        total: fmtCents(slot.total),
        total_cents: Number(slot.total),
        income: incomeLines.includes(line),
        entries: [...slot.entries],
      };
    }
    const k1Boxes: Json = {};
    for (const box of [...book.k1_boxes.keys()].sort()) {
      const slot = book.k1_boxes.get(box) ?? { total: 0n, entries: [] };
      k1Boxes[box] = {
        total: fmtCents(slot.total),
        total_cents: Number(slot.total),
        entries: [...slot.entries],
      };
    }
    // The book's own fields - key, name, kind, schedule - then the computed lines and K-1 boxes.
    const report: Json = {
      key: book.key,
      name: book.name,
      kind: book.kind,
      schedule: book.schedule,
      lines,
      k1_boxes: k1Boxes,
    };
    if (schedule === 'C' || schedule === 'E') {
      const { income, expenses } = bookTotals(book, incomeLines);
      report.income_total = fmtCents(income);
      report.income_total_cents = Number(income);
      report.expense_total = fmtCents(expenses);
      report.expense_total_cents = Number(expenses);
      report.net = fmtCents(income - expenses);
      report.net_cents = Number(income - expenses);
    }
    reports.push(report);
  }
  return reports;
}

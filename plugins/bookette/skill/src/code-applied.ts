// The answers Bookette applies itself (plan row 14.18, issue #658, founder ruling B of epic
// #667). A code-owned answer such as a Documents-table move carries its whole change in its own
// stored effect, so the importer derives the ledger change from the person's answer and the
// agent never authors it; a move's crossing rows are the exception, since their line on the new
// schedule is the agent's to choose (issue #1782). This one pure function is called twice: by
// check_outputs, which refuses an agent change on a pair Bookette applies, and by the importer,
// which folds the pairs it emits into the run's changes. Two are implemented: a
// `ledger`/`entity` effect on a `move_lines:` key, and the person's `reading_correction` on a
// `correct_reading:` key (plan row 15.11, issue #685), which changes a booked line's amount, date
// or vendor only where the line demonstrably took its value from the reading the person
// corrected. Issue #645 widens `isCodeApplied` and the field
// table for its bulk answers. A third, given the run's resolved trips: a confirmed `trip_register`
// answer moves the confirmed lines its trip covers onto it (`tripRegisterChanges`, issue #1022),
// since the register write alone ties no line booked before the person declared the trip; a
// confirmed found place that carries trips does the same for each of them (issue #1068). A
// fourth: the Trips screen's "Not a trip" and "Change place" edits untie or move the confirmed
// lines their trip ties (`tripEditChanges`, issue #1068). A fifth: the verify answer's
// `second_read` option (issue #1126, decision record 0133) carries the importer-minted
// `line_correction` payload and applies exactly as a `correct_line:` answer does. A sixth: the
// person's category pick for one booked line (issue #1376), a `ledger`/`category` effect on a
// `correct_category:` key, which moves the line's schedule line and never its tag.

import { judgeCategoryPick } from './categories';
import type { CategorySchedule, ScheduleLinesTable } from './categories';
import {
  ATTACH_RECEIPT_KEY_PREFIX,
  CORRECT_CATEGORY_KEY_PREFIX,
  CORRECT_LINE_KEY_PREFIX,
  CORRECT_READING_KEY_PREFIX,
  MOVE_LINES_KEY_PREFIX,
  READING_CORRECTION_LEDGER_FIELD,
  VERIFY_READING_KEY_PREFIX,
  parseEffect,
} from './effects';
import type {
  TripRegisterEffect,
  LineCorrectionEffect,
  ReadingCorrectionEffect,
  ReadingCorrectionField,
  ReadingCorrectionLedgerField,
  ReadingCorrectionPage,
} from './effects';
import { readingTotalCents } from './money';

/** One staged answer: its options (each carrying its typed effect), the chosen value, and the
 *  ledger ids its question cited — the three facts the strict answer arm reads. */
export interface StagedAnswer {
  options: unknown;
  answer: unknown;
  cites: readonly string[];
}

// An option's ledger effect arms only the fields it can decide (task 11.4, ADR 0088): a category
// decides the schedule line and the tag, an entity assignment decides the entity, a trip
// assignment decides the trip. An `effect: none` option arms nothing, and no catalog key carries
// an amount, date, vendor or meal effect, so a catalog answer never arms those fields; a code-owned
// reading correction arms amount, date and vendor on its cited line (`correctionArmsChange`).
export const EFFECT_ARMED_FIELDS: Record<string, readonly string[]> = {
  category: ['line', 'tag'],
  entity: ['entity'],
  trip_assignment: ['trip'],
  // A settled answer (issue #1153) arms only the line's settled marker.
  settled: ['settled'],
};

/** The chosen option's effect object, or null when the answer chose none that carries one. */
export function optionEffectOf(staged: StagedAnswer): Record<string, unknown> | null {
  const optionId =
    staged.answer !== null && typeof staged.answer === 'object' && !Array.isArray(staged.answer)
      ? (staged.answer as Record<string, unknown>)['optionId']
      : undefined;
  if (typeof optionId !== 'string' || !Array.isArray(staged.options)) return null;
  const option = staged.options.find(
    (candidate): candidate is Record<string, unknown> =>
      candidate !== null &&
      typeof candidate === 'object' &&
      (candidate as Record<string, unknown>)['id'] === optionId,
  );
  const effect = option?.['effect'];
  return effect !== null && typeof effect === 'object' && !Array.isArray(effect)
    ? (effect as Record<string, unknown>)
    : null;
}

/** The key namespaces Bookette applies itself. The verify-reading namespace (issue #1126, decision
 *  record 0133) rides the per-line correction's arm: its `second_read` option carries a
 *  `line_correction` payload the importer minted and validated at mint, so the person's answer to
 *  it applies exactly as a `correct_line:` answer does. */
export function isCodeApplied(key: string): boolean {
  return (
    key.startsWith(MOVE_LINES_KEY_PREFIX) ||
    key.startsWith(CORRECT_READING_KEY_PREFIX) ||
    key.startsWith(CORRECT_LINE_KEY_PREFIX) ||
    key.startsWith(VERIFY_READING_KEY_PREFIX) ||
    key.startsWith(CORRECT_CATEGORY_KEY_PREFIX) ||
    key.startsWith(ATTACH_RECEIPT_KEY_PREFIX)
  );
}

/**
 * A ledger row as the rule sees it: its id, status, the answer keys that already changed it and,
 * for the correction arm's from-value guard, its current amount (the canonical decimal string),
 * date, vendor and currency. The importer fills all four from the stored row; the sandbox fills
 * the first three from the digest and leaves the currency undefined. The category arm's from-guard
 * reads the row's schedule line and its schedule (its entity's, null when unassigned), which both
 * fill from the stored row; a row without them takes no category pair. The arm's entity yield reads
 * the row's place (`ent_<id>`, null when unassigned), which only the importer fills: the digest
 * carries none, so the sandbox never yields there and its pairs stay a superset.
 */
export interface CodeAppliedRow {
  readonly ledgerId: string;
  readonly status: string;
  readonly answerKeys: readonly string[];
  readonly amount?: string | undefined;
  readonly date?: string | undefined;
  readonly vendor?: string | null | undefined;
  readonly currency?: string | undefined;
  readonly line?: string | null | undefined;
  readonly schedule?: string | null | undefined;
  readonly entity?: string | null | undefined;
  /** The document the row was booked from, as the digest spells it: the attach arm's
   *  "already this document" guard, which both the importer and the digest fill. */
  readonly sourceFile?: string | null | undefined;
}

/** The importer's post-fold view of a row, for the E1 guards. */
export interface CodeAppliedRowState {
  readonly schedule: string | null;
  readonly trip: string | null;
  readonly vehicle: string | null;
  /** The row's entity key, line and meal flag, which a confirmed trip's move reads (issue #1022). */
  readonly entity?: string | null;
  readonly line?: string | null;
  readonly meal?: boolean;
}

/** A trip of the run's resolved profile, as a confirmed trip's move finds it (issue #1022). */
export interface CodeAppliedTrip {
  readonly key: string;
  readonly entity: string | null;
  readonly segments: readonly { location: string; start: string; end: string }[];
}

/**
 * The import-time guards. The sandbox has no row schedule or trip in its digest, so it passes none
 * and its emitted set is a superset of the importer's for confirmed rows (held rows are unknown to
 * the sandbox, and the digest-id gate refuses an agent change to them anyway).
 */
export interface CodeAppliedGuards {
  /** Schedule per entity key of the run's out/profile.resolved.json. */
  readonly profileEntities: ReadonlyMap<string, string | null>;
  /** A row's schedule, trip and vehicle after the agent's changes are folded; undefined when unknown. */
  readonly rowState: (ledgerId: string) => CodeAppliedRowState | undefined;
  /** Whether the ledger's fx path prices the currency on the day; absent, a date pair is not checked. */
  readonly fxPriceable?: (currency: string, day: string) => boolean;
  /** The trips of the run's out/profile.resolved.json; absent, no confirmed trip moves a line. */
  readonly profileTrips?: readonly CodeAppliedTrip[];
  /** The staged year's `schedule_lines.json`, parsed (issue #1376); null when it does not parse,
   *  and then no category pick applies. */
  readonly scheduleTable?: ScheduleLinesTable | null;
}

/** One change the importer applies for a person's code-owned answer (a move or a correction), in the shape of a ledger_changes entry. A `trip` change to null unties the line (a removed trip, or a non-travel line its trip's place change cannot carry across schedules). */
export interface CodeAppliedChange {
  readonly id: string;
  readonly field: 'entity' | 'trip' | 'line' | 'source_file' | ReadingCorrectionLedgerField;
  readonly to: string | null;
  readonly answer_key: string;
}

export class CodeAppliedError extends Error {
  readonly code = 'unsupported_field';
  readonly key: string;
  constructor(key: string) {
    super(`the code-applied answer ${key} carries an effect on a field Bookette does not apply`);
    this.key = key;
  }
}

/** A chosen `ledger` effect, with its field table entry, or null. */
function chosenLedgerEffect(staged: StagedAnswer): Record<string, unknown> | null {
  const effect = optionEffectOf(staged);
  return effect !== null && effect['kind'] === 'ledger' ? effect : null;
}

/** True when the effect covers the ledger field (`entity`, `line`, ...) a change would set. */
function effectCovers(effect: Record<string, unknown>, field: string): boolean {
  const effectField = effect['field'];
  const armed = typeof effectField === 'string' ? EFFECT_ARMED_FIELDS[effectField] : undefined;
  return armed !== undefined && armed.includes(field);
}

function entityKeyOf(value: unknown): string | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  return record['type'] === 'entity' && typeof record['entityKey'] === 'string'
    ? record['entityKey']
    : null;
}

/** A person's category pick as the arm reads it: the one schedule both values carry and the
 *  schedule line it moves from and to. */
export interface CategoryPick {
  readonly schedule: CategorySchedule;
  readonly from: string;
  readonly to: string;
}

/**
 * The chosen option's category pick (issue #1376), or null when the answer is not one: a
 * `ledger`/`category` effect whose `from` and `to` both carry the same `schedule`. A malformed
 * answer under the namespace is inert, never an error: unlike a move's, it could otherwise wedge
 * every later run.
 */
export function categoryPickOf(staged: StagedAnswer): CategoryPick | null {
  const effect = parseEffect(optionEffectOf(staged));
  if (effect === null || effect.kind !== 'ledger' || effect.field !== 'category') return null;
  const { from, to } = effect;
  if (from === null || from.type !== 'category' || to.type !== 'category') return null;
  if (to.schedule === undefined || from.schedule !== to.schedule) return null;
  return { schedule: to.schedule, from: from.scheduleLine, to: to.scheduleLine };
}

/** The place a staged answer's chosen option books its cited lines to: a ledger `entity`
 *  effect's `to` key, or a confirmed found place's register key; undefined for any other answer. */
function entityTargetOf(staged: StagedAnswer): string | undefined {
  const effect = optionEffectOf(staged);
  if (effect === null) return undefined;
  if (effect['kind'] === 'entity_register') {
    return typeof effect['entityKey'] === 'string' ? effect['entityKey'] : undefined;
  }
  if (effect['kind'] !== 'ledger' || !effectCovers(effect, 'entity')) return undefined;
  const to = entityKeyOf(effect['to']);
  return to ?? undefined;
}

/** A correction's value in the form two corrections compare: an amount as cents. */
export function canonicalValue(field: ReadingCorrectionLedgerField, value: string): string {
  if (field !== 'amount') return value;
  const cents = readingTotalCents(value);
  return cents === null ? value : cents.toString();
}

const CORRECTION_LEDGER_FIELDS = Object.keys(READING_CORRECTION_LEDGER_FIELD) as Exclude<
  ReadingCorrectionField,
  'currency'
>[];

/** The chosen option's effect when it parses as a reading correction, else null. */
export function correctionEffectOf(staged: StagedAnswer): ReadingCorrectionEffect | null {
  const effect = parseEffect(optionEffectOf(staged));
  return effect !== null && effect.kind === 'reading_correction' ? effect : null;
}

/** The chosen option's effect when it parses as a per-line correction, else null. */
export function lineCorrectionEffectOf(staged: StagedAnswer): LineCorrectionEffect | null {
  const effect = parseEffect(optionEffectOf(staged));
  return effect !== null && effect.kind === 'line_correction' ? effect : null;
}

const LINE_CORRECTION_FIELDS = ['amount', 'date', 'vendor'] as const;

/** One ledger field a correction sets on its cited line. */
export interface CorrectionPair {
  readonly field: ReadingCorrectionLedgerField;
  readonly to: string;
}

/**
 * The pairs a correction would apply to one row, by the clauses that read only the effect and the
 * row (plan row 15.11): the field is corrected on exactly one page; the row's current value equals
 * that field's `from`, the reading's raw value (the from-value guard: the line is changed only
 * where it demonstrably took the old reading's value, `BASELINE_FIELDS`' discipline applied to the
 * code path); an amount also needs the page's currency (`currency.to`, else the reading's own,
 * else the ledger's USD default) to equal the row's and the page's currency to be left as read; a
 * date on a foreign-currency row needs the ledger's fx path to price it. A pair that fails a
 * clause is simply not emitted. The citation, the consumed-key and the yield clauses are the
 * caller's; the Review card reads this same function to say which fields will follow.
 */
export function correctionPairsFor(
  effect: ReadingCorrectionEffect,
  row: Pick<CodeAppliedRow, 'amount' | 'date' | 'vendor' | 'currency'>,
  guards?: Pick<CodeAppliedGuards, 'fxPriceable'>,
): CorrectionPair[] {
  const pairs: CorrectionPair[] = [];
  for (const field of CORRECTION_LEDGER_FIELDS) {
    const corrected = effect.pages.filter((page) => page[field] !== undefined);
    const page: ReadingCorrectionPage | undefined = corrected[0];
    const correction = page?.[field];
    if (corrected.length !== 1 || page === undefined || correction === undefined) continue;
    const from = correction.from;
    if (from === null) continue;
    const ledgerField = READING_CORRECTION_LEDGER_FIELD[field];
    if (field === 'total') {
      if (row.amount === undefined || page.currency !== undefined) continue;
      const fromCents = readingTotalCents(from);
      if (fromCents === null || fromCents !== readingTotalCents(row.amount)) continue;
      const effective = page.currency_as_read ?? 'USD';
      if (row.currency !== undefined && row.currency.toUpperCase() !== effective) continue;
    } else if (field === 'document_date') {
      if (row.date !== from) continue;
      if (
        guards?.fxPriceable !== undefined &&
        row.currency !== undefined &&
        row.currency.toUpperCase() !== 'USD' &&
        !guards.fxPriceable(row.currency, correction.to)
      ) {
        continue;
      }
    } else if (row.vendor !== from) {
      continue;
    }
    pairs.push({ field: ledgerField, to: correction.to });
  }
  return pairs;
}

/**
 * The pairs a per-line correction would apply to one row (plan row 15.12): one per field the
 * effect carries, emitted when every clause holds. There is no from-value guard: the person
 * addressed the line itself, and `from` is the wording's. An amount needs the row's currency, when
 * known, to equal the effect's (currency is not a changeable field, so this backstops a row in
 * another currency); a date on a foreign-currency row needs the ledger's fx path to price it. The
 * sandbox's rows carry no currency and no guard, so it passes both and emits a superset.
 */
export function lineCorrectionPairsFor(
  effect: LineCorrectionEffect,
  row: Pick<CodeAppliedRow, 'currency'>,
  guards?: Pick<CodeAppliedGuards, 'fxPriceable'>,
): CorrectionPair[] {
  const pairs: CorrectionPair[] = [];
  for (const field of LINE_CORRECTION_FIELDS) {
    const correction = effect[field];
    if (correction === undefined) continue;
    if (
      field === 'amount' &&
      row.currency !== undefined &&
      row.currency.toUpperCase() !== effect.currency
    ) {
      continue;
    }
    if (
      field === 'date' &&
      guards?.fxPriceable !== undefined &&
      row.currency !== undefined &&
      row.currency.toUpperCase() !== 'USD' &&
      !guards.fxPriceable(row.currency, correction.to)
    ) {
      continue;
    }
    pairs.push({ field, to: correction.to });
  }
  return pairs;
}

/**
 * The fields of a correction that could leave a held line contradicted (the session amendment S1
 * to the 15.11 design): the correction cites exactly one row and corrects the total or the date
 * from a reading that left that field empty. Only such a correction is a person overriding a
 * value no reader ever gave; every other held row is released as a reading confirm releases it.
 * The importer adds the last condition (the row's value differs from the canonical `to`); the
 * Review card's held clause reads this same function.
 */
export function correctionHoldCandidates(
  effect: ReadingCorrectionEffect,
  citedCount: number,
): { field: 'amount' | 'date'; to: string }[] {
  if (citedCount !== 1) return [];
  const candidates: { field: 'amount' | 'date'; to: string }[] = [];
  for (const page of effect.pages) {
    if (page.total !== undefined && page.total.from === null) {
      candidates.push({ field: 'amount', to: page.total.to });
    }
    if (page.document_date !== undefined && page.document_date.from === null) {
      candidates.push({ field: 'date', to: page.document_date.to });
    }
  }
  return candidates;
}

/**
 * The `(id, ledger field)` slots a live, unapplied correction guards, whether or not its pair
 * passes its guard (`id\u0000field` keys). The agent writes no change to a guarded slot: a pair
 * Bookette skipped says the line keeps its value, and a document-armed change from the staged
 * corrected reading would put a model-transcribed figure there anyway.
 */
export function correctionGuardedSlots(
  answers: ReadonlyMap<string, StagedAnswer>,
  rows: readonly Pick<CodeAppliedRow, 'ledgerId' | 'answerKeys'>[],
): Set<string> {
  const keysById = new Map(rows.map((row) => [row.ledgerId, row.answerKeys]));
  const guarded = new Set<string>();
  for (const [key, staged] of answers) {
    const slots = correctionSlots(key, staged);
    for (const slot of slots.keys()) {
      const id = slot.slice(0, slot.indexOf('\u0000'));
      const keys = keysById.get(id);
      if (keys === undefined || keys.includes(key)) continue;
      guarded.add(slot);
    }
  }
  return guarded;
}

/**
 * The `(id, ledger field)` slots one staged correction carries, keyed `id\u0000field`, each with
 * the canonical values it sets there. A reading correction carries its fields on every cited row;
 * a per-line correction carries its fields on its one cited row, and none when it cites another
 * number of rows (its answer is then harmless, never guessed at). Other keys carry none.
 */
export function correctionSlots(key: string, staged: StagedAnswer): Map<string, Set<string>> {
  const slots = new Map<string, Set<string>>();
  const add = (id: string, field: ReadingCorrectionLedgerField, to: string): void => {
    const slot = `${id}\u0000${field}`;
    const set = slots.get(slot) ?? new Set<string>();
    set.add(canonicalValue(field, to));
    slots.set(slot, set);
  };
  if (key.startsWith(CORRECT_READING_KEY_PREFIX)) {
    const effect = correctionEffectOf(staged);
    if (effect === null) return slots;
    for (const id of new Set(staged.cites)) {
      for (const field of CORRECTION_LEDGER_FIELDS) {
        for (const page of effect.pages) {
          const value = page[field];
          if (value !== undefined) add(id, READING_CORRECTION_LEDGER_FIELD[field], value.to);
        }
      }
    }
  } else if (key.startsWith(CORRECT_LINE_KEY_PREFIX) || key.startsWith(VERIFY_READING_KEY_PREFIX)) {
    // The verify answer's own correction (0133) rides the per-line arm: the importer minted its
    // `line_correction` payload for exactly the one booked line the question cites, so its slots
    // are that line's.
    const effect = lineCorrectionEffectOf(staged);
    const cited = [...new Set(staged.cites)];
    const id = cited[0];
    if (effect === null || cited.length !== 1 || id === undefined) return slots;
    for (const field of LINE_CORRECTION_FIELDS) {
      const value = effect[field];
      if (value !== undefined) add(id, field, value.to);
    }
  }
  return slots;
}

/**
 * The changes Bookette applies for the staged answers, in answers.json order.
 *
 * A move emits one pair per cited row that is CONFIRMED and whose `answerKeys` lack the answer's
 * key (the key is unique per answer, so its presence proves the answer already moved the row). A
 * pair is dropped when a later staged answer also cites the row with a chosen ledger effect
 * covering the same field: the move yields to the person's later answer. Given the staged
 * schedules, a row whose own `schedule` is not its target's is left to the agent, which chooses
 * its line on the new schedule (issue #1782); the split reads the stored row and the staged
 * target, never the row after the agent's changes, so a crossing the agent applied is not
 * written twice; a row on no place (`null`) crosses, and a target the staged schedules do not
 * carry moves as before. With guards, a pair is also skipped when its target is not in the
 * profile, sits on another schedule than the row after the fold, or the row carries a trip or
 * vehicle.
 *
 * A reading correction (plan row 15.11) and a per-line correction (plan row 15.12) each emit for a
 * cited row of any status, only when their question cites exactly that one row and
 * `correctionPairsFor` / `lineCorrectionPairsFor` passes. Walking from the last answer back, one
 * yields to a later one-cite correction, from either family, that a passing pair covers, and to
 * ANY later one-cite correction of the same row and field to a different value, whether that one
 * passes, is skipped or is already applied (the person withdrew the figure). A correction citing
 * other than one row applies nothing and withdraws nothing.
 */
export function codeAppliedChanges(
  answers: ReadonlyMap<string, StagedAnswer>,
  rows: readonly CodeAppliedRow[],
  guards?: CodeAppliedGuards,
  /** This batch's document tokens (`check_outputs`'s `batchNamesOf`): an attach receipt applies
   *  only when its document has a reading in the batch, so the readers resolve it. Absent, the
   *  arm applies without that gate (the tests' direct calls). */
  batchNames?: ReadonlySet<string>,
  /** The staged `profile.json` schedule per entity key, which splits a move's crossing rows off
   *  (issue #1782). Absent, no row is split off. */
  stagedSchedules?: ReadonlyMap<string, string>,
): CodeAppliedChange[] {
  const rowById = new Map(rows.map((row) => [row.ledgerId, row]));
  const entries = [...answers.entries()];
  const citeSets = new Map(entries.map(([key, staged]) => [key, new Set(staged.cites)]));
  const perEntry: CodeAppliedChange[][] = entries.map(() => []);
  for (const [index, [key, staged]] of entries.entries()) {
    if (!key.startsWith(MOVE_LINES_KEY_PREFIX)) continue;
    const effect = chosenLedgerEffect(staged);
    if (effect === null) continue;
    if (effect['field'] !== 'entity') throw new CodeAppliedError(key);
    const to = entityKeyOf(effect['to']);
    if (to === null) throw new CodeAppliedError(key);
    const targetSchedule = guards === undefined ? undefined : guards.profileEntities.get(to);
    if (guards !== undefined && targetSchedule === undefined) continue;
    const stagedTarget = stagedSchedules?.get(to);
    const later = entries.slice(index + 1);
    for (const id of new Set(staged.cites)) {
      const row = rowById.get(id);
      if (row === undefined || row.status !== 'CONFIRMED' || row.answerKeys.includes(key)) continue;
      if (stagedTarget !== undefined && row.schedule !== stagedTarget) continue;
      const yielded = later.some(([otherKey, other]) => {
        if (citeSets.get(otherKey)?.has(id) !== true) return false;
        const otherEffect = chosenLedgerEffect(other);
        return otherEffect !== null && effectCovers(otherEffect, 'entity');
      });
      if (yielded) continue;
      if (guards !== undefined) {
        const state = guards.rowState(id);
        if (
          state === undefined ||
          state.trip !== null ||
          state.vehicle !== null ||
          state.schedule === null ||
          state.schedule !== targetSchedule
        ) {
          continue;
        }
      }
      perEntry[index]?.push({ id, field: 'entity', to, answer_key: key });
    }
  }
  // A category pick (issue #1376) emits one `line` pair for the one CONFIRMED row its question
  // cites, unless the row already carries its key, when the row still sits on the pick's schedule
  // on its `from` or `to` line (the from-guard: a line moved since, or crossed to the other
  // schedule, is left as it is). It yields to a later answer citing the row whose effect covers
  // `line` (the person's later word), and to a staged answer the row has not consumed that would
  // book it to another place than the one it sits on, unless a later `move_lines:` answer citing
  // the row overrides that answer: a crossing re-chooses the line on the other schedule, so the
  // pick waits until the line settles. An answer that keeps the line where it is (a placement
  // answered with its own placed option) or that the person's later move overrides never lands
  // its key, so the pick never waits on it. The sandbox knows no row's place and never yields
  // here; the checker leaves the line to the crossing that answer arms. With
  // guards, the row must tie no trip or vehicle, carry no meal flag and sit on the pick's
  // schedule after the agent's changes, and the staged year's table must judge the pick one the
  // person may make (`judgeCategoryPick`: same kind, no tie).
  for (const [index, [key, staged]] of entries.entries()) {
    if (!key.startsWith(CORRECT_CATEGORY_KEY_PREFIX)) continue;
    const pick = categoryPickOf(staged);
    const cited = [...new Set(staged.cites)];
    const id = cited[0];
    if (pick === null || cited.length !== 1 || id === undefined) continue;
    const row = rowById.get(id);
    if (row === undefined || row.status !== 'CONFIRMED' || row.answerKeys.includes(key)) continue;
    if (row.schedule !== pick.schedule) continue;
    if (row.line !== pick.from && row.line !== pick.to) continue;
    const yieldsToLater = entries.slice(index + 1).some(([otherKey, other]) => {
      if (citeSets.get(otherKey)?.has(id) !== true) return false;
      const otherEffect = chosenLedgerEffect(other);
      return otherEffect !== null && effectCovers(otherEffect, 'line');
    });
    if (yieldsToLater) continue;
    const yieldsToMove = entries.some(([otherKey, other], at) => {
      if (at === index || citeSets.get(otherKey)?.has(id) !== true) return false;
      if (row.answerKeys.includes(otherKey)) return false;
      const target = entityTargetOf(other);
      if (target === undefined || row.entity === undefined || target === row.entity) return false;
      return !entries
        .slice(at + 1)
        .some(
          ([laterKey]) =>
            laterKey.startsWith(MOVE_LINES_KEY_PREFIX) && citeSets.get(laterKey)?.has(id) === true,
        );
    });
    if (yieldsToMove) continue;
    if (guards !== undefined) {
      const state = guards.rowState(id);
      const table = guards.scheduleTable;
      if (
        state === undefined ||
        state.trip !== null ||
        state.vehicle !== null ||
        state.meal === true ||
        state.schedule !== pick.schedule ||
        table === undefined ||
        table === null ||
        judgeCategoryPick(table, pick.schedule, { from: pick.from, to: pick.to, meal: false }) !==
          null
      ) {
        continue;
      }
    }
    perEntry[index]?.push({ id, field: 'line', to: pick.to, answer_key: key });
  }
  // A person's attached receipt (task 37.26, issue #1402) emits one `source_file` pair for the
  // one CONFIRMED line its question cites: the line's document becomes the receipt. A row that
  // already carries the key (idempotent) or is already sourced from this document takes none,
  // and neither does any pair whose receipt has no reading in this batch: the fold would move
  // the row onto a document the readers cannot resolve. A trip target emits no pair at all — the
  // importer ties the lines it inserts from the answer's effect, never a change.
  for (const [index, [key, staged]] of entries.entries()) {
    if (!key.startsWith(ATTACH_RECEIPT_KEY_PREFIX)) continue;
    const effect = parseEffect(optionEffectOf(staged));
    if (effect === null || effect.kind !== 'attach_receipt' || effect.to.type !== 'line') continue;
    const cited = [...new Set(staged.cites)];
    const id = cited[0];
    if (cited.length !== 1 || id === undefined) continue;
    const row = rowById.get(id);
    if (row === undefined || row.status !== 'CONFIRMED' || row.answerKeys.includes(key)) continue;
    if (batchNames !== undefined && !batchNames.has(effect.documentKey)) continue;
    if (row.sourceFile === effect.documentKey) continue;
    perEntry[index]?.push({ id, field: 'source_file', to: effect.documentKey, answer_key: key });
  }
  // Corrections (both families: the reading's and the line's) walk from the last answer back. An
  // earlier correction yields to a later one that a passing pair covers, and also to ANY later
  // live correction of the same row and field to a different value, whether that one passes, is
  // skipped or is already applied: the person withdrew the earlier figure, so it must not land (a
  // skipped later correction with the same value changes nothing, and lets the earlier one apply).
  const covered = new Set<string>();
  const laterValues = new Map<string, Set<string>>();
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index];
    if (entry === undefined) continue;
    const [key, staged] = entry;
    const mine = correctionSlots(key, staged);
    if (mine.size === 0) continue;
    const cited = [...new Set(staged.cites)];
    const id = cited[0];
    const row = id === undefined ? undefined : rowById.get(id);
    if (
      cited.length === 1 &&
      id !== undefined &&
      row !== undefined &&
      !row.answerKeys.includes(key)
    ) {
      const reading = correctionEffectOf(staged);
      const line = lineCorrectionEffectOf(staged);
      const own =
        key.startsWith(CORRECT_READING_KEY_PREFIX) && reading !== null
          ? correctionPairsFor(reading, row, guards)
          : key.startsWith(CORRECT_LINE_KEY_PREFIX) && line !== null
            ? lineCorrectionPairsFor(line, row, guards)
            : key.startsWith(VERIFY_READING_KEY_PREFIX) && line !== null
              ? lineCorrectionPairsFor(line, row, guards)
              : [];
      for (const pair of own) {
        const slot = `${id}\u0000${pair.field}`;
        const wanted = canonicalValue(pair.field, pair.to);
        const withdrawn = [...(laterValues.get(slot) ?? [])].some((value) => value !== wanted);
        if (covered.has(slot) || withdrawn) continue;
        perEntry[index]?.push({ id, field: pair.field, to: pair.to, answer_key: key });
      }
      for (const pair of own) covered.add(`${id}\u0000${pair.field}`);
    }
    // Only an entry citing exactly one row can ever apply a pair, so only such an entry is the
    // person's later word on a slot: a multi-line reading correction withdraws nothing.
    if (cited.length !== 1) continue;
    for (const [slot, values] of mine) {
      const set = laterValues.get(slot) ?? new Set<string>();
      for (const value of values) set.add(value);
      laterValues.set(slot, set);
    }
  }
  const trips = guards?.profileTrips;
  const pairs = perEntry.flat();
  if (guards === undefined || trips === undefined) return pairs;
  const edits = tripEditChanges(answers, rows, guards);
  // A row this call moves to another entity is not the trip's to take: its entity after the move
  // is not the one the guards read (issue #1022 review). A row a trip edit touches is the edit's.
  const movedEntity = new Set(
    [...pairs, ...edits]
      .filter((pair) => pair.field === 'entity' || pair.field === 'trip')
      .map((pair) => pair.id),
  );
  return [...pairs, ...edits, ...tripRegisterChanges(answers, rows, trips, guards, movedEntity)];
}

/** The trips of a resolved profile in the shape the move reads; a malformed entry is skipped (the
 *  profile's own gates refuse it before any import writes). */
export function profileTripsOf(profile: unknown): CodeAppliedTrip[] {
  const record = (value: unknown): Record<string, unknown> | null =>
    value !== null && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  const list = record(profile)?.['trips'];
  const trips: CodeAppliedTrip[] = [];
  for (const raw of Array.isArray(list) ? list : []) {
    const trip = record(raw);
    const key = trip?.['key'];
    const segments = trip?.['segments'];
    if (trip === null || typeof key !== 'string' || !Array.isArray(segments)) continue;
    const parsed: { location: string; start: string; end: string }[] = [];
    for (const rawSegment of segments) {
      const segment = record(rawSegment);
      const location = segment?.['location'];
      const start = segment?.['start'];
      const end = segment?.['end'];
      if (typeof location !== 'string' || typeof start !== 'string' || typeof end !== 'string') {
        continue;
      }
      parsed.push({ location, start, end });
    }
    const entity = trip['entity'];
    trips.push({ key, entity: typeof entity === 'string' ? entity : null, segments: parsed });
  }
  return trips;
}

/** The lines of a trip's schedule that travel books to (`rules/ty<year>/schedule_lines.json`). */
export const TRIP_TRAVEL_LINES: Readonly<Record<string, readonly string[]>> = {
  C: ['24a', '24b'],
  E: ['6'],
};

/** Whether an ISO day falls inside one of a trip's segments, both ends included. */
function insideSegments(day: string | undefined, segments: CodeAppliedTrip['segments']): boolean {
  return (
    day !== undefined && segments.some((segment) => segment.start <= day && day <= segment.end)
  );
}

/** A trip an answer adds or edits, as the moves read it: a `trip_register` answer's own, or one
 *  of the trips a confirmed found place carries, added under the place's key (issue #1068). */
export interface AnsweredTrip {
  readonly segments: TripRegisterEffect['segments'];
  readonly tripKey?: string;
  readonly entityKey?: string;
  /** The name the trip lands with: the person's answer's, or the one a found place's option
   *  carries. */
  readonly name?: string;
  /** The person's purpose (`null` clears it on an edit); a found place's trip carries none. */
  readonly purpose?: string | null;
  /** Set on a trip a found place's option carries (the run found it), absent on the person's own
   *  `trip_register` add or edit. */
  readonly foundPlace?: true;
  /** The Trip log's facts the person's answer states (task 37.8, issue #1375); a found place's
   *  trip carries none. */
  readonly travel?: TripRegisterEffect['travel'];
  readonly vehicleKey?: TripRegisterEffect['vehicleKey'];
  readonly miles?: TripRegisterEffect['miles'];
  readonly personalDays?: TripRegisterEffect['personalDays'];
  readonly noCost?: TripRegisterEffect['noCost'];
}

/** The trips a staged answer's chosen option adds or edits: a `trip_register` effect that removes
 *  nothing, or each trip a found place's option carries — its `entity_register` option, or an
 *  `entity` option placing its lines with a staged place. */
export function answeredTrips(staged: StagedAnswer): AnsweredTrip[] {
  const effect = parseEffect(optionEffectOf(staged));
  if (effect === null) return [];
  if (effect.kind === 'trip_register') return effect.remove === true ? [] : [effect];
  if (effect.kind === 'entity_register') {
    return (effect.trips ?? []).map((trip) => ({
      segments: trip.segments,
      entityKey: effect.entityKey,
      name: trip.name,
      foundPlace: true as const,
    }));
  }
  // A found place's lines, or a placement's (issue #1563), placed with a staged place carry their
  // trips there (issue #1068).
  if (effect.kind === 'ledger' && effect.to.type === 'entity') {
    const entityKey = effect.to.entityKey;
    return (effect.trips ?? []).map((trip) => ({
      segments: trip.segments,
      entityKey,
      name: trip.name,
      foundPlace: true as const,
    }));
  }
  return [];
}

/** The profile trip an answer names: by its `tripKey` on an edit, else the one trip under its
 *  `entityKey` whose segments are the answer's own, location for location. */
export function tripOfAnswer(
  effect: AnsweredTrip,
  trips: readonly CodeAppliedTrip[],
): CodeAppliedTrip | null {
  if (effect.tripKey !== undefined) {
    return trips.find((trip) => trip.key === effect.tripKey) ?? null;
  }
  const same = (trip: CodeAppliedTrip): boolean =>
    trip.entity === (effect.entityKey ?? null) &&
    trip.segments.length === effect.segments.length &&
    effect.segments.every((segment, index) => {
      const mine = trip.segments[index];
      return (
        mine !== undefined &&
        mine.location === segment.location &&
        mine.start === segment.start &&
        mine.end === segment.end
      );
    });
  const found = trips.filter(same);
  return found.length === 1 ? (found[0] ?? null) : null;
}

/**
 * A confirmed trip's lines (issue #1022): a `trip_register` answer the person confirmed moves onto
 * its trip, by code at import and never by the model, every confirmed line that no trip or vehicle
 * ties yet, that books to the trip's own entity, whose date falls inside one of the answer's
 * segments, and that the question cited or that travel books to (a meal, or a travel line of the
 * entity's schedule, `TRIP_TRAVEL_LINES`). The trip is the resolved profile's that the answer names
 * (`tripOfAnswer`); none found, nothing moves. A line already carrying the answer's key was moved,
 * and a line a later answer's chosen `ledger` effect covering `trip` cites yields to that answer.
 * A line two confirmed trips of its entity both cover moves onto neither (the person places it),
 * and a line in `exclude` (one the same import moves to another entity) is never the trip's.
 */
export function tripRegisterChanges(
  answers: ReadonlyMap<string, StagedAnswer>,
  rows: readonly CodeAppliedRow[],
  trips: readonly CodeAppliedTrip[],
  guards: Pick<CodeAppliedGuards, 'profileEntities' | 'rowState'>,
  exclude: ReadonlySet<string> = new Set(),
): CodeAppliedChange[] {
  const entries = [...answers.entries()];
  const changes: CodeAppliedChange[] = [];
  const moved = new Set<string>();
  const resolved: { key: string; effect: AnsweredTrip; trip: CodeAppliedTrip }[] = [];
  for (const [key, staged] of entries) {
    for (const effect of answeredTrips(staged)) {
      const trip = tripOfAnswer(effect, trips);
      if (trip !== null && trip.entity !== null) resolved.push({ key, effect, trip });
    }
  }
  // A row two confirmed trips of its entity both cover is the person's to place, not code's.
  const contested = (row: CodeAppliedRow, entity: string | null | undefined): boolean =>
    resolved.filter(
      (candidate) =>
        candidate.trip.entity === entity && insideSegments(row.date, candidate.effect.segments),
    ).length > 1;
  for (const [index, [key, staged]] of entries.entries()) {
    for (const { effect, trip } of resolved.filter((candidate) => candidate.key === key)) {
      if (trip.entity === null) continue;
      const schedule = guards.profileEntities.get(trip.entity) ?? null;
      const travelLines = schedule === null ? [] : (TRIP_TRAVEL_LINES[schedule] ?? []);
      const cited = new Set(staged.cites);
      const later = entries.slice(index + 1);
      for (const row of rows) {
        if (moved.has(row.ledgerId) || exclude.has(row.ledgerId)) continue;
        if (row.status.toUpperCase() !== 'CONFIRMED' || row.answerKeys.includes(key)) continue;
        if (!insideSegments(row.date, effect.segments)) continue;
        const state = guards.rowState(row.ledgerId);
        if (state === undefined || state.trip !== null || state.vehicle !== null) continue;
        if (state.entity !== trip.entity || contested(row, state.entity)) continue;
        const travel =
          state.meal === true ||
          (state.line !== undefined && state.line !== null && travelLines.includes(state.line));
        if (!cited.has(row.ledgerId) && !travel) continue;
        const yielded = later.some(([, other]) => {
          if (!other.cites.includes(row.ledgerId)) return false;
          const otherEffect = chosenLedgerEffect(other);
          return otherEffect !== null && effectCovers(otherEffect, 'trip');
        });
        if (yielded) continue;
        moved.add(row.ledgerId);
        changes.push({ id: row.ledgerId, field: 'trip', to: trip.key, answer_key: key });
      }
    }
  }
  return changes;
}

/** The travel line a schedule books a moved trip's line to: a meal on Schedule C takes 24b, any
 *  other travel line 24a, and on Schedule E every travel line is line 6 (`TRIP_TRAVEL_LINES`). */
function travelLineOn(schedule: string, meal: boolean): string | null {
  if (schedule === 'C') return meal ? '24b' : '24a';
  if (schedule === 'E') return '6';
  return null;
}

/**
 * The Trips screen's edits of a recorded trip (issue #1068), applied by code at import to the
 * confirmed lines the trip ties, never by the model. "Not a trip" (`remove`) unties each of them:
 * the line keeps its place and line and goes back to plain expenses, and the register write
 * removes the trip. "Change place" (an edit carrying `entityKey`) moves each onto the new place:
 * on the same schedule the entity alone changes; across schedules a travel line (a meal, or a
 * travel line of its schedule) takes the new schedule's travel line, and any other tied line is
 * untied and stays where it is, since only the person can choose its line there. A target the
 * resolved profile does not carry moves nothing. Re-applying is a no-op: a moved line already sits
 * on the target, and an untied line carries no trip.
 */
export function tripEditChanges(
  answers: ReadonlyMap<string, StagedAnswer>,
  rows: readonly CodeAppliedRow[],
  guards: Pick<CodeAppliedGuards, 'profileEntities' | 'rowState'>,
): CodeAppliedChange[] {
  const changes: CodeAppliedChange[] = [];
  const touched = new Set<string>();
  for (const [key, staged] of [...answers.entries()].reverse()) {
    const effect = parseEffect(optionEffectOf(staged));
    if (effect === null || effect.kind !== 'trip_register' || effect.tripKey === undefined) {
      continue;
    }
    const remove = effect.remove === true;
    const target = remove ? undefined : effect.entityKey;
    if (!remove && target === undefined) continue;
    const targetSchedule = target === undefined ? undefined : guards.profileEntities.get(target);
    if (target !== undefined && (targetSchedule === undefined || targetSchedule === null)) continue;
    for (const row of rows) {
      // The latest edit of a line's trip wins: the walk runs from the last answer back.
      if (touched.has(row.ledgerId)) continue;
      const state = guards.rowState(row.ledgerId);
      if (state === undefined || state.trip !== effect.tripKey) continue;
      touched.add(row.ledgerId);
      if (remove) {
        changes.push({ id: row.ledgerId, field: 'trip', to: null, answer_key: key });
        continue;
      }
      if (target === undefined || targetSchedule === undefined || targetSchedule === null) continue;
      if (state.entity === target) continue;
      if (state.schedule === targetSchedule) {
        changes.push({ id: row.ledgerId, field: 'entity', to: target, answer_key: key });
        continue;
      }
      const fromLines = state.schedule === null ? [] : (TRIP_TRAVEL_LINES[state.schedule] ?? []);
      const travel =
        state.meal === true ||
        (state.line !== undefined && state.line !== null && fromLines.includes(state.line));
      const line = travel ? travelLineOn(targetSchedule, state.meal === true) : null;
      if (line === null) {
        changes.push({ id: row.ledgerId, field: 'trip', to: null, answer_key: key });
        continue;
      }
      changes.push({ id: row.ledgerId, field: 'entity', to: target, answer_key: key });
      changes.push({ id: row.ledgerId, field: 'line', to: line, answer_key: key });
    }
  }
  return changes;
}

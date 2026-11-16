/**
 * One trip checked against the rules a books run's trip gate holds it to. Its segments (decision
 * record 0132 item 7): at most `MAX_SEGMENTS`, every location naming a locality before its last
 * comma, every day a real ISO calendar day, no segment ending before it starts, every day inside
 * the workspace's tax year, and no two segments sharing a day. Its Trip log facts (the #1375 amendment): `validateTripFacts`. The gate
 * (`scripts/trip_gates.ts`) words its problems from these codes, and the Trips edit refuses a save
 * on them before it writes, so a trip the person saved never fails a later run's gate. A problem
 * names its code and the segment's index, never a value.
 *
 * Staged into the sandbox with the gate that imports it: this module imports nothing but the
 * skill's own date helpers and the effect contract's closed words, which import nothing
 * (test/trip-facts.spec.ts holds its import closure to that).
 */
import { isValidDay } from './dates';
import { TRIP_NO_COST_GAPS, TRIP_TRAVEL_WORDS, TRIP_VEHICLE_KEY } from './effects';

/** The most segments one trip carries: an itinerary of a dozen stops is already a long one. */
export const MAX_SEGMENTS = 12;

/** One stop of a trip as both the gate and the Trips edit carry it: its location ("City, ST" or
 *  "City, Country") and its ISO days, start then end. */
export interface TripSegmentDays {
  readonly location: string;
  readonly start: string;
  readonly end: string;
}

/**
 * The locality half of a "City, ST" / "City, Country" location, split on the last comma: the same
 * split the import's register write stores, so a stop whose split leaves no locality (blank, or
 * only a comma and a region) is refused by the gate's schema check and by the Trips edit alike.
 */
export function stopLocality(location: string): string {
  const cut = location.lastIndexOf(',');
  return (cut === -1 ? location : location.slice(0, cut)).trim();
}

export type TripSegmentCode =
  /** More than `MAX_SEGMENTS` segments: the only problem reported, before any day is read. */
  | 'too_many'
  /** A location with no locality before its last comma (`stopLocality`). */
  | 'no_locality'
  /** A start or end that is not a real `YYYY-MM-DD` calendar day. */
  | 'malformed_day'
  | 'end_before_start'
  /** A day of another year than the workspace's tax year. */
  | 'outside_year'
  /** Two segments of the trip share at least one day. */
  | 'shared_day';

export interface TripSegmentProblem {
  readonly code: TripSegmentCode;
  /** The segment the problem is about; absent on `too_many` and `shared_day`, which are the
   *  trip's. */
  readonly index?: number;
}

/**
 * Every problem of one trip's segments, in the gate's order: `too_many` alone when the count is
 * over the cap; else, per segment, a location with no locality, then a malformed day (its day
 * checks skipped) or an end before its start and a day outside the tax year; then `shared_day`
 * once. A null tax year checks no year.
 * Empty when the segments are sound.
 */
export function validateTripSegments(
  segments: readonly TripSegmentDays[],
  taxYear: number | null,
): readonly TripSegmentProblem[] {
  if (segments.length > MAX_SEGMENTS) return [{ code: 'too_many' }];
  const problems: TripSegmentProblem[] = [];
  const year = taxYear === null ? null : String(taxYear);
  for (const [index, segment] of segments.entries()) {
    if (stopLocality(segment.location) === '') problems.push({ code: 'no_locality', index });
    if (!isValidDay(segment.start) || !isValidDay(segment.end)) {
      problems.push({ code: 'malformed_day', index });
      continue;
    }
    if (segment.start > segment.end) problems.push({ code: 'end_before_start', index });
    if (year !== null && (segment.start.slice(0, 4) !== year || segment.end.slice(0, 4) !== year)) {
      problems.push({ code: 'outside_year', index });
    }
  }
  const shared = segments.some((segment, index) =>
    segments.some(
      (other, otherIndex) =>
        otherIndex > index && segment.start <= other.end && other.start <= segment.end,
    ),
  );
  if (shared) problems.push({ code: 'shared_day' });
  return problems;
}

/** The most miles one trip records: a log past this is no single trip's. */
export const MAX_TRIP_MILES = 99_999;

/** A trip's Trip log facts as they stand once an edit is applied: null is none (not stated). */
export interface TripFacts {
  readonly travel: unknown;
  /** `veh_<id>`. */
  readonly vehicleKey: unknown;
  readonly miles: unknown;
  readonly personalDays: unknown;
  readonly noCost: unknown;
}

export type TripFactsCode =
  /** A travel word outside `TRIP_TRAVEL_WORDS`. */
  | 'travel_unknown'
  /** `flew` on a trip that does not already carry it: a flight is recorded from its ticket. */
  | 'flew_not_recorded'
  /** A vehicle that is not a `veh_<id>` key as staging spells it (`TRIP_VEHICLE_KEY`). */
  | 'vehicle_malformed'
  | 'vehicle_without_own_car'
  /** Miles that are not a whole number from 1 to `MAX_TRIP_MILES`. */
  | 'miles_malformed'
  | 'miles_without_own_car'
  /** Personal days that are not a list of real ISO days. */
  | 'personal_days_malformed'
  /** A personal day on no day of the trip's segments. */
  | 'personal_day_outside'
  /** Personal days out of order, or one twice. */
  | 'personal_days_unsorted'
  /** A no-cost word outside `TRIP_NO_COST_GAPS`, or not a list of them. */
  | 'no_cost_unknown'
  | 'no_cost_repeated';

/**
 * Every problem of one trip's Trip log facts, by code: the closed travel word, never `flew` unless
 * `recordedTravel` (the trip's own before the edit) is already `flew`; a vehicle and miles only
 * on `own_car`, the vehicle a `veh_<id>` key and the miles a whole number from 1 to 99,999; the
 * personal days distinct real ISO days in order, each a day of the segments; the no-cost words
 * from the closed set, each once. Empty when the facts are sound.
 */
export function validateTripFacts(
  facts: TripFacts,
  segments: readonly TripSegmentDays[],
  recordedTravel: string | null,
): readonly TripFactsCode[] {
  const codes: TripFactsCode[] = [];
  const { travel, vehicleKey, miles, personalDays, noCost } = facts;
  if (travel !== null && !(TRIP_TRAVEL_WORDS as readonly unknown[]).includes(travel)) {
    codes.push('travel_unknown');
  }
  if (travel === 'flew' && recordedTravel !== 'flew') codes.push('flew_not_recorded');
  if (vehicleKey !== null) {
    if (typeof vehicleKey !== 'string' || !TRIP_VEHICLE_KEY.test(vehicleKey)) {
      codes.push('vehicle_malformed');
    }
    if (travel !== 'own_car') codes.push('vehicle_without_own_car');
  }
  if (miles !== null) {
    if (
      typeof miles !== 'number' ||
      !Number.isInteger(miles) ||
      miles < 1 ||
      miles > MAX_TRIP_MILES
    ) {
      codes.push('miles_malformed');
    }
    if (travel !== 'own_car') codes.push('miles_without_own_car');
  }
  if (personalDays !== null) {
    if (
      !Array.isArray(personalDays) ||
      !personalDays.every((day) => typeof day === 'string' && isValidDay(day))
    ) {
      codes.push('personal_days_malformed');
    } else {
      const days = personalDays as readonly string[];
      if (
        days.some((day) => !segments.some((segment) => segment.start <= day && day <= segment.end))
      ) {
        codes.push('personal_day_outside');
      }
      if (days.some((day, index) => index > 0 && (days[index - 1] ?? '') >= day)) {
        codes.push('personal_days_unsorted');
      }
    }
  }
  if (noCost !== null) {
    if (
      !Array.isArray(noCost) ||
      !noCost.every((gap) => (TRIP_NO_COST_GAPS as readonly unknown[]).includes(gap))
    ) {
      codes.push('no_cost_unknown');
    } else if (new Set(noCost).size !== noCost.length) {
      codes.push('no_cost_repeated');
    }
  }
  return codes;
}

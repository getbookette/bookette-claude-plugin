// The words every surface that shows Abacus's comparisons prints for the two facts task 37.8
// (issue #1375, decision record 0105's #1375 amendment) added: a trip on one calendar day has no
// per-diem reading, and a vehicle's standard-side miles have a source. books.md, the workbook,
// the Report's cards and the personal tool all read them from here, so no surface words them
// on its own. A vehicle row's actual-cost steps are formatted and parsed here too.
import { fmtCents, parseDec, toCents } from './money';

/** What a trip on one calendar day shows where a per-diem figure would be: it has none. */
export const DAY_TRIP_PER_DIEM = 'No per diem for a day trip';

/** The note a surface prints under a day trip's meals, which show one reading, not two. */
export const DAY_TRIP_NOTE =
  'One reading: a trip on one calendar day has no per diem, so its meals are shown from the receipts. Lodging for self-employed travel is actual cost only.';

// Where a vehicle row's standard-side miles come from: the year's miles as the register states
// them, or, when the year states none, the sum of the miles the person logged on the trips that
// cite the vehicle. A row whose year states no miles and whose trips log none carries null.
export const MILES_SOURCES = ['stated', 'trips'] as const;

export type MilesSource = (typeof MILES_SOURCES)[number];

/** A vehicle row's miles facts, as books.json and `report_vehicle_methods` carry them. */
export interface MilesFacts {
  readonly source: MilesSource | null;
  /** The sum of the miles logged on the own-car trips citing the vehicle. */
  readonly tripMiles: number;
  /** How many of those trips logged miles. */
  readonly tripCount: number;
  /** How many of those trips state no miles. */
  readonly unstatedCount: number;
}

const grouped = (miles: number): string => String(miles).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

const trips = (count: number): string => `${String(count)} ${count === 1 ? "trip's" : "trips'"}`;

/**
 * The miles' source in code's words, printed after "Miles: ". It states where the miles come
 * from, and that a trip's miles are not stated, and never a method: "1,200, from 2 trips'
 * logged miles"; "as stated for the year; 1 trip's logged miles: 350"; "not stated for the
 * year"; each followed by "; 1 trip's miles not stated" when an own-car trip citing the vehicle
 * states none.
 */
export function milesSourceWords(facts: MilesFacts): string {
  const { source, tripMiles, tripCount, unstatedCount } = facts;
  const logged = `${trips(tripCount)} logged miles`;
  const head =
    source === 'trips'
      ? `${grouped(tripMiles)}, from ${logged}`
      : `${source === 'stated' ? 'as stated for the year' : 'not stated for the year'}${
          tripCount === 0 ? '' : `; ${logged}: ${grouped(tripMiles)}`
        }`;
  return unstatedCount === 0 ? head : `${head}; ${trips(unstatedCount)} miles not stated`;
}

// The actual side of a vehicle row's steps: one `<ledger id> = <usd>` per ledger line the row
// summed, then `actual cost = <usd>`. Abacus writes them with these formatters and the Report
// reads them back with `parseVehicleStep`, so the two never drift apart.

/** The label of a vehicle row's closing actual-cost step. */
export const ACTUAL_COST_STEP_LABEL = 'actual cost';

/** One summed ledger line's step: `L0126 = 58.90`. */
export function vehicleLineStep(ledgerId: string, cents: bigint): string {
  return `${ledgerId} = ${fmtCents(cents)}`;
}

/** The actual side's closing step: `actual cost = 497.90`. */
export function vehicleActualCostStep(cents: bigint): string {
  return `${ACTUAL_COST_STEP_LABEL} = ${fmtCents(cents)}`;
}

// The standard side of a stated year: one step per priced mileage band (rounded as
// abacus/vehicles.ts's `bandSteps` says).

/** One priced band of a vehicle's stated year, as `vehicleBandStep` writes it. */
export interface VehicleBand {
  readonly from: string;
  readonly to: string;
  /** The band's miles as the profile states them (`fmtDec`). */
  readonly miles: string;
  /** The band's cents per mile as the rules data carries it. */
  readonly rate: string;
  readonly cents: number;
}

/** One priced band's step: `band 2026-01-01 to 2026-06-30: 2000 miles x 72.5 cents = 1450.00`. */
export function vehicleBandStep(
  from: string,
  to: string,
  miles: string,
  rate: string,
  cents: bigint,
): string {
  return `${BAND_PREFIX}${from} to ${to}: ${miles} miles x ${rate} cents = ${fmtCents(cents)}`;
}

/** The word every band step starts with, and no other step does. */
const BAND_PREFIX = 'band ';

const BAND_STEP =
  /^band (\d{4}-\d{2}-\d{2}) to (\d{4}-\d{2}-\d{2}): (\d+(?:\.\d+)?) miles x (\d+(?:\.\d+)?) cents = (\S+)$/;

/** A band step read back to its parts; null for any other step, or one whose figure does not
 *  format back to itself. */
export function parseVehicleBandStep(step: string): VehicleBand | null {
  const match = BAND_STEP.exec(step);
  if (match === null) return null;
  const cents = centsOf(match[5] ?? '');
  if (cents === null) return null;
  return {
    from: match[1] ?? '',
    to: match[2] ?? '',
    miles: match[3] ?? '',
    rate: match[4] ?? '',
    cents,
  };
}

/** A vehicle step as the Report sorts it: a summed line (its id and USD cents), the closing sum, a
 *  step shaped like a summed line or like the closing sum that does not parse, a priced band, or
 *  the standard side's other working. */
export type VehicleStep =
  | ({ readonly kind: 'band' } & VehicleBand)
  | { readonly kind: 'unparsed_band' }
  | { readonly kind: 'line'; readonly ledgerId: string; readonly cents: number }
  | { readonly kind: 'actual_cost'; readonly cents: number }
  | { readonly kind: 'unparsed_line' }
  | { readonly kind: 'unparsed_total' }
  | { readonly kind: 'miles' };

/** `<one token> = ...`: the shape every summed-line step has, parsable or not. No standard-side
 *  step has it: those name a trip and its days, or start with a two-word label. */
const LINE_SHAPED = /^(\S+) = (.*)$/s;

/** `fmtCents`'s output read back to integer cents through the money core; null for any text
 *  `fmtCents` would not have written, so a parse always formats back to the same text. */
function centsOf(text: string): number | null {
  let cents: bigint;
  try {
    cents = toCents(parseDec(text));
  } catch {
    return null;
  }
  const value = Number(cents);
  return fmtCents(cents) === text && Number.isSafeInteger(value) ? value : null;
}

/** Sort one persisted vehicle step back into what `vehicleLineStep` and `vehicleActualCostStep`
 *  wrote; anything else is the standard side's working. A step shaped like either whose figure
 *  does not parse is an unparsed line or an unparsed total, never the standard side's. */
export function parseVehicleStep(step: string): VehicleStep {
  // Every `band ` step is a band, read or not: never a trip keyed "band".
  if (step.startsWith(BAND_PREFIX)) {
    const band = parseVehicleBandStep(step);
    return band === null ? { kind: 'unparsed_band' } : { kind: 'band', ...band };
  }
  // A trip step next: its key is the run's to choose and may hold " = ".
  if (splitVehicleTripStep(step) !== null) return { kind: 'miles' };
  const closing = `${ACTUAL_COST_STEP_LABEL} = `;
  if (step.startsWith(closing)) {
    const cents = centsOf(step.slice(closing.length));
    return cents === null ? { kind: 'unparsed_total' } : { kind: 'actual_cost', cents };
  }
  const match = LINE_SHAPED.exec(step);
  if (match === null) return { kind: 'miles' };
  const cents = centsOf(match[2] ?? '');
  return cents === null
    ? { kind: 'unparsed_line' }
    : { kind: 'line', ledgerId: match[1] ?? '', cents };
}

/** A standard-side step naming a trip, `<trip key> <day>[ to <day>]: <tail>` (abacus/vehicles.ts),
 *  split at its key: the days and the tail are code's, and the key, which a run chooses for a
 *  trip an answer adds, is everything before the first day. Null for every other step, a band
 *  step included. */
export function splitVehicleTripStep(step: string): { key: string; rest: string } | null {
  if (step.startsWith(BAND_PREFIX)) return null;
  const match = /^(.+?) (\d{4}-\d{2}-\d{2}(?: to \d{4}-\d{2}-\d{2})?: [^:]*)$/s.exec(step);
  return match === null ? null : { key: match[1] ?? '', rest: match[2] ?? '' };
}

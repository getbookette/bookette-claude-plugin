/**
 * The vehicle comparison (issue #110, decision record 0105): per vehicle, both methods' figures
 * with no winner. The standard side is priced per use (decision record 0189): each place that
 * uses the car prices its own miles over the mileage file's bands that overlap the tax year (one
 * rounding at the cent over the use's whole sum), and the car's figure is the sum of its uses'
 * rounded figures. The actual side sums the vehicle-attributed ledger lines. The exclusions name
 * why the standard rate is unavailable - shown, never applied to either figure.
 *
 * Where a use's miles are not stated (no band breakdown and no business miles), its standard
 * side prices the miles the person logged on the trips that cite the vehicle (task 37.8, 0105's
 * #1375 amendment): each trip at the band covering its first day, one rounding over the sum. A
 * trip whose miles are not stated adds nothing and is named so in the steps; no mile is ever
 * estimated. Where the year is stated it prices as before, with the trips' sum beside it and a
 * warning when that sum exceeds the year's. Every trip citing the car counts toward its one use,
 * whatever the trip's place, so a car more than one place uses is an error here.
 */
import { addCents, divideHalfUp, fmtCents, parseDec, SCALE, type Dec } from '../money';
import { mileageBandsOf } from '../profile-facts';
import {
  milesSourceWords,
  vehicleActualCostStep,
  vehicleBandStep,
  vehicleLineStep,
  type MilesSource,
} from '../comparison-words';
import {
  asArray,
  asObject,
  decOrNull,
  fmtDec,
  idList,
  intOrNull,
  strOrNull,
  text,
  type Json,
} from './values';

export interface VehicleInputs {
  /** The profile's vehicles in their own order, a repeated key repeated. */
  readonly vehicles: readonly unknown[];
  /** The profile's trips: a trip by own car citing a vehicle's key logs its miles for it. */
  readonly trips: readonly unknown[];
  /** The workspace's together-used fleet count, or null when not recorded. */
  readonly vehiclesUsedTogether: number | null;
  /** Each profile vehicle's attributed ledger lines, in ledger order. */
  readonly vehicleLines: ReadonlyMap<string, readonly { id: string; cents: bigint }[]>;
  readonly mileageRules: Json;
  readonly taxYear: number;
}

/** A trip by own car that cites a vehicle: its key, first and last day, and its logged miles. */
interface CitingTrip {
  readonly key: string;
  readonly first: string;
  readonly last: string;
  readonly miles: number | null;
}

/** The trips by own car that cite `vehicleKey`, by first day then key. */
function tripsCiting(trips: readonly unknown[], vehicleKey: string): CitingTrip[] {
  const citing: CitingTrip[] = [];
  for (const raw of trips) {
    const trip = asObject(raw);
    if (trip.travel !== 'own_car' || trip.vehicle !== vehicleKey) continue;
    const days = asArray(trip.segments).flatMap((segment) => [
      text(asObject(segment).start),
      text(asObject(segment).end),
    ]);
    if (days.length === 0) continue;
    days.sort();
    const miles = intOrNull(trip.miles);
    citing.push({
      key: text(trip.key),
      first: days[0] ?? '',
      last: days[days.length - 1] ?? '',
      miles: miles !== null && miles > 0 ? miles : null,
    });
  }
  return citing.sort((a, b) =>
    a.first < b.first ? -1 : a.first > b.first ? 1 : a.key < b.key ? -1 : a.key > b.key ? 1 : 0,
  );
}

/** One band the stated year priced: its period, miles, rate and exact miles x cents product. */
interface PricedBand {
  readonly from: string;
  readonly to: string;
  readonly miles: Dec;
  readonly rate: string;
  readonly product: bigint;
}

/** The priced bands' steps in date order, each band's cents the running sum rounded once at the
 *  cent less the rounded sum before it, so the steps add exactly to the year's one rounding
 *  (0105 item 1). Date order makes the text and the cent the rounding moves deterministic. */
function bandSteps(bands: readonly PricedBand[]): string[] {
  let running = 0n;
  let roundedBefore = 0n;
  const inDateOrder = [...bands].sort((a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : 0));
  return inDateOrder.map((band) => {
    running += band.product;
    const rounded = divideHalfUp(running, SCALE * SCALE);
    const cents = rounded - roundedBefore;
    roundedBefore = rounded;
    return vehicleBandStep(band.from, band.to, fmtDec(band.miles), band.rate, cents);
  });
}

/** A trip's days as a step names them. */
function tripDays(trip: CitingTrip): string {
  return trip.first === trip.last ? trip.first : `${trip.first} to ${trip.last}`;
}

/** A built vehicle row's miles source in code's words, as books.md, the workbook and the
 *  personal tool print it: `milesSourceWords` over the row's own keys. */
export function vehicleMilesWords(row: Json): string {
  return milesSourceWords({
    source: row.miles_source === 'stated' || row.miles_source === 'trips' ? row.miles_source : null,
    tripMiles: intOrNull(row.trip_miles) ?? 0,
    tripCount: intOrNull(row.trip_count) ?? 0,
    unstatedCount: intOrNull(row.trip_miles_unstated) ?? 0,
  });
}

/** The places that use a built vehicle row's car, by profile key, in the uses' order. */
export function vehicleUseEntities(row: Json): string[] {
  return asArray(row.uses)
    .map((use) => strOrNull(asObject(use).entity))
    .filter((entity) => entity !== null);
}

/** The warning for ledger lines that cite a vehicle the profile does not carry, or null. */
export function strayVehicleWarning(ids: readonly string[]): string | null {
  return ids.length > 0 ? `vehicle citations outside any profile vehicle: ${idList(ids)}` : null;
}

/** The profile's together-used fleet count: an absent-or-null fact the report shows. */
export function vehiclesUsedTogetherOf(profile: Json): number | null {
  return profile.vehicles_used_together === null || profile.vehicles_used_together === undefined
    ? null
    : Number(profile.vehicles_used_together);
}

interface MileageContext {
  readonly mileageBands: readonly { from: string; to: string; cents: string }[];
  readonly yearBands: readonly { from: string; to: string; cents: string }[];
  readonly taxYear: number;
}

interface UseComparison {
  readonly row: Json;
  readonly standardCents: bigint | null;
  readonly complete: boolean;
  readonly milesSource: MilesSource | null;
  readonly errors: string[];
  readonly warnings: string[];
}

/** One use's standard side: its own miles priced, or its citing trips' logged miles. */
function useComparison(
  vehicleKey: string,
  use: Json,
  citing: readonly CitingTrip[],
  { mileageBands, yearBands, taxYear }: MileageContext,
): UseComparison {
  const errors: string[] = [];
  const warnings: string[] = [];
  const yearStart = `${String(taxYear)}-01-01`;
  const yearEnd = `${String(taxYear)}-12-31`;
  const bandRows = asArray(use.miles) as Json[];
  const businessMiles = decOrNull(use.business_miles);
  const logged = citing.filter((trip) => trip.miles !== null);
  const tripMiles = logged.reduce((sum, trip) => sum + (trip.miles ?? 0), 0);
  const milesSteps: string[] = [];
  let milesSource: MilesSource | null =
    bandRows.length > 0 || (businessMiles !== null && businessMiles.v > 0n) ? 'stated' : null;
  let standardCents: bigint | null = null;
  let complete = false;
  if (milesSource === null && logged.length > 0) {
    // The year states no miles: the standard side prices the trips' logged miles, each trip at
    // the band covering its first day, with one rounding over the whole sum.
    milesSource = 'trips';
    let pricedProduct = 0n;
    let priced = yearBands.length > 0;
    for (const trip of citing) {
      if (trip.miles === null) {
        milesSteps.push(`${trip.key} ${tripDays(trip)}: miles not stated`);
        continue;
      }
      const band = yearBands.find(
        (candidate) => candidate.from <= trip.first && trip.first <= candidate.to,
      );
      if (band === undefined) {
        priced = false;
        milesSteps.push(`${trip.key} ${tripDays(trip)}: ${String(trip.miles)} miles`);
        continue;
      }
      pricedProduct += BigInt(trip.miles) * SCALE * parseDec(band.cents).v;
      milesSteps.push(
        `${trip.key} ${tripDays(trip)}: ${String(trip.miles)} miles x ${band.cents} cents`,
      );
    }
    if (yearBands.length === 0) {
      warnings.push(
        `${vehicleKey}: the mileage file carries no band for tax year ${String(taxYear)}; the standard figure is not computed`,
      );
    } else if (!priced) {
      warnings.push(
        `${vehicleKey}: a trip's first day falls in no mileage band of tax year ${String(taxYear)}; the standard figure is not computed`,
      );
    } else {
      // Miles times cents-per-mile is cents; both factors carry SCALE, so one rounding
      // divides the trips' whole sum by the money scale squared.
      standardCents = divideHalfUp(pricedProduct, SCALE * SCALE);
      complete = true;
    }
    milesSteps.push(
      `standard mileage = ${String(tripMiles)} miles from the trips = ${standardCents === null ? 'not computed' : fmtCents(standardCents)}`,
    );
  } else {
    const milesTotal = { v: 0n };
    let pricedProduct = 0n;
    const priced: PricedBand[] = [];
    const seenBands = new Set<string>();
    let coveredBands = 0;
    let unknownBand = false;
    for (const rawBand of bandRows) {
      const band = asObject(rawBand);
      const from = text(band.from);
      const to = text(band.to);
      const fileBand = mileageBands.find(
        (candidate) => candidate.from === from && candidate.to === to,
      );
      if (fileBand === undefined) {
        errors.push(
          `${vehicleKey}: miles band ${from} to ${to} matches no band in the mileage file`,
        );
        unknownBand = true;
        continue;
      }
      if (!(from <= yearEnd && to >= yearStart)) continue;
      // A repeated band would count its miles twice and could complete the year short a band.
      if (seenBands.has(`${from} ${to}`)) {
        errors.push(`${vehicleKey}: miles band ${from} to ${to} is repeated`);
        unknownBand = true;
        continue;
      }
      seenBands.add(`${from} ${to}`);
      const miles = decOrNull(band.miles);
      if (miles === null) {
        errors.push(`${vehicleKey}: miles band ${from} to ${to} carries no parsable miles value`);
        continue;
      }
      if (miles.v < 0n) {
        errors.push(`${vehicleKey}: miles band ${from} to ${to} carries negative miles`);
        unknownBand = true;
        continue;
      }
      milesTotal.v += miles.v;
      const product = miles.v * parseDec(fileBand.cents).v;
      pricedProduct += product;
      priced.push({ from, to, miles, rate: fileBand.cents, product });
      coveredBands += 1;
    }
    if (unknownBand) {
      // The error above names the band; the standard side stays unpriced.
    } else if (yearBands.length === 0) {
      warnings.push(
        `${vehicleKey}: the mileage file carries no band for tax year ${String(taxYear)}; the standard figure is not computed`,
      );
    } else if (bandRows.length === 0 && yearBands.length === 1) {
      // No band breakdown staged: a single-band year prices the year's business_miles total.
      // With several overlapping bands no single rate answers, so the year falls through to
      // the partial-cover warning below.
      const only = yearBands[0];
      if (only !== undefined && businessMiles !== null && businessMiles.v >= 0n) {
        const product = businessMiles.v * parseDec(only.cents).v;
        standardCents = divideHalfUp(product, SCALE * SCALE);
        complete = true;
        milesSteps.push(
          ...bandSteps([
            { from: only.from, to: only.to, miles: businessMiles, rate: only.cents, product },
          ]),
        );
      } else {
        warnings.push(
          `${vehicleKey}: no miles breakdown and no business_miles; the standard figure is not computed`,
        );
      }
    } else if (coveredBands === yearBands.length) {
      // Miles times cents-per-mile is cents; both factors carry SCALE, so one rounding divides
      // the whole year's sum by the money scale squared.
      standardCents = divideHalfUp(pricedProduct, SCALE * SCALE);
      complete = true;
      milesSteps.push(...bandSteps(priced));
      if (businessMiles !== null && businessMiles.v !== milesTotal.v) {
        errors.push(
          `${vehicleKey}: business_miles ${text(use.business_miles)} disagrees with the band total ${fmtDec(milesTotal)}`,
        );
      }
    } else {
      // Partial band cover prices nothing: the standard side is simply incomplete.
      warnings.push(
        `${vehicleKey}: the miles list does not cover every band of tax year ${String(taxYear)}; the standard figure is not computed`,
      );
    }
    if (citing.length > 0) {
      // The trips' logged miles beside the stated year, priced into neither figure.
      for (const trip of citing) {
        milesSteps.push(
          `${trip.key} ${tripDays(trip)}: ${trip.miles === null ? 'miles not stated' : `${String(trip.miles)} miles`}`,
        );
      }
      milesSteps.push(
        `trips' logged miles = ${String(tripMiles)}${milesSource === 'stated' ? ", beside the year's" : ''}`,
      );
    }
    const statedMiles = bandRows.length > 0 ? milesTotal : businessMiles;
    if (
      milesSource === 'stated' &&
      statedMiles !== null &&
      BigInt(tripMiles) * SCALE > statedMiles.v
    ) {
      warnings.push(
        `${vehicleKey}: the trips' logged miles (${String(tripMiles)}) exceed the year's stated business miles (${fmtDec(statedMiles)})`,
      );
    }
  }
  return {
    row: {
      use: strOrNull(use.key),
      entity: strOrNull(use.entity),
      business_miles: strOrNull(use.business_miles),
      miles_source: milesSource,
      trip_miles: tripMiles,
      trip_count: logged.length,
      trip_miles_unstated: citing.length - logged.length,
      standard_mileage: standardCents === null ? null : fmtCents(standardCents),
      standard_mileage_cents: standardCents === null ? null : Number(standardCents),
      standard_complete: complete,
      steps: milesSteps,
    },
    standardCents,
    complete,
    milesSource,
    errors,
    warnings,
  };
}

/** The uses' business miles as the car's: none stated is null, one is its own text, more their sum. */
function businessMilesOf(uses: readonly Json[]): string | null {
  const stated = uses.map((use) => strOrNull(use.business_miles)).filter((miles) => miles !== null);
  const [only] = stated;
  if (only === undefined) return null;
  if (stated.length === 1) return only;
  return fmtDec({ v: stated.reduce((sum, miles) => sum + (decOrNull(miles)?.v ?? 0n), 0n) });
}

/** One row per profile vehicle, each carrying one row per place that uses it. */
export function vehicleComparisons(inputs: VehicleInputs): {
  rows: Json[];
  errors: string[];
  warnings: string[];
} {
  const { vehiclesUsedTogether, vehicleLines, mileageRules, taxYear } = inputs;
  const errors: string[] = [];
  const warnings: string[] = [];
  const mileage: MileageContext = {
    mileageBands: (asArray(mileageRules.business_cents_per_mile) as Json[]).map((band) => ({
      from: text(band.from),
      to: text(band.to),
      cents: text(band.cents),
    })),
    yearBands: mileageBandsOf(mileageRules, taxYear),
    taxYear,
  };
  const fiveOrMoreThreshold = intOrNull(
    mileageRules.unavailable_when_vehicles_used_together_at_least,
  );
  const rows: Json[] = [];
  for (const rawVehicle of inputs.vehicles) {
    const vehicle = asObject(rawVehicle);
    const vehicleKey = text(vehicle.key);
    const citing = tripsCiting(inputs.trips, vehicleKey);
    const logged = citing.filter((trip) => trip.miles !== null);
    const useEntries = asArray(vehicle.uses).map(asObject);
    if (useEntries.length > 1) {
      errors.push(
        `${vehicleKey}: more than one place uses this vehicle; its trips' miles cannot be told apart by place`,
      );
    }
    if (useEntries.length === 0) {
      warnings.push(
        `${vehicleKey}: no place uses this vehicle; the standard figure is not computed`,
      );
    }
    const uses = useEntries.map((use) => useComparison(vehicleKey, use, citing, mileage));
    for (const use of uses) {
      errors.push(...use.errors);
      warnings.push(...use.warnings);
    }
    // The car's standard figure is the sum of its uses' rounded figures, so the places add up to
    // the whole by construction; one unpriced use leaves the car's unpriced.
    const standardCents =
      uses.length === 0 || uses.some((use) => use.standardCents === null)
        ? null
        : uses.reduce((sum, use) => addCents(sum, use.standardCents ?? 0n), 0n);
    const attributed = vehicleLines.get(vehicleKey) ?? [];
    let actual = 0n;
    for (const line of attributed) actual = addCents(actual, line.cents);
    const steps = [
      ...uses.flatMap((use) => use.row.steps as string[]),
      ...attributed.map((line) => vehicleLineStep(line.id, line.cents)),
      vehicleActualCostStep(actual),
    ];
    const unavailable: string[] = [];
    if (strOrNull(vehicle.first_year_method) === 'actual_cost')
      unavailable.push('first_year_actual');
    const taken = decOrNull(vehicle.depreciation_taken);
    if (taken !== null && taken.v > 0n) unavailable.push('depreciation_taken');
    if (
      vehiclesUsedTogether !== null &&
      fiveOrMoreThreshold !== null &&
      vehiclesUsedTogether >= fiveOrMoreThreshold
    ) {
      unavailable.push('five_or_more');
    }
    const milesSource: MilesSource | null = uses.some((use) => use.milesSource === 'stated')
      ? 'stated'
      : uses.some((use) => use.milesSource === 'trips')
        ? 'trips'
        : null;
    rows.push({
      vehicle: vehicleKey,
      description: strOrNull(vehicle.description),
      first_year_method: strOrNull(vehicle.first_year_method),
      standard_mileage: standardCents === null ? null : fmtCents(standardCents),
      standard_mileage_cents: standardCents === null ? null : Number(standardCents),
      standard_complete: uses.length > 0 && uses.every((use) => use.complete),
      actual_cost: fmtCents(actual),
      actual_cost_cents: Number(actual),
      business_miles: businessMilesOf(useEntries),
      miles_source: milesSource,
      trip_miles: logged.reduce((sum, trip) => sum + (trip.miles ?? 0), 0),
      trip_count: logged.length,
      trip_miles_unstated: citing.length - logged.length,
      unavailable_reasons: unavailable,
      uses: uses.map((use) => use.row),
      steps,
      note: 'Both methods shown for the accountant; the exclusions are listed, never applied. Parking and tolls stay on their own lines, in neither figure.',
    });
  }
  return { rows, errors, warnings };
}

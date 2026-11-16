/**
 * Depreciation: the register's straight-line, mid-month booking for real property (decision
 * record 0061's Publication 946 chapter 4 fraction, one rounding at the cent on each year's
 * product), and the capital-cost comparisons (issue #691, decision record 0105's amendment), two
 * readings of the same facts each, computed from rules data and never chosen between.
 */
import { isValidDay } from '../dates';
import { addCents, divideHalfUp, fmtCents, parseDec, SCALE, toCents, type Dec } from '../money';
import {
  expenseComparisonKind,
  expenseMacrsRows,
  improvementRepairRows,
  isPersonalClass,
  type CapitalAsset,
  type CapitalCostRules,
  type TaggedLine,
} from '../scripts/capital_costs';
import type { LineBooking } from './schedules';
import { asArray, asObject, named, strOrNull, text, type Json } from './values';

export interface RegisterInputs {
  readonly entities: ReadonlyMap<string, Json>;
  readonly depreciationRules: Json;
  readonly capitalCostRules: CapitalCostRules;
  readonly taxYear: number;
}

export interface Register {
  /** The register's rows: one booked row per asset with a rule, one inputs-only row otherwise. */
  readonly rows: Json[];
  readonly totalCents: bigint;
  /** The expensing-or-MACRS comparison's inputs (issue #691): the equipment and improvements
   *  placed in service in the tax year, each with what the register booked for it. */
  readonly capitalAssets: CapitalAsset[];
  /** Each booked amount, on Schedule E line 18 or Schedule C line 13. */
  readonly bookings: LineBooking[];
  readonly errors: string[];
  readonly warnings: string[];
}

/** Months scaled by 2 rendered the way the step text reads them: 24 → "12", 13 → "6.5". */
function fmtMonths(monthsHalf: bigint): string {
  const whole = monthsHalf / 2n;
  const half = monthsHalf % 2n === 1n;
  return half ? `${whole.toString()}.5` : whole.toString();
}

/** One year's booking: its cents and the step line that shows how they were figured. */
type YearBooking = { cents: bigint; step: string };

/**
 * The Publication 946 chapter 4 fraction for each tax year of one asset: the full-year amount on
 * the original basis times the year's months in service, the placed month counted from its
 * midpoint and the disposal month through it, one rounding at the cent on the year's product. A
 * middle year never touches remaining basis or remaining life, and the year holding the recovery
 * period's last month books the basis left unrecovered instead.
 */
export function yearBookings(asset: {
  readonly basis: Dec;
  readonly basisCents: bigint;
  readonly years: Dec;
  readonly placedInService: string;
  readonly disposedOn: string | null;
}): (year: number) => YearBooking {
  const { basis, basisCents, years, placedInService, disposedOn } = asset;
  const placedMonth = Number(placedInService.slice(5, 7));
  const placedYear = Number(placedInService.slice(0, 4));
  const disposalYear = disposedOn === null ? 0 : Number(disposedOn.slice(0, 4));
  const disposalMonth = disposedOn === null ? 0 : Number(disposedOn.slice(5, 7));
  const annualCents = divideHalfUp(basis.v * 100n, years.v);
  // The recovery period spans recovery_years x 24 half-months from the midpoint of the
  // placed-in-service month; the year holding its last half-month closes the period.
  const totalHalfMonths = (years.v * 24n) / SCALE;
  const finalYear =
    placedYear + Number((totalHalfMonths - BigInt(25 - 2 * placedMonth) + 23n) / 24n);
  const lastMonth = Number((BigInt(placedMonth - 1) + totalHalfMonths / 2n) % 12n) + 1;
  const heldThroughRecoveryEnd =
    disposedOn === null ||
    disposalYear > finalYear ||
    (disposalYear === finalYear && disposalMonth >= lastMonth);
  const bookByYear = new Map<number, YearBooking>();
  const book = (year: number): YearBooking => {
    const cached = bookByYear.get(year);
    if (cached !== undefined) return cached;
    // Every earlier year first, in order, so the accumulation carries only clamped
    // amounts: a year's booking is clamped to what the basis still has left, so a
    // tiny basis whose rounded fractions outpace it can never book a negative year
    // or push the lifetime total past the basis.
    let accumulatedSoFar = 0n;
    for (let earlierYear = placedYear; earlierYear < year; earlierYear++) {
      accumulatedSoFar += book(earlierYear).cents;
    }
    const remaining = basisCents - accumulatedSoFar;
    const clamp = (raw: YearBooking): YearBooking => {
      if (raw.cents >= 0n && raw.cents <= remaining) return raw;
      const cents = raw.cents < 0n ? 0n : remaining;
      return {
        cents,
        step: `${String(year)} = capped at the remaining basis = ${fmtCents(cents)}`,
      };
    };
    const fraction = (monthsHalf: bigint): YearBooking => {
      const cents = divideHalfUp(basis.v * monthsHalf * 100n, years.v * 24n);
      return {
        cents,
        step: `${String(year)} = ${fmtCents(annualCents)} x ${fmtMonths(monthsHalf)} / 12 months = ${fmtCents(cents)}`,
      };
    };
    const zero = (why: string): YearBooking => ({
      cents: 0n,
      step: `${String(year)} = 0.00 (${why})`,
    });
    let computed: YearBooking;
    if (year < placedYear) {
      computed = zero(`placed in service ${placedInService}`);
    } else if (disposedOn !== null && disposalYear === placedYear) {
      if (year !== placedYear) computed = zero(`disposed ${disposedOn}`);
      else if (disposalMonth === placedMonth) {
        computed = zero('placed and disposed in the same month');
      } else {
        computed = fraction(BigInt(2 * (disposalMonth - placedMonth)));
      }
    } else if (year > finalYear) {
      computed = zero('the recovery period ended');
    } else if (disposedOn !== null && year > disposalYear) {
      computed = zero(`disposed ${disposedOn}`);
    } else if (year === finalYear && heldThroughRecoveryEnd) {
      // The closing year always books the schedule's own accumulation, never the
      // profile's recorded carryforward: a recorded figure the schedule disagrees
      // with is flagged by the register and left to the accountant, never chosen between.
      computed = {
        cents: remaining,
        step: `${String(year)} = unrecovered basis = ${fmtCents(basisCents)} - ${fmtCents(accumulatedSoFar)} = ${fmtCents(remaining)}`,
      };
    } else if (year === placedYear) {
      computed = fraction(BigInt(25 - 2 * placedMonth));
    } else if (disposedOn !== null && year === disposalYear) {
      computed = fraction(BigInt(2 * disposalMonth - 1));
    } else {
      computed = fraction(24n);
    }
    const bookedYear = clamp(computed);
    bookByYear.set(year, bookedYear);
    return bookedYear;
  };
  return book;
}

/** The register over every entity's assets for the tax year. */
export function depreciationRegister(inputs: RegisterInputs): Register {
  const { entities, depreciationRules, capitalCostRules, taxYear } = inputs;
  const errors: string[] = [];
  const warnings: string[] = [];
  const rows: Json[] = [];
  const bookings: LineBooking[] = [];
  const capitalAssets: CapitalAsset[] = [];
  let totalCents = 0n;
  for (const [entityKey, entity] of entities) {
    const entitySchedule = strOrNull(entity.schedule);
    for (const rawAsset of asArray(entity.assets)) {
      const asset = asObject(rawAsset);
      const assetClass = strOrNull(asset['class']);
      const rule =
        assetClass === null || depreciationRules[assetClass] === undefined
          ? null
          : (depreciationRules[assetClass] as Json);
      if (isPersonalClass(capitalCostRules, assetClass)) {
        // A personal-property class has its rule in capital_costs.json, and its first-year
        // method is the accountant's: the register books nothing, and expense_macrs shows both
        // readings for an asset placed in service this year.
        warnings.push(
          `${entityKey}: asset class ${named(assetClass)} is personal property; the register books no depreciation for it`,
        );
      } else if (assetClass === null || rule === null) {
        warnings.push(`${entityKey}: asset class ${named(assetClass)} has no depreciation rule`);
      }
      let basis: Dec;
      try {
        const cost = parseDec(text(asset.cost_basis));
        const land = parseDec(text(asset.land_value ?? '0'));
        basis = { v: cost.v - land.v };
      } catch {
        errors.push(`${entityKey}: asset ${text(asset.description)} is missing basis or date`);
        continue;
      }
      const placedInService = text(asset.placed_in_service);
      if (!isValidDay(placedInService)) {
        errors.push(`${entityKey}: asset ${text(asset.description)} is missing basis or date`);
        continue;
      }
      if (basis.v < 0n) {
        errors.push(
          `${entityKey}: asset ${text(asset.description)} has a negative depreciable basis (cost below land)`,
        );
        continue;
      }
      const basisCents = toCents(basis);
      let disposedOn: string | null = null;
      if (asset.disposed_on !== undefined && asset.disposed_on !== null) {
        disposedOn = text(asset.disposed_on);
        if (!isValidDay(disposedOn)) {
          errors.push(`${entityKey}: asset ${text(asset.description)} has a bad disposed_on date`);
          continue;
        }
        if (disposedOn < placedInService) {
          errors.push(
            `${entityKey}: asset ${text(asset.description)} is disposed before it was placed in service`,
          );
          continue;
        }
      }
      let recordedPriorAccumulated: bigint | null = null;
      if (asset.prior_accumulated !== undefined && asset.prior_accumulated !== null) {
        try {
          recordedPriorAccumulated = toCents(parseDec(text(asset.prior_accumulated)));
        } catch {
          errors.push(
            `${entityKey}: asset ${text(asset.description)} has a bad prior_accumulated value`,
          );
          continue;
        }
        // Accumulated straight-line depreciation is never negative and never
        // passes the depreciable basis; either would book a nonsense line.
        if (recordedPriorAccumulated < 0n) {
          errors.push(
            `${entityKey}: asset ${text(asset.description)} has a negative prior_accumulated carryforward`,
          );
          continue;
        }
        if (recordedPriorAccumulated > basisCents) {
          errors.push(
            `${entityKey}: asset ${text(asset.description)} has a prior_accumulated above the depreciable basis`,
          );
          continue;
        }
      }
      if (assetClass === null || rule === null) {
        // The expensing comparison covers this inputs-only row when the asset is equipment or an
        // improvement placed in service this year (expenseComparisonKind): a real-property class
        // never reaches here, because the register books it.
        const comparedKind = expenseComparisonKind(
          asset.kind,
          assetClass,
          capitalCostRules,
          depreciationRules,
        );
        if (comparedKind !== null && placedInService.slice(0, 4) === String(taxYear)) {
          capitalAssets.push({
            registerIndex: rows.length,
            entity: entityKey,
            description: text(asset.description) || null,
            kind: comparedKind,
            assetClass,
            placedInService,
            disposedOn,
            basisCents,
          });
        }
        // No rule for the class: the register lists the asset's inputs for the
        // accountant and books nothing, and the run passes.
        const row: Json = {
          entity: entityKey,
          asset: text(asset.description) || null,
          class: assetClass,
          cost_basis: text(asset.cost_basis),
          land_value: text(asset.land_value ?? '0'),
          placed_in_service: placedInService,
          basis_cents: Number(basisCents),
          computed: false,
        };
        if (isPersonalClass(capitalCostRules, assetClass)) row.personal_property = true;
        if (disposedOn !== null) row.disposed_on = disposedOn;
        if (recordedPriorAccumulated !== null) {
          row.recorded_prior_accumulated_cents = Number(recordedPriorAccumulated);
        }
        rows.push(row);
        continue;
      }
      if (assetClass === 'commercial_rental' && placedInService < '1993-05-13') {
        errors.push(
          `${entityKey}: asset ${text(asset.description)} placed in service ${placedInService} precedes 1993-05-13, the earliest date these rules carry`,
        );
        continue;
      }
      const years = parseDec(text(rule.recovery_years));
      const placedYear = Number(placedInService.slice(0, 4));
      const annualCents = divideHalfUp(basis.v * 100n, years.v);
      const book = yearBookings({ basis, basisCents, years, placedInService, disposedOn });
      const booked = book(taxYear);
      const amountCents = booked.cents;
      const line = entitySchedule === 'E' ? '18' : '13';
      // The register's prior figure is the schedule's own accumulation through the year
      // before the tax year, computed here year by year - never read from the profile.
      let priorCents = 0n;
      for (let earlierYear = placedYear; earlierYear < taxYear; earlierYear++) {
        priorCents += book(earlierYear).cents;
      }
      const rawAccumulated = priorCents + amountCents;
      const accumulatedCents = rawAccumulated > basisCents ? basisCents : rawAccumulated;
      const remainingCents = basisCents - accumulatedCents;
      const row: Json = {
        entity: entityKey,
        asset: text(asset.description) || null,
        line,
        amount: fmtCents(amountCents),
        amount_cents: Number(amountCents),
        prior_accumulated_cents: Number(priorCents),
        accumulated_cents: Number(accumulatedCents),
        remaining_basis_cents: Number(remainingCents),
        steps: [
          `depreciable basis = ${fmtCents(toCents(parseDec(text(asset.cost_basis))))} - ${fmtCents(toCents(parseDec(text(asset.land_value ?? '0'))))} = ${fmtCents(basisCents)}`,
          `annual = ${fmtCents(basisCents)} / ${text(rule.recovery_years)} years = ${fmtCents(annualCents)}`,
          booked.step,
          `prior accumulated through ${String(taxYear - 1)} = ${fmtCents(priorCents)}`,
          `accumulated in ${String(taxYear)} = ${fmtCents(priorCents)} + ${fmtCents(amountCents)} = ${fmtCents(accumulatedCents)}`,
          `remaining basis = ${fmtCents(basisCents)} - ${fmtCents(accumulatedCents)} = ${fmtCents(remainingCents)}`,
        ],
      };
      if (recordedPriorAccumulated !== null && recordedPriorAccumulated !== priorCents) {
        row.recorded_prior_accumulated_cents = Number(recordedPriorAccumulated);
        warnings.push(
          `${entityKey}: asset ${text(asset.description)} carries a recorded prior_accumulated of ${fmtCents(recordedPriorAccumulated)} but the schedule computes ${fmtCents(priorCents)} through ${String(taxYear - 1)}`,
        );
      }
      rows.push(row);
      totalCents = addCents(totalCents, amountCents);
      if (entitySchedule === 'C' || entitySchedule === 'E') {
        bookings.push({
          entity: entityKey,
          line,
          cents: amountCents,
          entry: {
            depreciation: text(asset.description),
            usd_cents: Number(amountCents),
            fx: null,
          },
        });
      }
    }
  }
  return { rows, totalCents, capitalAssets, bookings, errors, warnings };
}

export interface ComparisonInputs {
  readonly taggedLines: readonly TaggedLine[];
  readonly capitalAssets: readonly CapitalAsset[];
  readonly entities: ReadonlyMap<string, Json>;
  readonly depreciationRules: Json;
  readonly capitalCostRules: CapitalCostRules;
  readonly taxYear: number;
}

/**
 * The capital-cost comparisons (issue #691): a tagged line expensed or capitalized, an asset
 * expensed or depreciated. Nothing here books.
 */
export function capitalCostComparisons(inputs: ComparisonInputs): {
  improvementRepair: Json[];
  expenseMacrs: Json[];
} {
  return {
    improvementRepair: improvementRepairRows(
      inputs.taggedLines,
      inputs.entities,
      inputs.depreciationRules,
    ),
    expenseMacrs: expenseMacrsRows(inputs.capitalAssets, inputs.capitalCostRules, inputs.taxYear),
  };
}

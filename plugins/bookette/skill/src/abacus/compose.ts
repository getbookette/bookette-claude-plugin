/**
 * Abacus: the books computed from the run's inputs, every figure in this package and none from a
 * model. `computeBooks` reads files only through the conversion and rules lookup it is handed -
 * the script layer (scripts/build_books.ts) reads the workspace and the staged rules into
 * `AbacusInputs` - and runs each module in the order its inputs need: the ledger placed, the
 * register's depreciation and the property-tax pieces booked onto the same lines, then the
 * reports read off them. Every module's errors and warnings join the checks in that order, and
 * the build passes exactly when none reported an error.
 */
import type { CapitalCostRules } from '../scripts/capital_costs';
import type { HomeOfficeResult } from '../scripts/home_office';
import { fmtCents } from '../money';
import { capitalCostComparisons, depreciationRegister } from './depreciation';
import type { Convert } from './fx-use';
import { rentalUseRows } from './rental-use';
import { bookOnLines, combinedTotals, entityReports, placeLedger } from './schedules';
import { taxPaymentPieces } from './tax-payments';
import { tripComparisons } from './trips';
import { strayVehicleWarning, vehicleComparisons, vehiclesUsedTogetherOf } from './vehicles';
import { asArray, text, type Json } from './values';

const LABEL =
  'Prepared from your records for review by your accountant. Not a tax return and not tax advice.';

export type BooksResult = Json;

/** The error when the converted ledger and what was placed differ, or null when they agree. */
export function ledgerBalanceError(ledgerTotal: bigint, placedTotal: bigint): string | null {
  return ledgerTotal === placedTotal
    ? null
    : `ledger total ${fmtCents(ledgerTotal)} != placed total ${fmtCents(placedTotal)}`;
}

/** The books' checks object: passed exactly when no module reported an error. */
export function checksOf(
  errors: string[],
  warnings: string[],
  ledgerItems: number,
): { passed: boolean; errors: string[]; warnings: string[]; ledger_items: number } {
  return { passed: errors.length === 0, errors, warnings, ledger_items: ledgerItems };
}

/** Everything a build reads, already read: the files' contents and the two lookups bound to the
 *  staged rules directory and the run's rate snapshot. */
export interface AbacusInputs {
  /** The staged profile.json's year: the books' tax year and the rules directory's. */
  readonly taxYear: number;
  /** The resolved profile (else the staged one) with the recorded `profile_fact:` answers laid on. */
  readonly profile: Json;
  readonly ledger: readonly Json[];
  /** out/donations.json as written, or empty. */
  readonly donations: readonly unknown[];
  /** The payments `readTaxPayments` reads: out/tax_payments.json, else the confirmed ones, or empty. */
  readonly taxPayments: readonly unknown[];
  readonly scheduleLines: Json;
  readonly perDiem: Json;
  readonly depreciationRules: Json;
  readonly mileageRules: Json;
  readonly rentalUseRules: Json;
  readonly capitalCostRules: CapitalCostRules;
  /** out/web_values.json's and confirmed/web_values.json's entries. */
  readonly outValues: readonly Json[];
  readonly confirmedValues: readonly Json[];
  /** Whether the staged rules data already carries a web value's key. */
  readonly rulesCovered: (key: string) => boolean;
  /** Both home-office readings, shown side by side and booked on no line. */
  readonly homeOffice: HomeOfficeResult;
  /** The ledger's own fx path. */
  readonly convert: Convert;
}

export function computeBooks(inputs: AbacusInputs): { result: BooksResult; errors: string[] } {
  const { taxYear, profile, scheduleLines, depreciationRules, capitalCostRules, convert } = inputs;
  const errors: string[] = [];
  const warnings: string[] = [];
  const entityList = asArray(profile.entities) as Json[];
  const entities = new Map<string, Json>(entityList.map((entity) => [text(entity.key), entity]));
  const tripList = asArray(profile.trips) as Json[];
  const trips = new Map<string, Json>(tripList.map((trip) => [text(trip.key), trip]));
  const vehicleList = asArray(profile.vehicles) as Json[];
  const vehicles = new Map<string, Json>(
    vehicleList.map((vehicle) => [text(vehicle.key), vehicle]),
  );
  const vehiclesUsedTogether = vehiclesUsedTogetherOf(profile);

  const placed = placeLedger({
    ledger: inputs.ledger,
    taxYear,
    entities,
    trips,
    vehicles,
    scheduleLines,
    convert,
  });
  errors.push(...placed.errors);
  const { books } = placed;

  const register = depreciationRegister({
    entities,
    depreciationRules,
    capitalCostRules,
    taxYear,
  });
  errors.push(...register.errors);
  warnings.push(...register.warnings);
  bookOnLines(books, scheduleLines, register.bookings);

  const tripRows = tripComparisons({
    trips,
    perDiem: inputs.perDiem,
    outValues: inputs.outValues,
    confirmedValues: inputs.confirmedValues,
    rulesCovered: inputs.rulesCovered,
    mealsByTrip: placed.mealsByTrip,
    usdByMeal: placed.usdByMeal,
  });
  warnings.push(...tripRows.warnings);
  const stray = strayVehicleWarning(placed.strayVehicleLines);
  if (stray !== null) warnings.push(stray);
  const balance = ledgerBalanceError(placed.ledgerTotal, placed.placedTotal);
  if (balance !== null) errors.push(balance);

  const tax = taxPaymentPieces({
    profile,
    taxPayments: inputs.taxPayments,
    books,
    convert,
    taxYear,
  });
  errors.push(...tax.errors);
  warnings.push(...tax.warnings);
  bookOnLines(books, scheduleLines, tax.bookings);

  // Both home-office readings are reported side by side and neither is booked: the method is
  // the accountant's choice (invariant 5; decision record 0011's #1080 amendment).
  errors.push(...inputs.homeOffice.errors);

  const entityRows = entityReports(books, scheduleLines);
  // The combined figures the report's tables persist (issue #1112): the year's organized
  // expenses and the Schedule E worksheet's combined column, summed here where the per-entity
  // totals are, so the screen reads them and never sums.
  const combined = combinedTotals(books, scheduleLines);
  const vehicleRows = vehicleComparisons({
    vehicles: vehicleList,
    trips: tripList,
    vehiclesUsedTogether,
    vehicleLines: placed.vehicleLines,
    mileageRules: inputs.mileageRules,
    taxYear,
  });
  errors.push(...vehicleRows.errors);
  warnings.push(...vehicleRows.warnings);

  const rental = rentalUseRows({
    entities,
    books,
    scheduleLines,
    rentalUseRules: inputs.rentalUseRules,
    taxYear,
  });
  errors.push(...rental.errors);

  const comparisons = capitalCostComparisons({
    taggedLines: placed.taggedLines,
    capitalAssets: register.capitalAssets,
    entities,
    depreciationRules,
    capitalCostRules,
    taxYear,
  });

  const result: BooksResult = {
    label: LABEL,
    tax_year: taxYear,
    entities: entityRows,
    expense_total_cents: combined.expense_total_cents,
    schedule_e_totals: combined.schedule_e_totals,
    depreciation: register.rows,
    depreciation_total_cents: Number(register.totalCents),
    trips: tripRows.rows,
    vehicles: vehicleRows.rows,
    rental_use: rental.rows,
    home_office: inputs.homeOffice.rows,
    improvement_repair: comparisons.improvementRepair,
    expense_macrs: comparisons.expenseMacrs,
    donations: inputs.donations,
    unassigned: placed.unassigned,
    // What is dated outside the tax year (decision record 0148), by kind: the ledger lines with
    // what they would have taken, then the staged property-tax payments, then the home costs —
    // listed for the accountant and counted in none of the figures above.
    outside_year: [...placed.outsideYear, ...tax.outsideYear, ...inputs.homeOffice.outsideYear],
    // The in-year lines the run's rates cannot price (decision record 0159), with what they will
    // take: present only when a line is unpriced, so books with none read as before.
    ...(placed.unpriced.length > 0 ? { unpriced: placed.unpriced } : {}),
    // Present only when a line is settled, so books with none read as before.
    ...(placed.settled.length > 0 ? { settled: placed.settled } : {}),
    fx_used: placed.fxUsed,
    checks: checksOf(errors, warnings, placed.ledgerItems),
  };
  return { result, errors };
}

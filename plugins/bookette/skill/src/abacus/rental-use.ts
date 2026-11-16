/**
 * The rental-day analysis (issue #110, decision record 0105): for a short-term rental, or any
 * entity carrying a day count, the six threshold predicates and three unbooked allocation
 * products, each one rounding at the cent. The schedule is copied onto the row, never written
 * back, and the expense totals are untouched.
 */
import { dayOrdinal } from '../dates';
import { addCents, divideHalfUp, fmtCents } from '../money';
import { incomeLinesOf, requireBook, type Book } from './schedules';
import { asArray, asObject, intOrNull, strOrNull, type Json } from './values';

export interface RentalUseInputs {
  readonly entities: ReadonlyMap<string, Json>;
  /** The books with every figure booked: the products read their line totals. */
  readonly books: ReadonlyMap<string, Book>;
  readonly scheduleLines: Json;
  readonly rentalUseRules: Json;
  readonly taxYear: number;
}

/**
 * The rules file's named threshold. The rules data is baked into the image, so a key it does not
 * carry (or carries as something but an integer) is a packaging error, never a silent pricing at
 * the code-baked number: the published default keeps the predicates defined while the pushed
 * error refuses the run.
 */
function ruleInt(rules: Json, key: string, fallback: number, errors: string[]): number {
  const value = rules[key];
  if (value === undefined) {
    errors.push(`rental_use.json carries no ${key}; the packaged rules file is incomplete`);
    return fallback;
  }
  const parsed = intOrNull(value);
  if (parsed === null) {
    errors.push(`rental_use.json ${key} is not an integer; the packaged rules file is incomplete`);
    return fallback;
  }
  return parsed;
}

/** One row per short-term rental or day-count-carrying entity, in the profile's order. */
export function rentalUseRows(inputs: RentalUseInputs): { rows: Json[]; errors: string[] } {
  const { entities, books, scheduleLines, rentalUseRules, taxYear } = inputs;
  const errors: string[] = [];
  const interestAndTaxesLines = asObject(rentalUseRules.interest_and_taxes_lines);
  const rentalUnder15 = ruleInt(rentalUseRules, 'rental_under_15_days', 15, errors);
  const personalOverDays = ruleInt(rentalUseRules, 'personal_over_days', 14, errors);
  const personalOverPct = ruleInt(rentalUseRules, 'personal_over_10_pct_of_rental', 10, errors);
  const stayShort = ruleInt(rentalUseRules, 'average_stay_days_short', 7, errors);
  const stayLong = ruleInt(rentalUseRules, 'average_stay_days_long', 30, errors);
  const daysInYear =
    dayOrdinal(`${String(taxYear + 1)}-01-01`) - dayOrdinal(`${String(taxYear)}-01-01`);
  const rows: Json[] = [];
  for (const [entityKey, entity] of entities) {
    const fair = intOrNull(entity.fair_rental_days);
    const personal = intOrNull(entity.personal_use_days);
    const stays = intOrNull(entity.stay_count);
    if (strOrNull(entity.kind) !== 'short_term_rental' && fair === null && personal === null) {
      continue;
    }
    const book = requireBook(books, entityKey);
    const schedule = strOrNull(entity.schedule);
    const incomeLines = incomeLinesOf(scheduleLines, schedule);
    const iAndTLines = new Set(asArray(interestAndTaxesLines[schedule ?? '']) as string[]);
    let operating = 0n;
    let interestTaxes = 0n;
    for (const [line, slot] of book.lines) {
      if (incomeLines.includes(line)) continue;
      if (iAndTLines.has(line)) interestTaxes = addCents(interestTaxes, slot.total);
      else operating = addCents(operating, slot.total);
    }
    const under15 = fair === null ? null : fair < rentalUnder15;
    const over14 = personal === null ? null : personal > personalOverDays;
    const overPct = fair === null || personal === null ? null : personal * personalOverPct > fair;
    const residence = over14 === null || overPct === null ? null : over14 && overPct;
    const staysMissing = stays === null || stays === 0;
    const avgShort = fair === null || staysMissing ? null : fair <= stayShort * stays;
    const avgLong = fair === null || staysMissing ? null : fair <= stayLong * stays;
    const sharedDays = fair !== null && personal !== null ? fair + personal : null;
    const daysProduct = (cents: bigint): bigint | null =>
      sharedDays === null || sharedDays === 0 || fair === null
        ? null
        : divideHalfUp(cents * BigInt(fair), BigInt(sharedDays));
    const operatingAllocated = daysProduct(operating);
    const interestTaxesDays = daysProduct(interestTaxes);
    const interestTaxesYear =
      fair === null ? null : divideHalfUp(interestTaxes * BigInt(fair), BigInt(daysInYear));
    const steps: string[] = [];
    if (operatingAllocated !== null && sharedDays !== null) {
      steps.push(
        `operating by days = ${fmtCents(operating)} x ${String(fair)} / ${String(sharedDays)} = ${fmtCents(operatingAllocated)}`,
      );
    }
    if (interestTaxesDays !== null && sharedDays !== null) {
      steps.push(
        `interest and taxes by days = ${fmtCents(interestTaxes)} x ${String(fair)} / ${String(sharedDays)} = ${fmtCents(interestTaxesDays)}`,
      );
    }
    if (interestTaxesYear !== null) {
      steps.push(
        `interest and taxes by year = ${fmtCents(interestTaxes)} x ${String(fair)} / ${String(daysInYear)} = ${fmtCents(interestTaxesYear)}`,
      );
    }
    rows.push({
      entity: entityKey,
      schedule: entity.schedule,
      fair_rental_days: fair,
      personal_use_days: personal,
      stay_count: stays,
      services_note: strOrNull(entity.services_note),
      rental_under_15: under15,
      personal_over_14: over14,
      personal_over_10_pct: overPct,
      residence_test: residence,
      average_at_most_7: avgShort,
      average_at_most_30: avgLong,
      operating_allocated: operatingAllocated === null ? null : fmtCents(operatingAllocated),
      operating_allocated_cents: operatingAllocated === null ? null : Number(operatingAllocated),
      interest_taxes_days: interestTaxesDays === null ? null : fmtCents(interestTaxesDays),
      interest_taxes_days_cents: interestTaxesDays === null ? null : Number(interestTaxesDays),
      interest_taxes_year: interestTaxesYear === null ? null : fmtCents(interestTaxesYear),
      interest_taxes_year_cents: interestTaxesYear === null ? null : Number(interestTaxesYear),
      steps,
      note: 'Day ratios shown for the accountant; nothing is booked from them.',
    });
  }
  return { rows, errors };
}

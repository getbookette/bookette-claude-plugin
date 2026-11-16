/**
 * What a build shows: books.md, rendered from the result exactly as books.json carries it, and the
 * rows `pipeline build` prints for the agent to act on. Both read the result alone.
 */
import { fmtCents } from '../money';
import type { BooksResult } from './compose';
import { DAY_TRIP_PER_DIEM } from '../comparison-words';
import { vehicleMilesWords, vehicleUseEntities } from './vehicles';
import { asArray, asObject, intOrNull, named, strOrNull, text, type Json } from './values';

/**
 * The rows of a build the agent must act on with a finding, a question or a web lookup (issue
 * #910), so `pipeline build` prints them and the agent never reads out/books.json back. Each row
 * is read off the result exactly as it is written to out/books.json and carries only the keys and
 * figures its finding or question needs:
 *
 * - `missing_rules_data`: a depreciation row with `computed: false`, and why (no class, or no rule
 *   for its class).
 * - `prior_accumulated_mismatch`: a computed depreciation row carrying
 *   `recorded_prior_accumulated_cents`, beside the schedule's own `prior_accumulated_cents`. A
 *   rule-less row lists a recorded carryforward among its inputs with nothing to compare it to,
 *   so it is never a mismatch.
 * - `missing_receipt`: the home-office row when it carries no regular reading, with what is
 *   missing — the condition check_outputs requires a missing_receipt finding under.
 * - `rental_use`: every rental-day analysis row, with the day counts its fair_rental_days or
 *   personal_use finding names and whether a services note is recorded.
 * - `missing_rate`: a trip whose per-diem comparison lacks a rate, with the locations to look up.
 * - `method_comparison`: the home-office row when it carries both readings (issue #1080) — the
 *   condition check_outputs requires a method_comparison finding under, since the method is the
 *   accountant's and no question asks it — and every improvement-or-repair row (its ledger line)
 *   and every expensing-or-MACRS row (its asset), with what its readings lack (issue #691). An
 *   inputs-only depreciation row the expensing comparison carries is that row's, never
 *   `missing_rules_data`.
 */
export type ActionRow =
  | { kind: 'missing_rules_data'; entity: string; asset: string | null; reason: string }
  | {
      kind: 'prior_accumulated_mismatch';
      entity: string;
      asset: string | null;
      recorded_cents: number;
      schedule_cents: number;
    }
  | { kind: 'missing_receipt'; entity: string; regular_missing: string[] }
  | {
      kind: 'rental_use';
      entity: string;
      fair_rental_days: number | null;
      personal_use_days: number | null;
      stay_count: number | null;
      services_note_recorded: boolean;
    }
  | { kind: 'missing_rate'; trip: string; locations: string[] }
  | { kind: 'method_comparison'; comparison: 'home_office'; entity: string }
  | {
      kind: 'method_comparison';
      comparison: 'improvement_repair';
      entity: string;
      ledger_id: string;
      missing: string[];
    }
  | {
      kind: 'method_comparison';
      comparison: 'expense_macrs';
      entity: string;
      asset: string | null;
      missing: string[];
    }
  | { kind: 'statement_mismatch'; stem: string };

export function actionRows(result: BooksResult): ActionRow[] {
  const rows: ActionRow[] = [];
  // An inputs-only register row the expensing comparison carries is that comparison's open item,
  // not missing rules data: its class is personal property (or not yet established), and the two
  // readings beside it are the record the accountant reads.
  const expenseMacrs = asArray(result.expense_macrs).map(asObject);
  // Joined by the register row's own index, never by entity and description: two assets may
  // share a description, and only the one the comparison carries is its open item.
  const compared = new Set(expenseMacrs.map((row) => row.register_index));
  for (const [index, row] of asArray(result.depreciation).map(asObject).entries()) {
    const entity = text(row.entity);
    const asset = strOrNull(row.asset);
    if (row.computed === false && compared.has(index)) continue;
    if (row.computed === false) {
      const assetClass = strOrNull(row['class']);
      rows.push({
        kind: 'missing_rules_data',
        entity,
        asset,
        reason:
          assetClass === null
            ? 'no class'
            : row.personal_property === true
              ? `class ${assetClass} is personal property the register books nothing for`
              : `no rule for class ${assetClass}`,
      });
    } else if (typeof row.recorded_prior_accumulated_cents === 'number') {
      rows.push({
        kind: 'prior_accumulated_mismatch',
        entity,
        asset,
        recorded_cents: row.recorded_prior_accumulated_cents,
        schedule_cents: row.prior_accumulated_cents as number,
      });
    }
  }
  for (const row of asArray(result.home_office).map(asObject)) {
    const entity = text(row.entity);
    if (row.regular_cents === null) {
      rows.push({
        kind: 'missing_receipt',
        entity,
        regular_missing: asArray(row.regular_missing) as string[],
      });
    } else {
      rows.push({ kind: 'method_comparison', comparison: 'home_office', entity });
    }
  }
  for (const row of asArray(result.rental_use).map(asObject)) {
    rows.push({
      kind: 'rental_use',
      entity: text(row.entity),
      fair_rental_days: intOrNull(row.fair_rental_days),
      personal_use_days: intOrNull(row.personal_use_days),
      stay_count: intOrNull(row.stay_count),
      services_note_recorded: strOrNull(row.services_note) !== null,
    });
  }
  for (const trip of asArray(result.trips).map(asObject)) {
    const locations = asArray(trip.missing_rates) as string[];
    if (locations.length > 0) rows.push({ kind: 'missing_rate', trip: text(trip.trip), locations });
  }
  for (const row of asArray(result.improvement_repair).map(asObject)) {
    rows.push({
      kind: 'method_comparison',
      comparison: 'improvement_repair',
      entity: text(row.entity),
      ledger_id: text(row.ledger_id),
      missing: asArray(row.missing) as string[],
    });
  }
  for (const row of expenseMacrs) {
    rows.push({
      kind: 'method_comparison',
      comparison: 'expense_macrs',
      entity: text(row.entity),
      asset: strOrNull(row.asset),
      missing: asArray(row.missing) as string[],
    });
  }
  return rows;
}

/** Whether an entity's lines hold a meal: a Schedule C meals line (24b), or a line one of the
 *  trips counts among its meals. Wording only: it decides where the at-cost note is printed. */
function hasMeals(entity: Json, tripMeals: ReadonlySet<string>): boolean {
  const entityLines = entity.lines as Json;
  return Object.entries(entityLines).some(
    ([line, slot]) =>
      (entity.schedule === 'C' && line === '24b') ||
      asArray((slot as Json).entries).some((entry) =>
        tripMeals.has(text(asObject(entry).ledger_id)),
      ),
  );
}

export function renderMarkdown(result: BooksResult): string {
  const lines: string[] = [
    `# Books for tax year ${text(result.tax_year)}`,
    '',
    `_${text(result.label)}_`,
    '',
  ];
  const tripMeals = new Set(
    asArray(result.trips).flatMap((trip) => asArray(asObject(trip).meal_items).map(text)),
  );
  for (const rawEntity of result.entities as Json[]) {
    lines.push(`## ${text(rawEntity.name)} (Schedule ${text(rawEntity.schedule)})`, '');
    const entityLines = rawEntity.lines as Json;
    if (Object.keys(entityLines).length > 0) {
      lines.push('| Line | Category | Amount |', '|---|---|---|');
      for (const [line, slot] of Object.entries(entityLines)) {
        lines.push(`| ${line} | ${text((slot as Json).label)} | ${text((slot as Json).total)} |`);
      }
      const meals = hasMeals(rawEntity, tripMeals) ? ' Meals are shown at cost.' : '';
      lines.push(
        '',
        `Income ${text(rawEntity.income_total)}, expenses ${text(rawEntity.expense_total)}, net ${text(rawEntity.net)}.${meals}`,
        '',
      );
    }
    const k1Boxes = rawEntity.k1_boxes as Json;
    if (Object.keys(k1Boxes).length > 0) {
      lines.push('| K-1 box | Amount |', '|---|---|');
      for (const [box, slot] of Object.entries(k1Boxes)) {
        lines.push(`| ${box} | ${text((slot as Json).total)} |`);
      }
      lines.push('');
    }
  }
  const depreciation = result.depreciation as Json[];
  if (depreciation.length > 0) {
    lines.push(
      '## Depreciation',
      '',
      '| Entity | Asset | This year | Prior accumulated | Accumulated | Remaining basis |',
      '|---|---|---|---|---|---|',
    );
    for (const d of depreciation) {
      if (d.computed === false) {
        lines.push(
          `| ${text(d.entity)} | ${text(d.asset)} | - | - | - | ${d.personal_property === true ? `not booked: class ${named(d['class'])} is personal property` : `not computed: no rule for class ${named(d['class'])}`} (basis ${text(d.cost_basis)}, placed ${text(d.placed_in_service)}) |`,
        );
        continue;
      }
      lines.push(
        `| ${text(d.entity)} | ${text(d.asset)} | ${text(d.amount)} | ${fmtCents(BigInt(Number(d.prior_accumulated_cents)))} | ${fmtCents(BigInt(Number(d.accumulated_cents)))} | ${fmtCents(BigInt(Number(d.remaining_basis_cents)))} |`,
      );
    }
    lines.push(
      `|  | Total | ${fmtCents(BigInt(Number(result.depreciation_total_cents ?? 0)))} |  |  |  |`,
      '',
    );
  }
  const trips = result.trips as Json[];
  if (trips.length > 0) {
    // The limit percentage is each trip row's own figure; the table header reads it from
    // the rows rather than hardcoding it.
    const firstTrip = trips[0];
    const limitPct = firstTrip === undefined ? '50' : text(firstTrip.meal_limit_pct ?? '50');
    lines.push(
      '## Trip meals, both methods',
      '',
      `| Trip | Actual meals | At ${limitPct}% | M&IE per diem | At ${limitPct}% | Complete |`,
      '|---|---|---|---|---|---|',
    );
    for (const trip of trips) {
      const source = trip.per_diem_source as { url?: unknown } | undefined;
      const cited = typeof source?.url === 'string' ? ` (per diem from ${source.url})` : '';
      const complete =
        trip.per_diem_complete === true
          ? `yes${cited}`
          : `missing ${(trip.missing_rates as string[]).join(', ')}`;
      const perDiem = (value: unknown): string =>
        trip.per_diem_applies === false ? DAY_TRIP_PER_DIEM : text(value);
      lines.push(
        `| ${text(trip.trip)} | ${text(trip.actual_meals)} | ${text(trip.actual_meals_at_limit)} | ${perDiem(trip.mie_per_diem)} | ${perDiem(trip.mie_per_diem_at_limit)} | ${complete} |`,
      );
    }
    lines.push('');
  }
  const vehicles = result.vehicles as Json[] | undefined;
  if (vehicles !== undefined && vehicles.length > 0) {
    lines.push(
      '## Vehicles, both methods',
      '',
      '| Vehicle | Entity | Miles | Standard mileage | Actual cost | Band cover | Not available when |',
      '|---|---|---|---|---|---|---|',
    );
    for (const vehicle of vehicles) {
      const standard =
        vehicle.standard_mileage === null ? 'not computed' : text(vehicle.standard_mileage);
      const reasons = (vehicle.unavailable_reasons as string[]).join(', ');
      const places = vehicleUseEntities(vehicle).join(', ');
      lines.push(
        `| ${text(vehicle.vehicle)} | ${places} | ${vehicleMilesWords(vehicle)} | ${standard} | ${text(vehicle.actual_cost)} | ${vehicle.standard_complete === true ? 'yes' : 'no'} | ${reasons === '' ? '-' : reasons} |`,
      );
    }
    lines.push(
      '',
      'Both methods shown for the accountant; neither is booked in place of the other, and the exclusions are listed, never applied. Parking and tolls stay on their own lines, in neither figure.',
      '',
    );
  }
  const rentalUse = result.rental_use as Json[] | undefined;
  if (rentalUse !== undefined && rentalUse.length > 0) {
    const dayCell = (value: unknown): string => (value === null ? '-' : text(value));
    const flagCell = (value: unknown): string =>
      value === null ? '-' : value === true ? 'yes' : 'no';
    const moneyCell = (value: unknown): string => (value === null ? '-' : text(value));
    lines.push(
      '## Short-term rental days',
      '',
      '| Entity | Schedule | Rental days | Personal days | Stays | Under 15 rental days | Over 14 personal days | Over 10% of rental days | Residence test | Average stay at most 7 | Average stay at most 30 | Operating by days | Interest and taxes by days | Interest and taxes by year |',
      '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|',
    );
    const noted: string[] = [];
    for (const row of rentalUse) {
      lines.push(
        `| ${text(row.entity)} | ${text(row.schedule)} | ${dayCell(row.fair_rental_days)} | ${dayCell(row.personal_use_days)} | ${dayCell(row.stay_count)} | ${flagCell(row.rental_under_15)} | ${flagCell(row.personal_over_14)} | ${flagCell(row.personal_over_10_pct)} | ${flagCell(row.residence_test)} | ${flagCell(row.average_at_most_7)} | ${flagCell(row.average_at_most_30)} | ${moneyCell(row.operating_allocated)} | ${moneyCell(row.interest_taxes_days)} | ${moneyCell(row.interest_taxes_year)} |`,
      );
      if (row.services_note !== null) noted.push(`${text(row.entity)}: ${text(row.services_note)}`);
    }
    lines.push('');
    for (const note of noted) lines.push(`- Services note, ${note}`);
    if (noted.length > 0) lines.push('');
    lines.push('Day ratios are shown for the accountant; nothing is booked from them.', '');
  }
  const homeOffice = result.home_office as Json[] | undefined;
  if (homeOffice !== undefined && homeOffice.length > 0) {
    lines.push(
      '## Business use of home, both methods',
      '',
      '| Entity | Office sq ft | Home sq ft | Simplified | Regular |',
      '|---|---|---|---|---|',
    );
    for (const row of homeOffice) {
      const regular = row.regular === null ? 'not computed' : text(row.regular);
      lines.push(
        `| ${text(row.entity)} | ${text(row.office_sq_ft)} | ${row.home_sq_ft === null ? '-' : text(row.home_sq_ft)} | ${text(row.simplified)} | ${regular} |`,
      );
    }
    lines.push('', text(homeOffice[0]?.note), '');
  }
  const moneyOrNot = (value: unknown): string => (value === null ? 'not computed' : text(value));
  const improvementRepair = result.improvement_repair as Json[] | undefined;
  if (improvementRepair !== undefined && improvementRepair.length > 0) {
    lines.push(
      '## Improvement or repair, both readings',
      '',
      '| Line | Entity | Tag | Repair, this year | Capitalized, year one | Class |',
      '|---|---|---|---|---|---|',
    );
    for (const row of improvementRepair) {
      lines.push(
        `| ${text(row.ledger_id)} | ${text(row.entity)} | ${text(row.tag)} | ${text(row.repair)} | ${moneyOrNot(row.capitalized)} | ${row.class === null ? 'not established' : `${text(row.class)} (${text(row.recovery_years)} years)`} |`,
      );
    }
    lines.push('', text(improvementRepair[0]?.note), '');
  }
  const expenseMacrs = result.expense_macrs as Json[] | undefined;
  if (expenseMacrs !== undefined && expenseMacrs.length > 0) {
    lines.push(
      '## Expensing or MACRS, both readings',
      '',
      '| Entity | Asset | Placed in service | Expensed, year one | MACRS, year one | Convention | Limits passed |',
      '|---|---|---|---|---|---|---|',
    );
    for (const row of expenseMacrs) {
      const limits = (row.over_limits as string[]).join(', ');
      lines.push(
        `| ${text(row.entity)} | ${text(row.asset)} | ${text(row.placed_in_service)} | ${text(row.expensed)} | ${moneyOrNot(row.macrs)} | ${row.convention === null ? '-' : text(row.convention)} | ${limits === '' ? '-' : limits} |`,
      );
    }
    lines.push('', text(expenseMacrs[0]?.note), '');
  }
  const donations = result.donations as Json[] | undefined;
  if (donations !== undefined && donations.length > 0) {
    lines.push(
      '## Charitable contributions',
      '',
      'Listed for your accountant; not part of Schedule C or E books.',
      '',
      '| Organization | Date | Amount | Form | Goods or services |',
      '|---|---|---|---|---|',
    );
    for (const entry of donations) {
      lines.push(
        `| ${text(entry.organization)} | ${text(entry.date)} | ${text(entry.amount)} ${text(entry.currency)} | ${text(entry.form)} | ${text(entry.goods_services_amount)} |`,
      );
    }
    lines.push('');
  }
  const unassigned = result.unassigned as Json[];
  if (unassigned.length > 0) {
    lines.push('## Not yet assigned', '');
    for (const u of unassigned) {
      const reason = u.reason === 'no entity' ? 'not yet assigned' : text(u.reason);
      lines.push(`- ${text(u.id)}: ${text(u.usd)} (${reason})`);
    }
    lines.push('');
  }
  const outsideYear = asArray(result.outside_year).map(asObject);
  if (outsideYear.length > 0) {
    lines.push(
      '## Dated outside the tax year',
      '',
      'Listed for your accountant; counted in no total above.',
      '',
    );
    // A line by its ledger id; a staged property-tax payment by its parcels and payment document;
    // a home cost by its kind and document.
    for (const row of outsideYear) {
      const subject =
        row.kind === 'tax_payment'
          ? `property tax, parcel ${asArray(row.parcels).map(text).join(', ')} (${text(row.payment_source)})`
          : row.kind === 'home_cost'
            ? `home cost, ${text(row.cost_kind)} (${text(row.source_file)})`
            : text(row.id);
      lines.push(`- ${subject}: ${text(row.date)}, ${text(row.amount)} ${text(row.currency)}`);
    }
    lines.push('');
  }
  const unpriced = asArray(result.unpriced).map(asObject);
  if (unpriced.length > 0) {
    lines.push(
      '## No exchange rate on record',
      '',
      'The rules data had no exchange rate for that currency on that date: listed for your accountant, counted in no total above.',
      '',
    );
    for (const row of unpriced) {
      lines.push(`- ${text(row.id)}: ${text(row.date)}, ${text(row.amount)} ${text(row.currency)}`);
    }
    lines.push('');
  }
  const checks = result.checks as Json;
  lines.push(
    '## Checks',
    '',
    checks.passed === true ? 'Every check passed.' : 'The checks did not pass.',
  );
  for (const error of checks.errors as string[]) lines.push(`- error: ${error}`);
  for (const warning of checks.warnings as string[]) lines.push(`- warning: ${warning}`);
  return `${lines.join('\n')}\n`;
}

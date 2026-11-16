/**
 * The two capital-cost comparisons (issue #691, decision record 0105's amendment): two readings
 * of the same facts, computed here from rules data and never chosen between (ADR 0011 item 3).
 *
 * - Improvement or repair: every ledger line the skill (or an answer) tagged `capital` or
 *   `repair`, booked as an expense on a property or business, is shown expensed in the year (the
 *   line's own cents, the repair reading) and capitalized as an improvement to the building and
 *   depreciated (the year-one figure on Publication 946 chapter 4's mid-month fraction, decision
 *   record 0061). The building's class is the one the entity's real-property register assets
 *   agree on; an entity with no building takes it from its kind only where the kind names one
 *   class unambiguously. The tag is a fact about the document; both readings are computed for
 *   either word.
 * - Expensing or MACRS: every register asset of kind `equipment` or `improvement` placed in
 *   service in the tax year whose class is personal property or not yet established is shown
 *   expensed in year one (its basis) and depreciated (its year-one figure, a personal-property
 *   class from `capital_costs.json` at the declining-balance rate under the half-year or the
 *   mid-quarter convention). An asset with a real-property class is the register's: it books
 *   the building fraction by rule, and a tagged improvement line carries its two readings. The
 *   rules data's de minimis ceilings are listed as passed or not, never applied to either reading.
 *
 * A reading the facts or the rules data cannot settle is null and says what is missing; nothing
 * here invents a figure. Every amount is BigInt cents with one rounding at the cent.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  assetKindOf,
  type CapitalConvention,
  type CapitalMissing,
  type ExpenseLimit,
  type LedgerTag,
} from '../capital-costs';
import { divideHalfUp, fmtCents, parseDec, SCALE, type Dec } from '../money';

type Json = Record<string, unknown>;

export const IMPROVEMENT_REPAIR_NOTE =
  'Both readings shown for the accountant: the line expensed in the year as a repair, or capitalized as an improvement to the building and depreciated. The tag records what the document says and chooses neither; the books keep the line where it was recorded.';

export const EXPENSE_MACRS_NOTE =
  'Both readings shown for the accountant: the asset expensed in the year it was placed in service, or depreciated on the MACRS schedule. Whether an expensing provision is available, and the class, are for the accountant; the listed limits are shown, never applied.';

/**
 * The profile entity kinds that name one building class whatever the register holds. The SaaS
 * stages every rental as `residential_rental` (run-bundle.ts ENTITY_KINDS), so that word says
 * nothing about a commercial building; only `commercial_rental`, which a person's own profile
 * writes, is unambiguous.
 */
const UNAMBIGUOUS_KIND_CLASSES: ReadonlySet<string> = new Set(['commercial_rental']);

/** One personal-property class of `capital_costs.json`. */
interface PersonalClass {
  readonly years: Dec;
  readonly yearsText: string;
  readonly decliningPct: bigint;
}

/** `capital_costs.json` as the readings use it: each figure null when the file lacks it. */
export interface CapitalCostRules {
  readonly classes: ReadonlyMap<string, PersonalClass>;
  readonly midQuarterThresholdPct: bigint | null;
  readonly deMinimisCents: bigint | null;
  readonly deMinimisWithAfsCents: bigint | null;
}

function asObject(value: unknown): Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Json)
    : {};
}

/** A non-negative integer string, or null: the rules file's cents and percentages. */
function integerOrNull(value: unknown): bigint | null {
  return typeof value === 'string' && /^\d+$/.test(value) ? BigInt(value) : null;
}

/**
 * The rules file, read tolerantly: a figure it lacks, or one that is not a plain integer, is null
 * and the reading that needs it names it as missing, so an incomplete year's file shows the gap
 * instead of a number nobody fetched.
 */
export function loadCapitalCostRules(rulesDir: string): CapitalCostRules {
  let file: Json = {};
  try {
    file = asObject(JSON.parse(readFileSync(join(rulesDir, 'capital_costs.json'), 'utf8')));
  } catch {
    file = {};
  }
  const classes = new Map<string, PersonalClass>();
  for (const [name, raw] of Object.entries(asObject(file.personal_property_classes))) {
    const rule = asObject(raw);
    const pct = integerOrNull(rule.declining_balance_pct);
    if (typeof rule.recovery_years !== 'string' || pct === null) continue;
    let years: Dec;
    try {
      years = parseDec(rule.recovery_years);
    } catch {
      continue;
    }
    if (years.v <= 0n) continue;
    classes.set(name, { years, yearsText: rule.recovery_years, decliningPct: pct });
  }
  return {
    classes,
    midQuarterThresholdPct: integerOrNull(file.mid_quarter_threshold_pct),
    deMinimisCents: integerOrNull(file.de_minimis_per_item_cents),
    deMinimisWithAfsCents: integerOrNull(file.de_minimis_per_item_with_afs_cents),
  };
}

/** A real-property class of `depreciation.json`: straight line, mid-month, a recovery period. */
export function realClassOf(
  depreciationRules: Json,
  name: unknown,
): { years: Dec; yearsText: string } | null {
  if (typeof name !== 'string' || name === 'rules_note') return null;
  const rule = asObject(depreciationRules[name]);
  if (
    typeof rule.recovery_years !== 'string' ||
    rule.method !== 'straight_line' ||
    rule.convention !== 'mid_month'
  ) {
    return null;
  }
  try {
    const years = parseDec(rule.recovery_years);
    return years.v > 0n ? { years, yearsText: rule.recovery_years } : null;
  } catch {
    return null;
  }
}

/** Months scaled by 2 as the step text reads them: 21 -> "10.5", 12 -> "6". */
function months(monthsHalf: bigint): string {
  const whole = monthsHalf / 2n;
  return monthsHalf % 2n === 1n ? `${whole.toString()}.5` : whole.toString();
}

/**
 * The class of the building an entity's tagged line would improve, and where it came from: the
 * one class every real-property register asset of the entity names (an asset of kind
 * `real_property`, or one with no kind whose class is a real-property class); with no such asset,
 * the entity's kind where it names one class unambiguously. Buildings that disagree, or a building
 * whose class is not yet established, leave the class unknown — never the first one's.
 */
export function buildingClassOf(
  entity: Json,
  depreciationRules: Json,
): { readonly name: string; readonly source: 'building' | 'kind' } | null {
  const assets = Array.isArray(entity.assets) ? (entity.assets as unknown[]).map(asObject) : [];
  const buildings = assets.filter(
    (asset) =>
      asset.kind === 'real_property' ||
      ((asset.kind === undefined || asset.kind === null) &&
        realClassOf(depreciationRules, asset['class']) !== null),
  );
  if (buildings.length === 0) {
    const kind = entity.kind;
    return typeof kind === 'string' &&
      UNAMBIGUOUS_KIND_CLASSES.has(kind) &&
      realClassOf(depreciationRules, kind) !== null
      ? { name: kind, source: 'kind' }
      : null;
  }
  const classes = new Set(
    buildings.map((asset) =>
      realClassOf(depreciationRules, asset['class']) === null ? null : (asset['class'] as string),
    ),
  );
  const [only] = [...classes];
  return classes.size === 1 && only !== null && only !== undefined
    ? { name: only, source: 'building' }
    : null;
}

/** One tagged ledger line, booked as an expense on a property or business. */
export interface TaggedLine {
  readonly id: string;
  readonly entity: string;
  readonly date: string;
  readonly cents: bigint;
  readonly tag: LedgerTag;
}

/**
 * The improvement-or-repair rows, one per tagged line in ledger order. The capitalized reading is
 * the placed-in-service year's mid-month fraction on the line's cents, `(12.5 - month) / 12` of
 * the cents over the building's recovery years with one rounding at the cent. It is null, with
 * `class` missing, when the building's class is not established. Every tagged line is the tax
 * year's: a line dated in another year is in the books' `outside_year` list and reaches no
 * comparison (decision record 0148).
 */
export function improvementRepairRows(
  lines: readonly TaggedLine[],
  entities: ReadonlyMap<string, Json>,
  depreciationRules: Json,
): Json[] {
  return lines.map((line) => {
    const year = line.date.slice(0, 4);
    const building = buildingClassOf(entities.get(line.entity) ?? {}, depreciationRules);
    const rule = building === null ? null : realClassOf(depreciationRules, building.name);
    const missing: CapitalMissing[] = [];
    let capitalized: bigint | null = null;
    const steps = [`repair reading = ${fmtCents(line.cents)} expensed in ${year}`];
    if (building === null || rule === null) {
      missing.push('class');
    } else {
      const monthsHalf = BigInt(25 - 2 * Number(line.date.slice(5, 7)));
      const annual = divideHalfUp(line.cents * SCALE, rule.years.v);
      capitalized = divideHalfUp(line.cents * monthsHalf * SCALE, rule.years.v * 24n);
      steps.push(
        `class ${building.name} from the ${building.source === 'building' ? "entity's building" : "entity's kind"}`,
        `annual = ${fmtCents(line.cents)} / ${rule.yearsText} years = ${fmtCents(annual)}`,
        `${year} = ${fmtCents(annual)} x ${months(monthsHalf)} / 12 months = ${fmtCents(capitalized)}`,
      );
    }
    const computed = capitalized !== null;
    return {
      ledger_id: line.id,
      entity: line.entity,
      tag: line.tag,
      date: line.date,
      repair: fmtCents(line.cents),
      repair_cents: Number(line.cents),
      capitalized: capitalized === null ? null : fmtCents(capitalized),
      capitalized_cents: capitalized === null ? null : Number(capitalized),
      class: computed && building !== null ? building.name : null,
      recovery_years: computed && rule !== null ? rule.yearsText : null,
      convention: computed ? ('mid_month' satisfies CapitalConvention) : null,
      missing,
      steps,
      note: IMPROVEMENT_REPAIR_NOTE,
    };
  });
}

/** One register asset the expensing comparison covers, placed in service in the tax year. */
export interface CapitalAsset {
  /** The asset's row in books.json's `depreciation` list, so the build's actions can join them. */
  readonly registerIndex: number;
  readonly entity: string;
  readonly description: string | null;
  readonly kind: 'equipment' | 'improvement';
  readonly assetClass: string | null;
  readonly placedInService: string;
  readonly disposedOn: string | null;
  readonly basisCents: bigint;
}

/**
 * Whether the expensing comparison covers a register asset, and under which kind: an equipment
 * or improvement asset whose class is personal property or not yet established, and an asset
 * with no kind whose class is a personal-property class (it can only be equipment). An asset
 * whose class is a real-property class is the register's, never this comparison's.
 */
export function expenseComparisonKind(
  kind: unknown,
  assetClass: string | null,
  rules: CapitalCostRules,
  depreciationRules: Json,
): 'equipment' | 'improvement' | null {
  if (realClassOf(depreciationRules, assetClass) !== null) return null;
  const word = assetKindOf(kind);
  if (word === 'equipment' || word === 'improvement') return word;
  if ((kind === undefined || kind === null) && assetClass !== null) {
    return rules.classes.has(assetClass) ? 'equipment' : null;
  }
  return null;
}

/** Whether a class is one of `capital_costs.json`'s personal-property classes. */
export function isPersonalClass(rules: CapitalCostRules, assetClass: string | null): boolean {
  return assetClass !== null && rules.classes.has(assetClass);
}

/** The first-year share of a year in half-months: the half-year, or the quarter's midpoint. */
function firstYearHalfMonths(convention: CapitalConvention, month: number): bigint {
  if (convention === 'half_year') return 12n;
  const quarter = Math.floor((month - 1) / 3);
  return [21n, 15n, 9n, 3n][quarter] ?? 3n;
}

/**
 * The expensing-or-MACRS rows, one per asset in the order given. The convention for the
 * personal-property rows is settled once over all of them, as Publication 946 chapter 4 settles
 * it: mid-quarter when the basis placed in service in the year's last three months is more than
 * the rules data's percentage of the year's personal-property basis (equipment counts with or
 * without an established class; property placed in service and disposed of in the same year is
 * left out); nothing is expensed in this reading, so no basis leaves the test.
 */
export function expenseMacrsRows(
  assets: readonly CapitalAsset[],
  rules: CapitalCostRules,
  taxYear: number,
): Json[] {
  const year = String(taxYear);
  const classify = (asset: CapitalAsset) => {
    const personal = asset.assetClass === null ? undefined : rules.classes.get(asset.assetClass);
    const isPersonal = personal !== undefined || asset.kind === 'equipment';
    const disposedSameYear = asset.disposedOn !== null && asset.disposedOn.slice(0, 4) === year;
    return { personal, isPersonal, disposedSameYear };
  };
  let testTotal = 0n;
  let fourthQuarter = 0n;
  for (const asset of assets) {
    const { isPersonal, disposedSameYear } = classify(asset);
    if (!isPersonal || disposedSameYear) continue;
    testTotal += asset.basisCents;
    if (Number(asset.placedInService.slice(5, 7)) >= 10) fourthQuarter += asset.basisCents;
  }
  const threshold = rules.midQuarterThresholdPct;
  const convention: CapitalConvention | null =
    threshold === null
      ? null
      : fourthQuarter * 100n > testTotal * threshold
        ? 'mid_quarter'
        : 'half_year';
  const conventionStep =
    threshold === null
      ? null
      : `fourth-quarter basis ${fmtCents(fourthQuarter)} of ${fmtCents(testTotal)} placed in service in ${year}: ${convention === 'mid_quarter' ? `more than ${threshold.toString()}%, mid-quarter convention` : `not more than ${threshold.toString()}%, half-year convention`}`;

  return assets.map((asset) => {
    const { personal, disposedSameYear } = classify(asset);
    const missing: CapitalMissing[] = [];
    const steps = [`expensed reading = basis ${fmtCents(asset.basisCents)} in ${year}`];
    let macrs: bigint | null = null;
    let rowConvention: CapitalConvention | null = null;
    if (personal === undefined) {
      missing.push('class');
    } else if (disposedSameYear) {
      macrs = 0n;
      steps.push(`placed in service and disposed of in ${year} = 0.00`);
    } else if (convention === null || conventionStep === null) {
      missing.push('mid_quarter_threshold_pct');
    } else {
      rowConvention = convention;
      const monthsHalf = firstYearHalfMonths(convention, Number(asset.placedInService.slice(5, 7)));
      const annual = divideHalfUp(
        asset.basisCents * personal.decliningPct * SCALE,
        personal.years.v * 100n,
      );
      macrs = divideHalfUp(
        asset.basisCents * personal.decliningPct * monthsHalf * SCALE,
        personal.years.v * 2400n,
      );
      steps.push(
        conventionStep,
        `annual = ${fmtCents(asset.basisCents)} x ${personal.decliningPct.toString()}% / ${personal.yearsText} years = ${fmtCents(annual)}`,
        `${year} = ${fmtCents(annual)} x ${months(monthsHalf)} / 12 months = ${fmtCents(macrs)}`,
      );
    }
    const overLimits: ExpenseLimit[] = [];
    const limit = (figure: bigint | null, key: CapitalMissing, over: ExpenseLimit): void => {
      if (figure === null) missing.push(key);
      else if (asset.basisCents > figure) overLimits.push(over);
    };
    limit(rules.deMinimisCents, 'de_minimis_per_item_cents', 'over_de_minimis');
    limit(
      rules.deMinimisWithAfsCents,
      'de_minimis_per_item_with_afs_cents',
      'over_de_minimis_with_afs',
    );
    return {
      entity: asset.entity,
      asset: asset.description,
      register_index: asset.registerIndex,
      kind: asset.kind,
      class: asset.assetClass,
      placed_in_service: asset.placedInService,
      basis_cents: Number(asset.basisCents),
      expensed: fmtCents(asset.basisCents),
      expensed_cents: Number(asset.basisCents),
      macrs: macrs === null ? null : fmtCents(macrs),
      macrs_cents: macrs === null ? null : Number(macrs),
      recovery_years: personal === undefined ? null : personal.yearsText,
      method: personal === undefined ? null : 'declining_balance',
      convention: rowConvention,
      missing,
      over_limits: overLimits,
      steps,
      note: EXPENSE_MACRS_NOTE,
    };
  });
}

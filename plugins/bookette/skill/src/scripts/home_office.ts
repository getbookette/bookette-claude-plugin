/**
 * The home-office readings (issue #661; issue #1080, decision record 0011's #1080 amendment):
 * both readings of the workspace's one home office, computed once and read by two callers -
 * build_books, which writes them into books.json side by side and books neither, and
 * check_outputs, which recomputes them so the open items the readings call for are judged
 * against Abacus's own figures rather than a possibly stale out/books.json. The method is the
 * accountant's: nothing here, and no answer, picks one. The function reads no ledger.
 *
 * The simplified reading is the rules file's rate over the office area up to the cap, one
 * half-up rounding at the cent. The regular reading is the business share of the home's costs
 * by area, plus the costs of the office alone, one half-up rounding on the exact area ratio.
 * Home depreciation, the income limit and any carryover are in neither reading.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { isValidDay } from '../dates';
import { HOME_COST_USES } from '../home-office';
import { divideHalfUp, fmtCents, parseDec, SCALE, type Dec } from '../money';
import { rulesYearOf } from '../rules-year';
import { readFxSnapshotBeside, toUsd } from './fx';
import { loadProfile } from './profile';
import type { FxSnapshot } from './fx_snapshot';

type Json = Record<string, unknown>;

export const HOME_OFFICE_NOTE =
  'Both readings shown for the accountant, whose choice the method is. Depreciation of the home, the income limit and any carryover are not applied to either.';

export interface HomeOfficeRules {
  readonly simplifiedCentsPerSqFt: Dec;
  readonly simplifiedMaxSqFt: Dec;
  readonly line: string;
  readonly label: string;
}

export interface HomeOfficeResult {
  readonly rows: Json[];
  readonly rules: HomeOfficeRules | null;
  readonly errors: string[];
  /** The home costs dated outside the tax year (decision record 0148): listed, never converted,
   *  and in neither reading. */
  readonly outsideYear: Json[];
}

function asObject(value: unknown): Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Json)
    : {};
}

function loadJson(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

/** Dollars with thousands separators, the way the step wording prints a figure. */
function dollars(cents: bigint): string {
  const plain = fmtCents(cents);
  const [whole = '0', fraction = '00'] = plain.split('.');
  const negative = whole.startsWith('-');
  const grouped = (negative ? whole.slice(1) : whole).replaceAll(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${negative ? '-' : ''}$${grouped}.${fraction}`;
}

/** A scaled decimal as plain text: 168000000000000 -> "168", 168.5 -> "168.5". */
function plain(value: Dec): string {
  const whole = value.v / SCALE;
  const fraction = (value.v % SCALE).toString().padStart(12, '0').replace(/0+$/, '');
  return fraction === '' ? whole.toString() : `${whole.toString()}.${fraction}`;
}

/**
 * Whether a parsed area fits the numeric(10,2) columns the importer writes it to: below 10^8
 * square feet. A larger value would throw 22003 after the run is claimed, so every gate refuses
 * it before.
 */
export function homeAreaWithinColumn(area: Dec): boolean {
  return area.v < 10n ** 8n * SCALE;
}

/** Whether a decimal carries at most two places, the precision the area columns store. */
export function atMostTwoDecimals(value: string): boolean {
  return /^[+-]?\d+(\.\d{1,2})?$/.test(value.trim());
}

/** An area as text: a string or a number as written, anything else as a word no area parses from. */
function areaText(value: unknown): string {
  if (typeof value === 'string') return value;
  return typeof value === 'number' ? String(value) : 'not a number';
}

/** The rules file's two numbers, each a decimal string; a missing or malformed one is an error. */
export function loadHomeOfficeRules(rulesDir: string, errors: string[]): HomeOfficeRules | null {
  const file = asObject(loadJson(join(rulesDir, 'home_office.json')));
  const read = (key: string): Dec | null => {
    const value = file[key];
    if (typeof value !== 'string') {
      errors.push(`home_office.json carries no ${key}; the packaged rules file is incomplete`);
      return null;
    }
    try {
      const parsed = parseDec(value);
      if (parsed.v <= 0n) throw new Error('not positive');
      return parsed;
    } catch {
      errors.push(
        `home_office.json ${key} is not a positive decimal; the packaged rules file is incomplete`,
      );
      return null;
    }
  };
  const rate = read('simplified_cents_per_sq_ft');
  const cap = read('simplified_max_sq_ft');
  const lineRule = asObject(file.schedule_c_line);
  const line = lineRule.line;
  const label = lineRule.label;
  if (typeof line !== 'string' || typeof label !== 'string') {
    errors.push(
      'home_office.json carries no schedule_c_line; the packaged rules file is incomplete',
    );
    return null;
  }
  if (rate === null || cap === null) return null;
  return { simplifiedCentsPerSqFt: rate, simplifiedMaxSqFt: cap, line, label };
}

/**
 * Both readings for the workspace's home office, or no row when no entity records an office
 * area. A second office, an office on a schedule other than C, an area that is not a positive
 * decimal of at most two places and an office larger than its home are build errors; a cost that
 * cannot be priced lands in `errors` the way an unpriceable ledger line does.
 */
export function homeOfficeReadings(
  profile: Json,
  homeCosts: readonly unknown[],
  rulesDir: string,
  fxSnapshot: FxSnapshot | null,
  taxYear: number,
): HomeOfficeResult {
  const errors: string[] = [];
  const outsideYear: Json[] = [];
  const entities = (Array.isArray(profile.entities) ? profile.entities : []) as unknown[];
  const offices = entities.filter((raw) => {
    const office = asObject(asObject(raw).home_office).office_sq_ft;
    return office !== null && office !== undefined;
  });
  if (offices.length === 0) return { rows: [], rules: null, errors, outsideYear };
  if (offices.length > 1) {
    errors.push('home office recorded on more than one entity');
    return { rows: [], rules: null, errors, outsideYear };
  }
  const rules = loadHomeOfficeRules(rulesDir, errors);
  const entity = asObject(offices[0]);
  const entityKey = String(entity.key);
  if (entity.schedule !== 'C') {
    errors.push(`${entityKey}: a home office is recorded on an entity that is not on Schedule C`);
    return { rows: [], rules, errors, outsideYear };
  }
  const areas = asObject(entity.home_office);
  const officeText = areaText(areas.office_sq_ft);
  const homeText =
    areas.home_sq_ft === null || areas.home_sq_ft === undefined ? null : areaText(areas.home_sq_ft);
  let office: Dec | null = null;
  let home: Dec | null = null;
  try {
    if (!atMostTwoDecimals(officeText)) throw new Error('places');
    office = parseDec(officeText);
    if (office.v <= 0n || !homeAreaWithinColumn(office)) throw new Error('positive');
  } catch {
    errors.push(`${entityKey}: the office area is not a positive number of at most two decimals`);
  }
  if (homeText !== null) {
    try {
      if (!atMostTwoDecimals(homeText)) throw new Error('places');
      home = parseDec(homeText);
      if (home.v <= 0n || !homeAreaWithinColumn(home)) throw new Error('positive');
    } catch {
      home = null;
      errors.push(`${entityKey}: the home area is not a positive number of at most two decimals`);
    }
  }
  if (office !== null && home !== null && home.v < office.v) {
    errors.push(`${entityKey}: the home area is smaller than the office area`);
  }
  if (office === null || rules === null || errors.length > 0) {
    return { rows: [], rules, errors, outsideYear };
  }

  // Each cost converts to USD on its own date through the ledger's own fx path. A cost dated
  // outside the tax year (decision record 0148) is listed and feeds neither reading.
  const costs: Json[] = [];
  let homeCostsCents = 0n;
  let directCostsCents = 0n;
  for (const [index, raw] of homeCosts.entries()) {
    const cost = asObject(raw);
    const name = `home_costs.json item ${String(index)}`;
    let cents: bigint;
    let info: Json | null;
    try {
      const day = String(cost.date);
      if (!isValidDay(day)) throw new Error('bad date');
      if (Number(day.slice(0, 4)) !== taxYear) {
        outsideYear.push({
          kind: 'home_cost',
          date: day,
          cost_kind: cost.kind ?? null,
          source_file: cost.source_file ?? null,
          amount: String(cost.amount),
          currency: typeof cost.currency === 'string' ? cost.currency : 'USD',
          entity: entityKey,
        });
        continue;
      }
      const converted = toUsd(
        rulesDir,
        typeof cost.currency === 'string' ? cost.currency : 'USD',
        day,
        parseDec(String(cost.amount)),
        fxSnapshot,
      );
      cents = converted.cents;
      info = converted.info;
    } catch (error) {
      errors.push(`${name}: ${(error as Error).message}`);
      continue;
    }
    if (cost.use === 'home') homeCostsCents += cents;
    else if (cost.use === 'office') directCostsCents += cents;
    else {
      errors.push(`${name}: use is not one of ${HOME_COST_USES.join(', ')}`);
      continue;
    }
    costs.push({
      source_file: cost.source_file ?? null,
      date: cost.date,
      kind: cost.kind,
      use: cost.use,
      usd_cents: Number(cents),
      fx:
        info === null
          ? null
          : {
              amount: String(cost.amount),
              currency: String(info.currency),
              rate: String(info.rate),
              rate_date: String(info.rate_date),
              source: String(info.source),
            },
    });
  }

  const area = office.v < rules.simplifiedMaxSqFt.v ? office : rules.simplifiedMaxSqFt;
  const simplifiedCents = divideHalfUp(rules.simplifiedCentsPerSqFt.v * area.v, SCALE * SCALE);
  const steps = [
    office.v > rules.simplifiedMaxSqFt.v
      ? `simplified = ${plain(area)} sq ft (capped from ${plain(office)}) x ${dollars(divideHalfUp(rules.simplifiedCentsPerSqFt.v, SCALE))} = ${dollars(simplifiedCents)}`
      : `simplified = ${plain(area)} sq ft x ${dollars(divideHalfUp(rules.simplifiedCentsPerSqFt.v, SCALE))} = ${dollars(simplifiedCents)}`,
  ];
  const regularMissing: ('home_sq_ft' | 'home_costs')[] = [];
  if (home === null) regularMissing.push('home_sq_ft');
  if (costs.length === 0) regularMissing.push('home_costs');
  let businessUseBp: number | null = null;
  let regularCents: bigint | null = null;
  if (home !== null) {
    businessUseBp = Number(divideHalfUp(office.v * 10000n, home.v));
    steps.push(
      `business use = ${plain(office)} / ${plain(home)} sq ft = ${fmtCents(BigInt(businessUseBp))}%`,
    );
    if (costs.length > 0) {
      regularCents = divideHalfUp(homeCostsCents * office.v, home.v) + directCostsCents;
      steps.push(
        `regular = ${dollars(homeCostsCents)} x ${plain(office)} / ${plain(home)} + ${dollars(directCostsCents)} = ${dollars(regularCents)}`,
      );
    }
  }
  const row: Json = {
    entity: entityKey,
    office_sq_ft: plain(office),
    home_sq_ft: home === null ? null : plain(home),
    business_use_bp: businessUseBp,
    simplified_area_sq_ft: plain(area),
    simplified_cents: Number(simplifiedCents),
    simplified: fmtCents(simplifiedCents),
    home_costs_cents: Number(homeCostsCents),
    direct_costs_cents: Number(directCostsCents),
    regular_cents: regularCents === null ? null : Number(regularCents),
    regular: regularCents === null ? null : fmtCents(regularCents),
    regular_missing: regularMissing,
    costs,
    steps,
    note: HOME_OFFICE_NOTE,
  };
  return { rows: [row], rules, errors, outsideYear };
}

/**
 * The home costs the readings compute from (issue #910): out/home_costs.json when the run wrote
 * it - a present file is the complete set - else confirmed/home_costs.json, the stored costs the
 * bundle staged, which silence keeps the way the importer keeps a stored tax payment. Empty when
 * neither exists or the file read is not a list.
 */
export function readHomeCosts(workspace: string): unknown[] {
  const staged = join(workspace, 'out', 'home_costs.json');
  const value = loadJson(
    existsSync(staged) ? staged : join(workspace, 'confirmed', 'home_costs.json'),
  );
  return Array.isArray(value) ? (value as unknown[]) : [];
}

/**
 * The readings of one workspace, read from its own files: the resolved profile (or the staged
 * profile before one exists), out/home_costs.json, the staged year's rules file and the rate
 * snapshot beside the workspace. build_books and check_outputs both come through here, so the
 * two can never compute from different inputs.
 */
export function loadHomeOfficeReadings(workspace: string, skillDir: string): HomeOfficeResult {
  const profile = asObject(loadProfile(workspace, skillDir));
  let snapshot: FxSnapshot | null;
  try {
    snapshot = readFxSnapshotBeside(workspace);
  } catch (error) {
    // check_outputs calls this and must report, never throw: an unreadable snapshot is the
    // build's own error to name, and no reading exists to check against.
    return { rows: [], rules: null, errors: [(error as Error).message], outsideYear: [] };
  }
  const rules = rulesYearOf(workspace, skillDir);
  if (!rules.ok) return { rows: [], rules: null, errors: [rules.message], outsideYear: [] };
  return homeOfficeReadings(profile, readHomeCosts(workspace), rules.dir, snapshot, rules.year);
}

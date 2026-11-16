// The profile facts a person records (plan row 15.13, issue #733): a rental's fair rental days and
// personal-use days, a short-term rental's stay count and services note, a business's home-office
// areas and the miles a place drove a vehicle. Three things live here, all pure: the one validator the web action
// and the chat chip share, the overlay that lays the person's live `profile_fact:` answers onto a
// profile (the run bundle, Abacus and the importer all call it, so the register, the sandbox's
// books and the import's rebuild carry the same figure), and the mileage file's band list for the
// tax year. Nothing here reads a file, so a client bundle may import it.

import { personTextProblem } from './person-text';

import { PROFILE_FACT_KEY_PREFIX, parseEffect } from './effects';
import type { ProfileFactField, ProfileFactValue } from './effects';
import { optionEffectOf } from './code-applied';

export { PROFILE_FACT_FIELDS, PROFILE_FACT_KEY_PREFIX } from './effects';
export type { ProfileFactEffect, ProfileFactField, ProfileFactValue } from './effects';

type Json = Record<string, unknown>;

/** The most days a count may be: the longest year. The action also checks the sum against the workspace's own year. */
export const PROFILE_FACT_DAYS_MAX = 366;
/** The most miles one band may carry. */
export const PROFILE_FACT_MILES_MAX = 1_000_000;
/** The longest services note, in characters: the typed answer's bound. */
export const PROFILE_FACT_NOTE_MAX_LENGTH = 500;

export type ProfileFactRefusal =
  'malformed' | 'too_long' | 'too_large' | 'identifier' | 'policy' | 'url' | 'order' | 'band';

export type ProfileFactValidation =
  | { readonly ok: true; readonly value: ProfileFactValue }
  | { readonly ok: false; readonly code: ProfileFactRefusal };

/** One band of the mileage file: the validator and the overlay match a person's band on both dates. */
export interface MileageBand {
  readonly from: string;
  readonly to: string;
}

export interface ProfileFactContext {
  /** The tax year's bands, from `mileageBandsOf`; every one must be posted for `miles`. */
  readonly bands: readonly MileageBand[];
}

const fail = (code: ProfileFactRefusal): ProfileFactValidation => ({ ok: false, code });

function integerUpTo(text: string, max: number): ProfileFactValidation | number {
  if (!/^\d+$/.test(text)) return fail('malformed');
  const value = Number(text);
  return value > max ? fail('too_large') : value;
}

// The area columns are numeric(10,2): below 10^8 square feet, at most two places. Spelled on the
// text here so this module reads no file; a test pins it equal to home_office.ts's own predicates.
function area(text: string): { canonical: string; number: number } | ProfileFactRefusal {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(text);
  if (match === null) return 'malformed';
  const whole = (match[1] ?? '').replace(/^0+(?=\d)/, '');
  if (whole.length > 8) return 'too_large';
  const canonical = `${whole}.${(match[2] ?? '').padEnd(2, '0')}`;
  const number = Number(canonical);
  return number > 0 ? { canonical, number } : 'malformed';
}

/**
 * The one validator for a posted fact. `raw` is the submitted strings by input name: the field's
 * own name for a count or the note, `office_sq_ft` and `home_sq_ft` together for the areas, and
 * `miles_<from>` for each band of the year. Returns the canonical value or a typed refusal; a
 * refusal never carries the input, and nothing here logs.
 */
export function validateProfileFact(
  field: ProfileFactField,
  raw: Readonly<Record<string, string>>,
  context: ProfileFactContext,
): ProfileFactValidation {
  switch (field) {
    case 'fair_rental_days':
    case 'personal_use_days':
    case 'stay_count': {
      const value = integerUpTo((raw[field] ?? '').trim(), PROFILE_FACT_DAYS_MAX);
      return typeof value === 'number' ? { ok: true, value: { field, value } } : value;
    }
    case 'services_note': {
      const note = (raw[field] ?? '').trim();
      // The declared entity's text fields share this gate (person-text.ts), so the two cannot
      // drift: the checker scans every entity's services_note, and a note it would refuse must
      // never be recorded, or every later run would be rejected for it.
      const problem = personTextProblem(note, PROFILE_FACT_NOTE_MAX_LENGTH);
      if (problem !== null) return fail(problem);
      return { ok: true, value: { field, value: note } };
    }
    case 'home_office': {
      const office = area((raw['office_sq_ft'] ?? '').trim());
      const home = area((raw['home_sq_ft'] ?? '').trim());
      if (typeof office === 'string') return fail(office);
      if (typeof home === 'string') return fail(home);
      if (office.number > home.number) return fail('order');
      return {
        ok: true,
        value: { field, office_sq_ft: office.canonical, home_sq_ft: home.canonical },
      };
    }
    case 'miles': {
      if (context.bands.length === 0) return fail('band');
      const bands: { from: string; to: string; miles: number }[] = [];
      for (const band of context.bands) {
        const text = raw[`miles_${band.from}`];
        if (text === undefined) return fail('band');
        const miles = integerUpTo(text.trim(), PROFILE_FACT_MILES_MAX);
        if (typeof miles !== 'number') return miles;
        bands.push({ from: band.from, to: band.to, miles });
      }
      return { ok: true, value: { field, bands } };
    }
  }
}

/**
 * The mileage file's bands that overlap the tax year, in the file's order. Abacus, the overlay and
 * the web read the year's bands through this one function.
 */
export function mileageBandsOf(
  mileageRules: unknown,
  taxYear: number,
): { from: string; to: string; cents: string }[] {
  const rows =
    mileageRules !== null && typeof mileageRules === 'object'
      ? (mileageRules as Json)['business_cents_per_mile']
      : undefined;
  const yearStart = `${String(taxYear)}-01-01`;
  const yearEnd = `${String(taxYear)}-12-31`;
  const bands: { from: string; to: string; cents: string }[] = [];
  for (const row of Array.isArray(rows) ? (rows as unknown[]) : []) {
    if (row === null || typeof row !== 'object') continue;
    const { from, to, cents } = row as Json;
    if (typeof from !== 'string' || typeof to !== 'string') continue;
    if (from <= yearEnd && to >= yearStart) bands.push({ from, to, cents: String(cents) });
  }
  return bands;
}

const isJson = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * The person's live `profile_fact:` answers laid onto a profile: a copy, never the input. An
 * answer counts when its key is exactly `profile_fact:<target>:<field>` for the effect its chosen
 * option carries, and the effect parses as `profile_fact`. A target the profile does not carry is
 * skipped, never thrown on (the person sees it as not recorded). Presence-keyed like the
 * register's own write: a field the answers do not name stays as staged. A miles fact targets a
 * vehicle's use (`use_<id>`, decision record 0189) and keeps the bands that match one of
 * `mileageBands` exactly (so a later rules change cannot make the build fail on an unknown band);
 * the use's `business_miles` becomes their sum, the column contract.
 */
export function applyProfileFacts(
  profile: Json,
  answers: ReadonlyMap<string, object>,
  mileageBands: readonly MileageBand[],
): Json {
  const result: Json = { ...profile };
  const copyList = (name: string): Json[] | null => {
    const list = profile[name];
    if (!Array.isArray(list)) return null;
    const copy = (list as unknown[]).map((entry) =>
      isJson(entry) ? { ...entry } : entry,
    ) as Json[];
    result[name] = copy;
    return copy;
  };
  const entities = copyList('entities');
  const uses: Json[] = [];
  for (const vehicle of copyList('vehicles') ?? []) {
    if (!isJson(vehicle) || !Array.isArray(vehicle['uses'])) continue;
    const copy = (vehicle['uses'] as unknown[]).map((use) => (isJson(use) ? { ...use } : use));
    vehicle['uses'] = copy;
    uses.push(...(copy as Json[]));
  }
  for (const [key, staged] of answers) {
    if (!key.startsWith(PROFILE_FACT_KEY_PREFIX)) continue;
    const { options, answer } = staged as Json;
    const effect = parseEffect(optionEffectOf({ options, answer, cites: [] }));
    if (effect === null || effect.kind !== 'profile_fact') continue;
    const { target, fact } = effect;
    if (key !== `${PROFILE_FACT_KEY_PREFIX}${target}:${fact.field}`) continue;
    const list = fact.field === 'miles' ? uses : entities;
    const entry = list?.find((candidate) => isJson(candidate) && candidate['key'] === target);
    if (entry === undefined) continue;
    switch (fact.field) {
      case 'fair_rental_days':
      case 'personal_use_days':
      case 'stay_count':
      case 'services_note':
        entry[fact.field] = fact.value;
        break;
      case 'home_office':
        entry['home_office'] = { office_sq_ft: fact.office_sq_ft, home_sq_ft: fact.home_sq_ft };
        break;
      case 'miles': {
        const kept = fact.bands.filter((band) =>
          mileageBands.some((known) => known.from === band.from && known.to === band.to),
        );
        if (kept.length === 0) break;
        entry['miles'] = kept.map((band) => ({ ...band }));
        entry['business_miles'] = String(kept.reduce((sum, band) => sum + band.miles, 0));
        break;
      }
    }
  }
  return result;
}

/**
 * Trips: each trip's meals both ways, the actual meal lines and the M&IE per diem, each at the
 * rules file's limit, with no winner chosen and no difference computed. The per-diem rate comes
 * from the rules file's windows, or from a recorded web value the rules file does not carry. A
 * trip whose segments cover one calendar day has no M&IE side (the rules file's `same_day_note`):
 * its row carries `per_diem_applies: false` and null per-diem figures, and its actual meals are
 * shown as for any trip.
 */
import { dayOrdinal, ordinalToDay } from '../dates';
import { addCents, fmtCents, parseDec, percentOfCents, toCents } from '../money';
import { foldValueKey, parsePeriod, periodCovers } from '../web_values';
import { asArray, asObject, idList, strOrNull, text, type Json } from './values';

type Rate = { mie: string; first_last_day: string };
type Cited = { key: string; value: string; url: string };
type WebRate =
  { kind: 'rate'; rate: Rate; source: { key: string; url: string } } | { kind: 'partial' } | null;

/**
 * The state suffixes the GSA standard CONUS rate serves: the 48 states plus
 * DC. AK, HI, PR and the territories carry separately set rates this file does
 * not load, so an unmatched location with any other suffix resolves nothing
 * and the recorded-web-value arm stays reachable for it.
 */
const CONUS_SUFFIXES = new Set([
  'AL',
  'AR',
  'AZ',
  'CA',
  'CO',
  'CT',
  'DC',
  'DE',
  'FL',
  'GA',
  'IA',
  'ID',
  'IL',
  'IN',
  'KS',
  'KY',
  'LA',
  'MA',
  'MD',
  'ME',
  'MI',
  'MN',
  'MO',
  'MS',
  'MT',
  'NC',
  'ND',
  'NE',
  'NH',
  'NJ',
  'NM',
  'NV',
  'NY',
  'OH',
  'OK',
  'OR',
  'PA',
  'RI',
  'SC',
  'SD',
  'TN',
  'TX',
  'UT',
  'VA',
  'VT',
  'WA',
  'WI',
  'WV',
  'WY',
]);

/** A "City, ST" or "City, Country" location as its locality and suffix, each trimmed and lower
 *  cased, so spacing and case around the comma do not matter; null when either is missing. */
function placeKey(location: string): string | null {
  const [city = '', suffix = ''] = location.split(',').map((part) => part.trim().toLowerCase());
  return city === '' || suffix === '' ? null : `${city}, ${suffix}`;
}

/** A window whose dates are absent stays unbounded, as today. */
function windowCovers(window: Json, day: string): boolean {
  const from = window.effective_from;
  const to = window.effective_to;
  if (from !== undefined && from !== null && day < text(from)) return false;
  if (to !== undefined && to !== null && day > text(to)) return false;
  return true;
}

/** A window's effective_from as a comparable string; absent sorts earliest. */
function windowFrom(window: Json): string {
  const from = window.effective_from;
  return from === undefined || from === null ? '' : text(from);
}

/**
 * The covering window with the latest effective_from wins, so a newer edition
 * (the State Department's are open-ended and overlap from the new effective
 * date on) supersedes the older. Within it a location resolves in order: the
 * entry whose locality and suffix are the location's (`placeKey`), never a
 * same-named city of another state or country - the CONUS table carries
 * Portland, ME and Portland, OR, and Springfield, MA but not Springfield, IL,
 * which GSA's standard rate serves; then that standard rate, which serves
 * only a location whose suffix is one of the CONUS jurisdictions; and
 * unresolved otherwise, so the recorded-web-value arm stays reachable. A
 * location with no suffix names no state or country, so it resolves nothing
 * and its trip reports the missing rate. A day no window covers resolves
 * nothing.
 */
function findRate(perDiem: Json, location: string, day: string): Rate | null {
  const key = placeKey(location);
  const suffix = (location.split(',')[1] ?? '').trim().toUpperCase();
  for (const groupName of ['conus_mie', 'oconus_mie']) {
    const raw = perDiem[groupName];
    const windows = (Array.isArray(raw) ? raw : [raw]).map(asObject);
    let covering: Json | null = null;
    let matched: Rate | null = null;
    for (const window of windows) {
      if (!windowCovers(window, day)) continue;
      if (covering !== null && windowFrom(window) < windowFrom(covering)) continue;
      covering = window;
      const found =
        key === null
          ? undefined
          : Object.entries(asObject(window.locations)).find(([name]) => placeKey(name) === key);
      matched = found === undefined ? null : (asObject(found[1]) as Rate);
    }
    if (matched !== null) return matched;
    if (groupName === 'conus_mie' && covering !== null && CONUS_SUFFIXES.has(suffix)) {
      const standard = asObject(covering.standard);
      if (standard.mie !== undefined && standard.first_last_day !== undefined) {
        return standard as Rate;
      }
    }
  }
  return null;
}

/**
 * The web-value arm of per-diem resolution, one resolver per build. The run's own records come
 * first in the search order, so an out entry armed by an answer takes effect, silence (no out
 * entry) reuses the confirmed citation, and an identical re-emission is a no-op. A key the rules
 * file already carries is ignored here - rules data wins, and check_outputs rejects such an entry
 * instead.
 *
 * One location's rate object is assembled from its two recorded entries; a partial pair is never
 * completed by guessing the first/last-day fraction. A key addresses the rules data's own
 * address, with the location named by its full string or by its first comma part ("Taipei" for
 * "Taipei, Taiwan", the key SKILL.md rule 8 shows), matched case-insensitively. Unlike the rules
 * arm, the short key carries no suffix; it is the skill's documented key and stays until that
 * contract changes.
 */
function webRateResolver(
  outValues: readonly Json[],
  confirmedValues: readonly Json[],
  rulesCovered: (key: string) => boolean,
  warnings: string[],
): (location: string, tripStart: string, tripEnd: string) => WebRate {
  const webRates = new Map<string, WebRate>();
  return (location, tripStart, tripEnd) => {
    const cacheKey = `${location}\u0000${tripStart}\u0000${tripEnd}`;
    const cached = webRates.get(cacheKey);
    if (cached !== undefined) return cached;
    const base = foldValueKey(location.trim());
    const short = foldValueKey((location.split(',')[0] ?? '').trim());
    const candidates = short === '' || short === base ? [base] : [base, short];
    let resolved: WebRate = null;
    for (const groupName of ['conus_mie', 'oconus_mie']) {
      for (const city of candidates) {
        // One field's usable entries from one source file, in search order.
        // A value that is not a decimal parseDec accepts is never computed
        // from; check_outputs reports the entry as schema and the rate stays
        // unresolved.
        const matchIn = (list: readonly Json[], field: string): Cited | null => {
          const address = `per_diem.${groupName}.locations.${city}.${field}`;
          for (const raw of list) {
            const key = strOrNull(raw.key);
            if (key === null || foldValueKey(key) !== address) continue;
            if (rulesCovered(key)) continue;
            const period = parsePeriod(raw.effective_period);
            // The recorded period must cover the trip's whole span; a rate
            // that lets any day of the trip expire is unresolved for it,
            // never partially applied.
            if (
              period === null ||
              !periodCovers(period, tripStart) ||
              !periodCovers(period, tripEnd)
            )
              continue;
            const value = strOrNull(raw.value);
            const url = strOrNull(raw.url);
            if (value === null || url === null || !/^[+-]?\d+(\.\d+)?$/.test(value)) continue;
            try {
              parseDec(value);
            } catch {
              continue;
            }
            return { key, value, url };
          }
          return null;
        };
        const outMie = matchIn(outValues, 'mie');
        const confirmedMie = outMie === null ? matchIn(confirmedValues, 'mie') : null;
        const mie = outMie ?? confirmedMie;
        if (mie === null) continue;
        const outFirstLast = matchIn(outValues, 'first_last_day');
        const confirmedFirstLast =
          outFirstLast === null ? matchIn(confirmedValues, 'first_last_day') : null;
        const firstLast = outFirstLast ?? confirmedFirstLast;
        if (firstLast === null) {
          resolved = { kind: 'partial' };
          break;
        }
        // The pair prefers one source file - out with out, confirmed with
        // confirmed - so the citation names one page. A pair no file carries
        // whole still computes, with a warning naming both keys and urls.
        let miePick = mie;
        let firstLastPick = firstLast;
        if (
          confirmedMie !== null &&
          confirmedFirstLast !== null &&
          (outMie === null || outFirstLast === null)
        ) {
          miePick = confirmedMie;
          firstLastPick = confirmedFirstLast;
        }
        resolved = {
          kind: 'rate',
          rate: { mie: miePick.value, first_last_day: firstLastPick.value },
          source: { key: miePick.key, url: miePick.url },
        };
        if (miePick.url !== firstLastPick.url) {
          warnings.push(
            `${location}: the mie and first_last_day web values come from different sources (${miePick.key} ${miePick.url}; ${firstLastPick.key} ${firstLastPick.url})`,
          );
        }
        break;
      }
      if (resolved !== null) break;
    }
    webRates.set(cacheKey, resolved);
    return resolved;
  };
}

export interface TripInputs {
  readonly trips: ReadonlyMap<string, Json>;
  readonly perDiem: Json;
  /** out/web_values.json's entries, then confirmed/web_values.json's, in search order. */
  readonly outValues: readonly Json[];
  readonly confirmedValues: readonly Json[];
  /** Whether the staged rules data already carries a web value's key. */
  readonly rulesCovered: (key: string) => boolean;
  /** The ledger's meal ids by trip key (`_no_trip` for a meal on no trip) and their USD cents. */
  readonly mealsByTrip: ReadonlyMap<string, readonly string[]>;
  readonly usdByMeal: ReadonlyMap<string, bigint>;
}

const TRIP_NOTE =
  'Both methods shown for the accountant. Lodging for self-employed travel is actual cost only.';

/** One row per trip, then the warning for meals on no trip. */
export function tripComparisons(inputs: TripInputs): { rows: Json[]; warnings: string[] } {
  const { trips, perDiem, mealsByTrip, usdByMeal } = inputs;
  const warnings: string[] = [];
  const webRate = webRateResolver(
    inputs.outValues,
    inputs.confirmedValues,
    inputs.rulesCovered,
    warnings,
  );
  const limit = parseDec(text(perDiem.meal_limit_pct ?? '50'));
  const rows: Json[] = [];
  for (const [tripKey, trip] of trips) {
    const days: { ordinal: number; location: string }[] = [];
    for (const rawSegment of asArray(trip.segments)) {
      const segment = asObject(rawSegment);
      const start = dayOrdinal(text(segment.start));
      const end = dayOrdinal(text(segment.end));
      for (let ordinal = start; ordinal <= end; ordinal++) {
        days.push({ ordinal, location: text(segment.location) });
      }
    }
    days.sort(
      (a, b) =>
        a.ordinal - b.ordinal || (a.location < b.location ? -1 : a.location > b.location ? 1 : 0),
    );
    const mealIds = mealsByTrip.get(tripKey) ?? [];
    let actual = 0n;
    for (const id of mealIds) actual = addCents(actual, usdByMeal.get(id) ?? 0n);
    const actualAtLimit = percentOfCents(actual, limit);
    const limitPct = text(perDiem.meal_limit_pct ?? '50');
    const actualStep = `meals at ${limitPct}% = ${fmtCents(actual)} x ${limitPct}% = ${fmtCents(actualAtLimit)}`;
    const onlyDay = days[0];
    if (onlyDay !== undefined && days.every((day) => day.ordinal === onlyDay.ordinal)) {
      // One calendar day, so no night away and no M&IE side to price (the rules file's
      // same_day_note, Publication 463 chapter 1's sleep-or-rest rule). The actual meals stay as
      // recorded; no method is named.
      rows.push({
        trip: tripKey,
        entity: strOrNull(trip.entity),
        days: days.length,
        meal_limit_pct: limitPct,
        actual_meals: fmtCents(actual),
        actual_meals_cents: Number(actual),
        actual_meals_at_limit: fmtCents(actualAtLimit),
        actual_meals_at_limit_cents: Number(actualAtLimit),
        per_diem_applies: false,
        mie_per_diem: null,
        mie_per_diem_cents: null,
        mie_per_diem_at_limit: null,
        mie_per_diem_at_limit_cents: null,
        per_diem_complete: true,
        missing_rates: [],
        meal_items: mealIds,
        per_diem_steps: [
          `${ordinalToDay(onlyDay.ordinal)}: one calendar day, no M&IE per diem. ${text(perDiem.same_day_note)}`,
          actualStep,
        ],
        // One reading, so not TRIP_NOTE's "Both methods": the rules file's own reason.
        note: text(perDiem.same_day_note),
      });
      continue;
    }
    let perDiemTotal = 0n;
    const missing = new Set<string>();
    const steps: string[] = [];
    // A web value's effective period must cover the trip's whole span, so the
    // earliest segment start through the latest segment end is what resolution
    // checks against; a rate that expires mid-trip is unresolved for the trip.
    const firstDay = days[0];
    const lastDay = days[days.length - 1];
    const tripStart = firstDay === undefined ? '' : ordinalToDay(firstDay.ordinal);
    const tripEnd = lastDay === undefined ? '' : ordinalToDay(lastDay.ordinal);
    let tripSource: { key: string; url: string } | null = null;
    const partialWarned = new Set<string>();
    for (const [index, { ordinal, location }] of days.entries()) {
      const day = ordinalToDay(ordinal);
      let rate: Rate | null = findRate(perDiem, location, day);
      if (rate === null) {
        const web = tripStart === '' ? null : webRate(location, tripStart, tripEnd);
        if (web === null) {
          missing.add(location);
          steps.push(`${day} ${location}: no rate in rules data`);
          continue;
        }
        if (web.kind === 'partial') {
          missing.add(location);
          steps.push(`${day} ${location}: no rate in rules data`);
          if (!partialWarned.has(location)) {
            partialWarned.add(location);
            warnings.push(
              `${location}: a recorded web value carries one field of the rate but not the other; no rate applied`,
            );
          }
          continue;
        }
        rate = web.rate;
        if (tripSource === null) tripSource = web.source;
      }
      const firstOrLast = index === 0 || index === days.length - 1;
      const value = parseDec(text(firstOrLast ? rate.first_last_day : rate.mie));
      perDiemTotal = addCents(perDiemTotal, toCents(value));
      steps.push(
        `${day} ${location}: ${fmtCents(toCents(value))}${firstOrLast ? ' (first or last day)' : ''}`,
      );
    }
    const perDiemAtLimit = percentOfCents(perDiemTotal, limit);
    // Both methods, each at the limit, in the steps as well: no winner is chosen and no
    // difference is computed - the comparison is the accountant's.
    steps.push(actualStep);
    steps.push(
      `per diem at ${limitPct}% = ${fmtCents(perDiemTotal)} x ${limitPct}% = ${fmtCents(perDiemAtLimit)}`,
    );
    const report: Json = {
      trip: tripKey,
      entity: strOrNull(trip.entity),
      days: days.length,
      meal_limit_pct: limitPct,
      actual_meals: fmtCents(actual),
      actual_meals_cents: Number(actual),
      actual_meals_at_limit: fmtCents(actualAtLimit),
      actual_meals_at_limit_cents: Number(actualAtLimit),
      per_diem_applies: true,
      mie_per_diem: fmtCents(perDiemTotal),
      mie_per_diem_cents: Number(perDiemTotal),
      mie_per_diem_at_limit: fmtCents(perDiemAtLimit),
      mie_per_diem_at_limit_cents: Number(perDiemAtLimit),
      per_diem_complete: missing.size === 0,
      missing_rates: [...missing].sort(),
      meal_items: mealIds,
      per_diem_steps: steps,
    };
    if (tripSource !== null) report.per_diem_source = tripSource;
    report.note = TRIP_NOTE;
    rows.push(report);
  }
  const noTrip = mealsByTrip.get('_no_trip');
  if (noTrip !== undefined) warnings.push(`meals outside any trip: ${idList(noTrip)}`);
  return { rows, warnings };
}

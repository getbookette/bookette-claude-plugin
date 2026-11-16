/**
 * The property-tax payments' parcel resolution (issue #110): which profile entity claims each
 * parcel a staged payment covers, and why a payment books nothing, computed once and read by two
 * callers - build_books, which converts each payment and books what resolves into the taxes
 * schedule lines, and check_outputs, which re-runs the same resolution so a payment that books
 * nothing is a visible finding, not only a build warning. No currency, no conversion and no
 * booking enter - a stated amount is parsed only to judge it positive.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { parseDec, type Dec } from '../money';
import { normalizeParcel } from '../parcels';
import { loadProfile } from './profile';

type Json = Record<string, unknown>;

export type TaxPaymentOutcome =
  | 'resolved'
  | 'parcel_unclaimed'
  | 'entity_off_schedule'
  | 'covered_parcel_not_in_bill'
  | 'no_stated_amount';

export interface ResolvedTaxParcel {
  /** The parcel number, normalized. */
  readonly number: string;
  /** The claiming entity's key. */
  readonly entityKey: string;
  /** The bill's stated weight, parsed. */
  readonly stated: Dec;
  /** The bill's stated weight as written. */
  readonly statedText: string;
}

export interface TaxPaymentResolution {
  /** The payment's name in build warnings: its payment_source, else `tax_payments.json item N`. */
  readonly name: string;
  readonly paymentSource: string | null;
  readonly billSource: string | null;
  readonly outcome: TaxPaymentOutcome;
  /** The warning fragment build_books appends `; nothing booked` to; null only when resolved. */
  readonly reason: string | null;
  /** The bill's parcel numbers, normalized, in the bill's own order (for the bill-signature check). */
  readonly parcelNumbers: readonly string[];
  /** The resolved parcels, bill order; non-empty only when outcome is 'resolved'. */
  readonly parcels: readonly ResolvedTaxParcel[];
}

export interface TaxPaymentsResolution {
  /** One entry per staged payment, index-aligned with the input list. */
  readonly payments: readonly TaxPaymentResolution[];
  /** Profile-level errors: a parcel claimed by two entities. */
  readonly errors: string[];
}

function asObject(value: unknown): Json {
  return (value ?? {}) as Json;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function text(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'bigint' || typeof value === 'boolean') {
    return String(value);
  }
  if (value === null || value === undefined) return '';
  return JSON.stringify(value);
}

function str(value: unknown): string {
  return text(value);
}

function strOrNull(value: unknown): string | null {
  return value === null || value === undefined ? null : text(value);
}

/** A stated amount a payment field carries, or null when absent or unparseable. */
function decOrNull(value: unknown): Dec | null {
  if (value === null || value === undefined) return null;
  try {
    return parseDec(text(value));
  } catch {
    return null;
  }
}

function loadJson(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * The per-payment parcel resolution over a profile and the staged payments. No currency, no
 * conversion and no booking enter - a stated amount is parsed only to judge it positive.
 */
export function resolveTaxPayments(
  profile: Json,
  taxPayments: readonly unknown[],
): TaxPaymentsResolution {
  const errors: string[] = [];
  // The entities in the profile's own order, keyed the way build_books keys them; a repeated
  // key collapses onto the last entry, exactly as the builder's own map does.
  const entities = new Map<string, Json>(
    (asArray(profile.entities) as Json[]).map((entity) => [str(entity.key), entity]),
  );
  const parcelClaims = new Map<string, string>();
  for (const [entityKey, entity] of entities) {
    for (const rawParcel of asArray(entity.parcels)) {
      const number = normalizeParcel(str(rawParcel));
      if (number === '') continue;
      const claimed = parcelClaims.get(number);
      if (claimed !== undefined && claimed !== entityKey) {
        errors.push(`parcel ${number} is claimed by entities ${claimed} and ${entityKey}`);
        continue;
      }
      parcelClaims.set(number, entityKey);
    }
  }
  const payments = taxPayments.map((rawPayment, index): TaxPaymentResolution => {
    const payment = asObject(rawPayment);
    const paymentSource = strOrNull(payment.payment_source);
    const name = paymentSource ?? `tax_payments.json item ${String(index)}`;
    const billSource = strOrNull(payment.bill_source);
    const parcelRows = asArray(payment.parcels).map((raw) => {
      const parcel = asObject(raw);
      return { number: normalizeParcel(str(parcel.number)), stated: parcel.amount };
    });
    const coveredRaw = asArray(payment.covered_parcels).map((parcel) =>
      normalizeParcel(str(parcel)),
    );
    // The covered parcels walk the bill's own parcels order, whichever way covered_parcels
    // spelled them, so the largest-remainder tie lands on the parcel later in the bill's list -
    // the order the split's wording pins. A covered parcel the bill's list does not carry sorts
    // last and keeps its own failure below.
    const billOrder = new Map(
      parcelRows.map((parcel, parcelIndex) => [parcel.number, parcelIndex]),
    );
    const coveredSet = new Set(
      coveredRaw.length === 0 ? parcelRows.map((row) => row.number) : coveredRaw,
    );
    const coveredList = [...coveredSet].sort(
      (a, b) =>
        (billOrder.get(a) ?? Number.POSITIVE_INFINITY) -
        (billOrder.get(b) ?? Number.POSITIVE_INFINITY),
    );
    const resolved: ResolvedTaxParcel[] = [];
    let outcome: TaxPaymentOutcome = 'resolved';
    let reason: string | null = null;
    for (const number of coveredList) {
      const row = parcelRows.find((parcel) => parcel.number === number);
      if (row === undefined) {
        outcome = 'covered_parcel_not_in_bill';
        reason = `covered parcel ${number} is not in the payment's parcel list`;
        break;
      }
      const entityKey = parcelClaims.get(number);
      if (entityKey === undefined) {
        outcome = 'parcel_unclaimed';
        reason = `parcel ${number} is on no profile entity`;
        break;
      }
      const stated = decOrNull(row.stated);
      if (stated === null || stated.v <= 0n) {
        outcome = 'no_stated_amount';
        reason = `parcel ${number} carries no positive stated amount`;
        break;
      }
      resolved.push({ number, entityKey, stated, statedText: text(row.stated) });
    }
    const scheduleOf = (entityKey: string): string | null => {
      const entity = entities.get(entityKey);
      return entity === undefined ? null : strOrNull(entity.schedule);
    };
    if (
      outcome === 'resolved' &&
      resolved.some(
        (parcel) => scheduleOf(parcel.entityKey) !== 'E' && scheduleOf(parcel.entityKey) !== 'C',
      )
    ) {
      outcome = 'entity_off_schedule';
      reason = 'a receiving entity does not book Schedule C or E lines';
    }
    return {
      name,
      paymentSource,
      billSource,
      outcome,
      reason,
      parcelNumbers: parcelRows.map((parcel) => parcel.number),
      parcels: outcome === 'resolved' ? resolved : [],
    };
  });
  return { payments, errors };
}

/**
 * The tax payments the build computes from (issue #980): out/tax_payments.json when the run wrote
 * it - a present file is the complete set - else confirmed/tax_payments.json, the stored payments
 * the bundle staged, which silence keeps as the importer keeps a stored payment the output omits.
 * Empty when neither exists or the file read is not a list. The one seam build_books and
 * check_outputs share, as readHomeCosts is for the home costs.
 */
export function readTaxPayments(workspace: string): unknown[] {
  const staged = join(workspace, 'out', 'tax_payments.json');
  const value = loadJson(
    existsSync(staged) ? staged : join(workspace, 'confirmed', 'tax_payments.json'),
  );
  return Array.isArray(value) ? (value as unknown[]) : [];
}

/**
 * The resolution of one workspace, read from its own files - the profile through the one loader
 * the build and the home-office readings share, and the payments through `readTaxPayments` - so
 * both callers compute from the same inputs.
 */
export function loadTaxPaymentsResolution(
  workspace: string,
  skillDir: string,
): TaxPaymentsResolution {
  const profile = asObject(loadProfile(workspace, skillDir));
  return resolveTaxPayments(profile, readTaxPayments(workspace));
}

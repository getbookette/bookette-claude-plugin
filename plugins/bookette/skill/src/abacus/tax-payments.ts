/**
 * Property-tax payments, the parcel split (issue #110, decision record 0105): each staged payment
 * converts on the payment date through the ledger's own fx path, then books whole (one covered
 * parcel) or by the largest-remainder split across the covered parcels, the bill's stated amounts
 * as weights. Which entity claims which parcel resolves in the shared module tax_payments.ts; a
 * payment that resolves nowhere books nothing and warns; the pieces fold into the taxes schedule
 * lines, never the ledger. A payment dated outside the tax year books no piece: it is listed in
 * the books' `outside_year` (decision record 0148), never converted, whatever its resolution.
 *
 * Donations sit beside them in the books as a listing for the accountant, never ledger rows:
 * read as they were written, with no figure computed from them, so no module touches them.
 */
import { isValidDay } from '../dates';
import { fmtCents, parseDec, toCents } from '../money';
import { resolveTaxPayments } from '../scripts/tax_payments';
import type { Convert } from './fx-use';
import { requireBook, type Book, type LineBooking } from './schedules';
import { asObject, strOrNull, text, type Json } from './values';

export interface TaxPaymentInputs {
  readonly profile: Json;
  /** The payments `readTaxPayments` reads (out/, else confirmed/), in the bill's order. */
  readonly taxPayments: readonly unknown[];
  /** The books, read for each receiving entity's schedule. */
  readonly books: ReadonlyMap<string, Book>;
  readonly convert: Convert;
  readonly taxYear: number;
}

/** BigInt division floored toward negative infinity; denominator must be nonzero. */
function floorDiv(numerator: bigint, denominator: bigint): bigint {
  const quotient = numerator / denominator;
  const roundsDown = numerator % denominator !== 0n && numerator < 0n !== denominator < 0n;
  return roundsDown ? quotient - 1n : quotient;
}

/**
 * Largest remainder: floor every weight's share of `cents`, then hand the leftover cents one each
 * to the largest fractional parts, ties to the weight later in the list. The pieces sum to `cents`.
 */
export function largestRemainder(cents: bigint, weights: readonly bigint[]): bigint[] {
  const total = weights.reduce((sum, weight) => sum + weight, 0n);
  const weighted = weights.map((weight) => cents * weight);
  const floors = weighted.map((product) => floorDiv(product, total));
  let remainder = cents - floors.reduce((sum, floor) => sum + floor, 0n);
  const byFraction = weights
    .map((_, index) => index)
    .sort((a, b) => {
      const left = (((weighted[a] ?? 0n) % total) + total) % total;
      const right = (((weighted[b] ?? 0n) % total) + total) % total;
      return left > right ? -1 : left < right ? 1 : b - a;
    });
  for (const index of byFraction) {
    if (remainder <= 0n) break;
    floors[index] = (floors[index] ?? 0n) + 1n;
    remainder -= 1n;
  }
  return floors;
}

/** Every staged payment's pieces, each on its receiving entity's taxes line. */
export function taxPaymentPieces(inputs: TaxPaymentInputs): {
  bookings: LineBooking[];
  outsideYear: Json[];
  errors: string[];
  warnings: string[];
} {
  const { profile, taxPayments, books, convert, taxYear } = inputs;
  const outsideYear: Json[] = [];
  const resolution = resolveTaxPayments(profile, taxPayments);
  const errors: string[] = [...resolution.errors];
  const warnings: string[] = [];
  const bookings: LineBooking[] = [];
  // One parcel per receiving piece, with its entity and the bill's stated weight.
  const bookTaxPiece = (
    entityKey: string,
    parcel: string,
    piece: bigint,
    date: string,
    source: string | null,
    steps: string[],
  ): void => {
    const schedule = strOrNull(requireBook(books, entityKey).schedule);
    bookings.push({
      entity: entityKey,
      line: schedule === 'E' ? '16' : '23',
      cents: piece,
      entry: { tax: parcel, usd_cents: Number(piece), date, source_file: source, steps },
    });
  };
  const billParcelSignatures = new Map<string, string>();
  const stagedPaymentSources = new Set<string>();
  for (const [paymentIndex, paymentResolution] of resolution.payments.entries()) {
    const payment = asObject(taxPayments[paymentIndex]);
    const { name, paymentSource, billSource, outcome, reason, parcelNumbers, parcels } =
      paymentResolution;
    if (paymentSource !== null) {
      if (stagedPaymentSources.has(paymentSource)) {
        errors.push(`${name}: the same payment is staged more than once`);
      }
      stagedPaymentSources.add(paymentSource);
    }
    if (billSource !== null) {
      const signature = parcelNumbers.slice().sort().join('\u0000');
      const prior = billParcelSignatures.get(billSource);
      if (prior !== undefined && prior !== signature) {
        errors.push(`${name}: a second payment of bill ${billSource} lists different parcels`);
      }
      billParcelSignatures.set(billSource, signature);
    }
    // The tax year is a cut (decision record 0148): a payment dated in another year is listed with
    // its documents, its parcels and the places they resolve to, and books nothing.
    const paid = text(payment.date);
    if (isValidDay(paid) && Number(paid.slice(0, 4)) !== taxYear) {
      outsideYear.push({
        kind: 'tax_payment',
        date: paid,
        payment_source: paymentSource,
        bill_source: billSource,
        parcels: parcels.length > 0 ? parcels.map((parcel) => parcel.number) : [...parcelNumbers],
        amount: text(payment.amount),
        currency: strOrNull(payment.currency) ?? 'USD',
        entities: [...new Set(parcels.map((parcel) => parcel.entityKey))],
      });
      continue;
    }
    let cents: bigint;
    try {
      cents = convert(
        strOrNull(payment.currency) ?? 'USD',
        text(payment.date),
        parseDec(text(payment.amount)),
      ).cents;
    } catch (error) {
      errors.push(`${name}: ${(error as Error).message}`);
      continue;
    }
    const day = text(payment.date);
    if (outcome !== 'resolved' && reason !== null) {
      warnings.push(`${name}: ${reason}; nothing booked`);
      continue;
    }
    if (parcels.length === 1) {
      const only = parcels[0];
      if (only !== undefined) {
        bookTaxPiece(only.entityKey, only.number, cents, day, paymentSource, [
          `whole payment: ${fmtCents(cents)} to one covered parcel`,
        ]);
      }
      continue;
    }
    const statedSum = parcels.reduce((sum, parcel) => sum + parcel.stated.v, 0n);
    if (statedSum <= 0n) {
      warnings.push(`${name}: the stated amounts sum to zero; nothing booked`);
      continue;
    }
    const pieces = largestRemainder(
      cents,
      parcels.map((parcel) => parcel.stated.v),
    );
    for (const [index, parcel] of parcels.entries()) {
      const piece = pieces[index] ?? 0n;
      bookTaxPiece(parcel.entityKey, parcel.number, piece, day, paymentSource, [
        `${fmtCents(piece)} = ${fmtCents(cents)} x ${parcel.statedText} / ${fmtCents(toCents({ v: statedSum }))} (largest remainder)`,
      ]);
    }
  }
  return { bookings, outsideYear, errors, warnings };
}

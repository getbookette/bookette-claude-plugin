/**
 * Fixed-point decimal money on BigInt, the arithmetic core Abacus is built on.
 *
 * Every input is a decimal string of the shape the ledger and rules data carry
 * ("1184.00", "1280", "31.5900", "27.5"). Values are held scaled by SCALE, which
 * keeps sums exact; the only rounding is at the cent, half-up away from zero
 * (decision record 0033 item 2), and the goldens pin it to the cent.
 */
export const SCALE = 10n ** 12n;
const CENT_SCALE = 10n ** 10n; // SCALE / 100

export type Dec = { v: bigint };

export function parseDec(input: string): Dec {
  const match = /^([+-]?)(\d+)(?:\.(\d+))?$/.exec(input.trim());
  if (!match) throw new Error(`not a decimal: ${input}`);
  const [, sign = '', whole = '0', fraction = ''] = match;
  if (fraction.length > 12) throw new Error(`too much precision: ${input}`);
  const v = BigInt(whole + fraction.padEnd(12, '0'));
  return { v: sign === '-' ? -v : v };
}

/** Round a scaled value to whole cents, half away from zero. */
export function toCents(d: Dec): bigint {
  return divideHalfUp(d.v, CENT_SCALE);
}

/** BigInt division rounded half away from zero; denominator must be positive. */
export function divideHalfUp(num: bigint, den: bigint): bigint {
  const negative = num < 0n;
  const abs = negative ? -num : num;
  const q = abs / den;
  const roundUp = (abs - q * den) * 2n >= den;
  return negative ? -(q + (roundUp ? 1n : 0n)) : q + (roundUp ? 1n : 0n);
}

/** Cents as the decimal string the books carry: "11284.52", "-1210.00". */
export function fmtCents(cents: bigint): string {
  const negative = cents < 0n;
  const abs = negative ? -cents : cents;
  const whole = abs / 100n;
  const pennies = abs % 100n;
  return `${negative ? '-' : ''}${whole.toString()}.${pennies.toString().padStart(2, '0')}`;
}

export function addCents(a: bigint, b: bigint): bigint {
  return a + b;
}

/** amount * factor where factor is a percent string like "50" → exact at cents. */
export function percentOfCents(cents: bigint, percent: Dec): bigint {
  return divideHalfUp(cents * percent.v, 100n * SCALE);
}

/**
 * A reading's total as whole cents, or null when it is not a plain decimal: an optional leading
 * minus or parentheses for a negative, digits, an optional fraction (`DECIMAL_AMOUNT`'s shape,
 * which the reader's schema enforces). The one parse the correction validator and the
 * code-applied from-value guard share, so a reading and a booked cent compare as the same number.
 */
export function readingTotalCents(value: string): bigint | null {
  const trimmed = value.trim();
  const unwrapped = /^\((\d+(?:\.\d+)?)\)$/.exec(trimmed);
  const text = unwrapped === null ? trimmed : `-${unwrapped[1] ?? ''}`;
  if (!/^-?\d+(?:\.\d+)?$/.test(text)) return null;
  try {
    return toCents(parseDec(text));
  } catch {
    return null;
  }
}

const USD = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const GROUPED = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** A stored amount beside its own currency code, never converted: `$125.00 USD`, and with no
 *  dollar sign beside foreign money, `1,280.00 TWD`. The report and the workbook print every
 *  amount kept in its own currency this way, so the two cannot word one line differently. */
export function formatOwnCurrency(cents: number, currency: string): string {
  const figure = currency === 'USD' ? USD.format(cents / 100) : GROUPED.format(cents / 100);
  return `${figure} ${currency}`;
}

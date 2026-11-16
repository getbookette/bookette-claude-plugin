/**
 * ISO day helpers shared by the Abacus scripts. Dates are "YYYY-MM-DD" strings;
 * they compare lexicographically and convert to day ordinals for arithmetic.
 * A shape-valid but calendar-invalid date ("2026-13-01") is rejected here once,
 * so no caller can measure a NaN ordinal against a real one.
 */
export function isValidDay(day: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const ordinal = dayOrdinal(day);
  return Number.isFinite(ordinal) && ordinalToDay(ordinal) === day;
}

/** Days since 1970-01-01; NaN for a date Date.parse rejects. */
export function dayOrdinal(day: string): number {
  return Math.floor(Date.parse(`${day}T00:00:00Z`) / 86_400_000);
}

export function ordinalToDay(ordinal: number): string {
  return new Date(ordinal * 86_400_000).toISOString().slice(0, 10);
}

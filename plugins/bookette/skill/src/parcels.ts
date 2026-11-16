/**
 * Parcel-number normalization, the one function both Abacus and the importer call, so a bill's
 * stated parcel and a profile's recorded parcel can never disagree by spelling. Trim, remove
 * spaces, keep dashes and case: "41 - 822" and "41-822" are one parcel, and "41822" is another.
 */
export function normalizeParcel(value: string): string {
  return value.trim().replace(/\s+/g, '');
}

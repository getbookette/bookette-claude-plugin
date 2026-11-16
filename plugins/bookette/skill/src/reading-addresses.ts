/** One address a reading prints, as the reader writes it (issue #1628, @bookette/reader's
 *  ReaderAddress): the printed line, its USPS Publication 28 delivery line and its components. */
export interface ReadingAddress {
  readonly as_printed: string;
  readonly usps_standard: string | null;
  readonly city: string | null;
  readonly region: string | null;
  readonly country: string | null;
}

/** NFKC, upper case, punctuation removed, white space collapsed. */
export const addressFold = (text: string): string =>
  text
    .normalize('NFKC')
    .toUpperCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();

function stringOrNull(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function readingAddressOf(value: unknown): ReadingAddress | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const { as_printed, usps_standard, city, region, country } = value as Record<string, unknown>;
  if (typeof as_printed !== 'string') return null;
  if (![usps_standard, city, region, country].every(stringOrNull)) return null;
  return {
    as_printed,
    usps_standard: usps_standard as string | null,
    city: city as string | null,
    region: region as string | null,
    country: country as string | null,
  };
}

/** The addresses a `fields.addresses` value carries; anything that is not such an object is skipped. */
export function readingAddressesOf(value: unknown): ReadingAddress[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => readingAddressOf(item) ?? []);
}

/** Their printed lines. */
export function printedAddressesOf(value: unknown): string[] {
  return readingAddressesOf(value).map((address) => address.as_printed);
}

/** A reading's `fields` with each address reduced to its printed line, so a walk over what a page
 *  prints never collects the USPS form or components the reader wrote beside it. */
export function printedFieldsOf(fields: unknown): unknown {
  if (typeof fields !== 'object' || fields === null || Array.isArray(fields)) return fields;
  const { addresses, ...rest } = fields as Record<string, unknown>;
  return addresses === undefined ? rest : { ...rest, addresses: printedAddressesOf(addresses) };
}

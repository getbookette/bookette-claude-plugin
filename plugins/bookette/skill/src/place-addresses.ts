/**
 * out/places.json (issue #1628, reference/steps/3-propose.md): the books agent's USPS Publication 28 standard
 * form of each staged place's address, the shape the reader writes for a printed one, so the
 * placement pointer compares the two by fold and never by spelling rules of its own. Code checks
 * only the keys, the shape and the house number; nothing is stored from it (decision record 0009).
 */
import { join } from 'node:path';

import { loadJson, record, str } from './json-values';
import { addressFold, type ReadingAddress } from './reading-addresses';
import type { Problem } from './scripts/check_outputs';

export { addressFold };

export type StandardAddress = Omit<ReadingAddress, 'as_printed'>;

const PLACES_UNWRITTEN = 'places_unwritten';
const PLACES_MALFORMED = 'places_malformed';
const STANDARD_KEYS = ['usps_standard', 'city', 'region', 'country'] as const;

const agreeWhereBothSay = (a: string | null, b: string | null): boolean =>
  a === null || b === null || addressFold(a) === addressFold(b);

/** One delivery line a token prefix of the other, each at least a house number and a street
 *  word, and city and region agreeing where both say. */
export function sameStandardAddress(
  printed: StandardAddress,
  place: StandardAddress | null,
): boolean {
  if (printed.usps_standard === null || place?.usps_standard == null) return false;
  const [one, other] = [printed.usps_standard, place.usps_standard].map((line) =>
    addressFold(line).split(' ').filter(Boolean),
  ) as [string[], string[]];
  const [short, long] = one.length <= other.length ? [one, other] : [other, one];
  return (
    short.length >= 2 &&
    short.every((token, index) => long[index] === token) &&
    agreeWhereBothSay(printed.city, place.city) &&
    agreeWhereBothSay(printed.region, place.region)
  );
}

const sameOrBothMissing = (a: string | null, b: string | null): boolean =>
  a === null || b === null ? a === b : addressFold(a) === addressFold(b);

/** The two delivery lines equal after the fold, never one a prefix of the other ("123 MAIN ST"
 *  and "123 MAIN ST UNIT B" are a duplex's two places); the cities equal, one missing only beside
 *  the other missing, since a line printed with no city is no proof it is a staged place's in
 *  Denver; the regions and countries agreeing where both say. */
export function sameStandardForm(a: StandardAddress, b: StandardAddress | null): boolean {
  if (a.usps_standard === null || b?.usps_standard == null) return false;
  return (
    addressFold(a.usps_standard) === addressFold(b.usps_standard) &&
    sameOrBothMissing(a.city, b.city) &&
    agreeWhereBothSay(a.region, b.region) &&
    agreeWhereBothSay(a.country, b.country)
  );
}

/** The house number: the first digit run of the address's first comma part. */
const houseNumberOf = (address: string): string | null =>
  /\d+/.exec(address.split(',')[0] ?? '')?.[0] ?? null;

function standardAddressOf(value: unknown): StandardAddress | null | undefined {
  if (value === null) return null;
  const entry = record(value);
  if (entry === null || Object.keys(entry).sort().join() !== [...STANDARD_KEYS].sort().join()) {
    return undefined;
  }
  if (!STANDARD_KEYS.every((key) => entry[key] === null || typeof entry[key] === 'string')) {
    return undefined;
  }
  return entry as unknown as StandardAddress;
}

/** The staged key each of the run's own entity keys names: a key out/profile.resolved.json carries
 *  that profile.json does not stage, resolved by the entity's name to the staged one (the join
 *  check_outputs' unstagedEntityProblems accepts), as a recorded run re-imported into another
 *  workspace keys its places. */
export function stagedKeyAliases(
  workspace: string,
  entities: readonly Record<string, unknown>[],
): Map<string, string> {
  const staged = new Set(entities.flatMap((entity) => str(entity['key']) ?? []));
  const stagedKeyByName = new Map(
    entities.flatMap((entity) => {
      const key = str(entity['key']);
      const name = str(entity['name']);
      return key === null || name === null ? [] : [[name, key] as const];
    }),
  );
  const resolved = record(loadJson(join(workspace, 'out', 'profile.resolved.json')))?.['entities'];
  return new Map(
    (Array.isArray(resolved) ? resolved : []).flatMap((value: unknown) => {
      const entity = record(value);
      const key = str(entity?.['key']);
      const stagedKey = stagedKeyByName.get(str(entity?.['name']) ?? '');
      return key === null || staged.has(key) || stagedKey === undefined
        ? []
        : [[key, stagedKey] as const];
    }),
  );
}

/** out/places.json's valid entries by staged key, and its problems; a file key is a staged key or
 *  one of `aliases`, and a missing or incomplete file is a problem only when `required`. */
export function placesFileOf(
  workspace: string,
  entities: readonly Record<string, unknown>[],
  aliases: ReadonlyMap<string, string>,
  required: boolean,
): { places: Map<string, StandardAddress | null>; problems: Problem[] } {
  const places = new Map<string, StandardAddress | null>();
  const problems: Problem[] = [];
  const raw = loadJson(join(workspace, 'out', 'places.json'));
  const addressOf = new Map(entities.map((entity) => [str(entity['key']), str(entity['address'])]));
  const file = record(raw);
  let malformed = raw !== null && file === null ? 1 : 0;
  const written = new Set<string>();
  for (const [fileKey, value] of Object.entries(file ?? {})) {
    const key = aliases.get(fileKey) ?? fileKey;
    const standard = standardAddressOf(value);
    const address = addressOf.get(key);
    const house = address == null ? null : houseNumberOf(address);
    const housed =
      house === null ||
      addressFold(standard?.usps_standard ?? '')
        .match(/\d+/g)
        ?.includes(house) === true;
    const twice = written.has(key);
    written.add(key);
    // A place staged with no address has none to standardize, so the agent's never stands in.
    const invented = address === null && standard !== null;
    if (address === undefined || standard === undefined || invented || !housed || twice) {
      malformed += 1;
    } else places.set(key, standard);
  }
  const unwritten = [...addressOf].filter(
    ([key, address]) => key !== null && address !== null && !written.has(key),
  ).length;
  if (malformed > 0) {
    problems.push({
      code: 'schema',
      message: `${PLACES_MALFORMED}: out/places.json carries ${String(malformed)} entry(ies) that are not a staged place's {usps_standard, city, region, country}, each a string or null, or null (and null for a place staged with no address), or whose usps_standard drops its address's house number, or that name a place another entry already names (reference/steps/3-propose.md)`,
    });
  }
  if (required && (file === null || unwritten > 0)) {
    problems.push({
      code: 'schema',
      message: `${PLACES_UNWRITTEN}: out/places.json is missing, unreadable or lacks ${String(unwritten)} staged place(s) with an address; write each staged place's USPS standard address before asking a placement question (reference/steps/3-propose.md)`,
    });
  }
  return { places, problems };
}

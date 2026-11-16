/**
 * The staged places carrying a found place's address (decision records 0123 and 0157, amended
 * 2026-11-09): under the declare core's fold, or by the standard form of a cited printed line.
 */
import { join } from 'node:path';

import { entityNameKey } from '../declared-entity';
import { loadJson, record, str } from '../json-values';
import { placesFileOf, sameStandardForm, stagedKeyAliases } from '../place-addresses';
import { citedDocument, type KeyContext } from '../question-keys';
import { type ReadingAddress, readingAddressesOf } from '../reading-addresses';
import { readingNameOf, sameDocument } from './inventory';

function records(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item: unknown) => {
    const entry = record(item);
    return entry === null ? [] : [entry];
  });
}

/** NFKC, upper case, split at every run of what is not a letter or digit, so "address:1180" is
 *  two words and "123-45" two. */
const wordsOf = (text: string): string[] =>
  text
    .normalize('NFKC')
    .toUpperCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);

/** Whether an option's address is a verbatim run of a printed line's words that carries the
 *  line's house number: "1180 Quillfeather Ln, Denver, CO" copies "Service address: 1180
 *  Quillfeather Ln, Denver, CO 80220". */
function copiesPrintedLine(copied: readonly string[], printed: ReadingAddress): boolean {
  const line = wordsOf(printed.as_printed);
  const house = wordsOf(printed.usps_standard ?? '')[0];
  if (house === undefined || !/\d/.test(house) || !copied.includes(house)) return false;
  for (let start = 0; start + copied.length <= line.length; start += 1) {
    if (copied.every((word, offset) => line[start + offset] === word)) return true;
  }
  return false;
}

export function stagedAddressHoldersOf(
  workspace: string,
  recipe: KeyContext,
): (address: string, cites: unknown) => Set<string> {
  const entities = records(record(loadJson(join(workspace, 'profile.json')))?.['entities']);
  const { places } = placesFileOf(
    workspace,
    entities,
    stagedKeyAliases(workspace, entities),
    false,
  );
  const staged = entities.flatMap((entity) => {
    const key = str(entity['key']);
    const address = str(entity['address']);
    return key === null || address === null
      ? []
      : [{ key, folded: entityNameKey(address), standard: places.get(key) ?? null }];
  });
  const documents = records(loadJson(join(workspace, 'out', 'documents.json')));
  const addressesByDocument = new Map<string, ReadingAddress[]>();
  /** What a document prints: its staged reading's pages, else its documents.json entry, as the
   *  placement pointer reads it. */
  const addressesOf = (document: string): ReadingAddress[] => {
    const known = addressesByDocument.get(document);
    if (known !== undefined) return known;
    const reading = record(loadJson(join(workspace, 'extractions', readingNameOf(document))));
    const entries =
      reading !== null
        ? records(reading['pages'])
        : documents.filter((entry) => sameDocument(str(entry['file']) ?? '', document));
    const found = entries.flatMap((entry) =>
      readingAddressesOf(record(entry['fields'])?.['addresses']),
    );
    addressesByDocument.set(document, found);
    return found;
  };
  return (address, cites) => {
    const copied = wordsOf(address);
    const standardForms = (Array.isArray(cites) ? cites : [])
      .flatMap((cite: unknown) => citedDocument(cite, recipe) ?? [])
      .flatMap(addressesOf)
      .filter((printed) => copiesPrintedLine(copied, printed));
    const folded = entityNameKey(address);
    return new Set(
      staged
        .filter(
          (place) =>
            place.folded === folded ||
            standardForms.some((form) => sameStandardForm(form, place.standard)),
        )
        .map((place) => place.key),
    );
  };
}

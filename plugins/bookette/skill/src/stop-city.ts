/**
 * Whether a printed address lies in a trip stop's or the travel home's city (task 41.2, issue
 * #1629): the reader's `city`, `region` and `country` (issue #1628) compared to the stop spelled
 * "City, ST" or "City, Country" (`rules/ty<year>/per_diem.json`'s spelling), never a word of the
 * address's street or of another state's same-named city.
 */
import type { ReadingAddress } from './reading-addresses';

/** A stop or home location, read the way step 3 spells it. */
export interface StopCity {
  readonly city: string;
  /** A US stop's state or territory code; null abroad. */
  readonly region: string | null;
  /** ISO 3166 alpha-2; null when an abroad suffix names no country. */
  readonly country: string | null;
}

const SPELLED_OUT: Readonly<Record<string, string>> = {
  st: 'saint',
  ft: 'fort',
  mt: 'mount',
  pt: 'port',
};

/** Words folded for comparison: case, accents and punctuation aside, St, Ft, Mt and Pt spelled out. */
function foldedWords(text: string): string[] {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word !== '')
    .map((word) => SPELLED_OUT[word] ?? word);
}

/** A city name folded for comparison, a trailing "City" dropped ("New York City" is New York). */
export function cityKey(name: string): string {
  const words = foldedWords(name);
  if (words.length > 1 && words.at(-1) === 'city') words.pop();
  return words.join(' ');
}

/** A two-letter code as its current ISO form (UK → GB), or the text as written. */
function canonicalCountry(code: string): string {
  const upper = code.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(upper)) return upper;
  return Intl.getCanonicalLocales(`und-${upper}`)[0]?.slice(4) ?? upper;
}

let countryByName: ReadonlyMap<string, string> | null = null;

/** The ISO code of an English country name ("Taiwan" → TW), from every current code Intl names. */
function countryNamed(name: string): string | null {
  if (countryByName === null) {
    const names = new Intl.DisplayNames(['en'], { type: 'region' });
    const byName = new Map<string, string>();
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    for (const first of letters) {
      for (const second of letters) {
        const code = first + second;
        const label = names.of(code);
        // A deprecated alias (UK for GB, DD for DE) canonicalizes away and names no country.
        if (label !== undefined && label !== code && canonicalCountry(code) === code) {
          byName.set(cityKey(label), code);
        }
      }
    }
    countryByName = byName;
  }
  return countryByName.get(cityKey(name)) ?? null;
}

/** The US territories with their own ISO code, which a reader may write as the country. */
const US_TERRITORIES: ReadonlySet<string> = new Set(['PR', 'GU', 'VI', 'AS', 'MP']);

/** A location's city and where it lies, or null when it names no city. */
export function stopCityOf(location: string): StopCity | null {
  const comma = location.lastIndexOf(',');
  const city = (comma < 0 ? location : location.slice(0, comma)).split(',')[0]?.trim() ?? '';
  if (cityKey(city) === '') return null;
  const suffix = comma < 0 ? '' : location.slice(comma + 1).trim();
  if (/^[A-Z]{2}$/.test(suffix)) return { city, region: suffix, country: 'US' };
  return { city, region: null, country: countryNamed(suffix) };
}

/** Whether the reader placed this address in the stop's city: same folded city, the same state
 *  and country wherever both sides give one. An address the reader gave no city is in none. */
export function addressInCity(address: ReadingAddress, stop: StopCity): boolean {
  if (!citesCity(address) || cityKey(address.city ?? '') !== cityKey(stop.city)) return false;
  const region = address.region?.trim().toUpperCase() || null;
  if (stop.region !== null && region !== null && region !== stop.region) return false;
  const country = address.country === null ? null : canonicalCountry(address.country) || null;
  if (stop.country === null || country === null || country === stop.country) return true;
  return stop.region !== null && US_TERRITORIES.has(stop.region) && country === stop.region;
}

/** Whether a text prints a city's name, its words in order and whole (St, Ft, Mt and Pt spelled
 *  either way): the anchor a city the reader or the books agent wrote is held to. */
export function printsCityName(text: string, city: string): boolean {
  const wanted = cityKey(city)
    .split(' ')
    .filter((word) => word !== '');
  if (wanted.length === 0) return false;
  const printed = foldedWords(text);
  for (let start = 0; start + wanted.length <= printed.length; start += 1) {
    if (wanted.every((word, offset) => printed[start + offset] === word)) return true;
  }
  return false;
}

/** Whether the reader gave an address a city its printed line prints, so a city inferred from a
 *  postal code or misread from a suburb places nothing. */
function citesCity(address: ReadingAddress): boolean {
  return printsCityName(address.as_printed, address.city ?? '');
}

/** The addresses that say where a page was printed: those whose printed line prints the city
 *  the reader gave them. */
export function citedAddresses(addresses: readonly ReadingAddress[]): ReadingAddress[] {
  return addresses.filter(citesCity);
}

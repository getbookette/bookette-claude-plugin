/**
 * The Treasury Fiscal Data "Rates of Exchange" JSON parser (ADR 0018, plan task 10.4).
 * Pure: parsed payload in, rows out — no network, no filesystem. The quote is foreign
 * currency units per U.S. dollar; H.10's varies by series (rules/ty<tax_year>/fx/README.md).
 * The loader job (plan task 10.7) downloads the dataset and maps each record's
 * `country_currency_desc` through the rules' currency map
 * (rules/ty<tax_year>/fx/currencies.json).
 */
import { isValidDay } from '../dates';

import type { FxRateRow } from './parse_h10';

// The rules currency map (rules/ty<tax_year>/fx/currencies.json): one entry per ISO code the
// pipeline converts, naming its H.10 series and its Treasury country-currency name.
export interface FxCurrencyMapEntry {
  h10_series: string;
  treasury_name: string;
}

export type FxCurrencyMap = Record<string, FxCurrencyMapEntry>;

interface TreasuryRecord {
  country_currency_desc: string;
  exchange_rate: string;
  record_date: string;
  effective_date: string;
}

const SOURCE = 'treasury:rates_of_exchange';

// The dataset body is Fiscal Data's `{"data": [...]}` envelope; every record carries the four
// string fields. A record whose name has no map entry is a currency the pipeline does not
// convert — skipped, not an error. Any other shape change fails the parse: a reshaped dataset
// must stop the load, not silently produce a partial one.
export function parseTreasury(payload: unknown, map: FxCurrencyMap): FxRateRow[] {
  if (typeof payload !== 'object' || payload === null || !('data' in payload)) {
    throw new Error('the Treasury dataset body carries no "data" array');
  }
  const data: unknown = payload['data'];
  if (!Array.isArray(data)) {
    throw new Error('the Treasury dataset body carries no "data" array');
  }
  const isoByName = new Map(
    Object.entries(map).map(([iso, entry]) => [entry.treasury_name, iso.toUpperCase()] as const),
  );
  const rows: FxRateRow[] = [];
  for (const entry of data) {
    const record = asRecord(entry);
    const iso = isoByName.get(record.country_currency_desc);
    if (iso === undefined) continue;
    if (!isValidDay(record.record_date)) {
      throw new Error(`unexpected record_date in the Treasury dataset: ${record.record_date}`);
    }
    if (!/^\d+(\.\d+)?$/.test(record.exchange_rate)) {
      throw new Error(`unexpected exchange_rate in the Treasury dataset: ${record.exchange_rate}`);
    }
    rows.push({
      currency: iso,
      rateDate: record.record_date,
      rate: record.exchange_rate,
      source: SOURCE,
    });
  }
  return rows;
}

function asRecord(entry: unknown): TreasuryRecord {
  if (typeof entry !== 'object' || entry === null) {
    throw new Error('a Treasury dataset record is not an object');
  }
  const record = entry as Record<string, unknown>;
  return {
    country_currency_desc: asString(record, 'country_currency_desc'),
    exchange_rate: asString(record, 'exchange_rate'),
    record_date: asString(record, 'record_date'),
    effective_date: asString(record, 'effective_date'),
  };
}

function asString(record: Record<string, unknown>, field: string): string {
  const value = record[field];
  if (typeof value !== 'string') {
    throw new Error(`a Treasury dataset record carries no string "${field}"`);
  }
  return value;
}

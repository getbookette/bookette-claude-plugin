/**
 * The Federal Reserve H.10 Data Download Program CSV parser (ADR 0018, plan task 10.4).
 * Pure: text in, rows out — no network, no filesystem. The loader job (plan task 10.7)
 * downloads the file and pairs it with its currency and H.10 series id from the rules'
 * currency map (rules/ty<tax_year>/fx/currencies.json).
 */
import { isValidDay } from '../dates';

// The row shape `upsertFxRates` in @bookette/db stores: the rate is the exact decimal text the
// source carries, never a float.
export interface FxRateRow {
  currency: string;
  rateDate: string;
  rate: string;
  source: string;
}

// The download carries a preamble (title, series metadata, copyright) above the `date,<rate>`
// header, one `YYYY-MM-DD,<number>` row per publishing day, `ND` where a day has no rate, and
// nothing but blank lines after the data. Rows that are neither numeric nor `ND` fail the parse:
// a reshaped download must stop the load, not silently produce a partial one.
export function parseH10(csv: string, currency: string, seriesId: string): FxRateRow[] {
  const lines = csv.split('\n');
  const header = lines.findIndex((line) => line.trim().toLowerCase().startsWith('date'));
  if (header === -1) {
    throw new Error('the H.10 download carries no "date" header row');
  }
  const rows: FxRateRow[] = [];
  for (const line of lines.slice(header + 1)) {
    if (!line.trim()) continue;
    const [day, rate, extra] = line.split(',');
    if (day === undefined || rate === undefined || extra !== undefined) {
      throw new Error(`unexpected row in the H.10 download: ${line.trim()}`);
    }
    const rateDate = day.trim();
    if (!isValidDay(rateDate)) {
      throw new Error(`unexpected row in the H.10 download: ${line.trim()}`);
    }
    const value = rate.trim();
    if (value === 'ND') continue;
    if (!/^\d+(\.\d+)?$/.test(value)) {
      throw new Error(`unexpected rate cell in the H.10 download: ${value}`);
    }
    rows.push({
      currency: currency.toUpperCase(),
      rateDate,
      rate: value,
      source: `h10:${seriesId}`,
    });
  }
  return rows;
}

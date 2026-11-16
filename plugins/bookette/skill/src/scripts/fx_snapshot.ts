/**
 * The fx rate snapshot's bytes, shared by the three parties of one books run (plan task 10.4):
 * the worker's staging freeze builds them from the `fx_rates` rows and records their sha256, the
 * sandbox's fx lookup reads them from the run's input archive, and the importer's Abacus re-run
 * reads the same bytes back from the run's `fx` object. Pure: rows in, text out, text in, rows
 * out — no database, no network, no clock, so the same rows always build the same bytes and the
 * recorded hash pins the exact rates a run's conversions used (ADR 0018).
 */
import { isValidDay } from '../dates';
import type { FxRateRow } from './parse_h10';

/**
 * The workspace-relative path the snapshot rides everywhere: the input archive's entry, the file
 * the unpacked archive leaves at the sandbox workspace root, and the file the importer's union
 * dir carries beside `out/`. One constant, because the importer's re-run must read the exact
 * bytes the sandbox read.
 */
export const FX_SNAPSHOT_PATH = 'fx_snapshot.json';

/** One rate row of the snapshot, keyed as the JSON carries it. */
export interface FxSnapshotRow {
  rate_date: string;
  rate: string;
  source: string;
}

/** The snapshot's rows by ISO currency code — what the fx lookup consumes. */
export type FxSnapshot = Record<string, FxSnapshotRow[]>;

/**
 * Serialize the loaded rates to the snapshot's bytes. Currencies sort alphabetically and each
 * currency's rows by rate date then source, so the bytes depend on the rows alone.
 */
export function buildFxSnapshot(rows: readonly FxRateRow[]): string {
  const byCurrency = new Map<string, FxSnapshotRow[]>();
  for (const row of rows) {
    const currency = row.currency.toUpperCase();
    const list = byCurrency.get(currency) ?? [];
    list.push({ rate_date: row.rateDate, rate: row.rate, source: row.source });
    byCurrency.set(currency, list);
  }
  const snapshot: FxSnapshot = {};
  for (const currency of [...byCurrency.keys()].sort()) {
    const list = byCurrency.get(currency);
    if (list === undefined) continue;
    list.sort((a, b) => a.rate_date.localeCompare(b.rate_date) || a.source.localeCompare(b.source));
    snapshot[currency] = list;
  }
  return JSON.stringify(snapshot);
}

/**
 * Parse the snapshot's bytes, refusing any shape the fx lookup could not consume: a currency key
 * outside the ISO alphabetic-3 shape, or a row whose date, rate or source is not the exact text
 * the loader stored. Every rejection is a `TypeError` naming the rule, never a row's value.
 */
export function readFxSnapshot(text: string): FxSnapshot {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new TypeError('the fx snapshot is not valid JSON');
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new TypeError('the fx snapshot is not a JSON object');
  }
  const snapshot: FxSnapshot = {};
  for (const [currency, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (!/^[A-Z]{3}$/.test(currency)) {
      throw new TypeError('the fx snapshot carries a currency key outside the ISO shape');
    }
    if (!Array.isArray(value)) {
      throw new TypeError(`the fx snapshot's ${currency} rows are not a list`);
    }
    const rows: FxSnapshotRow[] = [];
    for (const entry of value) {
      if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
        throw new TypeError(`a ${currency} row of the fx snapshot is not an object`);
      }
      const record = entry as Record<string, unknown>;
      if (typeof record['rate_date'] !== 'string' || !isValidDay(record['rate_date'])) {
        throw new TypeError(`a ${currency} row of the fx snapshot carries no rate_date`);
      }
      if (typeof record['rate'] !== 'string' || !/^\d+(\.\d+)?$/.test(record['rate'])) {
        throw new TypeError(`a ${currency} row of the fx snapshot carries no decimal rate text`);
      }
      if (typeof record['source'] !== 'string' || record['source'] === '') {
        throw new TypeError(`a ${currency} row of the fx snapshot carries no source`);
      }
      rows.push({
        rate_date: record['rate_date'],
        rate: record['rate'],
        source: record['source'],
      });
    }
    snapshot[currency] = rows;
  }
  return snapshot;
}

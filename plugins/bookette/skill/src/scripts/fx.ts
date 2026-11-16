/**
 * Currency conversion from the run's rate snapshot, falling back to rules data only. No network,
 * no live table: the snapshot is the bytes staging froze, and the vendored files are the baked
 * rules. A currency the snapshot carries is owned by the snapshot, gaps included — the vendored
 * files are consulted only when the snapshot has no rows for it (plan task 10.4, assumption A7).
 *
 * Usage: node dist/scripts/fx.js <rules_dir> <currency> <YYYY-MM-DD> [amount] [snapshot_path]
 * snapshot_path is the path of a rate snapshot file, never the snapshot's JSON inline.
 * Snapshot lookups use the H.10 row for the date or the most recent earlier one within 7 days,
 * or the Treasury row for the quarter end containing the date; vendored lookups use the rate for
 * the date, or the most recent earlier rate within 7 days.
 *
 * Every failure the CLI meets is one line of JSON on stderr, `{"error":{"code","message"}}`, and
 * exit status 1 — never a stack trace. The code is an `FxErrorCode`, or `internal` for an error
 * this file did not type.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { dayOrdinal, isValidDay } from '../dates';
import { divideHalfUp, fmtCents, parseDec, toCents, type Dec } from '../money';
import {
  FX_SNAPSHOT_PATH,
  readFxSnapshot,
  type FxSnapshot,
  type FxSnapshotRow,
} from './fx_snapshot';

const MAX_GAP_DAYS = 7;

export type FxErrorCode =
  'bad_date' | 'no_source' | 'no_rate' | 'no_snapshot_quarter' | 'usage' | 'snapshot_unreadable';

/** A failure the conversion reports by its code; build_books prints the message per item. */
export class FxError extends Error {
  readonly code: FxErrorCode;

  constructor(code: FxErrorCode, message: string) {
    super(message);
    this.name = 'FxError';
    this.code = code;
  }
}

// What a missing rate asks of the agent: nothing — the build carries the line unpriced and the
// importer holds its row (decision record 0159), so no finding and no needs_review.
const NO_RATE_EXIT =
  'book nothing for it: the build carries the line unpriced and the importer flags its row, so write no finding and mark no document needs_review, and never look a rate up';

type FxInfo = {
  currency: string;
  requested_date: string;
  rate_date: string;
  rate: string;
  quote: string;
  source: string;
};

export function lookup(
  rulesDir: string,
  currency: string,
  day: string,
  snapshot: FxSnapshot | null = null,
): FxInfo | null {
  if (!isValidDay(day)) throw new FxError('bad_date', `not a valid date: ${day}`);
  const upper = currency.toUpperCase();
  if (upper === 'USD') return null;
  const snapshotRows = snapshot?.[upper];
  if (snapshotRows !== undefined && snapshotRows.length > 0) {
    return lookupSnapshot(upper, day, snapshotRows);
  }
  return lookupVendored(rulesDir, upper, day);
}

/**
 * The snapshot's lookup. Both loaded sources quote foreign units per U.S. dollar, so the snapshot
 * rows carry the quote the vendored sources.json names per file. An H.10 series walks back over
 * its own published days — the parser drops `ND` rows, so the gap a weekend or holiday leaves is
 * the ND rule of ADR 0018 — but never past 7 days: the item is flagged, not converted at a stale
 * rate. Treasury rows are quarterly, so the containing quarter's rate is inherently up to a
 * quarter old and the 7-day bound does not apply; a quarter with no row throws rather than walk
 * back across quarters.
 */
function lookupSnapshot(currency: string, day: string, rows: FxSnapshotRow[]): FxInfo {
  const h10 = rows.filter((row) => row.source.startsWith('h10:'));
  if (h10.length > 0) {
    let best: FxSnapshotRow | null = null;
    for (const row of h10) {
      if (row.rate_date <= day && (best === null || row.rate_date > best.rate_date)) best = row;
    }
    if (best === null || dayOrdinal(day) - dayOrdinal(best.rate_date) > MAX_GAP_DAYS) {
      throw new FxError(
        'no_rate',
        `no ${currency} rate on ${day} or within ${String(MAX_GAP_DAYS)} days before in the run's rate snapshot: the snapshot has no rate for that day; ${NO_RATE_EXIT}`,
      );
    }
    return snapshotInfo(currency, day, best);
  }
  const quarterEnd = quarterEndOf(day);
  const treasury = rows.find(
    (row) => row.source.startsWith('treasury:') && row.rate_date === quarterEnd,
  );
  if (treasury === undefined) {
    throw new FxError(
      'no_snapshot_quarter',
      `the run's rate snapshot carries no ${currency} rate for the quarter ending ${quarterEnd}`,
    );
  }
  return snapshotInfo(currency, day, treasury);
}

// The rate text and source come from the row itself; the quote is the loaded sources' shared one.
function snapshotInfo(currency: string, day: string, row: FxSnapshotRow): FxInfo {
  return {
    currency,
    requested_date: day,
    rate_date: row.rate_date,
    rate: row.rate,
    quote: 'units_per_usd',
    source: row.source,
  };
}

/** The last day of the quarter containing `day`, as `YYYY-MM-DD`. */
function quarterEndOf(day: string): string {
  const year = Number(day.slice(0, 4));
  const endMonth = Math.ceil(Number(day.slice(5, 7)) / 3) * 3;
  const endDay = endMonth === 3 || endMonth === 12 ? 31 : 30;
  return `${String(year)}-${String(endMonth).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;
}

function lookupVendored(rulesDir: string, upper: string, day: string): FxInfo {
  const fxDir = join(rulesDir, 'fx');
  const sources = JSON.parse(readFileSync(join(fxDir, 'sources.json'), 'utf8')) as Record<
    string,
    { file: string; quote: string; source: string }
  >;
  const meta = sources[upper];
  if (!meta) throw new FxError('no_source', `no exchange rate source for ${upper}`);
  const lines = readFileSync(join(fxDir, meta.file), 'utf8').split('\n');
  let best: { ordinal: number; rateDate: string; rate: string } | null = null;
  for (const row of lines.slice(1)) {
    if (!row.trim()) continue;
    const [rowDay, rate] = row.split(',');
    if (rowDay === undefined || rate === undefined) continue;
    if (rowDay <= day && (best === null || rowDay > best.rateDate)) {
      best = { ordinal: dayOrdinal(rowDay), rateDate: rowDay, rate };
    }
  }
  if (best === null || dayOrdinal(day) - best.ordinal > MAX_GAP_DAYS) {
    throw new FxError(
      'no_rate',
      `no ${upper} rate on ${day} or within ${String(MAX_GAP_DAYS)} days before: the rules data has no rate for that day; ${NO_RATE_EXIT}`,
    );
  }
  return {
    currency: upper,
    requested_date: day,
    rate_date: best.rateDate,
    rate: best.rate.trim(),
    quote: meta.quote,
    source: meta.source,
  };
}

/**
 * The workspace's own rate snapshot, or `null` when staging froze none. A file that is there but
 * unreadable throws: the bytes are the worker's own recorded hash subject, and building books
 * against a half-read snapshot would be worse than failing the build.
 */
export function readFxSnapshotBeside(workspace: string): FxSnapshot | null {
  const path = join(workspace, FX_SNAPSHOT_PATH);
  if (!existsSync(path)) return null;
  return readFxSnapshot(readFileSync(path, 'utf8'));
}

/**
 * Whether the ledger's own fx path prices `currency` on `day`: the lookup succeeds, or the
 * currency is USD. The importer's code-applied guard asks it before it folds a corrected date onto
 * a foreign-currency line, because a date no rate covers would fail the books rebuild and reject
 * every later import.
 */
export function fxPriceable(
  rulesDir: string,
  currency: string,
  day: string,
  snapshot: FxSnapshot | null = null,
): boolean {
  try {
    lookup(rulesDir, currency, day, snapshot);
    return true;
  } catch {
    return false;
  }
}

export function toUsd(
  rulesDir: string,
  currency: string,
  day: string,
  amount: Dec,
  snapshot: FxSnapshot | null = null,
): { cents: bigint; info: FxInfo | null } {
  const info = lookup(rulesDir, currency, day, snapshot);
  if (info === null) return { cents: toCents(amount), info: null };
  const rate = parseDec(info.rate);
  // Both values carry SCALE, so dollars are amount x rate / SCALE^2 and cents are
  // amount x rate / (SCALE^2 / 100); or, for a units-per-USD quote, amount x 100 / rate.
  const cents =
    info.quote === 'units_per_usd'
      ? divideHalfUp(amount.v * 100n, rate.v)
      : divideHalfUp(amount.v * rate.v, 10n ** 22n);
  return { cents, info };
}

function readSnapshotFile(path: string): FxSnapshot {
  try {
    return readFxSnapshot(readFileSync(path, 'utf8'));
  } catch {
    throw new FxError(
      'snapshot_unreadable',
      'the fifth argument names no readable rate snapshot file: pass the path of a rate snapshot file, never its JSON inline',
    );
  }
}

function main(argv: string[]): void {
  const [rulesDir, currency, day, amount, snapshotPath] = argv;
  if (rulesDir === undefined || currency === undefined || day === undefined) {
    throw new FxError(
      'usage',
      'usage: fx.js <rules_dir> <currency> <YYYY-MM-DD> [amount] [snapshot_path], where snapshot_path is the path of a rate snapshot file',
    );
  }
  const snapshot = snapshotPath === undefined ? null : readSnapshotFile(snapshotPath);
  if (amount !== undefined) {
    const { cents, info } = toUsd(rulesDir, currency, day, parseDec(amount), snapshot);
    console.log(JSON.stringify({ usd: fmtCents(cents), fx: info }, null, 2));
  } else {
    console.log(JSON.stringify(lookup(rulesDir, currency, day, snapshot), null, 2));
  }
}

/** The one stderr line a failed CLI call prints: the typed code, or `internal`, and the message. */
export function cliErrorLine(error: unknown): string {
  const code = error instanceof FxError ? error.code : 'internal';
  const message = error instanceof Error ? error.message : String(error);
  return JSON.stringify({ error: { code, message } });
}

if (require.main === module) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${cliErrorLine(error)}\n`);
    process.exitCode = 1;
  }
}

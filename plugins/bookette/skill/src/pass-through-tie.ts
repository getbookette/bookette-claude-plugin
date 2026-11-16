// The pass-through tie-out (issue #1530, decision record 0158): when a 1099-K's box 1a
// equals a hand-read payout export's booked gross, or that gross plus the open columns the
// `pass_through` question cites, to the cent, the build marks the matching option recommended and
// check_outputs re-derives it. The question is still asked; the person's confirm settles it.
// Pure: it reads the passed ledger items and documents.json entries and nothing else.

import { readingTotalCents } from './money';
import { box1aCentsOf } from './platform-statements';

type Json = Record<string, unknown>;

/** The `pass_through` option a tie-out recommends: the column inside the gross, or its own income. */
export type PassThroughTie = 'inside' | 'own_income';

const LEDGER_ID = /^L\d+$/;
/** A booked amount the tie-out compares exactly: a plain decimal of at most two places, never one
 *  rounded to the cent first. */
const CENT_AMOUNT = /^-?\d+(?:\.\d{1,2})?$/;

function objectOf(value: unknown): Json | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Json)
    : null;
}

function textOf(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null;
}

/** A USD line's cents, or null for another currency or an amount that is not a plain decimal of
 *  whole cents. */
function usdCentsOf(line: Json): bigint | null {
  const amount = textOf(line.amount);
  return line.currency === 'USD' && amount !== null && CENT_AMOUNT.test(amount)
    ? readingTotalCents(amount)
    : null;
}

function sumOf(lines: readonly Json[]): bigint | null {
  let total = 0n;
  for (const line of lines) {
    const cents = usdCentsOf(line);
    if (cents === null) return null;
    total += cents;
  }
  return total;
}

/**
 * The option a `pass_through` question's tie-out recommends, or null. The cited lines are the open
 * columns: income with no place, all from one document. The gross is every other income line of
 * that document, all on one place and under one vendor. The 1099-K is joined by cents alone (0158's
 * 2026-11-09 amendment): the one `form_1099_k` entry of documents.json whose `form_boxes["1a"]`
 * (`box1aCentsOf`) equals the gross plus the columns, `own_income`, or the gross alone, `inside`.
 * No such form, a second one, a non-USD line or an unparseable amount is null.
 */
export function passThroughTieOf(
  cites: readonly unknown[],
  ledger: readonly Json[],
  documents: readonly Json[],
): PassThroughTie | null {
  const cited = new Set(
    cites.filter((cite): cite is string => typeof cite === 'string' && LEDGER_ID.test(cite)),
  );
  const columns = ledger.filter((line) => typeof line.id === 'string' && cited.has(line.id));
  if (columns.length === 0 || columns.length !== cited.size) return null;
  const sources = new Set(columns.map((line) => textOf(line.source_file)));
  const [source] = [...sources];
  if (sources.size !== 1 || source === null || source === undefined) return null;
  if (columns.some((line) => line.kind !== 'income' || textOf(line.entity) !== null)) return null;
  const gross = ledger.filter(
    (line) =>
      typeof line.id === 'string' &&
      line.source_file === source &&
      line.kind === 'income' &&
      !cited.has(line.id),
  );
  const places = new Set(gross.map((line) => textOf(line.entity)));
  const vendors = new Set(gross.map((line) => (textOf(line.vendor) ?? '').trim().toLowerCase()));
  const [place] = [...places];
  if (gross.length === 0 || places.size !== 1 || place === null || vendors.size !== 1) return null;
  const grossCents = sumOf(gross);
  const columnCents = sumOf(columns);
  if (grossCents === null || columnCents === null || columnCents === 0n) return null;
  // Every 1099-K of the run whose box 1a ties the gross by cents, never by the payer's name: two
  // platforms' forms tying the same export is no tie.
  const ties: PassThroughTie[] = [];
  for (const entry of documents) {
    // Only an entry naming its file, as check_outputs reads documents.json, so the build and the
    // check count the same forms.
    if (entry.doc_type !== 'form_1099_k' || textOf(entry.file) === null) continue;
    const box1a = textOf(objectOf(objectOf(entry.fields)?.form_boxes)?.['1a']);
    const formCents = box1a === null ? null : box1aCentsOf([box1a]);
    if (formCents === grossCents + columnCents) ties.push('own_income');
    else if (formCents === grossCents) ties.push('inside');
  }
  return ties.length === 1 ? (ties[0] ?? null) : null;
}

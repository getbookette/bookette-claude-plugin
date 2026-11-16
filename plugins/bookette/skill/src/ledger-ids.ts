// The ledger id contract (task 11.8): ids are assigned by code, deterministically, and never
// change once a run is imported. The model proposes the facts; this module decides the ids.
//
// One module, two consumers: `scripts/assign_ids.ts` writes the ids into `out/ledger.json`, and
// `scripts/check_outputs.ts` recomputes them and reports an `invariant` when the file differs. The
// checker must be able to recompute the assignment, because on a first run there is no confirmed
// digest and a shape-only `id` gate would let any unique model string through.
//
// The sort key is an explicit fact list, never the whole item: `line`, `schedule`, `tag`, `meal`,
// `entity`, `trip`, `description`, `status`, `confidence` and `answer_keys` are exactly what varies
// between two runs over the same documents (assumption F2), so they must not order the ids.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

type Json = Record<string, unknown>;

/** The trailing number of a ledger id like L0001 or G0034, or null when the id has none. */
export function idNumber(id: string): number | null {
  const match = /^[A-Za-z]+(\d+)$/.exec(id);
  return match === null ? null : Number(match[1]);
}

/** The id for a position past the high-water, zero-padded to the four digits SKILL.md shows. */
export function formatLedgerId(n: number): string {
  return `L${String(n).padStart(4, '0')}`;
}

function loadJson(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

function strOrNull(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

/**
 * Every id the next run must not re-state or sort below: the confirmed `items` and the `held`
 * rows (flagged, held by the reader cap, or unclassified) of `confirmed/summaries.json`. Empty
 * when the file is absent or unreadable — a first run bounds nothing.
 */
export function knownLedgerIds(workspace: string): string[] {
  const summaries = loadJson(join(workspace, 'confirmed', 'summaries.json'));
  if (summaries === null || typeof summaries !== 'object' || Array.isArray(summaries)) return [];
  const ids: string[] = [];
  for (const list of [(summaries as Json).items, (summaries as Json).held]) {
    if (!Array.isArray(list)) continue;
    for (const raw of list) {
      if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) continue;
      const id = strOrNull((raw as Json).id);
      if (id !== null) ids.push(id);
    }
  }
  return ids;
}

/** The highest numeric suffix over the known ids, or 0 when none carries a number. */
export function ledgerHighWater(knownIds: readonly string[]): number {
  let highest = 0;
  for (const id of knownIds) {
    const n = idNumber(id);
    if (n !== null && n > highest) highest = n;
  }
  return highest;
}

// The transaction's stable facts, in the order they order the ids. `source_file` first because it
// is the document the item came from; the rest identify the transaction within it. Everything a
// model may choose (line, category, wording) is deliberately absent.
const SORT_FIELDS = ['source_file', 'date', 'amount', 'currency', 'kind', 'vendor'] as const;

/** A sort-field value as a string: strings as written, numbers and booleans as their text. */
function factText(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return null;
}

/** The stable-facts sort key: a fixed-order JSON tuple, so key order cannot decide it. */
function stableFacts(item: unknown): string {
  const record =
    typeof item === 'object' && item !== null && !Array.isArray(item)
      ? (item as Record<string, unknown>)
      : {};
  return JSON.stringify(SORT_FIELDS.map((field) => factText(record[field])));
}

/**
 * The id each addition must carry, by the item's position in the input list. Sorted on the stable
 * facts, ids continue past the highest known one (`L0001` when nothing is known) and are
 * zero-padded. Pure and idempotent: the sort never reads an item's `id`, so assigning twice gives
 * the same answer. Items equal on the whole sort tuple are indistinguishable duplicates; the
 * stable sort keeps their input order, and every caller reads the same list.
 */
export function assignLedgerIds(items: readonly unknown[], knownIds: readonly string[]): string[] {
  const order = items.map((_, index) => index);
  order.sort((a, b) => {
    const left = stableFacts(items[a]);
    const right = stableFacts(items[b]);
    return left < right ? -1 : left > right ? 1 : 0;
  });
  const highest = ledgerHighWater(knownIds);
  const ids: string[] = Array.from({ length: items.length }, () => '');
  order.forEach((itemIndex, rank) => {
    ids[itemIndex] = formatLedgerId(highest + rank + 1);
  });
  return ids;
}

/**
 * The workspace's ledger with code-assigned ids, written back in the file's own order. Any id the
 * model wrote is overwritten, and every reference to a rewritten id in the run's other files —
 * `findings.json` and `questions.json` `cites`, `web_values.json` `applies_to` — is rewritten too,
 * so a reference the model wrote before the assignment step still names the same row. Throws when
 * `out/ledger.json` is absent or not a list; the checker reports the schema problem. Returns the
 * number of ids written.
 */
export function assignWorkspaceLedger(workspace: string): number {
  const path = join(workspace, 'out', 'ledger.json');
  if (!existsSync(path)) throw new Error('out/ledger.json is missing');
  const parsed = loadJson(path);
  if (!Array.isArray(parsed)) throw new Error('out/ledger.json is not a JSON list');
  const items: unknown[] = parsed;
  const ids = assignLedgerIds(items, knownLedgerIds(workspace));
  const renamed = new Map<string, string>();
  items.forEach((item, index) => {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) return;
    const old = strOrNull((item as Json).id);
    const next = ids[index];
    if (old !== null && next !== undefined && old !== next) renamed.set(old, next);
  });
  const assigned: unknown[] = items.map((item, index) =>
    typeof item === 'object' && item !== null && !Array.isArray(item)
      ? { ...(item as Json), id: ids[index] }
      : item,
  );
  writeFileSync(path, `${JSON.stringify(assigned, null, 2)}\n`);
  if (renamed.size > 0) rewriteLedgerReferences(workspace, renamed);
  return items.length;
}

/** The list-valued fields on the run's other files that may name a ledger id. */
const REFERENCE_FIELDS = ['cites', 'applies_to'] as const;

/** Rewrite each `cites`/`applies_to` entry that names a renamed ledger id, in place. */
function rewriteLedgerReferences(workspace: string, renamed: ReadonlyMap<string, string>): void {
  for (const name of ['findings.json', 'questions.json', 'web_values.json']) {
    const path = join(workspace, 'out', name);
    if (!existsSync(path)) continue;
    const value = loadJson(path);
    if (!Array.isArray(value)) continue;
    const records = value as unknown[];
    let changed = false;
    for (const raw of records) {
      if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) continue;
      const record = raw as Json;
      for (const field of REFERENCE_FIELDS) {
        const list = record[field];
        if (!Array.isArray(list)) continue;
        const entries = list as unknown[];
        const mapped = entries.map((entry) =>
          typeof entry === 'string' && renamed.has(entry) ? (renamed.get(entry) ?? entry) : entry,
        );
        if (mapped.some((entry, index) => entry !== entries[index])) {
          record[field] = mapped;
          changed = true;
        }
      }
    }
    if (changed) writeFileSync(path, `${JSON.stringify(records, null, 2)}\n`);
  }
}

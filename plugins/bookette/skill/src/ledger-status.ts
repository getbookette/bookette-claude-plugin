// The one ledger-item status vocabulary (issue #314): SKILL.md's example, check_outputs' schema
// gate, the importer's reject and the Postgres enum all read these three words from here. Pure
// code with no imports, so it resolves inside the runner image at /skill/bookette-books like the
// rest of the package; the worker imports it from the package root.

export const LEDGER_ITEM_STATUSES = ['confirmed', 'flagged', 'unclassified'] as const;

export type LedgerItemStatus = (typeof LEDGER_ITEM_STATUSES)[number];

/** The word itself when it is one of the three ledger-item statuses, and null otherwise. */
export function ledgerItemStatus(value: unknown): LedgerItemStatus | null {
  return typeof value === 'string' && (LEDGER_ITEM_STATUSES as readonly string[]).includes(value)
    ? (value as LedgerItemStatus)
    : null;
}

// Keyed by the three words only: an unrecognized word has no label, and a fourth word does not
// compile into this table.
const LABELS: Record<LedgerItemStatus, 'CONFIRMED' | 'FLAGGED' | 'UNCLASSIFIED'> = {
  confirmed: 'CONFIRMED',
  flagged: 'FLAGGED',
  unclassified: 'UNCLASSIFIED',
};

/** The stored `line_item_status` label for one of the three words. */
export function ledgerItemStatusLabel(
  status: LedgerItemStatus,
): 'CONFIRMED' | 'FLAGGED' | 'UNCLASSIFIED' {
  return LABELS[status];
}

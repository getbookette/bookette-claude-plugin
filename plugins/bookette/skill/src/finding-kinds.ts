// The one finding-kind vocabulary (issue #613): SKILL.md's step-7 list, check_outputs' schema
// gate, the importer's writes and the Postgres enum all read these fourteen words from here. Pure
// code with no imports, so it resolves inside the runner image at /skill/bookette-books like the
// rest of the package; the worker imports it from the package root.
//
// The list order is the Postgres enum's physical order (migration 0027 appended
// PRIOR_ACCUMULATED_MISMATCH, 0039 the two 2026-10-05 words, 0054 `note` — issue #905's
// generic fact for the accountant that no other kind names), and the worker's drift pin walks
// it in order against `findingKind.enumValues`, so a transpose here is a test failure, not a
// silently swapped report title. Migration 0069 appends `trip_purpose_not_stated` (issue #1068):
// a trip the run recorded from the documents whose purpose the person has not stated.

export const FINDING_KINDS = [
  'missing_receipt',
  'related_party',
  'ownership_split',
  'fair_rental_days',
  'near_duplicate',
  'method_comparison',
  'missing_rules_data',
  'unreadable',
  'personal_use',
  'prior_accumulated_mismatch',
  'outside_tax_year',
  'entity_unestablished',
  'note',
  'trip_purpose_not_stated',
] as const;

export type FindingKind = (typeof FINDING_KINDS)[number];

/** The word itself when it is one of the fourteen finding kinds, and null otherwise. */
export function findingKindOf(value: unknown): FindingKind | null {
  return typeof value === 'string' && (FINDING_KINDS as readonly string[]).includes(value)
    ? (value as FindingKind)
    : null;
}

// The stored label is the word uppercased — the enum's labels are exactly that, so the map is
// derived rather than hand-written and a transpose has nothing to transpose. Keyed by the
// fourteen words only: an unrecognized word has no label, and a fifteenth word does not compile
// into this table.
export const FINDING_KIND_LABELS: Record<FindingKind, Uppercase<FindingKind>> = Object.fromEntries(
  FINDING_KINDS.map((kind) => [kind, kind.toUpperCase()]),
) as Record<FindingKind, Uppercase<FindingKind>>;

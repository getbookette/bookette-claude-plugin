// The closed vocabularies of the two capital-cost comparisons (issue #691, ADR 0097): what a
// profile asset's `kind` may say, which readings a row lists as not computed and why, and which
// limits a row lists as passed. check_outputs' profile gate rejects an asset kind outside these
// words, the importer refuses a stored word outside them, and nothing names a fourth one. Pure
// code with no imports, so it resolves inside the runner image like the rest of the package.

/** A register asset's kind, the `asset_kind` enum's words lowercased (ADR 0026). */
export const ASSET_KINDS = ['real_property', 'equipment', 'improvement'] as const;

export type AssetKind = (typeof ASSET_KINDS)[number];

/** The word itself when it is one of the three asset kinds, and null otherwise. */
export function assetKindOf(value: unknown): AssetKind | null {
  return typeof value === 'string' && (ASSET_KINDS as readonly string[]).includes(value)
    ? (value as AssetKind)
    : null;
}

/** The two words a ledger line's `tag` may carry, read case-insensitively. */
export const LEDGER_TAGS = ['capital', 'repair'] as const;

export type LedgerTag = (typeof LEDGER_TAGS)[number];

/** A ledger line's tag folded to its word (the importer stores CAPITAL and REPAIR), or null. */
export function ledgerTagOf(value: unknown): LedgerTag | null {
  if (typeof value !== 'string') return null;
  const folded = value.toLowerCase();
  return (LEDGER_TAGS as readonly string[]).includes(folded) ? (folded as LedgerTag) : null;
}

/** The depreciation conventions a reading names (Publication 946 chapter 4). */
export const CAPITAL_CONVENTIONS = ['mid_month', 'half_year', 'mid_quarter'] as const;

export type CapitalConvention = (typeof CAPITAL_CONVENTIONS)[number];

/**
 * Why a reading is not computed: the class is not established (no class, one neither rules file
 * carries, or buildings on the entity that disagree), or a figure the rules data must carry is
 * absent. Never a guess in its place.
 */
export const CAPITAL_MISSING = [
  'class',
  'mid_quarter_threshold_pct',
  'de_minimis_per_item_cents',
  'de_minimis_per_item_with_afs_cents',
] as const;

export type CapitalMissing = (typeof CAPITAL_MISSING)[number];

/**
 * The limits an expensing-or-MACRS row lists as passed, each from the rules data: shown beside
 * both readings for the accountant and never applied to either figure.
 */
export const EXPENSE_LIMITS = ['over_de_minimis', 'over_de_minimis_with_afs'] as const;

export type ExpenseLimit = (typeof EXPENSE_LIMITS)[number];

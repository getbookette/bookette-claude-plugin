// The closed home-office vocabularies (ADR 0097's placement, issue #661): the cost kinds and uses
// a staged home cost may carry. check_outputs' gates and the importer's writes both read these
// lists, so a word the importer or the report cannot render fails the gate instead of inventing
// another one.
export const HOME_COST_KINDS = [
  'mortgage_interest',
  'real_estate_taxes',
  'insurance',
  'rent',
  'utilities',
  'repairs',
  'other',
] as const;

export type HomeCostKind = (typeof HOME_COST_KINDS)[number];

// `home` is a cost of the whole home, shared with the office by area; `office` is a cost of the
// office alone, counted whole.
export const HOME_COST_USES = ['home', 'office'] as const;

export type HomeCostUse = (typeof HOME_COST_USES)[number];

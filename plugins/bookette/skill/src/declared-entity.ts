// The businesses, properties and K-1 interests a person declares (issue #898, decision record
// 0116): the one validator every surface that writes an `entities` row shares — the onboarding
// cards, the Account form and a confirmed chat chip. Every text field goes through
// `personTextProblem`, the gate the services note already uses, so an accepted value never makes a
// later run reject; the importer gains no new gate. The schedule is derived from the kind and is
// never posted: a short-term rental is stored on E, and whether it belongs on C is the
// accountant's call through the skill's finding (invariant 5). A property's price paid and the day
// it was first rented become its declared purchase, an `assets` row with no class chosen (the
// record's amendment): the skill's rules data carries no class for a short-term rental, and the
// land split belongs to the documents or the accountant. Pure and filesystem-free, so a client
// bundle may import it.

import { foldForScan } from '@bookette/identifier-scan';

import { isValidDay } from './dates';
import { listingTextProblem, personTextProblem } from './person-text';
import type { PersonTextProblem } from './person-text';

export {
  BIDI_CONTROL,
  LISTING_PLATFORMS,
  listingTextProblem,
  normalizeLineBreaks,
  paragraphTextProblem,
  personTextProblem,
} from './person-text';
export type { PersonTextProblem } from './person-text';

/** The `entity_kind` labels, spelled here because this package does not depend on the database
 *  package; a web spec pins them equal to the enum. */
export const DECLARED_ENTITY_KINDS = [
  'RENTAL',
  'STR_RENTAL',
  'BUSINESS',
  'PARTNERSHIP',
  'S_CORP',
] as const;
export type DeclaredEntityKind = (typeof DECLARED_ENTITY_KINDS)[number];
export type DeclaredEntitySchedule = 'C' | 'E' | 'K1';

/** The longest name, address and activity, in UTF-16 code units. */
export const DECLARED_NAME_MAX_LENGTH = 120;
export const DECLARED_ADDRESS_MAX_LENGTH = 300;
export const DECLARED_ACTIVITY_MAX_LENGTH = 200;
/** A business's payers: at most eight names of at most sixty UTF-16 code units each. */
export const DECLARED_PAYERS_MAX_COUNT = 8;
export const DECLARED_PAYER_MAX_LENGTH = 60;
/** A business's aliases, the other names it goes by on its documents (issue #1159): the payers'
 *  bounds, at most eight names of at most sixty UTF-16 code units each. */
export const DECLARED_ALIASES_MAX_COUNT = 8;
export const DECLARED_ALIAS_MAX_LENGTH = 60;
/** A rental's listings, the platforms and listing ids or titles it is let through as its
 *  statements print them (issue #1387): at most eight of at most sixty UTF-16 code units each. */
export const DECLARED_LISTINGS_MAX_COUNT = 8;
export const DECLARED_LISTING_MAX_LENGTH = 60;

const SCHEDULE_OF_KIND = {
  RENTAL: 'E',
  STR_RENTAL: 'E',
  BUSINESS: 'C',
  PARTNERSHIP: 'K1',
  S_CORP: 'K1',
} as const satisfies Record<DeclaredEntityKind, DeclaredEntitySchedule>;

const ADDRESS_KINDS: readonly DeclaredEntityKind[] = ['RENTAL', 'STR_RENTAL'];
const ACTIVITY_KINDS: readonly DeclaredEntityKind[] = ['BUSINESS'];
const PAYER_KINDS: readonly DeclaredEntityKind[] = ['BUSINESS'];
const ALIAS_KINDS: readonly DeclaredEntityKind[] = ['BUSINESS'];
const LISTING_KINDS: readonly DeclaredEntityKind[] = ['RENTAL', 'STR_RENTAL'];
const PURCHASE_KINDS: readonly DeclaredEntityKind[] = ['RENTAL', 'STR_RENTAL'];
const EIN_KINDS: readonly DeclaredEntityKind[] = ['BUSINESS', 'PARTNERSHIP', 'S_CORP'];
const ENDED_KINDS: readonly DeclaredEntityKind[] = ['RENTAL', 'STR_RENTAL', 'BUSINESS'];

/** The schedule a kind is stored on; the database's schedule-kind CHECK agrees (ADR 0068). */
export function scheduleOfKind(kind: DeclaredEntityKind): DeclaredEntitySchedule {
  return SCHEDULE_OF_KIND[kind];
}

export function isDeclaredEntityKind(value: string): value is DeclaredEntityKind {
  return (DECLARED_ENTITY_KINDS as readonly string[]).includes(value);
}

/** What a surface posts: strings as typed, an optional field absent, null or blank when unset. */
export interface DeclaredEntityInput {
  readonly kind: string;
  readonly name: string;
  readonly address?: string | null;
  readonly ownershipPct?: string | null;
  readonly placedInService?: string | null;
  readonly activity?: string | null;
  readonly ein?: string | null;
  /** Who pays a business, as the person names them; an empty list is none. */
  readonly payers?: readonly string[] | null;
  /** The other names a business goes by on its documents (a DBA); an empty list is none. */
  readonly aliases?: readonly string[] | null;
  /** The platforms and listing ids or titles a rental is let through, as its statements print
   *  them ("Vrbo 4820193", "Airbnb Seaside Cottage"); an empty list is none. */
  readonly listings?: readonly string[] | null;
  /** A property's price paid, in integer cents. */
  readonly pricePaidCents?: number | null;
  /** The day a property was first rented: the declared purchase's placed-in-service day. */
  readonly firstRentedOn?: string | null;
  /**
   * The month a property stopped being rented (or was sold), or a business stopped, as
   * `YYYY-MM` (issue #899): rentals and businesses only, inside the workspace's tax year and not
   * before the placed-in-service month. Null or blank clears it.
   */
  readonly endedOn?: string | null;
}

/** What the validator judges a declaration against: the workspace it is declared in. */
export interface DeclaredEntityContext {
  readonly taxYear: number;
}

export type DeclaredEntityField = keyof DeclaredEntityInput;

/** The canonical row the declare core writes; `ownershipPct` in the column's two-place spelling. */
export interface DeclaredEntity {
  readonly kind: DeclaredEntityKind;
  readonly schedule: DeclaredEntitySchedule;
  readonly name: string;
  readonly address: string | null;
  readonly ownershipPct: string | null;
  readonly placedInService: string | null;
  readonly activity: string | null;
  readonly ein: string | null;
  readonly payers: readonly string[] | null;
  readonly aliases: readonly string[] | null;
  readonly listings: readonly string[] | null;
  /** The end month as the column stores it, the first of the month (`YYYY-MM-01`), or null. */
  readonly endedOn: string | null;
  /**
   * The property's declared purchase, present when the declaration carries the price paid and the
   * first-rented day; the register's row needs both, so either alone is refused as
   * `purchase_incomplete` (naming the missing half) rather than silently dropped.
   */
  readonly purchase: DeclaredPurchase | null;
}

/**
 * The fixed description of a declared purchase's `assets` row: code-owned, so the row never holds
 * person text and keeps its description through a rename, and a run that carries the staged asset
 * forward joins the register row by it on the report's depreciation card.
 */
export const DECLARED_PURCHASE_DESCRIPTION = 'Declared purchase';

/** The inputs of a property's declared purchase: the `assets` row's cost and in-service day. */
export interface DeclaredPurchase {
  readonly costBasisCents: number;
  readonly placedInService: string;
}

export type DeclaredEntityRefusal =
  | 'malformed'
  | 'too_long'
  | 'identifier'
  | 'url'
  | 'policy'
  | 'range'
  | 'date'
  | 'kind'
  /** One half of a declared purchase without the other; the field names the missing half. */
  | 'purchase_incomplete';

export type DeclaredEntityValidation =
  | { readonly ok: true; readonly value: DeclaredEntity }
  | {
      readonly ok: false;
      readonly code: DeclaredEntityRefusal;
      /** The input name the refusal is about, so a form can mark it; never the value. */
      readonly field: DeclaredEntityField;
    };

/** A typed refusal inside the validator; it becomes the returned code and never escapes. */
class Refused extends Error {
  readonly code: DeclaredEntityRefusal;
  readonly field: DeclaredEntityField;
  constructor(code: DeclaredEntityRefusal, field: DeclaredEntityField) {
    super('declaration refused');
    this.code = code;
    this.field = field;
  }
}

/** An optional input as stored: absent, null and blank (after trimming) are all null. */
function optional(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed === '' ? null : trimmed;
}

function text(value: string, field: DeclaredEntityField, maxLength: number): string {
  const problem = personTextProblem(value, maxLength);
  if (problem !== null) throw new Refused(problem, field);
  return value;
}

/** A field only some kinds carry: refused as `kind` on any other. */
function onlyFor(
  value: string | null,
  kind: DeclaredEntityKind,
  kinds: readonly DeclaredEntityKind[],
  field: DeclaredEntityField,
): string | null {
  if (value !== null && !kinds.includes(kind)) throw new Refused('kind', field);
  return value;
}

// ownership_pct is numeric(5,2) with a 0–100 CHECK: digits with at most two places, spelled as
// the column prints it, so a re-saved row compares equal to what Postgres returns.
function ownership(value: string | null): string | null {
  if (value === null) return null;
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(value);
  if (match === null) throw new Refused('malformed', 'ownershipPct');
  const whole = (match[1] ?? '').replace(/^0+(?=\d)/, '');
  const canonical = `${whole}.${(match[2] ?? '').padEnd(2, '0')}`;
  if (whole.length > 3 || Number(canonical) > 100) throw new Refused('range', 'ownershipPct');
  return canonical;
}

/** A list of names (a business's payers or aliases, a rental's listings): null when empty, each
 *  trimmed and judged as person text (a listing by the listings gate), the count bounded. */
function namesOf(
  value: readonly string[] | null | undefined,
  field: 'payers' | 'aliases' | 'listings',
  maxCount: number,
  maxLength: number,
  problemOf: (text: string, maxLength: number) => PersonTextProblem | null = personTextProblem,
): readonly string[] | null {
  if (value === null || value === undefined || value.length === 0) return null;
  if (value.length > maxCount) throw new Refused('too_long', field);
  return value.map((name) => {
    const trimmed = name.trim();
    const problem = problemOf(trimmed, maxLength);
    if (problem !== null) throw new Refused(problem, field);
    return trimmed;
  });
}

// cost_basis_cents is a bigint the web reads as a JavaScript number: a positive safe integer.
function pricePaid(value: number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (!Number.isInteger(value)) throw new Refused('malformed', 'pricePaidCents');
  if (value <= 0 || !Number.isSafeInteger(value)) throw new Refused('range', 'pricePaidCents');
  return value;
}

/**
 * The end month as stored, `YYYY-MM-01`, from the posted `YYYY-MM`: a calendar month of the tax
 * year, and not before the month the entity was placed in service when that day is recorded.
 */
function endedMonth(
  value: string | null,
  placedInService: string | null,
  taxYear: number,
): string | null {
  if (value === null) return null;
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) throw new Refused('date', 'endedOn');
  if (Number(value.slice(0, 4)) !== taxYear) throw new Refused('range', 'endedOn');
  if (placedInService !== null && value < placedInService.slice(0, 7)) {
    throw new Refused('range', 'endedOn');
  }
  return `${value}-01`;
}

/**
 * The one validator for a declaration. Returns the canonical row or a typed refusal naming the
 * field; a refusal never carries the input, and nothing here logs. For an update the caller
 * validates the stored row with the patch laid over it, so every stored field is judged again.
 */
export function validateDeclaredEntity(
  input: DeclaredEntityInput,
  context: DeclaredEntityContext,
): DeclaredEntityValidation {
  try {
    if (!isDeclaredEntityKind(input.kind)) throw new Refused('kind', 'kind');
    const kind = input.kind;
    const name = text(input.name.trim(), 'name', DECLARED_NAME_MAX_LENGTH);
    const address = onlyFor(optional(input.address), kind, ADDRESS_KINDS, 'address');
    const activity = onlyFor(optional(input.activity), kind, ACTIVITY_KINDS, 'activity');
    const ein = onlyFor(optional(input.ein), kind, EIN_KINDS, 'ein');
    const placedInService = optional(input.placedInService);
    if (placedInService !== null && !isValidDay(placedInService)) {
      throw new Refused('date', 'placedInService');
    }
    // A business EIN is an entity attribute (invariant 2 allows it); only its shape is accepted.
    if (ein !== null && !/^\d{2}-\d{7}$/.test(ein)) throw new Refused('malformed', 'ein');
    const payers = namesOf(
      input.payers,
      'payers',
      DECLARED_PAYERS_MAX_COUNT,
      DECLARED_PAYER_MAX_LENGTH,
    );
    if (payers !== null && !PAYER_KINDS.includes(kind)) throw new Refused('kind', 'payers');
    const aliases = namesOf(
      input.aliases,
      'aliases',
      DECLARED_ALIASES_MAX_COUNT,
      DECLARED_ALIAS_MAX_LENGTH,
    );
    if (aliases !== null && !ALIAS_KINDS.includes(kind)) throw new Refused('kind', 'aliases');
    const listings = namesOf(
      input.listings,
      'listings',
      DECLARED_LISTINGS_MAX_COUNT,
      DECLARED_LISTING_MAX_LENGTH,
      listingTextProblem,
    );
    if (listings !== null && !LISTING_KINDS.includes(kind)) throw new Refused('kind', 'listings');
    const costBasisCents = pricePaid(input.pricePaidCents);
    if (costBasisCents !== null && !PURCHASE_KINDS.includes(kind)) {
      throw new Refused('kind', 'pricePaidCents');
    }
    const firstRentedOn = onlyFor(
      optional(input.firstRentedOn),
      kind,
      PURCHASE_KINDS,
      'firstRentedOn',
    );
    if (firstRentedOn !== null && !isValidDay(firstRentedOn)) {
      throw new Refused('date', 'firstRentedOn');
    }
    if (costBasisCents !== null && firstRentedOn === null) {
      throw new Refused('purchase_incomplete', 'firstRentedOn');
    }
    if (firstRentedOn !== null && costBasisCents === null) {
      throw new Refused('purchase_incomplete', 'pricePaidCents');
    }
    const endedOn = endedMonth(
      onlyFor(optional(input.endedOn), kind, ENDED_KINDS, 'endedOn'),
      placedInService,
      context.taxYear,
    );
    return {
      ok: true,
      value: {
        kind,
        schedule: scheduleOfKind(kind),
        name,
        address: address === null ? null : text(address, 'address', DECLARED_ADDRESS_MAX_LENGTH),
        ownershipPct: ownership(optional(input.ownershipPct)),
        placedInService,
        activity:
          activity === null ? null : text(activity, 'activity', DECLARED_ACTIVITY_MAX_LENGTH),
        ein,
        payers,
        aliases,
        listings,
        endedOn,
        purchase:
          costBasisCents === null || firstRentedOn === null
            ? null
            : { costBasisCents, placedInService: firstRentedOn },
      },
    };
  } catch (error) {
    if (error instanceof Refused) return { ok: false, code: error.code, field: error.field };
    throw error;
  }
}

/**
 * The comparison form of an entity name for the duplicate refusal, in this order: NFKC-normalized;
 * every format character (`\p{Cf}`: zero-width spaces and joiners, bidi marks, the BOM) removed;
 * case-folded (upper then lower, so `ß` meets `ss`) and normalized again; every whitespace run
 * collapsed to one space; and trimmed. Two entities of one workspace whose names compare exactly
 * equal would make every later run's profile repeat a name, which the checker refuses as a schema
 * problem (check_outputs.spec.ts) in the sandbox and again at import; the wider fold also keeps
 * two entries a person cannot tell apart from being declared. The importer compares names
 * exactly, so this side is the stricter one.
 */
export function entityNameKey(name: string): string {
  return name
    .normalize('NFKC')
    .replace(/\p{Cf}/gu, '')
    .toUpperCase()
    .toLowerCase()
    .normalize('NFKC')
    .replace(/\s+/gu, ' ')
    .trim();
}

/**
 * The fewest digits the longest run of a listing's id carries for a statement to be read as
 * printing it (issue #1387). Every statement prints a year and days or months in its dates and
 * amounts below ten thousand, so a shorter run would read as printed by nearly any statement; five
 * keeps the ids the committed payout exports print (Booking's six digits, Vrbo's seven).
 */
export const LISTING_ID_MIN_DIGITS = 5;

/**
 * The comparison form of a listing (issue #1387), folded as the identifier scan reads it and
 * lowercased. A listing whose id reaches {@link LISTING_ID_MIN_DIGITS} digits keys on its first
 * letter run (the platform word) and its digit runs, joined by one space: "Vrbo #4820193", "VRBO:
 * 4820193" and "Vrbo 4820193 cabin" are one listing. Any other listing is a title, as Airbnb's
 * earnings export prints one ("Airbnb 2BR Seaside Cottage"), and keys on every letter and digit
 * run, so two titles differ and one title typed two ways meets. The declare core refuses a listing
 * another place of the workspace carries under this key (`duplicate_listing`).
 */
export function listingKey(listing: string): string {
  const runs =
    foldForScan(listing)
      .normalize('NFKC')
      .toLowerCase()
      .match(/\p{L}+|\d+/gu) ?? [];
  const digits = runs.filter((run) => /^\d+$/.test(run));
  if (!digits.some((run) => run.length >= LISTING_ID_MIN_DIGITS)) return runs.join(' ');
  const word = runs.find((run) => !/^\d+$/.test(run));
  return [...(word === undefined ? [] : [word]), ...digits].join(' ');
}

/** The digit runs of a listing's key (issue #1387): its id, as the identifier scan reads it. */
export function listingDigits(listing: string): string[] {
  return listingKey(listing)
    .split(' ')
    .filter((part) => /^\d+$/.test(part));
}

/** Whether a listing's id reaches {@link LISTING_ID_MIN_DIGITS} in its longest digit run: the
 *  checker's floor for a match's listing, and the fold's test of whether a rental's folded name
 *  carries a listing id (issue #1388). */
export function listingIdLongEnough(listing: string): boolean {
  return listingDigits(listing).some((run) => run.length >= LISTING_ID_MIN_DIGITS);
}

// The typed-effect contract of the S.6 design ("Typed effects, one writer, derived pending"):
// an option's effect is a typed payload in one of ten kinds — ledger, entity_register,
// asset_register, trip_register (the registers of decision record 0026), reading_correction (the
// person's correction of a reading, issue #685), line_correction (the person's correction of one
// booked line, issue #731), profile_fact (the person's recorded day count, services note,
// home-office areas or vehicle miles, issue #733), entity_fold (the person's word that one place
// is another, issue #1388), attach_receipt (the person's word that an uploaded document is a
// trip's or a line's receipt, issue #1402), or none — and this
// file is the contract tasks 11.5 and 15.1 render. The renderer here turns a payload into the
// wording a person sees, as a pure function of the payload alone, never model text; the
// comparator in src/compare.ts reads the same payloads against an imported ledger.
//
// Two rules shape every payload:
//   - a pending display never names a run-minted identifier. Trip keys ("taipei_austin_apr")
//     and ledger ids exist only after a run imports, so no payload carries one and the renderer
//     cannot emit one. Entity keys are the exception by design: they are catalog-owned keys of
//     the versioned catalog (the fixture catalog derives them from the synthetic workspace
//     generator, production's from task 11.5), stable across runs rather than minted by one.
//     The trip register's edit provenance (`tripKey`, `entityKey`) is a second: staging-minted
//     ids an answer applies against, which the renderer never renders.
//   - `amount` is never a field of a register effect. Derived figures — depreciation from
//     basis, land and date — are Abacus's at run time; the payload promises inputs (basis,
//     land value, in-service date), not results.
//
// Money is integer cents everywhere (AGENTS.md).

export type EffectKind =
  | 'ledger'
  | 'entity_register'
  | 'asset_register'
  | 'trip_register'
  | 'reading_correction'
  | 'line_correction'
  | 'profile_fact'
  | 'entity_fold'
  | 'attach_receipt'
  | 'none';

// The three ledger fields an option can set (the S.6 design): the category of the cited lines,
// the entity they book to, and whether they follow one trip. A fourth, `settled` (issue #1153),
// settles the cited lines: the person said their figures are already inside the income (a
// pass-through column already inside the income column booked as the gross), so they stay out
// of every total and are never offered for a place again.
export type LedgerField = 'category' | 'entity' | 'trip_assignment' | 'settled';

export type LineItemTagValue = 'CAPITAL' | 'REPAIR';

// A ledger effect's target value, scoped by selector — "the cited lines" — never by ledger id
// and never by a row count.
export interface CategoryValue {
  readonly type: 'category';
  /** The schedule line the rules data owns, e.g. '14'; never a run-minted id. */
  readonly scheduleLine: string;
  readonly tag: LineItemTagValue | null;
  /** The schedule whose table numbers `scheduleLine` (issue #1376): required under the
   *  `correct_category:` namespace, so a line that crossed to the other schedule since the click
   *  never takes a same-numbered line there; optional on every other category value. */
  readonly schedule?: RegisterSchedule;
}

export interface EntityValue {
  readonly type: 'entity';
  /** A catalog-owned entity key ('ashwood'), stable across runs; the comparator's join value. */
  readonly entityKey: string;
  /** Display name from the user's documents; the renderer's wording source, never a match key. */
  readonly entityName: string;
  /** The address the documents print for a place the person declared without one (issue #1070):
   *  only on a found-place question's option that books the lines to that place, and only on
   *  the `to` value. Confirming the option records it as the place's address, through the
   *  declare core; the run never writes it. Trimmed and non-empty when present. */
  readonly address?: string;
  /** Another name a business the person declared goes by on its documents (issue #1159): only on
   *  a found business's question, on the option that books its lines to that business, and only
   *  on the `to` value. Confirming the option appends it to the business's aliases through the
   *  declare core; the run never writes it. Trimmed and non-empty when present. */
  readonly alias?: string;
  /** The platform and listing id a found rental's payout statement prints (issue #1387): only on a
   *  found place's question, on the option that books its lines to a rental the person declared,
   *  and only on the `to` value. Confirming the option appends it to the rental's listings through
   *  the declare core; the run never writes it. Trimmed and non-empty when present. */
  readonly listing?: string;
}

export interface TripAssignmentValue {
  readonly type: 'trip_assignment';
  /** The trip's class from the answer; the trip's own key is run-minted and never appears here. */
  readonly tripClass: 'business' | 'rental';
}

/** The cited lines are settled as already inside the income column (issue #1153): the value carries nothing more,
 *  and a settled effect's `from` is always null. */
export interface SettledValue {
  readonly type: 'settled';
}

export type LedgerValue = CategoryValue | EntityValue | TripAssignmentValue | SettledValue;

export interface LedgerEffect {
  readonly kind: 'ledger';
  readonly field: LedgerField;
  /** The pre-run value, when a pre-answer ledger recorded one; null when unknown. */
  readonly from: LedgerValue | null;
  readonly to: LedgerValue;
  /** On an `entity` option that places a found place's lines, or a `placement` question's lines
   *  that no document places, with a staged place: the trips the run found in those documents,
   *  recorded under that place in the run that applies the answer, as an `entity_register` option
   *  carries them (issues #1068, #1563; decision records 0132, 0160). */
  readonly trips?: readonly FoundPlaceTrip[];
}

export type RegisterEntityKind = 'RENTAL' | 'STR_RENTAL' | 'BUSINESS';
export type RegisterSchedule = 'C' | 'E';

// The entity register of decision record 0026: inputs only, no derived figures.
export interface EntityRegisterEffect {
  readonly kind: 'entity_register';
  readonly entityKey: string;
  readonly entityName: string;
  readonly entityKind: RegisterEntityKind;
  readonly schedule: RegisterSchedule;
  readonly ownershipPct: number | null;
  /** What a found rental's documents print as its place, exactly one of the two (issue #1468,
   *  decision record 0157): the address a tax bill or receipt prints, or the listing a payout
   *  statement prints. A business carries neither. */
  readonly address?: string;
  readonly listing?: string;
  /** The trips the run found in this place's documents (issue #1068, decision record 0132): they
   *  land under the place, with exactly these segments, in the run that applies the confirmation. */
  readonly trips?: readonly FoundPlaceTrip[];
}

/** A trip a found place carries: its name, its document-dated segments and the documents that
 *  dated them, as the run read them. Never a purpose: the person states one on the Trips page. */
export interface FoundPlaceTrip {
  readonly name: string;
  readonly segments: readonly TripSegmentInput[];
  readonly documents: readonly string[];
}

export type RegisterAssetKind = 'REAL_PROPERTY' | 'EQUIPMENT' | 'IMPROVEMENT';

// The fixed-asset register's inputs (0026 item 1). Each field is present only when the answer
// promises it, so separate answers can contribute separate inputs to one asset.
export interface AssetRegisterEffect {
  readonly kind: 'asset_register';
  readonly entityKey: string;
  readonly entityName: string;
  readonly description: string;
  readonly assetKind: RegisterAssetKind;
  readonly costBasisCents?: number;
  readonly landValueCents?: number;
  readonly placedInService?: string;
}

export interface TripSegmentInput {
  readonly location: string;
  /** ISO calendar date. */
  readonly start: string;
  readonly end: string;
}

// The trip register's inputs: where the trip went and when. The register row itself, and the
// key naming it, are minted by the run.
export interface TripRegisterEffect {
  readonly kind: 'trip_register';
  readonly segments: readonly TripSegmentInput[];
  /** The profile trip the answer rewrites, `trip_<id>` as staging minted it. Absent: add a trip. */
  readonly tripKey?: string;
  /** The profile entity the trip sits under, `ent_<id>`: the place of an add, and on an edit the
   *  place the trip moves to (the Trips screen's "Change place", issue #1068). */
  readonly entityKey?: string;
  readonly name?: string;
  /** The trip's purpose; `null` on an edit clears it (the person emptied the field). */
  readonly purpose?: string | null;
  /** "Not a trip" (issue #1068): on an edit, the trip leaves the register and its lines go back
   *  to plain expenses, applied by code at import; never re-proposed. */
  readonly remove?: true;
  // The Trip log's facts (task 37.8, issue #1375): each absent leaves the trip's own as it is,
  // and an explicit `null` on an edit clears it. `validateTripFacts` (`./trip-facts`) holds what
  // they may combine to.
  /** How the person travelled: one of `TRIP_TRAVEL_WORDS`. */
  readonly travel?: TripTravel | null;
  /** The declared vehicle they drove, `veh_<id>`; only on `own_car`. */
  readonly vehicleKey?: string | null;
  /** The vehicle's description as the register held it when the answer was stored, for the
   *  pending sentence only; present only beside a `vehicleKey`. */
  readonly vehicleName?: string;
  /** The miles from the person's own log, a whole number; only on `own_car`. */
  readonly miles?: number | null;
  /** The trip's personal days, ISO days; empty: none. */
  readonly personalDays?: readonly string[] | null;
  /** The cost gaps the person said do not exist: `TRIP_NO_COST_GAPS` words. */
  readonly noCost?: readonly TripNoCostGap[] | null;
}

/** How a trip was travelled, the register's closed words (migration 0097). */
export const TRIP_TRAVEL_WORDS = [
  'own_car',
  'flew',
  'train_or_bus',
  'rental_car',
  'rideshare',
] as const;
export type TripTravel = (typeof TRIP_TRAVEL_WORDS)[number];

/** The cost gaps a person can say a trip has no cost for, the register's closed words (migration
 *  0098); miles are not a cost and take none, so `mileage` is no such word. */
export const TRIP_NO_COST_GAPS = ['lodging', 'fare', 'ride', 'baggage', 'meal'] as const;
export type TripNoCostGap = (typeof TRIP_NO_COST_GAPS)[number];

/** The gap words a trip's `missing_receipt` finding carries (task 37.8): the cost gaps, and
 *  `mileage` for a drive whose miles are not stated, which no "No such cost" answers. */
export const TRIP_GAP_WORDS = [...TRIP_NO_COST_GAPS, 'mileage'] as const;
export type TripGapWord = (typeof TRIP_GAP_WORDS)[number];

/** The reading fields a correction can name, one vocabulary for the web form, the validator and the importer (issue #685). */
export const READING_CORRECTION_FIELDS = [
  'total',
  'document_date',
  'vendor_or_payer',
  'currency',
] as const;
export type ReadingCorrectionField = (typeof READING_CORRECTION_FIELDS)[number];

/** The corrected reading fields that are also a booked line's changeable ledger fields; `currency` is not one. */
export const READING_CORRECTION_LEDGER_FIELD = {
  total: 'amount',
  document_date: 'date',
  vendor_or_payer: 'vendor',
} as const;
export type ReadingCorrectionLedgerField =
  (typeof READING_CORRECTION_LEDGER_FIELD)[keyof typeof READING_CORRECTION_LEDGER_FIELD];

/** One corrected value: `from` is the reading's raw value the card showed (null when the reader left it empty), `to` the person's value in canonical form. */
export interface ReadingCorrectionValue {
  readonly from: string | null;
  readonly to: string;
}

export interface ReadingCorrectionPage {
  /** The page's own 1-based number in the document (`pages.index` + 1), as the card shows it; the
   *  server maps it to a page row from its own read. A page left out as agreement text is
   *  never one, and the pages after it keep their numbers (issue #1260). */
  readonly page: number;
  /** The raw reading's currency, normalised as the read gate normalises it (three uppercase letters) or null; written whether or not the currency changed, so the importer's currency clause has its source. */
  readonly currency_as_read: string | null;
  /** Each field is present only when changed; at least one per page. */
  readonly total?: ReadingCorrectionValue;
  readonly document_date?: ReadingCorrectionValue;
  readonly vendor_or_payer?: ReadingCorrectionValue;
  readonly currency?: ReadingCorrectionValue;
}

// The person's correction of a reading (issue #685, plan row 15.11): carried only by the code-owned
// `correct_reading:` keys the web writes. The importer applies it to a booked line only where the
// line demonstrably took the old reading's value (code-applied.ts). Values are canonical decimal
// strings, not typed cents, because the reading's currency may not be USD.
export interface ReadingCorrectionEffect {
  readonly kind: 'reading_correction';
  readonly pages: readonly ReadingCorrectionPage[];
}

/** One field of a booked line the person corrected: `from` the line's value when the form was shown (null when the line had no vendor), `to` the person's value in canonical form. */
export interface LineCorrectionEffect {
  readonly kind: 'line_correction';
  /** The line's currency as booked, three uppercase letters: the amount is in it, and it is not changeable here. */
  readonly currency: string;
  /** Canonical decimal strings (`fmtCents`) on both sides. */
  readonly amount?: ReadingCorrectionValue;
  /** ISO calendar dates on both sides. */
  readonly date?: ReadingCorrectionValue;
  /** `from` a string or null; `to` the person's vendor. */
  readonly vendor?: ReadingCorrectionValue;
}

export const PROFILE_FACT_FIELDS = [
  'fair_rental_days',
  'personal_use_days',
  'stay_count',
  'services_note',
  'home_office',
  'miles',
] as const;
export type ProfileFactField = (typeof PROFILE_FACT_FIELDS)[number];

/** The person's recorded value, in the canonical shape `validateProfileFact` produces: integers, two-decimal area strings, one integer of miles per band of the year. */
export type ProfileFactValue =
  | {
      readonly field: 'fair_rental_days' | 'personal_use_days' | 'stay_count';
      readonly value: number;
    }
  | { readonly field: 'services_note'; readonly value: string }
  | { readonly field: 'home_office'; readonly office_sq_ft: string; readonly home_sq_ft: string }
  | {
      readonly field: 'miles';
      readonly bands: readonly {
        readonly from: string;
        readonly to: string;
        readonly miles: number;
      }[];
    };

/** A profile fact the person recorded (plan row 15.13): the web mints it under `profile_fact:<target>:<field>`; code overlays it onto the profile, and a run never carries it. */
export interface ProfileFactEffect {
  readonly kind: 'profile_fact';
  /** `ent_<id>` for an entity fact, `use_<id>` (a place's use of a vehicle) for miles; staging-minted, never rendered. */
  readonly target: string;
  /** The entity's name or the vehicle's description at the time of the write: wording only, stored text re-gated at display. */
  readonly name: string;
  readonly fact: ProfileFactValue;
}

/** The person's word that one of their places is another (issue #1388, decision record 0151): the
 *  web mints it under `fold_place:ent_<from>`, one live key per folded place, born answered, and
 *  the next run stages the folded place as the target and the import that consumes it moves the
 *  place's rows there. A run never carries it: staging keeps it out of answers.json. */
export interface EntityFoldEffect {
  readonly kind: 'entity_fold';
  /** `ent_<id>` of the place folded away; staging-minted, never rendered. */
  readonly from: string;
  /** `ent_<id>` of the place it is folded into; never the same as `from`. */
  readonly to: string;
  /** The two places' names at the time of the write: wording only, stored text re-gated at
   *  display, as a profile fact's `name` is. */
  readonly fromName: string;
  readonly toName: string;
  /** Set when the folded place is a rental whose name carries no listing id ("Airbnb"): the name is
   *  reserved, so a statement printing only it is still asked about (the founder's ruling). */
  readonly reservedName?: true;
}

/** Where an uploaded receipt belongs (task 37.26, issue #1402): with one trip of the run's staged
 *  profile, or with one booked line of its confirmed digest. */
export type AttachReceiptTarget =
  | { readonly type: 'trip'; readonly tripKey: string }
  | { readonly type: 'line'; readonly ledgerId: string };

/** The person's word that an uploaded document is a trip's receipt or one booked line's receipt
 *  (task 37.26, issue #1402): the web mints it under `attach_receipt:doc_<d>:<target>` born
 *  answered, and the next run's importer applies it — tying the receipt's in-days expenses to the
 *  trip, or moving the cited line's document to the receipt. A run never carries it. */
export interface AttachReceiptEffect {
  readonly kind: 'attach_receipt';
  /** The uploaded receipt, `doc_<id>`: the batch token its reading file is keyed by. */
  readonly documentKey: string;
  readonly to: AttachReceiptTarget;
}

// Review-only: books unchanged. The comparator treats any ledger row armed by an answer whose
// effect is `none` as a contradiction.
export interface NoneEffect {
  readonly kind: 'none';
}

export type Effect =
  | LedgerEffect
  | EntityRegisterEffect
  | AssetRegisterEffect
  | TripRegisterEffect
  | ReadingCorrectionEffect
  | LineCorrectionEffect
  | ProfileFactEffect
  | EntityFoldEffect
  | AttachReceiptEffect
  | NoneEffect;

/** The trips screen's code-owned question-key namespace: the web action mints keys with it, and the importer refuses any model-minted key bearing it (the 0050 reading-confirm rule, second namespace). */
export const TRIP_EDIT_KEY_PREFIX = 'trip_edit:';

/** The Documents table's code-owned move-answer namespace (plan row 14.18): the web action mints `move_lines:doc_<d>:<n>`, the importer applies the move and refuses any model-minted key bearing it (the 0050 reading-confirm rule, third namespace). */
export const MOVE_LINES_KEY_PREFIX = 'move_lines:';

/** The Review card's code-owned correction namespace (plan row 15.11): the web action mints `correct_reading:doc_<d>:<n>`, the importer applies the person's values from the stored answer and refuses any model-minted key bearing it (the 0050 reading-confirm rule, fourth namespace). */
export const CORRECT_READING_KEY_PREFIX = 'correct_reading:';

/** The Review card's code-owned per-line correction namespace (plan row 15.12): the web action mints `correct_line:doc_<d>:<n>` citing one line, the importer applies the person's values to that line and refuses any model-minted key bearing it (the 0050 reading-confirm rule, fifth namespace). */
export const CORRECT_LINE_KEY_PREFIX = 'correct_line:';

/** The Review facts form's code-owned namespace (plan row 15.13): the web mints `profile_fact:<target>:<field>`, one live key per target and field, code overlays the person's value onto the profile, and the importer refuses any model-minted key bearing it (the 0050 reading-confirm rule, sixth namespace). */
export const PROFILE_FACT_KEY_PREFIX = 'profile_fact:';

/** The Review screen's code-owned verify-reading namespace (issue #1126, decision record 0133): the importer mints `verify_reading:doc_<d>` born OPEN at import, when the scan double-read disagrees with the first reading on a booked figure or a figure field scored low, and the person's answer applies it through this file's correction machinery. Unlike the six namespaces above it is not the web action's key but the importer's — the 0050 rule's rejected importer-minted question row, born open — and the born-answered precedent's mirror: the row is asked the moment it exists, so it needs no run behind an ask. The importer refuses any model-minted key bearing it (the 0050 reading-confirm rule, seventh namespace). */
export const VERIFY_READING_KEY_PREFIX = 'verify_reading:';

/** Account's and the chat's code-owned fold namespace (issue #1388, decision record 0151): the fold core mints `fold_place:ent_<s>`, one live key per folded place, born answered with one `entity_fold` option; staging applies a live fold and the import that consumes it moves the place's rows to the target. The importer refuses any model-minted key bearing it (the 0050 reading-confirm rule, eighth namespace). */
export const FOLD_PLACE_KEY_PREFIX = 'fold_place:';

/** The code-owned category namespace (issue #1376), for the Review line form and the chat's chip still to come: the category core mints `correct_category:doc_<d>:<n>` citing one booked line, born answered with one `ledger`/`category` option whose values carry their `schedule`, and the importer applies the person's pick to that line (code-applied.ts). The importer refuses any model-minted key bearing it (the 0050 reading-confirm rule, ninth namespace). */
export const CORRECT_CATEGORY_KEY_PREFIX = 'correct_category:';

/** The Review card's and the Trip log's code-owned attach-receipt namespace (task 37.26, issue #1402): the web mints `attach_receipt:doc_<d>:trip_<t>` or `attach_receipt:doc_<d>:<ledger id>` born answered with one `attach_receipt` option, and the importer applies the receipt to the trip's in-days expenses or moves the cited line's document to it (code-applied.ts). The document comes first so the document delete reaches it by its per-document prefix. The importer refuses any model-minted key bearing it (the 0050 reading-confirm rule, tenth namespace). */
export const ATTACH_RECEIPT_KEY_PREFIX = 'attach_receipt:';

// --- the total runtime validator ----------------------------------------------------------

// An option's effect reaches this contract as jsonb — the importer persists `questions.options`
// verbatim — so a renderer must never trust the shape. parseEffect is the total check: anything
// that is not exactly one of the ten kinds above, or carries a required field of the wrong
// type, parses to null and the caller renders no pending wording. Unknown extra keys are
// tolerated, so the contract can grow without stored payloads failing to parse; optional fields
// are validated when present and treated as absent when undefined.

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

// Money is integer cents (AGENTS.md); a fractional-cent payload would be silently truncated by
// the renderer's formatting, so it fails the parse instead of displaying a wrong figure.
function isCents(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value);
}

// The shape the importer and the books rebuild can carry out. The web writes only validated
// values, so a `to` outside these shapes is a malformed stored payload: it parses to null and is
// skipped, never allowed to fail an import (imports this module nothing, so the checks are inline).
const CANONICAL_TOTAL = /^-?(?:0|[1-9]\d*)\.\d{2}$/;
/** A total's integer part is at most eight digits: the same cap as `CORRECTION_MAX_CENTS` in `@bookette/reader/correction` (10^10 cents, exclusive), repeated because this module imports nothing; a test pins the two equal. A larger stored figure is skipped, never allowed to overflow the importer's write. */
export const CORRECTION_TOTAL_MAX_INTEGER_DIGITS = 8;
function totalOk(value: string): boolean {
  return (
    CANONICAL_TOTAL.test(value) &&
    value !== '-0.00' &&
    value.indexOf('.') - (value.startsWith('-') ? 1 : 0) <= CORRECTION_TOTAL_MAX_INTEGER_DIGITS
  );
}
function isCalendarDay(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match === null) return false;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return (
    date.getUTCFullYear() === Number(match[1]) &&
    date.getUTCMonth() === Number(match[2]) - 1 &&
    date.getUTCDate() === Number(match[3])
  );
}
function correctionTargetOk(field: ReadingCorrectionField, to: string): boolean {
  switch (field) {
    case 'total':
      return totalOk(to);
    case 'document_date':
      return isCalendarDay(to);
    case 'currency':
      return /^[A-Z]{3}$/.test(to);
    case 'vendor_or_payer':
      return true;
  }
}

function parseCorrectionValue(
  field: ReadingCorrectionField,
  value: unknown,
): ReadingCorrectionValue | null {
  if (!isRecord(value)) return null;
  const from = value['from'];
  const to = value['to'];
  if (from !== null && typeof from !== 'string') return null;
  if (typeof to !== 'string' || to === '' || !correctionTargetOk(field, to)) return null;
  return { from, to };
}

const CORRECTION_PAGE_KEYS: ReadonlySet<string> = new Set([
  'page',
  'currency_as_read',
  ...READING_CORRECTION_FIELDS,
]);

function parseReadingCorrection(value: Record<string, unknown>): ReadingCorrectionEffect | null {
  const rawPages = value['pages'];
  if (!Array.isArray(rawPages) || rawPages.length === 0) return null;
  const seen = new Set<number>();
  const pages: ReadingCorrectionPage[] = [];
  for (const raw of rawPages) {
    if (!isRecord(raw)) return null;
    // Strict, unlike the other kinds: a key outside the page's vocabulary is a malformed payload,
    // because the importer applies every field a page carries.
    if (Object.keys(raw).some((key) => !CORRECTION_PAGE_KEYS.has(key))) return null;
    const page = raw['page'];
    if (typeof page !== 'number' || !Number.isSafeInteger(page) || page <= 0 || seen.has(page)) {
      return null;
    }
    seen.add(page);
    const currencyAsRead = raw['currency_as_read'];
    if (currencyAsRead !== null && typeof currencyAsRead !== 'string') return null;
    const parsed: {
      -readonly [K in keyof ReadingCorrectionPage]: ReadingCorrectionPage[K];
    } = { page, currency_as_read: currencyAsRead };
    let fields = 0;
    for (const field of READING_CORRECTION_FIELDS) {
      const rawValue = raw[field];
      if (rawValue === undefined) continue;
      const correction = parseCorrectionValue(field, rawValue);
      if (correction === null) return null;
      parsed[field] = correction;
      fields += 1;
    }
    if (fields === 0) return null;
    pages.push(parsed);
  }
  return { kind: 'reading_correction', pages };
}

const LINE_CORRECTION_KEYS: ReadonlySet<string> = new Set([
  'kind',
  'currency',
  'amount',
  'date',
  'vendor',
]);

// Strict like the reading correction: the importer applies every field the payload carries. The
// field names are the ledger's own, so each is checked as the reading field that feeds it.
function parseLineCorrection(value: Record<string, unknown>): LineCorrectionEffect | null {
  if (Object.keys(value).some((key) => !LINE_CORRECTION_KEYS.has(key))) return null;
  const currency = value['currency'];
  if (typeof currency !== 'string' || !/^[A-Z]{3}$/.test(currency)) return null;
  const parsed: { -readonly [K in keyof LineCorrectionEffect]: LineCorrectionEffect[K] } = {
    kind: 'line_correction',
    currency,
  };
  let fields = 0;
  for (const [field, readingField] of [
    ['amount', 'total'],
    ['date', 'document_date'],
    ['vendor', 'vendor_or_payer'],
  ] as const) {
    const raw = value[field];
    if (raw === undefined) continue;
    const correction = parseCorrectionValue(readingField, raw);
    if (correction === null) return null;
    // The amount's `from` is the form's pre-fill, a canonical figure; a vendor `from` is free text.
    if (field === 'amount' && (correction.from === null || !totalOk(correction.from))) {
      return null;
    }
    if (field === 'date' && (correction.from === null || !isCalendarDay(correction.from))) {
      return null;
    }
    parsed[field] = correction;
    fields += 1;
  }
  return fields === 0 ? null : parsed;
}

const PROFILE_FACT_KEYS: ReadonlySet<string> = new Set(['kind', 'target', 'name', 'fact']);
const PROFILE_FACT_NAME_MAX = 200;
const PROFILE_FACT_NOTE_MAX = 500;
const CANONICAL_AREA = /^\d{1,8}\.\d{2}$/;

function isNonNegativeInteger(value: unknown, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= max;
}

function positiveArea(value: unknown): value is string {
  return typeof value === 'string' && CANONICAL_AREA.test(value) && Number(value) > 0;
}

function hasControlCharacter(value: string): boolean {
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0;
    if (code < 0x20 || (code >= 0x7f && code <= 0x9f)) return true;
  }
  return false;
}

// Strict like the corrections: the overlay applies every field the payload carries, and code
// (not the model) writes the kind, so a value outside the validator's canonical shape is no effect.
function parseProfileFactValue(target: string, raw: unknown): ProfileFactValue | null {
  if (!isRecord(raw)) return null;
  const field = raw['field'];
  const keys = Object.keys(raw);
  const onUse = target.startsWith('use_');
  if (field === 'miles') {
    if (!onUse || keys.some((key) => key !== 'field' && key !== 'bands')) return null;
    const rawBands = raw['bands'];
    if (!Array.isArray(rawBands) || rawBands.length === 0) return null;
    const bands: { from: string; to: string; miles: number }[] = [];
    for (const band of rawBands as unknown[]) {
      if (
        !isRecord(band) ||
        Object.keys(band).some((k) => k !== 'from' && k !== 'to' && k !== 'miles')
      ) {
        return null;
      }
      const { from, to, miles } = band;
      if (typeof from !== 'string' || !isCalendarDay(from)) return null;
      if (typeof to !== 'string' || !isCalendarDay(to) || to < from) return null;
      if (!isNonNegativeInteger(miles, 1_000_000)) return null;
      bands.push({ from, to, miles });
    }
    return { field, bands };
  }
  if (onUse) return null;
  if (field === 'fair_rental_days' || field === 'personal_use_days' || field === 'stay_count') {
    if (keys.some((key) => key !== 'field' && key !== 'value')) return null;
    const value = raw['value'];
    return isNonNegativeInteger(value, 366) ? { field, value } : null;
  }
  if (field === 'services_note') {
    if (keys.some((key) => key !== 'field' && key !== 'value')) return null;
    const value = raw['value'];
    if (typeof value !== 'string' || value !== value.trim()) return null;
    if (value.length < 1 || value.length > PROFILE_FACT_NOTE_MAX || hasControlCharacter(value)) {
      return null;
    }
    return { field, value };
  }
  if (field === 'home_office') {
    if (keys.some((key) => key !== 'field' && key !== 'office_sq_ft' && key !== 'home_sq_ft')) {
      return null;
    }
    const office = raw['office_sq_ft'];
    const home = raw['home_sq_ft'];
    if (!positiveArea(office) || !positiveArea(home) || Number(office) > Number(home)) return null;
    return { field, office_sq_ft: office, home_sq_ft: home };
  }
  return null;
}

function parseProfileFact(value: Record<string, unknown>): ProfileFactEffect | null {
  if (Object.keys(value).some((key) => !PROFILE_FACT_KEYS.has(key))) return null;
  const target = value['target'];
  if (typeof target !== 'string' || !/^(ent|use)_[1-9]\d*$/.test(target)) return null;
  const name = value['name'];
  if (typeof name !== 'string' || name === '' || name.length > PROFILE_FACT_NAME_MAX) return null;
  const fact = parseProfileFactValue(target, value['fact']);
  return fact === null ? null : { kind: 'profile_fact', target, name, fact };
}

const ENTITY_FOLD_KEYS: ReadonlySet<string> = new Set([
  'kind',
  'from',
  'to',
  'fromName',
  'toName',
  'reservedName',
]);
const ENTITY_KEY = /^ent_[1-9]\d*$/;

// Strict like the profile fact: code writes the whole payload, and staging and the import act on
// both keys, so a key outside the shape, a place folded into itself or a name outside the
// wording bound is no effect.
function parseEntityFold(value: Record<string, unknown>): EntityFoldEffect | null {
  if (Object.keys(value).some((key) => !ENTITY_FOLD_KEYS.has(key))) return null;
  const { from, to, fromName, toName, reservedName } = value;
  if (typeof from !== 'string' || !ENTITY_KEY.test(from)) return null;
  if (typeof to !== 'string' || !ENTITY_KEY.test(to) || to === from) return null;
  const nameOk = (name: unknown): name is string =>
    typeof name === 'string' && name !== '' && name.length <= PROFILE_FACT_NAME_MAX;
  if (!nameOk(fromName) || !nameOk(toName)) return null;
  if (reservedName !== undefined && reservedName !== true) return null;
  return {
    kind: 'entity_fold',
    from,
    to,
    fromName,
    toName,
    ...(reservedName === true ? { reservedName } : {}),
  };
}

const ATTACH_RECEIPT_KEYS: ReadonlySet<string> = new Set(['kind', 'documentKey', 'to']);
const ATTACH_DOCUMENT_KEY = /^doc_[1-9]\d{0,15}$/;
const ATTACH_TRIP_KEY = /^trip_[1-9]\d{0,15}$/;
// The shape `ledger-ids.ts` reads (L0001, G0034), bounded so a stored payload cannot carry a
// token no row can: the importer looks the id up in the confirmed digest and drops it otherwise.
const ATTACH_LEDGER_ID = /^[A-Za-z]{1,8}\d{1,12}$/;

// Strict like the fold: code writes both the document and its target, and the importer acts on
// both, so a token outside the run's vocabulary or a target that is neither a trip nor a line is
// no effect.
function parseAttachReceipt(value: Record<string, unknown>): AttachReceiptEffect | null {
  if (Object.keys(value).some((key) => !ATTACH_RECEIPT_KEYS.has(key))) return null;
  const documentKey = value['documentKey'];
  if (typeof documentKey !== 'string' || !ATTACH_DOCUMENT_KEY.test(documentKey)) return null;
  const to = value['to'];
  if (!isRecord(to)) return null;
  const type = to['type'];
  if (type === 'trip') {
    if (Object.keys(to).some((key) => key !== 'type' && key !== 'tripKey')) return null;
    const tripKey = to['tripKey'];
    if (typeof tripKey !== 'string' || !ATTACH_TRIP_KEY.test(tripKey)) return null;
    return { kind: 'attach_receipt', documentKey, to: { type: 'trip', tripKey } };
  }
  if (type === 'line') {
    if (Object.keys(to).some((key) => key !== 'type' && key !== 'ledgerId')) return null;
    const ledgerId = to['ledgerId'];
    if (typeof ledgerId !== 'string' || !ATTACH_LEDGER_ID.test(ledgerId)) return null;
    return { kind: 'attach_receipt', documentKey, to: { type: 'line', ledgerId } };
  }
  return null;
}

/** An optional text a confirmation records: absent (undefined), the string when trimmed and
 *  non-empty, else malformed (null). */
function confirmedText(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || value === '' || value !== value.trim()) return null;
  return value;
}

function parseLedgerValue(value: unknown): LedgerValue | null {
  if (!isRecord(value)) return null;
  switch (value['type']) {
    case 'category': {
      const scheduleLine = value['scheduleLine'];
      const tag = value['tag'];
      const schedule = value['schedule'];
      if (typeof scheduleLine !== 'string') return null;
      if (tag !== null && tag !== 'CAPITAL' && tag !== 'REPAIR') return null;
      // Optional, and validated when present: a value naming no schedule still parses.
      if (schedule !== undefined && schedule !== 'C' && schedule !== 'E') return null;
      return {
        type: 'category',
        scheduleLine,
        tag,
        ...(schedule === undefined ? {} : { schedule }),
      };
    }
    case 'entity': {
      const entityKey = value['entityKey'];
      const entityName = value['entityName'];
      if (typeof entityKey !== 'string' || typeof entityName !== 'string') return null;
      // An address, an alias or a listing is the person's text once confirmed, so a padded or
      // empty one is malformed rather than trimmed here: the sentence confirmed and the column
      // written are one string.
      const address = confirmedText(value['address']);
      const alias = confirmedText(value['alias']);
      const listing = confirmedText(value['listing']);
      if (address === null || alias === null || listing === null) return null;
      return {
        type: 'entity',
        entityKey,
        entityName,
        ...(address === undefined ? {} : { address }),
        ...(alias === undefined ? {} : { alias }),
        ...(listing === undefined ? {} : { listing }),
      };
    }
    case 'trip_assignment': {
      const tripClass = value['tripClass'];
      if (tripClass !== 'business' && tripClass !== 'rental') return null;
      return { type: 'trip_assignment', tripClass };
    }
    case 'settled':
      return Object.keys(value).length === 1 ? { type: 'settled' } : null;
    default:
      return null;
  }
}

type TripFactFields = Pick<
  TripRegisterEffect,
  'travel' | 'vehicleKey' | 'vehicleName' | 'miles' | 'personalDays' | 'noCost'
>;

/** A vehicle's key as a trip names it, `veh_<id>`, spelled as staging mints it: no leading zero
 *  and at most 15 digits, so the id is one Number holds exactly and one spelling names one row. */
export const TRIP_VEHICLE_KEY = /^veh_[1-9]\d{0,14}$/;

// The Trip log's facts on a trip_register effect, by shape only: a closed travel word, a `veh_`
// key (its name beside it alone), a whole number of miles, a list of ISO days and a list of gap
// words. An explicit null clears a fact, so it rides an edit (`tripKey`) only, as a cleared
// purpose does; what the facts may combine to is `validateTripFacts`'s. Null on a malformed one.
function parseTripFacts(value: Record<string, unknown>, edit: boolean): TripFactFields | null {
  const out: { -readonly [K in keyof TripFactFields]: TripFactFields[K] } = {};
  const cleared = (field: unknown): boolean => field === null && edit;
  const travel = value['travel'];
  if (travel !== undefined) {
    if (cleared(travel)) out.travel = null;
    else if ((TRIP_TRAVEL_WORDS as readonly unknown[]).includes(travel)) {
      out.travel = travel as TripTravel;
    } else return null;
  }
  const vehicleKey = value['vehicleKey'];
  if (vehicleKey !== undefined) {
    if (cleared(vehicleKey)) out.vehicleKey = null;
    else if (typeof vehicleKey === 'string' && TRIP_VEHICLE_KEY.test(vehicleKey)) {
      out.vehicleKey = vehicleKey;
    } else return null;
  }
  const vehicleName = value['vehicleName'];
  if (vehicleName !== undefined) {
    if (typeof vehicleName !== 'string' || vehicleName === '') return null;
    if (typeof out.vehicleKey !== 'string') return null;
    out.vehicleName = vehicleName;
  }
  const miles = value['miles'];
  if (miles !== undefined) {
    if (cleared(miles)) out.miles = null;
    else if (typeof miles === 'number' && Number.isInteger(miles)) out.miles = miles;
    else return null;
  }
  const personalDays = value['personalDays'];
  if (personalDays !== undefined) {
    if (cleared(personalDays)) out.personalDays = null;
    else if (
      Array.isArray(personalDays) &&
      personalDays.every((day) => typeof day === 'string' && isCalendarDay(day))
    ) {
      out.personalDays = personalDays as string[];
    } else return null;
  }
  const noCost = value['noCost'];
  if (noCost !== undefined) {
    if (cleared(noCost)) out.noCost = null;
    else if (
      Array.isArray(noCost) &&
      noCost.every((gap) => (TRIP_NO_COST_GAPS as readonly unknown[]).includes(gap))
    ) {
      out.noCost = noCost as TripNoCostGap[];
    } else return null;
  }
  return out;
}

function parseSegments(value: unknown): TripSegmentInput[] | null {
  if (!Array.isArray(value)) return null;
  const parsed: TripSegmentInput[] = [];
  for (const segment of value) {
    if (!isRecord(segment)) return null;
    const location = segment['location'];
    const start = segment['start'];
    const end = segment['end'];
    if (typeof location !== 'string' || typeof start !== 'string' || typeof end !== 'string') {
      return null;
    }
    parsed.push({ location, start, end });
  }
  return parsed;
}

// A found place's trips: each a non-empty name, at least one segment on real calendar days in
// order, and the documents that dated it as non-empty strings. Anything else is a malformed
// payload, so the whole effect parses to null and nothing renders or applies.
function parseFoundPlaceTrips(value: unknown): FoundPlaceTrip[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const trips: FoundPlaceTrip[] = [];
  for (const raw of value) {
    if (!isRecord(raw)) return null;
    const name = raw['name'];
    const documents = raw['documents'];
    const segments = parseSegments(raw['segments']);
    if (typeof name !== 'string' || name === '' || segments === null || segments.length === 0) {
      return null;
    }
    if (
      segments.some(
        (segment) =>
          !isCalendarDay(segment.start) ||
          !isCalendarDay(segment.end) ||
          segment.start > segment.end,
      )
    ) {
      return null;
    }
    if (
      !Array.isArray(documents) ||
      documents.length === 0 ||
      documents.some((document) => typeof document !== 'string' || document === '')
    ) {
      return null;
    }
    trips.push({ name, segments, documents: documents as string[] });
  }
  return trips;
}

/** Parses unknown jsonb into an Effect, or null when the payload is not one of the ten kinds. */
export function parseEffect(value: unknown): Effect | null {
  if (!isRecord(value)) return null;
  switch (value['kind']) {
    case 'none':
      return { kind: 'none' };
    case 'ledger': {
      const field = value['field'];
      if (
        field !== 'category' &&
        field !== 'entity' &&
        field !== 'trip_assignment' &&
        field !== 'settled'
      ) {
        return null;
      }
      const rawFrom = value['from'];
      if (rawFrom === undefined) return null;
      const from = rawFrom === null ? null : parseLedgerValue(rawFrom);
      if (from === null && rawFrom !== null) return null;
      const to = parseLedgerValue(value['to']);
      if (to === null) return null;
      // A settled effect settles lines that had no place: it names no prior value, and its field
      // and value go together, so neither half alone is a settled effect.
      if ((field === 'settled') !== (to.type === 'settled')) return null;
      // Nor is a settled value ever a prior one: no line is moved off "already inside the income
      // column", and a settled effect's own `from` is null.
      if (from !== null && from.type === 'settled') return null;
      if (field === 'settled' && from !== null) return null;
      // Trips ride only an option that places lines with a place.
      const rawTrips = value['trips'];
      if (rawTrips === undefined) return { kind: 'ledger', field, from, to };
      if (field !== 'entity' || to.type !== 'entity') return null;
      const trips = parseFoundPlaceTrips(rawTrips);
      if (trips === null) return null;
      return { kind: 'ledger', field, from, to, trips };
    }
    case 'entity_register': {
      const entityKey = value['entityKey'];
      const entityName = value['entityName'];
      const entityKind = value['entityKind'];
      const schedule = value['schedule'];
      const ownershipPct = value['ownershipPct'];
      if (typeof entityKey !== 'string' || typeof entityName !== 'string') return null;
      if (entityKind !== 'RENTAL' && entityKind !== 'STR_RENTAL' && entityKind !== 'BUSINESS') {
        return null;
      }
      if (schedule !== 'C' && schedule !== 'E') return null;
      // Required as `number | null`: an absent ownershipPct is a malformed payload, not null.
      if (ownershipPct !== null && !isFiniteNumber(ownershipPct)) return null;
      const address = value['address'];
      const listing = value['listing'];
      if (address !== undefined && !isNonEmptyString(address)) return null;
      if (listing !== undefined && !isNonEmptyString(listing)) return null;
      // A rental is placed by exactly one thing its documents print; a business by neither.
      const printed = [address, listing].filter((field) => field !== undefined).length;
      if (printed !== (entityKind === 'BUSINESS' ? 0 : 1)) return null;
      const rawTrips = value['trips'];
      const trips = rawTrips === undefined ? undefined : parseFoundPlaceTrips(rawTrips);
      if (trips === null) return null;
      return {
        kind: 'entity_register',
        entityKey,
        entityName,
        entityKind,
        schedule,
        ownershipPct,
        ...(address !== undefined ? { address } : {}),
        ...(listing !== undefined ? { listing } : {}),
        ...(trips !== undefined ? { trips } : {}),
      };
    }
    case 'asset_register': {
      const entityKey = value['entityKey'];
      const entityName = value['entityName'];
      const description = value['description'];
      const assetKind = value['assetKind'];
      const costBasisCents = value['costBasisCents'];
      const landValueCents = value['landValueCents'];
      const placedInService = value['placedInService'];
      if (
        typeof entityKey !== 'string' ||
        typeof entityName !== 'string' ||
        typeof description !== 'string'
      ) {
        return null;
      }
      if (
        assetKind !== 'REAL_PROPERTY' &&
        assetKind !== 'EQUIPMENT' &&
        assetKind !== 'IMPROVEMENT'
      ) {
        return null;
      }
      if (costBasisCents !== undefined && !isCents(costBasisCents)) return null;
      if (landValueCents !== undefined && !isCents(landValueCents)) return null;
      // Land above the price paid would leave a negative depreciable basis (issue #1561).
      if (
        costBasisCents !== undefined &&
        landValueCents !== undefined &&
        landValueCents > costBasisCents
      ) {
        return null;
      }
      if (placedInService !== undefined && typeof placedInService !== 'string') return null;
      return {
        kind: 'asset_register',
        entityKey,
        entityName,
        description,
        assetKind,
        ...(costBasisCents !== undefined ? { costBasisCents } : {}),
        ...(landValueCents !== undefined ? { landValueCents } : {}),
        ...(placedInService !== undefined ? { placedInService } : {}),
      };
    }
    case 'trip_register': {
      const parsed = parseSegments(value['segments']);
      if (parsed === null) return null;
      // The trips form mints the provenance fields and never writes an empty string, so an
      // empty string is a malformed payload, not an empty value.
      const tripKey = value['tripKey'];
      const entityKey = value['entityKey'];
      const name = value['name'];
      const purpose = value['purpose'];
      if (tripKey !== undefined && (typeof tripKey !== 'string' || tripKey === '')) return null;
      if (entityKey !== undefined && (typeof entityKey !== 'string' || entityKey === '')) {
        return null;
      }
      if (name !== undefined && (typeof name !== 'string' || name === '')) return null;
      // An edit may clear the purpose with an explicit null; an add has none to clear.
      if (
        purpose !== undefined &&
        !(purpose === null && typeof tripKey === 'string') &&
        (typeof purpose !== 'string' || purpose === '')
      ) {
        return null;
      }
      // A removal names the trip it removes and nothing else may ride it: `true` only, on an edit.
      const remove = value['remove'];
      if (remove !== undefined && (remove !== true || tripKey === undefined)) return null;
      const facts = parseTripFacts(value, typeof tripKey === 'string');
      if (facts === null) return null;
      return {
        kind: 'trip_register',
        segments: parsed,
        ...(tripKey !== undefined ? { tripKey } : {}),
        ...(entityKey !== undefined ? { entityKey } : {}),
        ...(name !== undefined ? { name } : {}),
        ...(purpose !== undefined ? { purpose } : {}),
        ...(remove === true ? { remove } : {}),
        ...facts,
      };
    }
    case 'reading_correction':
      return parseReadingCorrection(value);
    case 'line_correction':
      return parseLineCorrection(value);
    case 'profile_fact':
      return parseProfileFact(value);
    case 'entity_fold':
      return parseEntityFold(value);
    case 'attach_receipt':
      return parseAttachReceipt(value);
    default:
      return null;
  }
}

// --- why a recorded trip sits under its place ----------------------------------------------

/** The closed words a run records for why a trip sits under its place (issue #1068). */
export const TRIP_PLACED_BY = ['named', 'city', 'card'] as const;

/**
 * Why a recorded trip sits under its place, in code's words from the run's closed `placed_by`
 * word (decision record 0132), so no model text says it; null for any other value, such as a
 * trip the person added. The place's name is the caller's, gated before it reaches here.
 */
export function renderTripPlacement(placedBy: unknown, placeName: string): string | null {
  switch (placedBy) {
    case 'named':
      return `Placed with ${placeName}: a document of the trip names it.`;
    case 'city':
      return `Placed with ${placeName}: it is your only place in the trip's city.`;
    case 'card':
      return `Placed with ${placeName}: the card that paid is the one its income lines use.`;
    default:
      return null;
  }
}

// --- the pending-payload renderer ---------------------------------------------------------

// Hand-rolled cents formatting: the wording is a pure function of the payload, so it must not
// depend on the ICU database a host Node build carries either.
function formatCents(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const absolute = Math.abs(cents);
  const dollars = Math.floor(absolute / 100).toString();
  const grouped = dollars.replaceAll(/\B(?=(\d{3})+(?!\d))/g, ',');
  const remainder = (absolute % 100).toString().padStart(2, '0');
  return `${sign}$${grouped}.${remainder}`;
}

const ENTITY_KIND_WORDING: ReadonlyMap<RegisterEntityKind, string> = new Map([
  ['RENTAL', 'a residential rental'],
  ['STR_RENTAL', 'a short-term rental'],
  ['BUSINESS', 'a business'],
]);

function renderLedgerValue(value: LedgerValue): string {
  switch (value.type) {
    case 'category':
      return value.tag === null
        ? `line ${value.scheduleLine}`
        : `line ${value.scheduleLine}, tagged ${value.tag === 'CAPITAL' ? 'a capital item' : 'a repair'}`;
    case 'entity':
      return value.entityName;
    case 'trip_assignment':
      return value.tripClass === 'business'
        ? 'one business trip'
        : 'one trip for the rental property';
    case 'settled':
      return 'already inside the income column';
  }
}

/** What a settled effect (issue #1153) promises, as the pending wording renders it. */
export const SETTLED_PENDING_WORDING =
  'The cited lines are already inside the income column and will not be booked again.';

function renderLedger(effect: LedgerEffect): string {
  // A settled effect moves nothing anywhere (issue #1153): the lines stay out of every total.
  if (effect.to.type === 'settled') return SETTLED_PENDING_WORDING;
  const toText = renderLedgerValue(effect.to);
  // A `from` that renders as the `to` is a no-move (an option offering the line's own line, an
  // entity move onto the entity the item already books to): the person reads "stay", never
  // "change from line 8 to line 8". The comparison is on the rendered value, the wording being
  // a function of what the person sees (issue #1121).
  const move =
    effect.from === null
      ? `The cited lines will be booked to ${toText}`
      : renderLedgerValue(effect.from) === toText
        ? `The cited lines will stay ${effect.to.type === 'entity' ? 'with' : 'on'} ${toText}`
        : `The cited lines will change from ${renderLedgerValue(effect.from)} to ${toText}`;
  const address =
    effect.to.type === 'entity' && effect.to.address !== undefined
      ? `, and ${effect.to.address} will be recorded as its address`
      : '';
  const alias =
    effect.to.type === 'entity' && effect.to.alias !== undefined
      ? `, and ${effect.to.alias} will be recorded as another name for it`
      : '';
  const listing =
    effect.to.type === 'entity' && effect.to.listing !== undefined
      ? `, and ${effect.to.listing} will be recorded as its listing`
      : '';
  return `${move}${address}${alias}${listing}.${foundPlaceTripsClause(effect)}`;
}

function renderSegments(segments: readonly TripSegmentInput[]): string {
  return segments
    .map((segment) => `${segment.location} from ${segment.start} to ${segment.end}`)
    .join('; ');
}

function renderEntityRegister(effect: EntityRegisterEffect): string {
  const kind = ENTITY_KIND_WORDING.get(effect.entityKind) ?? effect.entityKind;
  const ownership =
    effect.ownershipPct === null ? '' : `, owned ${effect.ownershipPct.toString()}%`;
  const placed =
    effect.listing !== undefined
      ? `, listed as ${effect.listing}`
      : effect.address !== undefined
        ? `, at ${effect.address}`
        : '';
  return `${effect.entityName} will be recorded on the entity register as ${kind} (Schedule ${effect.schedule})${ownership}${placed}.${foundPlaceTripsClause(effect)}`;
}

/** The trips a found place's option carries, as one sentence after the option's own (issue
 *  #1068), or nothing when it carries none: on the register option and on an option placing the
 *  lines with a staged place alike. Exported so the second confirmation spells the same words. */
export function foundPlaceTripsClause(effect: {
  readonly trips?: readonly FoundPlaceTrip[] | undefined;
}): string {
  const trips = effect.trips ?? [];
  if (trips.length === 0) return '';
  const listing = trips.map((trip) => `${trip.name} (${renderSegments(trip.segments)})`);
  return trips.length === 1
    ? ` The trip found in its documents will be recorded under it: ${listing.join('')}.`
    : ` The ${String(trips.length)} trips found in its documents will be recorded under it: ${listing.join('; ')}.`;
}

function renderAssetRegister(effect: AssetRegisterEffect): string {
  const clauses: string[] = [];
  if (effect.costBasisCents !== undefined) {
    clauses.push(`a cost basis of ${formatCents(effect.costBasisCents)}`);
  }
  if (effect.landValueCents !== undefined) {
    clauses.push(`a land value of ${formatCents(effect.landValueCents)}`);
  }
  if (effect.placedInService !== undefined) {
    clauses.push(`a placed-in-service date of ${effect.placedInService}`);
  }
  const details = clauses.length === 0 ? '' : ` with ${clauses.join(', ')}`;
  return `An asset (${effect.description}) for ${effect.entityName} will be recorded on the fixed-asset register${details}.`;
}

function renderTripRegister(effect: TripRegisterEffect): string {
  if (effect.remove === true) {
    const named = effect.name === undefined ? 'This trip' : `Trip "${effect.name}"`;
    return `${named} will be taken off the trip register, and its lines will go back to plain expenses.`;
  }
  const facts = renderTripFacts(effect);
  const tail = facts.length === 0 ? '.' : ` (${facts.join(', ')}).`;
  const segments = renderSegments(effect.segments);
  if (effect.name === undefined) {
    const listing = segments === '' ? '' : `: ${segments}`;
    return `One trip will be recorded on the trip register${listing}${tail}`;
  }
  if (effect.segments.length === 0) {
    // A named trip whose answer carries no segments yet: no dangling "0 segments" listing.
    return `Trip "${effect.name}" will be recorded on the trip register${tail}`;
  }
  const noun = effect.segments.length === 1 ? 'segment' : 'segments';
  return `Trip "${effect.name}" will be recorded on the trip register: ${effect.segments.length.toString()} ${noun}: ${segments}${tail}`;
}

const TRAVEL_WORDING: Record<TripTravel, string> = {
  own_car: 'by own car',
  flew: 'by air',
  train_or_bus: 'by train or bus',
  rental_car: 'by rental car',
  rideshare: 'by rideshare or taxi',
};

const NO_COST_WORDING: Record<TripNoCostGap, string> = {
  lodging: 'no hotel cost',
  fare: 'no fare',
  ride: 'no ride cost',
  baggage: 'no baggage cost',
  meal: 'no meal cost',
};

// The Trip log's facts as clauses, never an amount: how travelled and the vehicle, the miles, the
// personal days and the gaps with no cost; a cleared fact says so.
function renderTripFacts(effect: TripRegisterEffect): string[] {
  const clauses: string[] = [];
  const vehicle = effect.vehicleName === undefined ? '' : ` (${effect.vehicleName})`;
  if (effect.travel === null) clauses.push('how you travelled cleared');
  else if (effect.travel !== undefined) clauses.push(`${TRAVEL_WORDING[effect.travel]}${vehicle}`);
  else if (effect.vehicleName !== undefined) clauses.push(`by car${vehicle}`);
  if (effect.vehicleKey === null) clauses.push('vehicle cleared');
  if (effect.miles === null) clauses.push('miles cleared');
  else if (effect.miles !== undefined) {
    clauses.push(`${effect.miles.toString()} ${effect.miles === 1 ? 'mile' : 'miles'}`);
  }
  if (effect.personalDays === null) clauses.push('personal days cleared');
  else if (effect.personalDays !== undefined) {
    clauses.push(
      effect.personalDays.length === 0
        ? 'no personal days'
        : `personal days: ${effect.personalDays.join(', ')}`,
    );
  }
  if (effect.noCost === null) clauses.push('no-cost marks cleared');
  else if (effect.noCost !== undefined) {
    for (const gap of effect.noCost) clauses.push(NO_COST_WORDING[gap]);
  }
  return clauses;
}

const CORRECTION_FIELD_WORDING: Record<ReadingCorrectionField, string> = {
  total: 'total',
  document_date: 'date',
  vendor_or_payer: 'vendor',
  currency: 'currency',
};

// One clause per corrected field, page by page: `Page 1: total 412.00 → 41.20; vendor HOME DEPOT
// #4521 → Home Depot`. The reader's `from` is model text, so the consumers re-gate the sentence
// like every pending wording; the web wrote the effect only after the whole reading passed that gate.
function renderReadingCorrection(effect: ReadingCorrectionEffect): string {
  return effect.pages
    .map((page) => {
      const clauses = READING_CORRECTION_FIELDS.flatMap((field) => {
        const correction = page[field];
        if (correction === undefined) return [];
        const from = correction.from === null ? 'could not be read' : correction.from;
        return [`${CORRECTION_FIELD_WORDING[field]} ${from} → ${correction.to}`];
      });
      return `Page ${page.page.toString()}: ${clauses.join('; ')}`;
    })
    .join('. ');
}

// One clause per corrected field, in the order amount, date, vendor. The vendor's `from` is
// document-derived text, so the consumers re-gate the sentence like every pending wording.
function renderLineCorrection(effect: LineCorrectionEffect): string {
  const clauses: string[] = [];
  if (effect.amount !== undefined) {
    clauses.push(
      `amount ${effect.amount.from ?? 'none'} ${effect.currency} → ${effect.amount.to} ${effect.currency}`,
    );
  }
  if (effect.date !== undefined) {
    clauses.push(`date ${effect.date.from ?? 'none'} → ${effect.date.to}`);
  }
  if (effect.vendor !== undefined) {
    clauses.push(`vendor ${effect.vendor.from ?? 'no vendor'} → ${effect.vendor.to}`);
  }
  return `This line: ${clauses.join('; ')}`;
}

const PROFILE_FACT_DAY_WORDING = {
  fair_rental_days: 'fair rental days',
  personal_use_days: 'personal-use days',
  stay_count: 'stays',
} as const;

function renderProfileFact(effect: ProfileFactEffect): string {
  const { fact } = effect;
  switch (fact.field) {
    case 'fair_rental_days':
    case 'personal_use_days':
    case 'stay_count':
      return `${effect.name}: ${PROFILE_FACT_DAY_WORDING[fact.field]} recorded as ${String(fact.value)}.`;
    case 'services_note':
      return `${effect.name}: services recorded as \u201c${fact.value}\u201d.`;
    case 'home_office':
      return `${effect.name}: home office recorded as ${fact.office_sq_ft} sq ft of a ${fact.home_sq_ft} sq ft home.`;
    case 'miles': {
      const total = fact.bands.reduce((sum, band) => sum + band.miles, 0);
      const parts = fact.bands.map(
        (band) => `${String(band.miles)} from ${band.from} to ${band.to}`,
      );
      return `${effect.name}: business miles recorded as ${String(total)} (${parts.join('; ')}).`;
    }
  }
}

/** What a `none` effect promises: nothing in the books moves. Review's reply to such an answer
 *  says so (apps/web/lib/review.ts, `answerReply`). */
export const NONE_PENDING_WORDING = 'Books are unchanged; this answer is noted for review only.';

/**
 * The display wording of a pending effect: a pure function of the payload, deterministic and
 * free of model text, run-minted identifiers and derived figures, with exceptions that embed
 * stored text: a reading correction embeds the reader's raw `from` beside the person's `to`.
 * Named trips and segment locations embed stored text, so this wording is not exempt from the display scan by
 * construction: both consumers re-gate the rendered sentence before a person sees it (the web
 * app's `displayGateCode`, over the review screen's rendered text and the trips screen's pending
 * sentence), and a tripped gate withholds it whole.
 */
export function renderPendingEffect(effect: Effect): string {
  switch (effect.kind) {
    case 'ledger':
      return renderLedger(effect);
    case 'entity_register':
      return renderEntityRegister(effect);
    case 'asset_register':
      return renderAssetRegister(effect);
    case 'trip_register':
      return renderTripRegister(effect);
    case 'reading_correction':
      return renderReadingCorrection(effect);
    case 'line_correction':
      return renderLineCorrection(effect);
    case 'profile_fact':
      return renderProfileFact(effect);
    case 'entity_fold':
      return effect.reservedName === true
        ? `${effect.fromName} will be folded into ${effect.toName}, which then also goes by ${effect.fromName}; statements that name only ${effect.fromName} will still be asked about.`
        : `${effect.fromName} will be folded into ${effect.toName}, which then also goes by ${effect.fromName}.`;
    case 'attach_receipt':
      return effect.to.type === 'trip'
        ? "The receipt will be recorded with the trip you chose and its costs on that trip's days will be tied to it."
        : 'The receipt will be recorded as the document behind the line you chose, and nothing new will be booked from it.';
    case 'none':
      return NONE_PENDING_WORDING;
  }
}

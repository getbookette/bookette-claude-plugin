/**
 * Gate the books run outputs in <workspace>/out.
 *
 * The checks, per SKILL.md step 8, each reported with a typed code:
 *
 * 1. Identifiers (`identifier`): no line in any out file is shaped like an
 *    individual TIN, and no question or finding string carries an identifier or
 *    URL shape. Reports file/line or field paths only, never the matched value.
 * 2. Policy (`policy`): no question prompt, option label, cite or finding
 *    message carries a word from rules/policy.md's list, nor does any other
 *    model-written string an importer keeps (issue #1035) - every string and
 *    key of a ledger line, a contribution, a home cost and a tax payment but
 *    its files, dates and amounts, a change's new value, a document's notes,
 *    and what the resolved profile adds - save a name copied as the document
 *    prints it (a vendor, a payer, an organization, an entity's name; decision
 *    record 0011's 2026-10-13 amendment); or a finding message carries a money
 *    figure (11.13; ADR 0104 item 3). Names the path, never the word or the
 *    figure.
 * 3. Schema (`schema`): the files the workflow requires exist with the shape
 *    SKILL.md contracts - lists of objects carrying the documented keys,
 *    objects where an object is documented, every ledger status one of the
 *    three words the skill's ledger-status module exports - and this batch's
 *    coverage: every
 *    unique inbox document has a documents.json entry, and every entry names a
 *    document in this batch's inbox/. A question key must be in the skill's
 *    question_catalog.json, and every option a string id and a typed effect the
 *    key allows. profile.resolved.json's trips carry the shapes the import
 *    gate holds: an entry object with a non-empty name, one entity string, a
 *    non-empty segments list of dated locations that yield a locality, and no
 *    repeated trip or entity key or trip name. Every `entity_register` option
 *    is one the confirmation's applier would accept (0123, issue #907 part B):
 *    its name and share pass the declaration's validator, its schedule is its
 *    kind's, its name folds onto no staged entity's and no other option's under
 *    another key, and no second question offers its key.
 * 4. Contract (`invariant`): on an incremental run (confirmed/summaries.json
 *    exists) out/ledger.json holds only additions sorting past the highest
 *    id the digest carries, confirmed `items` and `held` rows alike; every ledger_changes.json entry names a digest id, carries
 *    the confirmed baseline where the digest has one, and is armed by an
 *    answer or a batch document - never, for a vendor, date or amount, by the
 *    document the changed item's own source_file names, since a re-read of
 *    the line's own document is a finding (`reread_is_a_finding`, issue #984); every web_values.json entry is well formed,
 *    addresses a key the rules data does not carry, applies inside its own
 *    effective period, and does not contradict the confirmed record without
 *    an answer key; every `applies_to` `trip:<key>` names a trip in
 *    profile.resolved.json; and, when profile.json stages entities, every
 *    resolved entity is one it stages by key or by name, since a run never
 *    adds one.
 * 5. Originals (`schema`, task 11.9): a workspace whose staging carries no
 *    originals - no `inbox/` holding files, every `extractions/*.json` stem a
 *    `doc_<id>` token, the product bundle's shape - may name a document only
 *    by a name its staging carried. An output reference to an `inbox/...`
 *    path that is neither a batch name (by basename or basename minus one
 *    extension) nor a `source_file` the confirmed digest handed the run is
 *    the fingerprint of a run that saw an original. Every structured
 *    reference is scanned: the ledger's and donations' `source_file`, the
 *    inventory's `file` and `duplicate_of`, the documents' `file` and
 *    `near_duplicate_of` status, a change's arming `source_file` and
 *    `source_file` `to`, and the questions' and findings' `cites`. Dormant
 *    wherever originals are staged: the eval path and the inbox-carrying
 *    recorded corpora keep their contract. There, the converse holds: a
 *    booked row names an original by its inbox path, never its
 *    reading's stem (`source_file_not_inbox_path`, issue #1558).
 * 6. Upload hint (`invariant`, issue #900): a ledger addition booked from a
 *    reading whose file carries a code-built `hint_entity` carries that entity
 *    or none, unless its `answer_keys` names an answer in which the person
 *    chose that place. A document that names another of the person's places is left
 *    unassigned and asked about (SKILL.md step 3), never booked there silently.
 *    The problem is `hint_entity_mismatch`, naming the item's index and the
 *    reading's file, never an entity.
 * 7. Trips (`invariant`, issue #1068, decision record 0132): the trips the run records from the
 *    documents, the trips a found place carries, the person's trip edits and the travel home
 *    hold their contract (trip_gates.ts names each gate).
 * 8. Sort request (`invariant`, issue #1249): a run that stages `waiting_lines.json` acts on at
 *    least one of its lines no live placement, register or `pass_through` answer cites (issue
 *    #1257) - a question cites it, or
 *    its document without its lines, or a ledger change moves it to a place - unless every such
 *    line is trip- or vehicle-tied, or a travel line no trip ties (issue #1257), and an
 *    `entity_unestablished` finding cites it. The problem is `waiting_lines_unasked`, naming the
 *    count only.
 * 9. Answers applied (`invariant`, issue #1257): a live placement or register answer whose option
 *    places lines on an entity leaves no cited line unassigned in the digest without this run's
 *    `entity` change, except where reference/steps/5-apply.md defers the move
 *    (`answerUnappliedProblems` names each case); and an answer to a stored placement that moved its
 *    lines elsewhere, or un-placed them, is written onto each cited line (issue #1384); on a rebuild
 *    whose answers the importer pairs with its lines, each such line sits where its answer put it
 *    (issue #1537); a line a later move or placement answer decides owes an earlier answer nothing
 *    (`laterWordCites`). The problem is `answer_unapplied`, naming the count only.
 * 10. Stored placements (`schema` and `invariant`, issue #1384, decision record 0150): an option
 *    marked `"placed": true` rides only a run whose `review_mode.json` stages `sort_then_show`,
 *    never a key already asked, only an `open_` placement question, only as its first option and
 *    a `ledger`/`entity` one, and only when every line the question asks about is this run's confirmed addition, booked on that
 *    option's place, tied to no trip or vehicle and no income line (`placedQuestionProblems`). The
 *    problems are `placed_question`, naming the item and the rule, never a line or a value.
 * 11. Travel lines asked (`invariant`, issue #1563, decision record 0160): a meal or travel-line
 *    expense this run books with no place, no trip and no receipt attached to a trip is cited by a
 *    question or a live placement answer, or waits under an `entity_unestablished` finding while the
 *    run asks its cap or no place is staged (`travelLinesUnaskedProblems`). The problem is
 *    `travel_line_unasked`, naming the count only.
 * 12. No placement without a pointer (`invariant`, issues #1591 and #1628): a placement question
 *    carrying no trip that cites a line no pointer ties to a staged place, or whose recommended or
 *    placed option books its lines on a place no pointer of theirs names, is refused, and so is a
 *    placed option beside a pointer to another place (`unpointedPlacementProblems`,
 *    scripts/placement_pointer.ts). A pointer is a staged fact code finds, or a quote the agent
 *    writes on the option, `{document|note|answer, quote}`, found verbatim in that source and
 *    tied to the place by out/places.json's standard address or a shared word. The problems are
 *    `placement_unpointed`, naming the count only; `placement_pointer_malformed` and
 *    `placement_pointer_unquoted` (`schema`), naming the question and option indices; and
 *    `places_unwritten` and `places_malformed` (`schema`) for out/places.json, naming counts.
 * 13. Typed readings (`invariant`, issue #1766): what a run takes from a reading the person typed
 *    (its pages' code-built `typed_by_person`) - ledger lines, donations, home costs, the payments
 *    it evidences - adds up to their typed total
 *    (`typed_total_unmatched`), and one leaving its vendor or date not given is cited by a note
 *    (`typed_reading_unstated`); both name the reading's file, never a figure.
 *
 * Exits 1 on any problem. Problems name files, keys, indices and shapes,
 * never content values.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, join, relative, sep } from 'node:path';

import {
  answeredTrips,
  CodeAppliedError,
  codeAppliedChanges,
  correctionGuardedSlots,
  EFFECT_ARMED_FIELDS,
  isCodeApplied,
  optionEffectOf,
  TRIP_TRAVEL_LINES,
  type CodeAppliedRow,
  type StagedAnswer,
} from '../code-applied';

export type { StagedAnswer };

import { listFiles } from '../files';
import { isValidDay } from '../dates';
import { parseDec, readingTotalCents } from '../money';
import { normalizeParcel } from '../parcels';
import {
  addressFold,
  placesFileOf,
  sameStandardAddress,
  sameStandardForm,
  stagedKeyAliases,
  type StandardAddress,
} from '../place-addresses';
import { printedFieldsOf, readingAddressesOf, type ReadingAddress } from '../reading-addresses';
import {
  ATTACH_RECEIPT_KEY_PREFIX,
  CORRECT_CATEGORY_KEY_PREFIX,
  CORRECT_LINE_KEY_PREFIX,
  CORRECT_READING_KEY_PREFIX,
  MOVE_LINES_KEY_PREFIX,
  PROFILE_FACT_KEY_PREFIX,
  READING_CORRECTION_LEDGER_FIELD,
  parseEffect,
} from '../effects';
import type { Effect, EntityRegisterEffect, LedgerEffect } from '../effects';
import {
  DECLARED_ADDRESS_MAX_LENGTH,
  DECLARED_ALIAS_MAX_LENGTH,
  DECLARED_ALIASES_MAX_COUNT,
  DECLARED_LISTING_MAX_LENGTH,
  DECLARED_LISTINGS_MAX_COUNT,
  entityNameKey,
  LISTING_ID_MIN_DIGITS,
  listingDigits,
  listingIdLongEnough,
  listingKey,
  listingTextProblem,
  personTextProblem,
  scheduleOfKind,
  validateDeclaredEntity,
} from '../declared-entity';
import { documentStatus, isYearForm } from '../document-status';
import { findingKindOf } from '../finding-kinds';
import { RUN_SUMMARY_FILE, RUN_SUMMARY_MAX_LENGTH, runSummaryOf } from '../run-summary';
import { ledgerItemStatus } from '../ledger-status';
import { rulesYearOf, type RulesYearCode } from '../rules-year';
import {
  MAX_QUESTIONS_PER_RUN,
  askedQuestionCount,
  isOpenPlacementKey,
  placedOptionOf,
  UNPLACING_OPTION_IDS,
  OPEN_QUESTION_KEY_PREFIX,
  PASS_THROUGH_FACT,
  PER_DOCUMENT_OPTION_ID,
  PLACEMENT_QUESTION_KEY_PATTERN,
  QUESTION_PROMPT_MAX_LENGTH,
  QUESTION_HELP_MAX_LENGTH,
  questionHelpOf,
  UNASSIGNED_LINE_ENTITY_KEY,
  citedDocument,
  hashSubject,
  isOpenQuestionKey,
  keyWords,
  parseOpenQuestionKey,
  placeSubject,
  profileKeySubject,
  questionDisplayStrings,
  spellOpenQuestionKey,
  stagedEntityNames,
  treatmentChoiceOf,
} from '../question-keys';
import type { KeyContext, OpenQuestionSubject } from '../question-keys';
import {
  keyContextOf,
  keyFlagOf,
  parseOpenFacts,
  questionEffects,
  questionFactOf,
  type WorkspaceKeyContext,
} from './question_keys';
import { assignLedgerIds, idNumber, knownLedgerIds, ledgerHighWater } from '../ledger-ids';
import {
  placesNamed,
  statesPurchase,
  typedFigures,
  type NamedPlace,
  type TypedFigures,
} from '../typed-figures';
import { unpointedPlacementProblems } from './placement_pointer';
import { stagedAddressHoldersOf } from './staged_addresses';
import { printsCityAwayFromHome, PROPERTY_PROFILE_KINDS, tripGateProblems } from './trip_gates';
import { passThroughTieOf, type PassThroughTie } from '../pass-through-tie';
import { stopLocality } from '../trip-facts';
import { policyFilePhrases } from '../policy-file';
import { bannedPolicyPhrases, lineCarriesIndividualTin } from '../scan';
import { ASSET_KINDS, assetKindOf } from '../capital-costs';
import { VEHICLE_METHODS } from '../vehicle-methods';
import { waitingLineIds } from '../waiting-lines';
import { reviewModeOf } from '../review-mode';
import { withRecordedFacts } from './profile';
import { HOME_COST_KINDS, HOME_COST_USES } from '../home-office';
import { atMostTwoDecimals, homeAreaWithinColumn, loadHomeOfficeReadings } from './home_office';
import { loadTaxPaymentsResolution, readTaxPayments } from './tax_payments';
import { absoluteCents, isoDate, readingNameOf, sameDocument, stemOf } from './inventory';
import { readCsvText } from '../sheet-text';
import {
  EXPORT_ROW_DISPOSITIONS,
  EXPORT_ROW_WINDOW_DAYS,
  EXPORT_ROWS_FILE,
  type ExportRowDisposition,
} from '../export-rows';
import { exportTableOf, hasDatedRecord, readExportTable, sheetRecords } from '../export-table';
import {
  computeStatementFigures,
  statementBlockOf,
  statementDocumentOf,
} from '../platform-statements';
import {
  foldForScan,
  hasUrlShape,
  moneyFigureClasses,
  scanForIdentifiers,
} from '@bookette/identifier-scan';
import {
  foldValueKey,
  parsePeriod,
  parseValueKey,
  periodCovers,
  periodsOverlap,
  type Period,
  readWebValues,
  rulesIndex,
  sameCitation,
} from '../web_values';

// The keys SKILL.md steps 2 and 3 document for these two files; skill-doc.spec.ts compares the
// step-2 example entry's keys to DOCUMENT_KEYS.
export const DOCUMENT_KEYS = ['file', 'doc_type', 'fields', 'confidence', 'status', 'notes'];
export const LEDGER_KEYS = [
  'id',
  'source_file',
  'date',
  'vendor',
  'description',
  'kind',
  'amount',
  'currency',
  'entity',
  'schedule',
  'line',
  'trip',
  'meal',
  'tag',
  'confidence',
  'status',
];

/** The fields a model could write to order its questions; Review orders them by code (0166). */
const QUESTION_RANK_FIELDS = ['rank', 'priority', 'order', 'tier'] as const;

// A ledger change names the confirmed item, the field, the new value and - for
// the fields the digest carries - the baseline it is changing. `from` is
// optional for line, tag, meal, entity and trip because the digest deliberately carries none
// of those (it carries a row's schedule and tie, never its placement), so a baseline cannot be
// checked. `schedule` is not changeable at all (issue #680): it follows the entity.
const REQUIRED_CHANGE_KEYS = ['id', 'field', 'to'];
const CHANGEABLE_FIELDS = [
  'amount',
  'date',
  'vendor',
  'source_file',
  'line',
  'tag',
  'meal',
  'entity',
  'trip',
  // The settled marker (issue #1153): `to` is `true`, and only an answered pass_through question's
  // `inside` answer arms it (settledChangeProblems).
  'settled',
];
const BASELINE_FIELDS = ['amount', 'date', 'vendor', 'source_file'];

// One web value: the rules data's own address of one scalar field, its
// citation, the value, the period the source states, what it applies to, and
// the answers that may change it.
export const WEB_VALUE_KEYS = [
  'key',
  'url',
  'fetched_at',
  'quoted_text',
  'value',
  'effective_period',
  'applies_to',
  'answer_keys',
];
// The confirmed item digest: enough to detect a cross-batch duplicate. It carries the row's
// schedule (C, E, K1, or null when unassigned) and whether a trip or vehicle ties it, both derived
// from Postgres (issue #680), so a move onto another schedule is visible to the sandbox, and its
// line (issue #1257), so a confirmed travel line no trip ties is read as an addition's is. Seeing
// the line re-opens no line choice: a `line` change is armed only by an answer or a batch
// document, as before.
const DIGEST_KEYS = [
  'id',
  'date',
  'vendor',
  'amount',
  'source_file',
  'answer_keys',
  'schedule',
  'line',
  'tied',
];
const DIGEST_SCHEDULES = ['C', 'E', 'K1'];

// What the workflow must produce: JSON lists of objects, JSON objects, and the two
// files with per-item key contracts. questions.json may be absent (a run can end
// with no open questions) but is a list when present; donations.json may be absent
// (a run can end with nothing listed) and is a list of documented entries when present.
const REQUIRED_LISTS = ['findings.json'];
const REQUIRED_OBJECTS = ['inventory.json', 'profile.resolved.json', 'books.json'];
const REQUIRED_DOCUMENTS = 'documents.json';
const REQUIRED_LEDGER = 'ledger.json';
const OPTIONAL_LISTS = ['questions.json'];
const OPTIONAL_DONATIONS = 'donations.json';
const OPTIONAL_TAX_PAYMENTS = 'tax_payments.json';
const OPTIONAL_HOME_COSTS = 'home_costs.json';

// The keys SKILL.md step 3 documents for one listed contribution. The listing
// carries facts only; no figure is computed from it.
const DONATION_KEYS = [
  'organization',
  'date',
  'amount',
  'currency',
  'form',
  'goods_services_amount',
  'source_file',
];

/** A string parseDec accepts, the same acceptance the ledger's amounts get. */
function isDecimalString(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    parseDec(value);
    return true;
  } catch {
    return false;
  }
}

type Json = Record<string, unknown>;

export type ProblemCode = 'schema' | 'identifier' | 'policy' | 'invariant' | RulesYearCode;
export type Problem = { code: ProblemCode; message: string };

export type CheckResult = { problems: Problem[]; notices?: Notice[] };

/** The staged year's rules directory, as `rulesYearOf` resolved it. */
type YearRules = { readonly year: number; readonly dir: string; readonly label: string };

function problem(code: ProblemCode, message: string): Problem {
  return { code, message };
}

/**
 * Adds a stated parcel to the exempt set in three spellings: normalized the way Abacus normalizes
 * it, as written (trimmed), and as a JSON string escapes it. The out/ lines hold the raw spelling
 * and the line scan reads a spaced `041 32 1234` as an SSN shape, so a normalized-only mask would
 * refuse a bill's own parcel and bring back issue #110's deadlock.
 */
function addParcel(parcels: Set<string>, raw: string): void {
  const normalized = normalizeParcel(raw);
  if (normalized === '') return;
  parcels.add(normalized);
  const written = raw.trim();
  if (written === '') return;
  parcels.add(written);
  // The out/ lines are JSON text, so a parcel with a backslash or a quote sits there escaped.
  parcels.add(JSON.stringify(written).slice(1, -1));
}

/**
 * The parcel numbers a staged tax payment states, normalized the way Abacus normalizes them
 * (issue #110). A parcel number stated on the bill is data the run must carry verbatim - the
 * masking below exempts exactly these strings, and nothing else.
 */
function statedParcelsOf(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const parcels = new Set<string>();
  for (const raw of value) {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) continue;
    const entry = raw as Json;
    for (const rawParcel of Array.isArray(entry.parcels) ? entry.parcels : []) {
      if (typeof rawParcel !== 'object' || rawParcel === null || Array.isArray(rawParcel)) continue;
      const number = (rawParcel as Json).number;
      if (typeof number === 'string') addParcel(parcels, number);
    }
    for (const ref of Array.isArray(entry.covered_parcels) ? entry.covered_parcels : []) {
      if (typeof ref === 'string') addParcel(parcels, ref);
    }
  }
  return [...parcels];
}

/**
 * The parcel numbers the profile's entities state on their `parcels` arrays, through the same
 * normalization (issue #110): an incremental batch stages the entity's parcels before any
 * payment file exists, and the bill's stated number is data on the entity too.
 */
function entityParcelsOf(value: unknown): string[] {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return [];
  const entities = (value as Json).entities;
  if (!Array.isArray(entities)) return [];
  const parcels = new Set<string>();
  for (const raw of entities) {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) continue;
    const listed = (raw as Json).parcels;
    for (const parcel of Array.isArray(listed) ? listed : []) {
      if (typeof parcel !== 'string') continue;
      addParcel(parcels, parcel);
    }
  }
  return [...parcels];
}

function identifierProblems(workspace: string): Problem[] {
  const out = join(workspace, 'out');
  const problems: Problem[] = [];
  // A bill's stated parcel numbers are masked out before the line scan - as a staged payment
  // states them and as a profile entity records them, since an incremental batch carries the
  // entity's parcels before any payment file exists - so a parcel whose shape a TIN pattern
  // would otherwise catch never fails its own run; the patterns themselves are untouched, and
  // the same shape anywhere else still refuses.
  // The longest strings are masked first, so a parcel that contains another is masked whole.
  const parcels = [
    ...new Set([
      ...statedParcelsOf(readTaxPayments(workspace)),
      ...entityParcelsOf(loadJson(join(out, 'profile.resolved.json'))),
    ]),
  ].sort((first, second) => second.length - first.length);
  // Residual, waived by the founder in 11.6: the mask is a substring replace, so a stated parcel
  // such as `45` also masks that substring elsewhere in a line.
  const mask = (text: string): string =>
    parcels.reduce((masked, parcel) => masked.split(parcel).join('[parcel]'), text);
  for (const path of listFiles(out).sort()) {
    const lines = readFileSync(path, 'utf8').split('\n');
    for (const [index, line] of lines.entries()) {
      // Each line is scanned as written and with its `\uXXXX` escapes decoded, under the same
      // mask: a JSON writer that escapes non-ASCII (Python's `ensure_ascii`) would otherwise hide
      // `\u0661\u0662\u0663-...` Arabic-Indic digits as ASCII.
      if (lineCarriesIndividualTin(line, mask)) {
        problems.push(problem('identifier', `${relative(workspace, path)}:${String(index + 1)}`));
      }
    }
  }
  return problems;
}

/** A string Postgres cannot store: it carries a NUL, or a UTF-16 surrogate left unpaired. */
function unstorableAdvice(text: string): string | null {
  if (text.includes('\0')) return 'remove the NUL character (U+0000)';
  if (!text.isWellFormed()) return 'remove the unpaired surrogate (a lone \\uD800-\\uDFFF escape)';
  return null;
}

/**
 * Postgres cannot store every string a JSON file can carry, and the importer stores the model's
 * strings and object keys from the out/ JSON files, so one of them would pass every other gate and
 * fail the import transaction with a driver error. Two of those errors were observed by the gate's
 * mutation check: a NUL in a text column is `invalid byte sequence for encoding "UTF8": 0x00`, and
 * a lone surrogate escape in jsonb is `invalid input syntax for type json`; the db suite pins the
 * third, a NUL in jsonb refused with SQLSTATE 22021 (`database.spec.ts`).
 * Both are refused here, where the sandbox and the importer's re-check both run. A raw NUL byte
 * makes the file unparseable, so it is named by file; an escaped one (`\u0000`) or a lone surrogate
 * is found in the parsed value, in a string or an object key, and named by file and item path
 * (walkStrings' path, with identifier-shaped or unstorable keys masked). Problems never carry the
 * string.
 */
function nulProblems(workspace: string): Problem[] {
  const problems: Problem[] = [];
  for (const path of listFiles(join(workspace, 'out')).sort()) {
    if (!path.endsWith('.json')) continue;
    const file = relative(workspace, path);
    const text = readFileSync(path, 'utf8');
    if (text.includes('\0')) {
      problems.push(
        problem(
          'invariant',
          `${file} carries a raw NUL character; remove the NUL character (U+0000) and write the file again`,
        ),
      );
      continue;
    }
    walkStrings(
      loadJson(path),
      '$',
      (value, at) => {
        const advice = unstorableAdvice(value);
        if (advice !== null) {
          problems.push(
            problem('invariant', `${file} ${at} carries a string Postgres cannot store; ${advice}`),
          );
        }
      },
      (key, at) => {
        const advice = unstorableAdvice(key);
        if (advice !== null) {
          problems.push(
            problem(
              'invariant',
              `${file} ${at} carries an object key Postgres cannot store; ${advice}`,
            ),
          );
        }
      },
    );
  }
  return problems;
}

function loadJson(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

function listSchemaProblems(out: string, name: string, itemKeys: string[] | null): Problem[] {
  const path = join(out, name);
  if (!existsSync(path)) return [problem('schema', `missing required output ${name}`)];
  const value = loadJson(path);
  if (!Array.isArray(value)) {
    return [
      problem(
        'schema',
        `${name} must be a JSON list${value === null ? ', not valid JSON' : `, got ${typeName(value)}`}`,
      ),
    ];
  }
  if (itemKeys === null) return [];
  const problems: Problem[] = [];
  for (const [index, item] of value.entries()) {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) {
      problems.push(problem('schema', `${name} item ${String(index)} must be an object`));
      continue;
    }
    const missing = itemKeys.filter((key) => !(key in (item as Json)));
    if (missing.length > 0) {
      problems.push(
        problem('schema', `${name} item ${String(index)} is missing keys: ${missing.join(', ')}`),
      );
    }
  }
  return problems;
}

// The keys an addition may carry beside LEDGER_KEYS: the line's vehicle tie and the answer keys
// that armed it (SKILL.md steps 3 and 5). Nothing else, and never `settled` (issue #1153): only an
// answered pass_through question's `inside` answer settles a line, as a change, at import.
export const LEDGER_OPTIONAL_KEYS = ['vehicle', 'answer_keys'];
const CHANGE_KEYS = ['id', 'field', 'from', 'to', 'answer_key', 'source_file'];

/**
 * The ledger contract's keys (issue #1153): an addition carries LEDGER_KEYS and the optional
 * vehicle and answer keys, nothing more, so a model-written `settled: true` can never drop a line
 * from the books; a change carries its own keys, and the settled marker only as its field. The
 * message names the item and, for a settled key, the rule; never another key's spelling.
 */
function ledgerKeyProblems(out: string): Problem[] {
  const problems: Problem[] = [];
  const allowed = new Set([...LEDGER_KEYS, ...LEDGER_OPTIONAL_KEYS]);
  for (const [index, item] of listOf(loadJson(join(out, REQUIRED_LEDGER))).entries()) {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) continue;
    const extra = Object.keys(item).filter((key) => !allowed.has(key));
    if (extra.length === 0) continue;
    problems.push(
      problem(
        'schema',
        extra.includes('settled')
          ? `${REQUIRED_LEDGER} item ${String(index)} carries settled; a line is settled only by an answered pass_through question's inside answer, as a change`
          : `${REQUIRED_LEDGER} item ${String(index)} carries keys the ledger contract does not list`,
      ),
    );
  }
  const changes = loadJson(join(out, 'ledger_changes.json'));
  for (const [index, change] of (Array.isArray(changes) ? (changes as unknown[]) : []).entries()) {
    if (typeof change !== 'object' || change === null || Array.isArray(change)) continue;
    if (Object.keys(change).some((key) => !CHANGE_KEYS.includes(key))) {
      problems.push(
        problem(
          'schema',
          `ledger_changes.json entry ${String(index)} carries keys a change does not list; the settled marker is a change's field, never a key of its own`,
        ),
      );
    }
  }
  return problems;
}

function typeName(value: unknown): string {
  if (value === null) return 'NoneType';
  if (Array.isArray(value)) return 'list';
  if (typeof value === 'object') return 'dict';
  if (typeof value === 'string') return 'str';
  return typeof value;
}

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string')
    : [];
}

function strOrNull(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

/**
 * The per-entry contract for an out/donations.json listing: each entry an object carrying
 * the documented fields, the way the ledger's and web values' per-item contracts report.
 * An absent file stays optional; a present one must be a list.
 */
function donationsProblems(out: string): Problem[] {
  const path = join(out, OPTIONAL_DONATIONS);
  if (!existsSync(path)) return [];
  const value = loadJson(path);
  if (!Array.isArray(value)) {
    return [
      problem(
        'schema',
        `${OPTIONAL_DONATIONS} must be a JSON list${value === null ? ', not valid JSON' : `, got ${typeName(value)}`}`,
      ),
    ];
  }
  const problems: Problem[] = [];
  for (const [index, raw] of value.entries()) {
    const name = `${OPTIONAL_DONATIONS} item ${String(index)}`;
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
      problems.push(problem('schema', `${name} must be an object`));
      continue;
    }
    const entry = raw as Json;
    const missing = DONATION_KEYS.filter((key) => !(key in entry));
    if (missing.length > 0) {
      problems.push(problem('schema', `${name} is missing keys: ${missing.join(', ')}`));
      continue;
    }
    if (typeof entry.organization !== 'string' || entry.organization.trim().length === 0) {
      problems.push(problem('schema', `${name} organization must be a non-empty string`));
    }
    if (typeof entry.date !== 'string' || !isValidDay(entry.date)) {
      problems.push(problem('schema', `${name} date must be an ISO day`));
    }
    if (!isDecimalString(entry.amount)) {
      problems.push(problem('schema', `${name} amount must be a decimal string`));
    }
    if (typeof entry.currency !== 'string' || entry.currency.trim().length === 0) {
      problems.push(problem('schema', `${name} currency must be a non-empty string`));
    }
    if (entry.form !== 'cash' && entry.form !== 'non_cash') {
      problems.push(problem('schema', `${name} form must be cash or non_cash`));
    }
    if (entry.goods_services_amount !== null && !isDecimalString(entry.goods_services_amount)) {
      problems.push(
        problem('schema', `${name} goods_services_amount must be a decimal string or null`),
      );
    }
    if (typeof entry.source_file !== 'string' || entry.source_file.trim().length === 0) {
      problems.push(problem('schema', `${name} source_file must be a non-empty string`));
    }
  }
  return problems;
}

/**
 * The currency codes the fx path can price: USD, which needs no rate, plus every code
 * `sources.json` names a rate file for - the same set `fx.lookupVendored` reads, so a payment in
 * a code outside it has no rate file to consult and would throw inside build_books
 * (`no exchange rate source for <code>`). `currencies.json` is the narrower refresh recipe of a
 * subset of these series and prices nothing by itself, so the shape gate refuses a payment in a
 * code sources.json does not carry and accepts every code it does.
 */
function knownCurrencies(rules: YearRules): Set<string> {
  const codes = new Set<string>(['USD']);
  const value = loadJson(join(rules.dir, 'fx', 'sources.json'));
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    for (const code of Object.keys(value)) codes.add(code.toUpperCase());
  }
  return codes;
}

/** The prefix of the out-of-year staged payment's problem (issue #1364). */
export const TAX_PAYMENT_OUTSIDE_YEAR = 'tax_payment_outside_year';

/**
 * The per-payment contract for an out/tax_payments.json staging (issue #110): the same
 * shape donations.json gets, plus the cross-file invariants. A ledger line whose
 * `source_file` is a document a staged payment names - its `payment_source` or its
 * `bill_source` (issue #770) - would book the tax twice, so it is refused - and so is a staged
 * payment whose document a source_file change's `to` names, the same citation once the change
 * applies and the arm that arms the carry-forward's escape. The parcel resolution runs here as it runs in build_books: a payment whose
 * parcel no profile entity claims, or whose receiving entity books no Schedule C or E lines,
 * must carry an `entity_unestablished` finding - the accountant's open item - and a payment
 * naming a covered parcel its own parcel list does not carry is refused as a staging error.
 * The carry-forward is checked, not trusted. An absent file is silence (issue #980): the
 * importer keeps every stored payment and the build computes from confirmed/tax_payments.json
 * through `readTaxPayments`, so nothing is dropped - except that a confirmed payment whose payment
 * evidence or bill a ledger line now cites would be recorded twice, so that silence is refused.
 * A present file is the complete set the build computes from, so every payment
 * confirmed/tax_payments.json carries must come back in it - the importer upserts by
 * payment_source and keeps the rows the output omits, which is why the gate exists - unless the
 * payment's document has moved to the ledger, the one correction path a ledger-citing line
 * opens. Only the payment evidence arms that escape, never the bill (issue #770): installments
 * share one bill, so a line citing it would otherwise drop every installment on it while the
 * importer keeps their stored rows. A line citing a confirmed payment's bill is refused both
 * ways, and the line is what goes. And a document cannot feed both a home cost and a payment,
 * staged or kept by silence: the overlap is refused as a double record.
 */
function taxPaymentsProblems(workspace: string, skillDir: string, rules: YearRules): Problem[] {
  const out = join(workspace, 'out');
  const path = join(out, OPTIONAL_TAX_PAYMENTS);
  const problems: Problem[] = [];
  const staged = existsSync(path);
  // The list the build computes from, by the name a refusal gives it: the written file, or the
  // confirmed payments its silence keeps (issue #980).
  const listName = staged ? OPTIONAL_TAX_PAYMENTS : `confirmed/${OPTIONAL_TAX_PAYMENTS}`;
  let value: unknown[] = [];
  if (staged) {
    const loaded = loadJson(path);
    if (!Array.isArray(loaded)) {
      return [
        problem(
          'schema',
          `${OPTIONAL_TAX_PAYMENTS} must be a JSON list${loaded === null ? ', not valid JSON' : `, got ${typeName(loaded)}`}`,
        ),
      ];
    }
    value = loaded;
  }
  const currencies = knownCurrencies(rules);
  const paymentSources = new Set<string>();
  // The payments an earlier run confirmed, by the exact spelling the carry-forward gate below
  // matches: one dated outside the tax year must come back, so it is not refused here.
  const carried = new Set<string>();
  const carriedRaw = loadJson(join(workspace, 'confirmed', OPTIONAL_TAX_PAYMENTS));
  for (const raw of Array.isArray(carriedRaw) ? carriedRaw : []) {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) continue;
    const source = strOrNull((raw as Json).payment_source);
    if (source !== null) carried.add(source);
  }
  for (const [index, raw] of value.entries()) {
    const name = `${OPTIONAL_TAX_PAYMENTS} item ${String(index)}`;
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
      problems.push(problem('schema', `${name} must be an object`));
      continue;
    }
    const entry = raw as Json;
    for (const field of PAYMENT_DOCUMENT_FIELDS) {
      if (namedDocument(entry, field) === null) {
        problems.push(problem('schema', `${name} ${field} must be a non-empty string`));
      }
    }
    if (typeof entry.payment_source === 'string') {
      if (paymentSources.has(entry.payment_source)) {
        problems.push(problem('schema', `${name} repeats an earlier payment_source`));
      }
      paymentSources.add(entry.payment_source);
    }
    if (typeof entry.date !== 'string' || !isValidDay(entry.date)) {
      problems.push(problem('schema', `${name} date must be an ISO day`));
    } else if (
      Number(entry.date.slice(0, 4)) !== rules.year &&
      !(typeof entry.payment_source === 'string' && carried.has(entry.payment_source))
    ) {
      // An installment paid outside the tax year is not staged (reference/situations.md); the
      // build lists one staged anyway and books nothing from it (decision record 0148). One an
      // earlier run confirmed passes: the carry-forward gate below requires it back, and the cut
      // books nothing from it.
      problems.push(
        problem(
          'invariant',
          `${TAX_PAYMENT_OUTSIDE_YEAR}: ${name} is paid outside the tax year; leave it out of ${OPTIONAL_TAX_PAYMENTS} and write an outside_tax_year finding citing its payment document (reference/situations.md)`,
        ),
      );
    }
    if (!isDecimalString(entry.amount)) {
      problems.push(problem('schema', `${name} amount must be a decimal string`));
    }
    if (typeof entry.currency !== 'string' || !currencies.has(entry.currency.toUpperCase())) {
      problems.push(problem('schema', `${name} currency is not a code the rate tables carry`));
    }
    if (!Array.isArray(entry.parcels) || entry.parcels.length === 0) {
      problems.push(problem('schema', `${name} parcels must be a non-empty array`));
    } else {
      for (const [parcelIndex, rawParcel] of entry.parcels.entries()) {
        const parcelName = `${name} parcel ${String(parcelIndex)}`;
        if (typeof rawParcel !== 'object' || rawParcel === null || Array.isArray(rawParcel)) {
          problems.push(problem('schema', `${parcelName} must be an object`));
          continue;
        }
        const parcel = rawParcel as Json;
        if (typeof parcel.number !== 'string' || parcel.number.trim().length === 0) {
          problems.push(problem('schema', `${parcelName} number must be a non-empty string`));
        }
        if (parcel.amount !== null && !isDecimalString(parcel.amount)) {
          problems.push(problem('schema', `${parcelName} amount must be a decimal string or null`));
        }
      }
    }
    if (
      !Array.isArray(entry.covered_parcels) ||
      entry.covered_parcels.some((ref) => typeof ref !== 'string')
    ) {
      problems.push(problem('schema', `${name} covered_parcels must be a list of strings`));
    }
  }
  // The resolution the build computes is the gate's input too (issue #110). A parcel no
  // entity claims, and a receiving entity outside Schedules C and E, owe an
  // entity_unestablished finding - the kind alone, the way the home-office gate reads
  // findings.json - and a covered parcel the payment's own list does not carry is a staging
  // error, refused without one. The residual the gate leaves: a payment whose covered parcel
  // carries no positive stated amount books nothing with no open item - the build's own
  // warning stands, and the agent is told to copy the bill's stated figures. On silence the
  // resolution runs over the confirmed payments the build computes from (issue #980), so a
  // carried payment a changed profile leaves unclaimed still owes its finding.
  const resolution = loadTaxPaymentsResolution(workspace, skillDir);
  const findings = loadJson(join(out, 'findings.json'));
  const hasEntityUnestablished =
    Array.isArray(findings) &&
    findings.some(
      (raw) =>
        typeof raw === 'object' &&
        raw !== null &&
        !Array.isArray(raw) &&
        (raw as Json).kind === 'entity_unestablished',
    );
  const mailingNoteCites = mailingAddressNoteCitesOf(findings);
  const parcelAnchors = parcelAnchorsOf(workspace);
  for (const [index, payment] of resolution.payments.entries()) {
    if (payment.outcome === 'covered_parcel_not_in_bill') {
      problems.push(
        problem(
          'schema',
          `${listName} item ${String(index)} covers a parcel the payment's own parcel list does not carry`,
        ),
      );
      continue;
    }
    if (
      (payment.outcome === 'parcel_unclaimed' || payment.outcome === 'entity_off_schedule') &&
      !hasEntityUnestablished
    ) {
      problems.push(
        problem(
          'schema',
          payment.outcome === 'parcel_unclaimed'
            ? `${listName} item ${String(index)} stages a payment whose parcel no entity claims, so findings.json must carry an entity_unestablished finding`
            : `${listName} item ${String(index)} stages a payment whose receiving entity is outside Schedules C and E, so findings.json must carry an entity_unestablished finding`,
        ),
      );
    }
    const bill = payment.billSource;
    const owedPlace =
      payment.outcome === 'parcel_unclaimed' && bill !== null
        ? parcelClaimOwedPlace(workspace, parcelAnchors, bill, payment.parcelNumbers)
        : null;
    if (owedPlace !== null && !mailingNoteCites.some((cite) => sameDocument(bill ?? '', cite))) {
      problems.push(
        problem(
          'schema',
          `${PARCEL_CLAIM_OWED}: ${listName} item ${String(index)} stages a payment whose parcel no entity claims while its bill prints the address of the staged place ${owedPlace}, which claims none of the bill's parcels; put the bill's parcel numbers on that entity's parcels in out/profile.resolved.json (reference/steps/5-apply.md), or, only when that address is the owner's mailing address and not the property's location, write a note finding citing the bill whose message begins \`${MAILING_ADDRESS_NOTE}\``,
        ),
      );
    }
  }
  // The carry-forward over a present file, by the exact payment_source spelling: the importer
  // upserts each staged
  // payment by that string and keeps the rows the output omits, so a folded match (confirmed
  // `doc_12` against staged `inbox/doc_12.pdf`) would stage a re-spelled duplicate beside the
  // stored row and book the tax twice on the next run. Run-bundle stages the confirmed file
  // verbatim from the stored rows, so re-staging the carried spelling verbatim always passes,
  // and the refusal names the missing item. The one escape is the correction path: a ledger
  // line now citing the payment's evidence (its payment_source). A confirmed payment mis-staged on the home's bill
  // can move to the ledger as a home cost's citing line, and the importer upserts and never
  // deletes payment rows while no product path retires one, so without the escape the
  // mis-staging would be permanent. A staged payment beside a citing line is still refused by
  // the not-twice walk below, so the escape books the tax exactly once. The bill never arms it
  // (issue #770): one bill carries every installment, and the importer keeps the stored row of
  // a payment the output omits, so a line citing the bill would lose each installment from the
  // books while keeping the wrong line.
  //
  // An absent file is silence (issue #980): the importer writes nothing and keeps every stored
  // row, and the build computes from the confirmed payments, so the walk has nothing to check -
  // except a confirmed payment a ledger line now cites, on any of the three surfaces, which the
  // kept payment would book a second time. Cited by its payment evidence, the correction path
  // above is open: write the file without it. Cited by its bill, a line of this run goes (issue
  // #770); a confirmed digest line cannot, so that refusal leaves the run only a finding.
  // Each refusal names the confirmed item, never the document.
  const citations = ledgerCitations(workspace);
  const confirmedPath = join(workspace, 'confirmed', OPTIONAL_TAX_PAYMENTS);
  if (existsSync(confirmedPath)) {
    const cited = citedKeysOf(citations);
    const confirmed = loadJson(confirmedPath);
    for (const [index, raw] of (Array.isArray(confirmed) ? confirmed : []).entries()) {
      if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) continue;
      const source = strOrNull((raw as Json).payment_source);
      if (!staged) {
        const bill = namedDocument(raw as Json, 'bill_source');
        if (source !== null && cited.has(documentKeyOf(source))) {
          problems.push(
            problem(
              'invariant',
              `confirmed/${OPTIONAL_TAX_PAYMENTS} item ${String(index)} names payment evidence a ledger line now cites while ${OPTIONAL_TAX_PAYMENTS} is absent; silence keeps the payment, so write ${OPTIONAL_TAX_PAYMENTS} without it`,
            ),
          );
        } else if (bill !== null && cited.has(documentKeyOf(bill))) {
          const billKey = documentKeyOf(bill);
          // A line of this run (out/ledger.json or a source_file change) is the run's to remove;
          // a confirmed digest line is not, and no written file escapes it either (the bill arms
          // nothing, and a carried payment trips the digest arm), so the refusal states the fact
          // and leaves the run a finding for the person.
          const runCites =
            citations.ledger.some((key) => key === billKey) || citations.changes.has(billKey);
          problems.push(
            problem(
              'invariant',
              runCites
                ? `confirmed/${OPTIONAL_TAX_PAYMENTS} item ${String(index)} names a bill a ledger line now cites while ${OPTIONAL_TAX_PAYMENTS} is absent; silence keeps the payment, so remove the line citing its bill`
                : `confirmed/${OPTIONAL_TAX_PAYMENTS} item ${String(index)} names a bill a confirmed digest line cites, which the kept payment would record twice; the digest cannot be edited, so write a finding naming the document for the person`,
            ),
          );
        }
        continue;
      }
      if (source === null || paymentSources.has(source)) continue;
      if (cited.has(documentKeyOf(source))) continue;
      problems.push(
        problem(
          'invariant',
          `confirmed/${OPTIONAL_TAX_PAYMENTS} item ${String(index)} is missing from ${OPTIONAL_TAX_PAYMENTS}; a present file is the complete set, and a confirmed payment leaves it only when a ledger line now cites its payment evidence (payment_source)`,
        ),
      );
    }
  }
  // One document cannot feed both a home cost and a payment, on either surface the payment
  // names: recorded twice, so the overlap is refused. The home costs are the staged file, or
  // the confirmed ones its silence keeps (issue #910), and the payments likewise (issue #980).
  const homeCostKeys = new Set<string>();
  const homeCostsPath = join(out, OPTIONAL_HOME_COSTS);
  for (const raw of listOf(
    loadJson(
      existsSync(homeCostsPath) ? homeCostsPath : join(workspace, 'confirmed', OPTIONAL_HOME_COSTS),
    ),
  )) {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) continue;
    const file = (raw as Json).source_file;
    if (typeof file === 'string' && file.trim().length > 0) homeCostKeys.add(documentKeyOf(file));
  }
  for (const [index, raw] of (staged ? value : readTaxPayments(workspace)).entries()) {
    if (paymentDocumentKeys(raw).some((key) => homeCostKeys.has(key))) {
      problems.push(
        problem(
          'invariant',
          `${listName} item ${String(index)} names a document that also feeds a staged home cost; the document must not be recorded twice`,
        ),
      );
    }
  }
  // The not-twice walk, on both documents a staged payment names (issue #770): a line citing
  // the bill books the tax beside the payment's parcel pieces as surely as one citing the
  // payment evidence does. Its three arms are the three surfaces `ledgerCitations` reads -
  // out/ledger.json, the confirmed digest, and a source_file change's `to` - walked one by one
  // so each refusal names an item the run can act on, never the document: the ledger item, or
  // the staged payment where the citing line is confirmed or a change.
  const stagedKeys = new Set(value.flatMap(paymentDocumentKeys));
  if (stagedKeys.size === 0) return problems;
  for (const [index, key] of citations.ledger.entries()) {
    if (key !== null && stagedKeys.has(key)) {
      problems.push(
        problem(
          'invariant',
          `${REQUIRED_LEDGER} item ${String(index)} cites a document a staged tax payment names, its payment evidence or its bill; the payment must not be recorded twice`,
        ),
      );
    }
  }
  // The confirmed digest's items and held rows are ledger lines too: a payment whose document a
  // confirmed line already cites would book the tax twice, once as parcel pieces and once as the
  // line. Compared by the document's token, the way a home cost is. The run cannot edit the
  // digest, so the refusal names the staged payment, the item it can withhold.
  for (const [index, raw] of value.entries()) {
    if (paymentDocumentKeys(raw).some((key) => citations.digest.has(key))) {
      problems.push(
        problem(
          'invariant',
          `${OPTIONAL_TAX_PAYMENTS} item ${String(index)} stages a payment whose payment evidence or bill a confirmed digest line cites; the payment must not be recorded twice`,
        ),
      );
    }
  }
  // The not-twice walk's third arm: a source_file change's `to` cites the document the same way
  // a ledger line's source_file does (the importer applies the change verbatim), and the
  // carry-forward escape above is armed by it — so a staged payment it names must be refused
  // on the same set, or a re-spelled staging beside such a change books the tax twice.
  for (const [index, raw] of value.entries()) {
    if (paymentDocumentKeys(raw).some((key) => citations.changes.has(key))) {
      problems.push(
        problem(
          'invariant',
          `${OPTIONAL_TAX_PAYMENTS} item ${String(index)} stages a payment whose document a ledger change cites; the payment must not be recorded twice`,
        ),
      );
    }
  }
  return problems;
}

/**
 * The resolved profile as the importer judges it (issue #766): the agent's
 * `out/profile.resolved.json` with the person's recorded facts overlaid through the one shared
 * `withRecordedFacts`, as the importer rewrites the file before it runs these gates. Null unless
 * the file is an object; the schema gate owns the report of a missing or malformed file, so this
 * never falls back to the staged profile. `profileFactsHonoured` keeps the raw read on purpose:
 * it compares what the agent wrote with what was recorded.
 */
function resolvedProfileOf(workspace: string, skillDir: string): Json | null {
  const profile = loadJson(join(workspace, 'out', 'profile.resolved.json'));
  if (profile === null || typeof profile !== 'object' || Array.isArray(profile)) return null;
  return withRecordedFacts(profile as Json, workspace, skillDir);
}

/**
 * The home-office areas the profile records (issue #661): a present `home_office` is an object
 * carrying both `office_sq_ft` and `home_sq_ft` explicitly, each a positive decimal string of at
 * most two places or null, with the office no larger than the home, and only on a Schedule C
 * entity. The build therefore computes from exactly the pair the importer will store.
 *
 * It judges the importer's merged state (issue #766): the resolved profile with the recorded
 * facts overlaid, against the staged `profile.json` (the register with the recorded facts
 * overlaid, so a holder that is only a fact counts, which the importer's gate alone would miss). A resolved entry
 * overrides the staged pair of the entity it resolves to (`ent_<id>` key first, then name, as the
 * importer resolves a row); the workspace holds one office, and an entry that omits the pair
 * keeps the office the register records on it (issue #910: silence keeps the stored areas, which
 * Abacus reads through `loadProfile`'s overlay), while a resolved profile that drops the holding
 * entity itself is refused. The "more than one" and "carry that entity" refusals are
 * `invariant`, the importer's own code, and name the entry; no message names an area.
 */
function profileHomeOfficeProblems(workspace: string, skillDir: string): Problem[] {
  const profile = resolvedProfileOf(workspace, skillDir);
  if (profile === null) return [];
  const entities = profile.entities;
  if (!Array.isArray(entities)) return [];
  const problems: Problem[] = [];
  const staged = stagedEntitiesOf(workspace);
  const idOf = (key: unknown): number | null => {
    const match = typeof key === 'string' ? /^ent_(\d+)$/.exec(key) : null;
    return match === null ? null : Number(match[1]);
  };
  // The staged entity (by index) a resolved entry lands on, or null for a new entity.
  const resolveStaged = (entry: Json): number | null => {
    const id = idOf(entry.key);
    if (id !== null) {
      const keyed = staged.findIndex((row) => idOf(row.key) === id);
      if (keyed >= 0) return keyed;
    }
    if (typeof entry.name !== 'string') return null;
    const named = staged.findIndex((row) => row.name === entry.name);
    return named >= 0 ? named : null;
  };
  // The staged entities that hold an office, overridden below by the entries that resolve to them.
  const effective = new Set<number>();
  for (const [index, row] of staged.entries()) {
    if (hasOfficeArea(row.home_office)) effective.add(index);
  }
  const stagedHolders = new Set(effective);
  const officeEntries: { index: number; staged: number | null }[] = [];
  const resolvedTo = new Map<number, number>(); // staged index -> first resolved entry on it
  for (const [index, raw] of entities.entries()) {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) continue;
    const entity = raw as Json;
    const target = resolveStaged(entity);
    if (target !== null && !resolvedTo.has(target)) resolvedTo.set(target, index);
    if (entity.home_office === undefined) continue;
    const name = `profile.resolved.json entity entry ${String(index)} home_office`;
    const areas = entity.home_office;
    if (typeof areas !== 'object' || areas === null || Array.isArray(areas)) {
      problems.push(problem('schema', `${name} must be an object`));
      continue;
    }
    const record = areas as Json;
    const parsed: Record<string, bigint | null> = {};
    let valid = true;
    for (const key of ['office_sq_ft', 'home_sq_ft'] as const) {
      if (!(key in record)) {
        problems.push(problem('schema', `${name} must carry ${key}, a decimal string or null`));
        valid = false;
        continue;
      }
      const value = record[key];
      if (value === null) {
        parsed[key] = null;
        continue;
      }
      if (typeof value !== 'string' || !isDecimalString(value) || !atMostTwoDecimals(value)) {
        problems.push(
          problem('schema', `${name} ${key} must be a decimal string of at most two decimals`),
        );
        valid = false;
        continue;
      }
      const area = parseDec(value);
      if (area.v <= 0n || !homeAreaWithinColumn(area)) {
        problems.push(
          problem('schema', `${name} ${key} must be greater than zero and below 100000000`),
        );
        valid = false;
        continue;
      }
      parsed[key] = area.v;
    }
    if (!valid) continue;
    const office = parsed['office_sq_ft'] ?? null;
    const home = parsed['home_sq_ft'] ?? null;
    if (office !== null && home !== null && office > home) {
      problems.push(problem('schema', `${name} office_sq_ft is larger than home_sq_ft`));
    }
    if (target !== null) {
      if (office === null) effective.delete(target);
      else effective.add(target);
    }
    if (office !== null) {
      officeEntries.push({ index, staged: target });
      if (entity.schedule !== 'C') {
        problems.push(
          problem('schema', `${name} records a home office on an entity that is not on Schedule C`),
        );
      }
    }
  }
  if (officeEntries.length > 1 || effective.size > 1) {
    // The keeper is the entry on the staged holder while it still holds (none when the entry
    // omitted the pair, so every office the run adds is named), else the first office entry.
    const held = [...stagedHolders].filter((index) => effective.has(index));
    const keeper =
      held.length > 0
        ? officeEntries.find((entry) => entry.staged !== null && held.includes(entry.staged))
        : officeEntries[0];
    const holder = [...stagedHolders][0];
    const where =
      holder === undefined ? '' : `; profile.json records it on entity entry ${String(holder)}`;
    let named = 0;
    for (const entry of officeEntries) {
      if (entry === keeper) continue;
      named += 1;
      problems.push(
        problem(
          'invariant',
          `profile.resolved.json entity entry ${String(entry.index)} field home_office puts a home office on more than one entity; the workspace holds one: keep the pair on one entity and write office_sq_ft and home_sq_ft as null on every other${where}`,
        ),
      );
    }
    if (named === 0) {
      problems.push(
        problem(
          'invariant',
          'profile.json records a home office on more than one entity; the workspace holds one',
        ),
      );
    }
    return problems;
  }
  const [holder] = [...effective];
  if (holder !== undefined && !resolvedTo.has(holder)) {
    problems.push(
      problem(
        'invariant',
        `profile.resolved.json carries no entry for the entity profile.json entity entry ${String(holder)} records the home office on; carry that entity forward, its home_office stays as stored`,
      ),
    );
  }
  return problems;
}

/** The staged `profile.json`'s entity entries (objects only, in file order), or none. */
function stagedEntitiesOf(workspace: string): Json[] {
  const staged = loadJson(join(workspace, 'profile.json'));
  if (staged === null || typeof staged !== 'object' || Array.isArray(staged)) return [];
  const entities = (staged as Json).entities;
  return Array.isArray(entities)
    ? entities.map((raw) =>
        typeof raw === 'object' && raw !== null && !Array.isArray(raw) ? (raw as Json) : {},
      )
    : [];
}

/**
 * The staged fixed-asset register carried forward (issue #898, decision record 0116 amendment):
 * every asset `profile.json` stages on an entity (a register row, such as a property's declared
 * purchase) must still appear on that entity's resolved entry under its staged description, once
 * per staged occurrence, so a run can neither drop the person's declared purchase nor rename it
 * away from the register row the report joins it to. A resolved entry lands on a staged entity
 * by its key first, then by its name, as the importer resolves a row. An asset the run adds is
 * never refused here: a second asset for the same purchase cannot be told from furnishings or an
 * improvement placed in service the same day, so that rule stays with the skill. `invariant`, the
 * code of the home office's own carry-forward refusal; a message names the staged entry and asset
 * by index and never a description.
 */
function stagedAssetsCarriedProblems(workspace: string, skillDir: string): Problem[] {
  const profile = resolvedProfileOf(workspace, skillDir);
  if (profile === null) return [];
  const objects = (value: unknown): Json[] =>
    Array.isArray(value)
      ? value.filter(
          (item): item is Json => typeof item === 'object' && item !== null && !Array.isArray(item),
        )
      : [];
  const resolved = objects(profile.entities);
  const problems: Problem[] = [];
  for (const [stagedIndex, staged] of stagedEntitiesOf(workspace).entries()) {
    const stagedAssets = objects(staged.assets);
    if (stagedAssets.length === 0) continue;
    let entryIndex = resolved.findIndex(
      (entry) => typeof staged.key === 'string' && entry.key === staged.key,
    );
    if (entryIndex < 0) {
      entryIndex = resolved.findIndex(
        (entry) => typeof staged.name === 'string' && entry.name === staged.name,
      );
    }
    const entry = entryIndex < 0 ? undefined : resolved[entryIndex];
    if (entry === undefined) {
      problems.push(
        problem(
          'invariant',
          `profile.resolved.json carries no entry for profile.json entity entry ${String(stagedIndex)}, which stages fixed assets; carry that entity and every staged asset forward`,
        ),
      );
      continue;
    }
    // A staged asset's register kind (issue #691) is never changed: it decides whether the asset
    // is in the expensing comparison, and the register row it came from is the record. A carried
    // asset silent about its kind keeps the staged word (loadProfile lays it back on), so only a
    // different word is refused.
    const carried = objects(entry.assets).filter((asset) => typeof asset.description === 'string');
    const used = new Set<number>();
    const word = (value: unknown): string | null => (typeof value === 'string' ? value : null);
    for (const [assetIndex, asset] of stagedAssets.entries()) {
      const description = typeof asset.description === 'string' ? asset.description : null;
      const sameDescription = carried
        .map((candidate, index) => ({ candidate, index }))
        .filter(
          ({ candidate, index }) => !used.has(index) && candidate.description === description,
        );
      const match =
        sameDescription.find(({ candidate }) => {
          const staged = word(asset.kind);
          const resolved = word(candidate.kind);
          return staged === null || resolved === null || staged === resolved;
        }) ?? null;
      if (description !== null && match !== null) {
        used.add(match.index);
        continue;
      }
      if (description !== null && sameDescription.length > 0) {
        problems.push(
          problem(
            'invariant',
            `profile.resolved.json entity entry ${String(entryIndex)} changes the kind of profile.json entity entry ${String(stagedIndex)} asset ${String(assetIndex)}; carry the staged kind forward unchanged`,
          ),
        );
        continue;
      }
      problems.push(
        problem(
          'invariant',
          `profile.resolved.json entity entry ${String(entryIndex)} drops or renames profile.json entity entry ${String(stagedIndex)} asset ${String(assetIndex)}; carry every staged asset forward under its staged description, adding its class and land value when documents or answers establish them`,
        ),
      );
    }
  }
  return problems;
}

/**
 * An asset's register kind (issue #691) is absent, null or one of the closed words: it decides
 * whether the expensing comparison covers the asset, so a word the build cannot read must fail
 * here, not drop the asset from the comparison silently. Names the entry and the asset by index.
 */
function assetKindProblems(workspace: string, skillDir: string): Problem[] {
  const profile = resolvedProfileOf(workspace, skillDir);
  if (profile === null || !Array.isArray(profile.entities)) return [];
  const problems: Problem[] = [];
  for (const [entityIndex, entity] of (profile.entities as unknown[]).entries()) {
    if (typeof entity !== 'object' || entity === null || Array.isArray(entity)) continue;
    const assets = (entity as Json).assets;
    if (!Array.isArray(assets)) continue;
    for (const [assetIndex, asset] of assets.entries()) {
      if (typeof asset !== 'object' || asset === null || Array.isArray(asset)) continue;
      const kind = (asset as Json).kind;
      if (kind === undefined || kind === null || assetKindOf(kind) !== null) continue;
      problems.push(
        problem(
          'schema',
          `profile.resolved.json entity entry ${String(entityIndex)} asset ${String(assetIndex)} field kind must be one of ${ASSET_KINDS.join(', ')}, or null`,
        ),
      );
    }
  }
  return problems;
}

/** Whether a staged `home_office` pair records an office area (the bundle writes both keys). */
function hasOfficeArea(areas: unknown): boolean {
  return (
    typeof areas === 'object' &&
    areas !== null &&
    !Array.isArray(areas) &&
    typeof (areas as Json).office_sq_ft === 'string'
  );
}

// Whether two profile values are the same number, however the agent spelled it (7 or "7").
function sameNumber(a: unknown, b: unknown): boolean {
  const spelled = (value: unknown): value is string | number =>
    (typeof value === 'string' && value.trim() !== '') || typeof value === 'number';
  return spelled(a) && spelled(b) && Number(a) === Number(b);
}

/**
 * A recorded fact the resolved profile contradicts (plan row 15.13): for each live `profile_fact:`
 * answer whose target the profile carries, the entry either omits the field or carries the
 * person's value. The message names the entry and the field and never a value; the overlay
 * discards the agent's figure anyway, so this tells the agent to keep the recorded one.
 */
function profileFactsHonoured(workspace: string, skillDir: string): Problem[] {
  const profile = loadJson(join(workspace, 'out', 'profile.resolved.json'));
  if (profile === null || typeof profile !== 'object' || Array.isArray(profile)) return [];
  const staged = new Map<string, StagedAnswer>();
  for (const [key, answer] of answersOf(workspace)) {
    if (key.startsWith(PROFILE_FACT_KEY_PREFIX)) staged.set(key, answer);
  }
  if (staged.size === 0) return [];
  const resolved = profile as Json;
  const expected = withRecordedFacts(resolved, workspace, skillDir);
  const problems: Problem[] = [];
  // An entity fact names its entry; a miles fact names a use of a vehicle entry (0189), found
  // under the vehicle that carries it and reported by that vehicle's index.
  const entryOf = (profileValue: Json, list: string, target: string) => {
    const entries = profileValue[list];
    if (!Array.isArray(entries)) return null;
    for (const [index, entry] of (entries as (Json | null)[]).entries()) {
      if (list === 'entities') {
        if (entry?.key === target) return { index, entry };
        continue;
      }
      const uses = Array.isArray(entry?.uses) ? (entry.uses as (Json | null)[]) : [];
      const use = uses.find((candidate) => candidate?.key === target);
      if (use !== undefined && use !== null) return { index, entry: use };
    }
    return null;
  };
  for (const [key, answer] of staged) {
    const effect = parseEffect(optionEffectOf({ ...answer, cites: [] }));
    if (effect === null || effect.kind !== 'profile_fact') continue;
    const { target, fact } = effect;
    if (key !== `${PROFILE_FACT_KEY_PREFIX}${target}:${fact.field}`) continue;
    const list = fact.field === 'miles' ? 'vehicles' : 'entities';
    const have = entryOf(resolved, list, target);
    const want = entryOf(expected, list, target);
    if (have === null || want === null) continue;
    const got = have.entry;
    const wanted = want.entry;
    let agrees = true;
    switch (fact.field) {
      case 'services_note':
        agrees = got.services_note === undefined || got.services_note === wanted.services_note;
        break;
      case 'home_office': {
        const a = got.home_office as Json | null | undefined;
        const b = wanted.home_office as Json;
        agrees =
          a === undefined ||
          (a !== null &&
            typeof a === 'object' &&
            sameNumber(a.office_sq_ft, b.office_sq_ft) &&
            sameNumber(a.home_sq_ft, b.home_sq_ft));
        break;
      }
      case 'miles': {
        const a = got.miles;
        const b = wanted.miles as Json[];
        const bandsAgree =
          a === undefined ||
          (Array.isArray(a) &&
            a.length === b.length &&
            a.every((band: Json | null, i) => {
              const other = b[i];
              return (
                band !== null &&
                other !== undefined &&
                band.from === other.from &&
                band.to === other.to &&
                sameNumber(band.miles, other.miles)
              );
            }));
        agrees =
          bandsAgree &&
          (got.business_miles === undefined ||
            sameNumber(got.business_miles, wanted.business_miles));
        break;
      }
      default:
        agrees = got[fact.field] === undefined || sameNumber(got[fact.field], wanted[fact.field]);
    }
    if (!agrees) {
      problems.push(
        problem(
          'invariant',
          `profile.resolved.json ${list === 'vehicles' ? 'vehicle' : 'entity'} entry ${String(have.index)} field ${fact.field} differs from the fact the person recorded under its profile_fact: key; keep the recorded value and write the finding the fact calls for`,
        ),
      );
    }
  }
  return problems;
}

/**
 * A document's identity for the not-booked-twice and carry-forward checks: its `doc_<id>` token
 * when the spelling carries one (`inbox/doc_118.pdf`, `doc_118` and `doc_118.pdf` are one
 * document), the exact spelling otherwise.
 */
function documentKeyOf(file: string): string {
  const base = file.slice(file.lastIndexOf('/') + 1).replace(/\.[^.]*$/, '');
  return /^doc_\d+$/.test(base) ? base : file;
}

function listOf(value: unknown): unknown[] {
  return Array.isArray(value) ? (value as unknown[]) : [];
}

/** The two documents a tax payment names: its payment evidence and its bill. */
const PAYMENT_DOCUMENT_FIELDS = ['payment_source', 'bill_source'] as const;

/** A payment's named document in `field`, or null when the field is no non-empty string. */
function namedDocument(
  entry: Json,
  field: (typeof PAYMENT_DOCUMENT_FIELDS)[number],
): string | null {
  const source = entry[field];
  return typeof source === 'string' && source.trim().length > 0 ? source : null;
}

/** The document keys a tax payment names, for the not-twice walk and the home-cost cross-check
 *  (issue #770). */
function paymentDocumentKeys(raw: unknown): string[] {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return [];
  return PAYMENT_DOCUMENT_FIELDS.flatMap((field) => {
    const source = namedDocument(raw as Json, field);
    return source === null ? [] : [documentKeyOf(source)];
  });
}

/** The documents a ledger line cites now, by surface and as document keys: each out/ledger.json
 *  item's `source_file` by item index (null when it names none), the confirmed digest's items and
 *  held rows, and the `to` of a ledger_changes source_file change. */
type LedgerCitations = {
  readonly ledger: readonly (string | null)[];
  readonly digest: ReadonlySet<string>;
  readonly changes: ReadonlySet<string>;
};

function ledgerCitations(workspace: string): LedgerCitations {
  const out = join(workspace, 'out');
  const ledger = listOf(loadJson(join(out, REQUIRED_LEDGER))).map((raw) => {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
    const file = strOrNull((raw as Json).source_file);
    return file === null ? null : documentKeyOf(file);
  });
  const changes = new Set<string>();
  for (const raw of listOf(loadJson(join(out, 'ledger_changes.json')))) {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) continue;
    const change = raw as Json;
    if (change.field !== 'source_file') continue;
    const file = strOrNull(change.to);
    if (file !== null) changes.add(documentKeyOf(file));
  }
  const digest = new Set([...handedSourceFiles(workspace)].map(documentKeyOf));
  return { ledger, digest, changes };
}

function citedKeysOf(citations: LedgerCitations): Set<string> {
  const cited = new Set<string>([...citations.digest, ...citations.changes]);
  for (const key of citations.ledger) if (key !== null) cited.add(key);
  return cited;
}

/** The `source_file` spellings a ledger line cites now, as document keys: out/ledger.json, the
 *  confirmed digest's items and held rows, and the `to` of a ledger_changes source_file change.
 *  A home cost is never recorded on a document that feeds one of these. */
function ledgerCitedSources(workspace: string): Set<string> {
  return citedKeysOf(ledgerCitations(workspace));
}

/**
 * The per-cost contract for out/home_costs.json (issue #661): the same shape donations.json and
 * tax_payments.json get, the closed kind and use vocabularies, the currency set the rate tables
 * price, and no repeat of one document's kind on one date. Two cross-file invariants join it.
 * A cost whose document a ledger line cites is recorded twice, so it is refused. And the
 * carry-forward is checked, not trusted. An absent file is silence (issue #910): the importer
 * keeps the stored set and the build computes from confirmed/home_costs.json, so nothing is
 * dropped - except that a confirmed cost whose document a ledger line now cites would be recorded
 * twice, so that silence is refused and the run must write the file without it. A present file
 * is the complete set the importer replaces the stored one with, so every document the confirmed
 * staging carries must come back in it, except one a ledger line now cites - a document moved
 * to the ledger leaves the home costs. Either way the stored set is exactly the set the build
 * computed from.
 */
function homeCostsProblems(workspace: string, rules: YearRules): Problem[] {
  const out = join(workspace, 'out');
  const path = join(out, OPTIONAL_HOME_COSTS);
  const confirmedPath = join(workspace, 'confirmed', OPTIONAL_HOME_COSTS);
  const problems: Problem[] = [];
  const staged = existsSync(path);
  let value: unknown[] = [];
  if (staged) {
    const loaded = loadJson(path);
    if (!Array.isArray(loaded)) {
      return [
        problem(
          'schema',
          `${OPTIONAL_HOME_COSTS} must be a JSON list${loaded === null ? ', not valid JSON' : `, got ${typeName(loaded)}`}`,
        ),
      ];
    }
    value = loaded;
  }
  const currencies = knownCurrencies(rules);
  const seen = new Set<string>();
  const sources = new Set<string>();
  for (const [index, raw] of value.entries()) {
    const name = `${OPTIONAL_HOME_COSTS} item ${String(index)}`;
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
      problems.push(problem('schema', `${name} must be an object`));
      continue;
    }
    const entry = raw as Json;
    const source = entry.source_file;
    if (typeof source !== 'string' || source.trim().length === 0) {
      problems.push(problem('schema', `${name} source_file must be a non-empty string`));
    } else {
      sources.add(documentKeyOf(source));
    }
    if (typeof entry.date !== 'string' || !isValidDay(entry.date)) {
      problems.push(problem('schema', `${name} date must be an ISO day`));
    }
    if (!isDecimalString(entry.amount) || parseDec(entry.amount).v <= 0n) {
      problems.push(problem('schema', `${name} amount must be a decimal string greater than zero`));
    }
    if (typeof entry.currency !== 'string' || !currencies.has(entry.currency.toUpperCase())) {
      problems.push(problem('schema', `${name} currency is not a code the rate tables carry`));
    }
    if (!(HOME_COST_KINDS as readonly unknown[]).includes(entry.kind)) {
      problems.push(problem('schema', `${name} kind is outside the home cost kinds`));
    }
    if (!(HOME_COST_USES as readonly unknown[]).includes(entry.use)) {
      problems.push(problem('schema', `${name} use must be home or office`));
    }
    if (
      typeof source === 'string' &&
      typeof entry.kind === 'string' &&
      typeof entry.date === 'string'
    ) {
      const identity = JSON.stringify([source, entry.kind, entry.date]);
      if (seen.has(identity)) {
        problems.push(problem('schema', `${name} repeats an earlier source_file, kind and date`));
      }
      seen.add(identity);
    }
  }
  const cited = ledgerCitedSources(workspace);
  for (const [index, raw] of value.entries()) {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) continue;
    const source = (raw as Json).source_file;
    if (typeof source === 'string' && cited.has(documentKeyOf(source))) {
      problems.push(
        problem(
          'invariant',
          `${OPTIONAL_HOME_COSTS} item ${String(index)} carries the source_file of a ledger line; the document must not be recorded twice`,
        ),
      );
    }
  }
  if (existsSync(confirmedPath)) {
    const confirmed = loadJson(confirmedPath);
    for (const [index, raw] of (Array.isArray(confirmed) ? confirmed : []).entries()) {
      if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) continue;
      const source = strOrNull((raw as Json).source_file);
      if (source === null) continue;
      const key = documentKeyOf(source);
      if (!staged) {
        if (!cited.has(key)) continue;
        problems.push(
          problem(
            'invariant',
            `confirmed/${OPTIONAL_HOME_COSTS} item ${String(index)} names a document a ledger line now cites while ${OPTIONAL_HOME_COSTS} is absent; silence keeps the cost, so write ${OPTIONAL_HOME_COSTS} without it`,
          ),
        );
        continue;
      }
      if (sources.has(key) || cited.has(key)) continue;
      problems.push(
        problem(
          'invariant',
          `confirmed/${OPTIONAL_HOME_COSTS} item ${String(index)} is missing from ${OPTIONAL_HOME_COSTS}; a present file is the complete set, and a confirmed home cost leaves it only when a ledger line now cites its document`,
        ),
      );
    }
  }
  return problems;
}

/** The run's closing summary (issue #1639): required, an object whose `summary` is one paragraph
 *  of at most RUN_SUMMARY_MAX_LENGTH characters. modelTextProblems scans its wording. */
function summaryShapeProblems(out: string): Problem[] {
  const path = join(out, RUN_SUMMARY_FILE);
  if (!existsSync(path)) return [problem('schema', `missing required output ${RUN_SUMMARY_FILE}`)];
  if (runSummaryOf(loadJson(path)) !== null) return [];
  return [
    problem(
      'schema',
      `${RUN_SUMMARY_FILE} must be an object whose summary is a non-empty string of at most ${String(RUN_SUMMARY_MAX_LENGTH)} characters with no control character`,
    ),
  ];
}

function schemaProblems(out: string): Problem[] {
  const problems: Problem[] = [];
  for (const name of [...REQUIRED_LISTS, REQUIRED_DOCUMENTS]) {
    problems.push(
      ...listSchemaProblems(out, name, name === REQUIRED_DOCUMENTS ? DOCUMENT_KEYS : null),
    );
  }
  problems.push(...listSchemaProblems(out, REQUIRED_LEDGER, LEDGER_KEYS));
  problems.push(...ledgerKeyProblems(out));
  // Duplicate ids inside the ledger are a shape problem: build_books refuses
  // them, and the incremental ordering gate reads them as additions.
  const ledger = loadJson(join(out, REQUIRED_LEDGER));
  if (Array.isArray(ledger)) {
    const seen = new Set<string>();
    for (const [index, raw] of ledger.entries()) {
      if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) continue;
      const item = raw as Json;
      const id = strOrNull(item.id);
      if (id !== null) {
        if (seen.has(id)) {
          problems.push(
            problem('schema', `${REQUIRED_LEDGER} item ${String(index)} repeats id ${id}`),
          );
        }
        seen.add(id);
      }
      // The status vocabulary is the one this package exports (issue #314), the same sentence the
      // importer rejects with. A missing key keeps the missing-keys problem above and is not
      // reported here a second time.
      if ('status' in item && ledgerItemStatus(item.status) === null) {
        problems.push(
          problem(
            'schema',
            `${REQUIRED_LEDGER} item ${String(index)} field status is outside the known set`,
          ),
        );
      }
    }
  }
  // The kind vocabulary is the one this package exports (issue #613), the same sentence the
  // importer rejected with before this gate existed. A missing kind fails here too: findings.json
  // carries no per-item key contract, so nothing else reports it.
  const findings = loadJson(join(out, 'findings.json'));
  if (Array.isArray(findings)) {
    for (const [index, raw] of findings.entries()) {
      if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) continue;
      if (findingKindOf((raw as Json).kind) === null) {
        problems.push(
          problem(
            'schema',
            `findings.json item ${String(index)} field kind is outside the finding catalog`,
          ),
        );
      }
    }
  }
  for (const name of OPTIONAL_LISTS) {
    if (existsSync(join(out, name))) problems.push(...listSchemaProblems(out, name, null));
  }
  problems.push(...donationsProblems(out));
  problems.push(...summaryShapeProblems(out));
  for (const name of REQUIRED_OBJECTS) {
    const path = join(out, name);
    if (!existsSync(path)) {
      problems.push(problem('schema', `missing required output ${name}`));
      continue;
    }
    const value = loadJson(path);
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      problems.push(
        problem(
          'schema',
          `${name} must be a JSON object${value === null ? ', not valid JSON' : `, got ${typeName(value)}`}`,
        ),
      );
    }
  }
  return problems;
}

/**
 * Keys dedup by what they name, not by their spelling: the register writes target rows by the id
 * a staged `<moniker>_<id>` key parses to, so `trip_42` and `trip_042` are one target, and two
 * spellings of one id must reject exactly like two copies of one string. A key the pattern does
 * not name compares as its raw string. Mirrors the import gate in import-saved-output.ts.
 */
function keyRepeats(
  key: string,
  idPattern: RegExp,
  seenIds: Set<number>,
  seenStrings: Set<string>,
): boolean {
  const match = idPattern.exec(key);
  if (match === null) {
    if (seenStrings.has(key)) return true;
    seenStrings.add(key);
    return false;
  }
  const id = Number(match[1]);
  if (seenIds.has(id)) return true;
  seenIds.add(id);
  return false;
}

/**
 * The sandbox-checkable subset of the importer's gates over `profile.resolved.json` (0019 item
 * 7): the trip shapes the register write cannot hold, the key and name repeats the profile joins
 * cannot survive, and a trip entity no entry of the profile's own carries must fail step 8 in
 * the sandbox instead of rejecting SCHEMA at import — a billed run whose output the importer
 * refuses is a run the workspace pays for twice. The database-side checks stay importer-side: a
 * `trip_<id>` key naming a row of this workspace, a staged `ent_<id>` entity naming one, and a
 * trip name colliding with a register row need the database the sandbox does not have.
 */
function profileProblems(workspace: string): Problem[] {
  const profile = loadJson(join(workspace, 'out', 'profile.resolved.json'));
  if (profile === null || typeof profile !== 'object' || Array.isArray(profile)) {
    return []; // schemaProblems already reports the missing or malformed object
  }
  const record = profile as Json;
  const problems: Problem[] = [];
  // The joins resolve through the entries carrying both a key and a name (namedProfileEntries on
  // the import side), so a trip's entity must name one of these keys to resolve at all.
  const entityEntryKeys = new Set<string>();
  const entities = record.entities;
  if (entities !== undefined) {
    if (!Array.isArray(entities)) {
      problems.push(problem('schema', 'profile.resolved.json field entities must be an array'));
    } else {
      const seenEntityKeyIds = new Set<number>();
      const seenEntityKeyStrings = new Set<string>();
      const seenEntityNames = new Set<string>();
      const stagedSchedules = stagedEntitySchedules(workspace);
      for (const [index, raw] of entities.entries()) {
        if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) continue;
        const key = strOrNull((raw as Json).key);
        if (key === null) continue;
        // Every entity carries a schedule of exactly C, E or K1 (issue #704). A newly established
        // entity has no staged schedule for profileScheduleProblems to compare against, so one
        // written without it reached build_books as a rental_use row with a null schedule and the
        // importer's write threw after the claim, on every retry. A staged key is that gate's:
        // one refusal per cause. Names the index only.
        const schedule = (raw as Json).schedule;
        if (
          !stagedSchedules.has(key) &&
          (typeof schedule !== 'string' || !DIGEST_SCHEDULES.includes(schedule))
        ) {
          problems.push(
            problem(
              'schema',
              `profile.resolved.json entity entry ${String(index)} has no schedule of C, E or K1`,
            ),
          );
        }
        const name = strOrNull((raw as Json).name);
        if (name !== null) {
          entityEntryKeys.add(key);
          if (seenEntityNames.has(name)) {
            problems.push(
              problem(
                'schema',
                `profile.resolved.json entity entry ${String(index)} repeats an entity name`,
              ),
            );
          } else {
            seenEntityNames.add(name);
          }
        }
        if (keyRepeats(key, /^ent_(\d+)$/, seenEntityKeyIds, seenEntityKeyStrings)) {
          problems.push(
            problem(
              'schema',
              `profile.resolved.json entity entry ${String(index)} repeats an entity key`,
            ),
          );
        }
      }
    }
  }
  const trips = record.trips;
  if (trips === undefined) return problems;
  if (!Array.isArray(trips)) {
    problems.push(problem('schema', 'profile.resolved.json field trips must be an array'));
    return problems;
  }
  const seenNames = new Set<string>();
  const seenTripKeyIds = new Set<number>();
  const seenTripKeyStrings = new Set<string>();
  for (const [index, raw] of trips.entries()) {
    const name = `profile.resolved.json trip entry ${String(index)}`;
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
      problems.push(problem('schema', `${name} must be an object`));
      continue;
    }
    const entry = raw as Json;
    if (typeof entry.name !== 'string' || entry.name === '') {
      problems.push(problem('schema', `${name} field name must be a non-empty string`));
    } else if (seenNames.has(entry.name)) {
      problems.push(problem('schema', `${name} repeats a trip name`));
    } else {
      seenNames.add(entry.name);
    }
    const key = strOrNull(entry.key);
    if (key !== null && keyRepeats(key, /^trip_(\d+)$/, seenTripKeyIds, seenTripKeyStrings)) {
      problems.push(problem('schema', `${name} repeats a trip key`));
    }
    if (typeof entry.entity !== 'string') {
      problems.push(problem('schema', `${name} field entity must be a string`));
    } else if (!entityEntryKeys.has(entry.entity)) {
      // The database-free half of the import gate: the entity resolves through the profile's own
      // entries, so a key none of them carries resolves nowhere even with the database present.
      problems.push(
        problem('schema', `${name} field entity does not resolve to an entity register row`),
      );
    }
    if (!Array.isArray(entry.segments) || entry.segments.length === 0) {
      problems.push(problem('schema', `${name} field segments must be a non-empty array`));
      continue;
    }
    for (const [segmentIndex, rawSegment] of entry.segments.entries()) {
      const segmentName = `${name} segment ${String(segmentIndex)}`;
      if (typeof rawSegment !== 'object' || rawSegment === null || Array.isArray(rawSegment)) {
        problems.push(problem('schema', `${segmentName} must be an object`));
        continue;
      }
      const segment = rawSegment as Json;
      // The locality half of the location, the split the import's register write stores, so the
      // sandbox names the defect the importer would: one rule with the Trips edit's
      // (`validateTripSegments`'s `no_locality`). A blank or comma-only location splits to none,
      // and the next run's staging would emit `location: ""` from it, which the import rejects.
      if (typeof segment.location !== 'string' || stopLocality(segment.location) === '') {
        problems.push(
          problem('schema', `${segmentName} field location must carry a non-empty locality`),
        );
      }
      const start = strOrNull(segment.start);
      const end = strOrNull(segment.end);
      if (start === null || !isValidDay(start)) {
        problems.push(problem('schema', `${segmentName} field start is not an ISO calendar date`));
      }
      if (end === null || !isValidDay(end)) {
        problems.push(problem('schema', `${segmentName} field end is not an ISO calendar date`));
      }
      if (start !== null && end !== null && isValidDay(start) && isValidDay(end) && start > end) {
        problems.push(problem('schema', `${segmentName} field start is after its end`));
      }
    }
    if (
      entry.purpose !== undefined &&
      entry.purpose !== null &&
      typeof entry.purpose !== 'string'
    ) {
      problems.push(problem('schema', `${name} field purpose must be a string`));
    }
  }
  return problems;
}

/** The typed code a use is refused with when its key takes the `use_<id>` shape of a stored use
 *  that `profile.json` does not stage for that same vehicle (decision record 0189): the person's
 *  recorded miles find a use by that key alone. The message never carries the key. */
export const VEHICLE_USE_KEY_UNSTAGED = 'vehicle_use_key_unstaged';

/** The typed code a staged use is refused with when its `entity` is not the place `profile.json`
 *  stages for it (decision record 0189). The message never names a place. */
export const VEHICLE_USE_ENTITY_CHANGED = 'vehicle_use_entity_changed';

/**
 * The sandbox-checkable shapes of the vehicle comparison's profile inputs (issue #110): a
 * `first_year_method` outside the closed vocabulary, a repeated vehicle key, and, on each use
 * (decision record 0189), a missing or repeated key, a miles band matching no band in the
 * mileage rules file date-for-date and negative miles all fail here, before a billed run's
 * output reaches the importer.
 */
function profileVehicleProblems(workspace: string, skillDir: string, rules: YearRules): Problem[] {
  const profile = resolvedProfileOf(workspace, skillDir);
  if (profile === null) {
    return []; // schemaProblems already reports the missing or malformed object
  }
  const vehicles = profile.vehicles;
  if (vehicles === undefined) return [];
  if (!Array.isArray(vehicles)) {
    return [problem('schema', 'profile.resolved.json field vehicles must be an array')];
  }
  const mileage = loadJson(join(rules.dir, 'mileage.json'));
  const bands =
    mileage !== null && typeof mileage === 'object' && !Array.isArray(mileage)
      ? (mileage as Json).business_cents_per_mile
      : [];
  const fileBands = (Array.isArray(bands) ? bands : []).flatMap((raw) => {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return [];
    const from = strOrNull((raw as Json).from);
    const to = strOrNull((raw as Json).to);
    return from !== null && to !== null ? [{ from, to }] : [];
  });
  const records = (value: unknown): Json[] =>
    (Array.isArray(value) ? value : [])
      .map(recordOf)
      .filter((entry): entry is Json => entry !== null);
  // Each staged vehicle's uses by key, with the staged place each names.
  const stagedUses = new Map<string, Map<string, string | null>>();
  for (const staged of records(recordOf(loadJson(join(workspace, 'profile.json')))?.vehicles)) {
    const stagedKey = strOrNull(staged.key);
    if (stagedKey === null) continue;
    stagedUses.set(
      stagedKey,
      new Map(
        records(staged.uses).flatMap((use): [string, string | null][] => {
          const useKey = strOrNull(use.key);
          return useKey === null ? [] : [[useKey, strOrNull(use.entity)]];
        }),
      ),
    );
  }
  const stagedPlaceOf = stagedPlaceResolver(stagedEntitiesOf(workspace), records(profile.entities));
  const problems: Problem[] = [];
  const seenKeys = new Set<string>();
  const seenUseKeys = new Set<string>();
  for (const [index, raw] of vehicles.entries()) {
    const name = `profile.resolved.json vehicle entry ${String(index)}`;
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
      problems.push(problem('schema', `${name} must be an object`));
      continue;
    }
    const vehicle = raw as Json;
    // The comparison and the ledger join key by this string, so a missing or empty key would
    // key the row by '': the trips' name gate, stated for the vehicle's key.
    const key = strOrNull(vehicle.key);
    if (key === null || key === '') {
      problems.push(problem('schema', `${name} field key must be a non-empty string`));
    } else if (seenKeys.has(key)) {
      problems.push(problem('schema', `${name} repeats a vehicle key`));
    } else {
      seenKeys.add(key);
    }
    const method = strOrNull(vehicle.first_year_method);
    if (method !== null && !(VEHICLE_METHODS as readonly string[]).includes(method)) {
      problems.push(
        problem(
          'schema',
          `${name} field first_year_method is outside the vehicle-method vocabulary`,
        ),
      );
    }
    const uses = vehicle.uses;
    if (!Array.isArray(uses)) {
      problems.push(problem('schema', `${name} field uses must be an array`));
      continue;
    }
    // The person says which place uses a vehicle (0189): a staged vehicle keeps exactly its
    // staged uses, and a vehicle the run adds carries one.
    const stagedUseKeys = key === null ? undefined : stagedUses.get(key);
    const useKeys = uses.map((use) => strOrNull((use as Json | null)?.key));
    if (stagedUseKeys === undefined) {
      if (uses.length !== 1) {
        problems.push(
          problem('invariant', `${name} is added by this run and must carry exactly one use`),
        );
      }
    } else if (
      useKeys.length !== stagedUseKeys.size ||
      useKeys.some((useKey) => useKey === null || !stagedUseKeys.has(useKey))
    ) {
      problems.push(
        problem(
          'invariant',
          `${name} field uses differs from the uses profile.json stages for it; carry them forward by key`,
        ),
      );
    }
    for (const [useIndex, rawUse] of uses.entries()) {
      const useName = `${name} use ${String(useIndex)}`;
      if (typeof rawUse !== 'object' || rawUse === null || Array.isArray(rawUse)) {
        problems.push(problem('schema', `${useName} must be an object`));
        continue;
      }
      const use = rawUse as Json;
      // The person's recorded miles and a miles question find the use by this key.
      const useKey = strOrNull(use.key);
      if (useKey === null || useKey === '') {
        problems.push(problem('schema', `${useName} field key must be a non-empty string`));
      } else if (seenUseKeys.has(useKey)) {
        problems.push(problem('schema', `${useName} repeats a use key`));
      } else {
        seenUseKeys.add(useKey);
      }
      const stagedPlace = useKey === null ? undefined : stagedUseKeys?.get(useKey);
      if (stagedPlace === undefined) {
        if (useKey !== null && /^use_\d+$/.test(useKey)) {
          problems.push(
            problem(
              'invariant',
              `${VEHICLE_USE_KEY_UNSTAGED}: ${useName} field key takes the use_<id> shape of a use profile.json does not stage for this vehicle; give a use you add a key of your own`,
            ),
          );
        }
      } else if (stagedPlace !== null && stagedPlaceOf(use.entity) !== stagedPlace) {
        problems.push(
          problem(
            'invariant',
            `${VEHICLE_USE_ENTITY_CHANGED}: ${useName} field entity is not the place profile.json stages for this use; carry it forward as staged`,
          ),
        );
      }
      problems.push(...milesBandProblems(useName, use.miles, fileBands));
    }
  }
  return problems;
}

/**
 * The staged place a resolved profile's entity key names: the staged entity its resolved entry
 * lands on, by its key (an `ent_<id>` by the id it parses to), then by name, as the importer
 * resolves a row. Null when the
 * key names no resolved entry or the entry lands on no staged place.
 */
function stagedPlaceResolver(
  staged: readonly Json[],
  resolved: readonly Json[],
): (entityKey: unknown) => string | null {
  const idOf = (key: unknown): number | null => {
    const match = typeof key === 'string' ? /^ent_(\d+)$/.exec(key) : null;
    return match === null ? null : Number(match[1]);
  };
  return (entityKey) => {
    const entry = resolved.find((candidate) => candidate.key === entityKey);
    if (entry === undefined || typeof entityKey !== 'string') return null;
    const id = idOf(entry.key);
    const landed =
      staged.find((row) => row.key === entry.key) ??
      (id === null ? undefined : staged.find((row) => idOf(row.key) === id)) ??
      (typeof entry.name === 'string' ? staged.find((row) => row.name === entry.name) : undefined);
    return strOrNull(landed?.key);
  };
}

/** The shape problems of one use's `miles` list against the mileage rules file's bands. */
function milesBandProblems(
  name: string,
  miles: unknown,
  fileBands: readonly { from: string; to: string }[],
): Problem[] {
  const problems: Problem[] = [];
  if (miles === undefined) return problems;
  if (!Array.isArray(miles)) {
    return [problem('schema', `${name} field miles must be an array`)];
  }
  const seenBands = new Set<string>();
  for (const [bandIndex, rawBand] of miles.entries()) {
    const bandName = `${name} miles band ${String(bandIndex)}`;
    if (typeof rawBand !== 'object' || rawBand === null || Array.isArray(rawBand)) {
      problems.push(problem('schema', `${bandName} must be an object`));
      continue;
    }
    const band = rawBand as Json;
    const from = strOrNull(band.from);
    const to = strOrNull(band.to);
    if (from === null || to === null) {
      problems.push(problem('schema', `${bandName} must carry from and to dates`));
    } else if (seenBands.has(`${from} ${to}`)) {
      problems.push(problem('schema', `${bandName} repeats the band ${from} to ${to}`));
    } else {
      seenBands.add(`${from} ${to}`);
    }
    const milesValue =
      typeof band.miles === 'number'
        ? band.miles
        : isDecimalString(band.miles)
          ? Number(band.miles)
          : null;
    if (milesValue === null || !Number.isFinite(milesValue)) {
      problems.push(problem('schema', `${bandName} must carry a miles value`));
    } else if (milesValue < 0) {
      problems.push(problem('schema', `${bandName} carries negative miles`));
    }
    if (
      from !== null &&
      to !== null &&
      fileBands.length > 0 &&
      !fileBands.some((fileBand) => fileBand.from === from && fileBand.to === to)
    ) {
      problems.push(problem('schema', `${bandName} matches no band in the mileage rules file`));
    }
  }
  return problems;
}

function coverageProblems(workspace: string): Problem[] {
  const out = join(workspace, 'out');
  const inventory = loadJson(join(out, 'inventory.json')) as Json | null;
  const documents = loadJson(join(out, REQUIRED_DOCUMENTS));
  if (inventory === null || typeof inventory !== 'object' || !Array.isArray(documents)) {
    return []; // schemaProblems already reports these
  }
  const batchNames = batchNamesOf(workspace);
  const rawFiles = inventory.files;
  const entries = (Array.isArray(rawFiles) ? rawFiles : []).filter(
    (entry): entry is Json => typeof entry === 'object' && entry !== null,
  );
  const inventoried = entries
    .map((entry) => strOrNull(entry.file))
    .filter((file): file is string => file !== null);
  // A duplicate drops its own path from the required set - by full path, so a
  // same-basename copy in a subdirectory cannot mask the original it duplicates.
  const marked = new Set(
    entries.filter((entry) => entry.duplicate_of).map((entry) => strOrNull(entry.file) ?? ''),
  );
  const unique = inventoried
    .filter((file) => !marked.has(file))
    .map((file) => basename(file))
    .sort();
  const documented = new Set<string>();
  const problems: Problem[] = [];
  for (const [index, raw] of documents.entries()) {
    if (typeof raw !== 'object' || raw === null) continue;
    const entry = raw as Json;
    const name = basename(strOrNull(entry.file) ?? '');
    documented.add(name);
    if (!namesBatchToken(name, batchNames)) {
      problems.push(
        problem(
          'schema',
          `${REQUIRED_DOCUMENTS} entry ${String(index)} names ${name}, which is not in this batch`,
        ),
      );
    }
  }
  for (const name of unique) {
    // The batch direction is permissive the same way the arm is: a reading staged as
    // `extractions/IMG_2041.json` is documented by the entry naming its original
    // `IMG_2041.png`.
    if (!matchesAnyDocumented(name, documented)) {
      problems.push(problem('schema', `no ${REQUIRED_DOCUMENTS} entry for ${name}`));
    }
  }
  return problems;
}

/** Whether an inventoried file's basename matches a documented entry by basename or by
 *  basename-minus-extension — the same tolerance the document arm reads. */
function matchesAnyDocumented(name: string, documented: ReadonlySet<string>): boolean {
  if (documented.has(name)) return true;
  const dot = name.lastIndexOf('.');
  return dot > 0 ? documented.has(name.slice(0, dot)) : false;
}

/** The confirmed digest's `source_file` spellings, items and held rows alike: the names the run
 *  was handed. A product run may echo one honestly - the demo seed imports recorded provenance
 *  whose spellings a later run's staging still carries in its digest. */
function handedSourceFiles(workspace: string): Set<string> {
  const summaries = loadJson(join(workspace, 'confirmed', 'summaries.json'));
  const handed = new Set<string>();
  if (summaries === null || typeof summaries !== 'object' || Array.isArray(summaries)) {
    return handed;
  }
  const record = summaries as Json;
  for (const key of ['items', 'held'] as const) {
    const rows = record[key];
    if (!Array.isArray(rows)) continue;
    for (const raw of rows) {
      if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) continue;
      const file = strOrNull((raw as Json).source_file);
      if (file !== null) handed.add(file);
    }
  }
  return handed;
}

/**
 * The `source_file` spellings the confirmed home costs and tax payments carry (issue #661): they
 * are never ledger lines, so the digest never hands their spellings over, yet a carried-forward
 * entry must be copied unchanged - an earlier run wrote it, possibly as an `inbox/doc_<id>.pdf`
 * name no later batch stages. Without this, a product-shaped run could neither carry the entry
 * forward (the originals arm refuses its spelling) nor drop it (the carry-forward gate) nor
 * respell it (the exact match).
 */
function carriedSourceFiles(workspace: string): Set<string> {
  const carried = new Set<string>();
  const add = (value: unknown): void => {
    if (typeof value === 'string' && value !== '') carried.add(value);
  };
  for (const entry of listOf(loadJson(join(workspace, 'confirmed', OPTIONAL_HOME_COSTS)))) {
    if (typeof entry === 'object' && entry !== null) add((entry as Json).source_file);
  }
  for (const entry of listOf(loadJson(join(workspace, 'confirmed', OPTIONAL_TAX_PAYMENTS)))) {
    if (typeof entry !== 'object' || entry === null) continue;
    add((entry as Json).payment_source);
    add((entry as Json).bill_source);
  }
  return carried;
}

/**
 * Whether the workspace stages no originals: no `inbox/` holding files, and every
 * `extractions/*.json` stem a `doc_<id>` token - the product bundle's shape, which the import's
 * rebuild reproduces (the rebuild writes the same roots and never an `inbox/`). False wherever
 * originals are staged: the eval path and the inbox-carrying recorded corpora, where the arm
 * sleeps and the original-naming outputs are the batch's own names.
 */
function stagesNoOriginals(workspace: string): boolean {
  const inbox = join(workspace, 'inbox');
  if (existsSync(inbox) && readdirSync(inbox).length > 0) return false;
  const extractions = join(workspace, 'extractions');
  if (!existsSync(extractions)) return true;
  for (const name of readdirSync(extractions)) {
    if (!name.endsWith('.json')) continue;
    if (!/^doc_\d+$/.test(name.slice(0, -'.json'.length))) return false;
  }
  return true;
}

/** Whether an `inbox/...` reference names a document the run's staging carried: a batch name by
 *  basename or basename minus one extension, or a digest-handed spelling. */
function namesStagedDocument(
  file: string,
  batchNames: ReadonlySet<string>,
  handed: ReadonlySet<string>,
): boolean {
  return handed.has(file) || namesBatchToken(file, batchNames);
}

/**
 * The originals arm (task 11.9): in a product-shaped workspace - one staged without originals -
 * every structured document reference is checked against the staging, and an `inbox/...` path
 * that names neither a batch document nor a digest-handed spelling is a `schema` problem. The
 * scanned surfaces are the fields whose job is to name a document: each ledger item's
 * `source_file`; each inventory.json entry's `file` and `duplicate_of`; each documents.json
 * entry's `file` and its `near_duplicate_of:` status value; a ledger_changes.json entry's arming
 * `source_file` key (an answer-armed change passes the arming gate without it) and the `to` of a
 * `source_file` change (never its `from`, which the baseline gate anchors); each donations
 * entry's `source_file`; each home cost's `source_file`; and the `cites` of questions and findings. Prose is the identifier and
 * wording scans' business. The message names the file and entry, never the matched value.
 */
function inboxReferenceProblems(workspace: string): Problem[] {
  if (!stagesNoOriginals(workspace)) return [];
  const batchNames = batchNamesOf(workspace);
  const handed = handedSourceFiles(workspace);
  // The carried spellings are handed only on the surfaces whose job is to carry them forward:
  // the staged home costs and tax payments themselves, and a question's or finding's cites (a
  // re-ask). A ledger line, a change, the inventory or a document entry citing one would book
  // the document a second time, so those surfaces stay on the digest's own spellings.
  const carried = new Set([...handed, ...carriedSourceFiles(workspace)]);
  const problems: Problem[] = [];
  const check = (value: unknown, name: string, allowed: ReadonlySet<string> = handed): void => {
    if (
      typeof value === 'string' &&
      value.startsWith('inbox/') &&
      !namesStagedDocument(value, batchNames, allowed)
    ) {
      problems.push(
        problem('schema', `${name} names an inbox original this run's staging never carried`),
      );
    }
  };
  const items = (value: unknown): [number, Json][] =>
    Array.isArray(value)
      ? value.flatMap((raw, index) =>
          typeof raw === 'object' && raw !== null && !Array.isArray(raw)
            ? [[index, raw as Json] as [number, Json]]
            : [],
        )
      : [];
  const out = join(workspace, 'out');
  for (const [index, entry] of items(loadJson(join(out, REQUIRED_LEDGER)))) {
    check(entry['source_file'], `${REQUIRED_LEDGER} item ${String(index)}`);
  }
  // The inventory is an object carrying a files array, not a list itself - the shape
  // inventory.js writes and the coverage gate reads.
  const inventory = loadJson(join(out, 'inventory.json'));
  const inventoryFiles =
    inventory !== null && typeof inventory === 'object' && !Array.isArray(inventory)
      ? (inventory as Json).files
      : undefined;
  for (const [index, entry] of items(inventoryFiles)) {
    // The inventory's document references are scanned like the rest: a duplicate-marked path is
    // exactly the entry the coverage gate exempts from the documents.json requirement, so without
    // this surface an uploaded filename could persist in the saved output un-named by any gate.
    check(entry['file'], `inventory.json entry ${String(index)}`);
    check(entry['duplicate_of'], `inventory.json entry ${String(index)} duplicate_of`);
  }
  for (const [index, entry] of items(loadJson(join(out, REQUIRED_DOCUMENTS)))) {
    check(entry['file'], `${REQUIRED_DOCUMENTS} entry ${String(index)}`);
    const status = entry['status'];
    if (typeof status === 'string' && status.startsWith('near_duplicate_of:')) {
      check(
        status.slice('near_duplicate_of:'.length).trim(),
        `${REQUIRED_DOCUMENTS} entry ${String(index)} status`,
      );
    }
  }
  for (const [index, entry] of items(loadJson(join(out, 'ledger_changes.json')))) {
    check(entry['source_file'], `ledger_changes.json entry ${String(index)}`);
    if (entry['field'] === 'source_file') {
      check(entry['to'], `ledger_changes.json entry ${String(index)}`);
    }
  }
  for (const [index, entry] of items(loadJson(join(out, OPTIONAL_DONATIONS)))) {
    check(entry['source_file'], `${OPTIONAL_DONATIONS} item ${String(index)}`);
  }
  for (const [index, entry] of items(loadJson(join(out, OPTIONAL_TAX_PAYMENTS)))) {
    check(entry['payment_source'], `${OPTIONAL_TAX_PAYMENTS} item ${String(index)}`, carried);
    check(
      entry['bill_source'],
      `${OPTIONAL_TAX_PAYMENTS} item ${String(index)} bill_source`,
      carried,
    );
  }
  for (const [index, entry] of items(loadJson(join(out, OPTIONAL_HOME_COSTS)))) {
    check(entry['source_file'], `${OPTIONAL_HOME_COSTS} item ${String(index)}`, carried);
  }
  for (const name of ['questions.json', 'findings.json']) {
    for (const [index, entry] of items(loadJson(join(out, name)))) {
      const cites = entry['cites'];
      if (!Array.isArray(cites)) continue;
      for (const [citeIndex, cite] of cites.entries()) {
        check(cite, `${name} item ${String(index)} cite ${String(citeIndex)}`, carried);
      }
    }
  }
  return problems;
}

/** The prefix of the problem a booked row gets when it names a staged original by another
 *  spelling than its inbox path (issue #1558). */
export const SOURCE_FILE_NOT_INBOX_PATH = 'source_file_not_inbox_path';

/**
 * Where originals are staged, a booked row names its document as `inbox/<path>`, the spelling step
 * 3 writes (issue #1558): the tui's reconcile and score.py's line signature compare the string
 * raw, and the tui's organize and completeness find no file under a stem. A row whose file name or
 * stem is an original's but whose value is not that original's `inbox/` path (a bare name, the
 * reading's stem or path, another extension or folder) is refused; a digest-handed spelling (and a
 * carried home cost's or payment's) is copied as it was booked. A file name matching no original
 * is not this gate's to judge, and a change's arming `source_file` may still name a reading by its
 * stem (`reference/incremental.md`).
 */
function sourceFileSpellingProblems(workspace: string): Problem[] {
  const inbox = join(workspace, 'inbox');
  // The personal tool's staging walk skips every dot entry, so a dot path is no original.
  const inboxPaths = new Set(
    listFiles(inbox)
      .map((file) => relative(inbox, file).split(sep).join('/'))
      .filter((path) => !path.split('/').some((segment) => segment.startsWith('.'))),
  );
  if (inboxPaths.size === 0) return [];
  const originalNames = new Set<string>();
  for (const path of inboxPaths) {
    originalNames.add(basename(path));
    originalNames.add(withoutExtension(basename(path)));
  }
  const handed = handedSourceFiles(workspace);
  const carried = new Set([...handed, ...carriedSourceFiles(workspace)]);
  const out = join(workspace, 'out');
  const problems: Problem[] = [];
  const check = (value: unknown, name: string, allowed: ReadonlySet<string> = handed): void => {
    if (typeof value !== 'string' || allowed.has(value)) return;
    if (value.startsWith('inbox/') && inboxPaths.has(value.slice('inbox/'.length))) return;
    // A Windows separator names no folder on POSIX, so the tui would read it as one file name.
    const file = basename(value.replaceAll('\\', '/'));
    if (!originalNames.has(file) && !originalNames.has(withoutExtension(file))) return;
    problems.push(
      problem(
        'schema',
        `${SOURCE_FILE_NOT_INBOX_PATH}: ${name} names a staged original by another spelling than its inbox path; write inbox/ and the original's path, with its extension`,
      ),
    );
  };
  const rows = (file: string): [number, Json][] =>
    listOf(loadJson(join(out, file))).flatMap((raw, index) =>
      typeof raw === 'object' && raw !== null && !Array.isArray(raw)
        ? [[index, raw as Json] as [number, Json]]
        : [],
    );
  for (const [index, entry] of rows(REQUIRED_LEDGER)) {
    check(entry['source_file'], `${REQUIRED_LEDGER} item ${String(index)}`);
  }
  for (const [index, entry] of rows('ledger_changes.json')) {
    if (entry['field'] === 'source_file') {
      check(entry['to'], `ledger_changes.json entry ${String(index)} to`);
    }
  }
  for (const [index, entry] of rows(OPTIONAL_DONATIONS)) {
    check(entry['source_file'], `${OPTIONAL_DONATIONS} item ${String(index)}`);
  }
  for (const [index, entry] of rows(OPTIONAL_HOME_COSTS)) {
    check(entry['source_file'], `${OPTIONAL_HOME_COSTS} item ${String(index)}`, carried);
  }
  for (const [index, entry] of rows(OPTIONAL_TAX_PAYMENTS)) {
    check(entry['payment_source'], `${OPTIONAL_TAX_PAYMENTS} item ${String(index)}`, carried);
    check(
      entry['bill_source'],
      `${OPTIONAL_TAX_PAYMENTS} item ${String(index)} bill_source`,
      carried,
    );
  }
  return problems;
}

function withoutExtension(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(0, dot) : name;
}

/** The confirmed item digest by id; empty when confirmed/summaries.json is absent or unreadable. */
function digestItems(workspace: string): Map<string, Json> {
  const summaries = loadJson(join(workspace, 'confirmed', 'summaries.json'));
  if (summaries === null || typeof summaries !== 'object' || Array.isArray(summaries)) {
    return new Map();
  }
  const items = (summaries as Json).items;
  if (!Array.isArray(items)) return new Map();
  const digest = new Map<string, Json>();
  for (const raw of items) {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) continue;
    const id = strOrNull((raw as Json).id);
    if (id !== null) digest.set(id, raw as Json);
  }
  return digest;
}

/** The ids of the confirmed digest's held rows (`held`), or none. */
function heldDigestIds(workspace: string): Set<string> {
  const summaries = loadJson(join(workspace, 'confirmed', 'summaries.json'));
  const ids = new Set<string>();
  if (summaries === null || typeof summaries !== 'object' || Array.isArray(summaries)) return ids;
  const held = (summaries as Json).held;
  if (!Array.isArray(held)) return ids;
  for (const raw of held) {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) continue;
    const id = strOrNull((raw as Json).id);
    if (id !== null) ids.add(id);
  }
  return ids;
}

/** The keys of the staged answers whose person chose an offered option, for the web-values arm: a
 *  confirmed web value's one-writer rule keys on the answer alone (ADR 0030 item on web values),
 *  with no cited-line or effect-field test - those are the ledger change arm's own strictness. An
 *  answer the person typed in their own words arms nothing (ADR 0104 item 4), so it is not here. */
export function optionAnsweredKeysOf(workspace: string): Set<string> {
  const keys = new Set<string>();
  for (const [key, staged] of answersOf(workspace)) {
    if (optionEffectOf(staged) !== null) keys.add(key);
  }
  return keys;
}

/** The person's own words when they typed the answer: a string `text` and no string
 *  `optionId`; null for an answer that chose an option. */
function typedTextOf(staged: StagedAnswer): string | null {
  const answer = staged.answer;
  if (answer === null || typeof answer !== 'object' || Array.isArray(answer)) return null;
  const record = answer as Record<string, unknown>;
  const text = record['text'];
  return typeof text === 'string' && typeof record['optionId'] !== 'string' ? text : null;
}

/** The keys of the staged answers the person typed in their own words. Nothing the agent writes
 *  may name one (gate G10), but the purchase a typed `purchase` answer states in full (0161) and
 *  the place a typed `placement` answer names once a register answer created it (0167). */
function textAnsweredKeysOf(workspace: string): Set<string> {
  const keys = new Set<string>();
  for (const [key, staged] of answersOf(workspace)) {
    if (typedTextOf(staged) !== null) keys.add(key);
  }
  return keys;
}

export function answersOf(workspace: string): Map<string, StagedAnswer> {
  const loaded = loadJson(join(workspace, 'answers.json'));
  const map = new Map<string, StagedAnswer>();
  if (loaded === null || typeof loaded !== 'object' || Array.isArray(loaded)) return map;
  for (const [key, raw] of Object.entries(loaded)) {
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) continue;
    const entry = raw as Record<string, unknown>;
    const cites = entry['cites'];
    map.set(key, {
      options: entry['options'],
      answer: entry['answer'],
      cites: Array.isArray(cites) ? cites.filter((id): id is string => typeof id === 'string') : [],
    });
  }
  return map;
}

/** A row's move onto another schedule: the schedule it lands on, and the answer key whose `entity`
 *  effect arms the crossing change (null when no answer does). */
export interface ScheduleCrossing {
  readonly schedule: string;
  readonly armingKey: string | null;
}

/** Whether the answer chose a `trip_register` option: the trip the person confirmed. */
function isTripRegisterAnswer(staged: StagedAnswer): boolean {
  return optionEffectOf(staged)?.['kind'] === 'trip_register';
}

/** Whether a trip answer moves its trip to another place ("Change place", issue #1068): Bookette
 *  moves the trip's lines, so the answer arms their `entity` and crossing `line` too. */
function movesTripPlace(staged: StagedAnswer): boolean {
  const effect = parseEffect(optionEffectOf(staged));
  return (
    effect?.kind === 'trip_register' &&
    effect.tripKey !== undefined &&
    effect.entityKey !== undefined &&
    effect.remove !== true
  );
}

/** Whether the answer confirmed a found place that carries trips (issue #1068): Bookette ties the
 *  lines each trip covers, as it does for a confirmed trip. */
function confirmsFoundPlaceTrips(staged: StagedAnswer): boolean {
  return answeredTrips(staged).some((trip) => trip.foundPlace === true);
}

/**
 * The strict answer arm (task 11.4, ADR 0088): an answer arms a change only when its key is
 * staged, the changed item is one of the lines its question cited, and the chosen option's
 * ledger effect covers the changed field. This one predicate feeds the checker's gate and the
 * importer's `answer_keys` append, so a change the person never approved on that line cannot
 * import under an answer's name.
 */
export function answerArmsChange(
  change: Record<string, unknown>,
  answers: ReadonlyMap<string, StagedAnswer>,
  crossings: ReadonlyMap<string, ScheduleCrossing>,
): boolean {
  const key = change['answer_key'];
  const id = change['id'];
  if (typeof key !== 'string' || typeof id !== 'string') return false;
  const staged = answers.get(key);
  if (staged === undefined) return false;
  // A confirmed trip's move (issue #1022) arms the `trip` of the lines Bookette moves onto it,
  // cited or not (`tripRegisterChanges`); the model never writes one (`ledgerChangesProblems`).
  if (isTripRegisterAnswer(staged)) {
    return (
      change['field'] === 'trip' ||
      ((change['field'] === 'entity' || change['field'] === 'line') && movesTripPlace(staged))
    );
  }
  if (change['field'] === 'trip' && confirmsFoundPlaceTrips(staged)) return true;
  if (!staged.cites.includes(id)) return false;
  const effect = optionEffectOf(staged);
  // A placement's un-place (issue #1384, decision record 0150 and its #1384 amendment; the 0088
  // amendment): a `none` answer - `personal`, `not_mine` or `per_document` - to an `open_`
  // placement question arms an `entity` change to null on a line its question cites, and nothing
  // else, whatever its options carry, so a placement the person sent back and a run asked again
  // still takes its lines off the place. A `none` answer to any other question still arms
  // nothing, so a catalog question whose lines are placed by their nature (personal use, the home
  // bills) never un-places them, and neither does any other `none` option a run wrote ("not sure").
  if (effect !== null && effect['kind'] === 'none') {
    return unplacesPlacement(key, staged) && change['field'] === 'entity' && change['to'] === null;
  }
  // A move onto another schedule (issue #680): the entity answer that arms the crossing entity
  // change also arms the line change that chooses the line again on the target schedule, because
  // a line number means something else there. A same-schedule entity answer arms only `entity`.
  if (change['field'] === 'line') {
    const crossing = crossings.get(id);
    if (crossing !== undefined && crossing.armingKey !== null && crossing.armingKey === key) {
      return true;
    }
  }
  // A person's reading correction arms the amount, date or vendor of a line its question cites,
  // and only to the value the person gave (compared as cents for an amount): the importer appends
  // the key to `answer_keys` when this holds, which is the proof the correction applied.
  if (effect !== null && effect['kind'] === 'reading_correction') {
    // Only the code-owned namespace arms: a model-worded catalog option never does.
    return key.startsWith(CORRECT_READING_KEY_PREFIX) && correctionArmsChange(effect, change);
  }
  // A person's per-line correction arms the field it carries on the one line it cites, only to
  // the person's value (an amount compared as cents), only under its own code-owned namespace.
  if (effect !== null && effect['kind'] === 'line_correction') {
    return key.startsWith(CORRECT_LINE_KEY_PREFIX) && lineCorrectionArmsChange(effect, change);
  }
  // A confirmed found place (decision record 0123, the 0088 amendment of issue #907 part B): the
  // register answer's click declared the entity, and the run bundle staged the chosen option
  // under that row's `ent_<id>` key, so the answer arms an `entity` change on a line its question
  // cites, onto exactly that key — never a model-worded key, which no row can stand behind. The
  // crossing `line` change rides `crossing.armingKey` above, as an entity move's does.
  if (effect !== null && effect['kind'] === 'entity_register') {
    const entityKey = effect['entityKey'];
    return (
      change['field'] === 'entity' &&
      typeof entityKey === 'string' &&
      /^ent_\d+$/.test(entityKey) &&
      change['to'] === entityKey
    );
  }
  // A person's attached receipt (task 37.26, issue #1402) arms the `source_file` change the
  // importer derives for the one line its question cites, and only to the receipt's own document,
  // under its code-owned key. Its trip target emits no pair: the importer ties the lines it
  // inserts itself, so a `trip` change never carries this answer's key.
  if (effect !== null && effect['kind'] === 'attach_receipt') {
    const to = effect['to'];
    const target =
      to !== null && typeof to === 'object' && !Array.isArray(to)
        ? (to as Record<string, unknown>)['type']
        : undefined;
    return (
      key.startsWith(ATTACH_RECEIPT_KEY_PREFIX) &&
      target === 'line' &&
      change['field'] === 'source_file' &&
      typeof effect['documentKey'] === 'string' &&
      change['to'] === effect['documentKey']
    );
  }
  if (effect === null || effect['kind'] !== 'ledger') return false;
  const field = effect['field'];
  const armed = typeof field === 'string' ? EFFECT_ARMED_FIELDS[field] : undefined;
  if (armed === undefined || !armed.includes(change['field'] as string)) return false;
  // A settled answer settles its cited lines and never unsettles one (issue #1153).
  if (change['field'] === 'settled') return change['to'] === true;
  // An entity change lands only on the entity the option names (issue #658): the answer decided
  // that entity and no other.
  if (change['field'] === 'entity') {
    const to = effect['to'];
    const entityKey =
      to !== null && typeof to === 'object' && !Array.isArray(to)
        ? (to as Record<string, unknown>)['entityKey']
        : undefined;
    return typeof entityKey === 'string' && change['to'] === entityKey;
  }
  return true;
}

/** Whether an answer takes its question's lines off their place: the key is an `open_` placement
 *  key (never a catalog key), whatever its stored options carry, and the person chose one of the
 *  un-placing `none` options. A cited line already on no place has nothing to un-place. */
export function unplacesPlacement(key: string, staged: StagedAnswer): boolean {
  const chosen = chosenOptionOf(staged);
  return (
    isOpenPlacementKey(key) &&
    optionEffectOf(staged)?.['kind'] === 'none' &&
    typeof chosen === 'string' &&
    UNPLACING_OPTION_IDS.has(chosen)
  );
}

function correctionArmsChange(
  effect: Record<string, unknown>,
  change: Record<string, unknown>,
): boolean {
  const parsed = parseEffect(effect);
  if (parsed === null || parsed.kind !== 'reading_correction') return false;
  const to = change['to'];
  if (typeof to !== 'string') return false;
  for (const field of ['total', 'document_date', 'vendor_or_payer'] as const) {
    if (READING_CORRECTION_LEDGER_FIELD[field] !== change['field']) continue;
    const corrected = parsed.pages.filter((page) => page[field] !== undefined);
    const value = corrected[0]?.[field];
    if (corrected.length !== 1 || value === undefined) return false;
    if (field !== 'total') return value.to === to;
    const given = readingTotalCents(to);
    return given !== null && given === readingTotalCents(value.to);
  }
  return false;
}

function lineCorrectionArmsChange(
  effect: Record<string, unknown>,
  change: Record<string, unknown>,
): boolean {
  const parsed = parseEffect(effect);
  if (parsed === null || parsed.kind !== 'line_correction') return false;
  const to = change['to'];
  const field = change['field'];
  if (typeof to !== 'string') return false;
  if (field !== 'amount' && field !== 'date' && field !== 'vendor') return false;
  const value = parsed[field];
  if (value === undefined) return false;
  if (field !== 'amount') return value.to === to;
  const given = readingTotalCents(to);
  return given !== null && given === readingTotalCents(value.to);
}

function confirmedProblems(workspace: string): Problem[] {
  const dir = join(workspace, 'confirmed');
  if (!existsSync(dir)) return [];
  // The first run of a family has no confirmed/ directory at all; an empty one
  // means a lost or half-written state, never a first run.
  if (listFiles(dir).length === 0) {
    return [
      problem(
        'schema',
        'confirmed/ is empty; that is an error, not a first run - delete it or restore its files',
      ),
    ];
  }
  const summariesPath = join(dir, 'summaries.json');
  // A directory that carries files but no summaries.json is the same lost or
  // half-written state as an empty one, never a first run.
  if (!existsSync(summariesPath)) {
    return [
      problem(
        'schema',
        'confirmed/ carries files but no summaries.json; that is an error, not a first run - restore it or delete the directory',
      ),
    ];
  }
  const value = loadJson(summariesPath);
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return [
      problem(
        'schema',
        `confirmed/summaries.json must be a JSON object${value === null ? ', not valid JSON' : `, got ${typeName(value)}`}`,
      ),
    ];
  }
  const items = (value as Json).items;
  if (!Array.isArray(items)) {
    return [
      problem('schema', 'confirmed/summaries.json must carry an items list of digest entries'),
    ];
  }
  const held = (value as Json).held;
  if (held !== undefined && !Array.isArray(held)) {
    return [problem('schema', 'confirmed/summaries.json held must be a list when present')];
  }
  const problems: Problem[] = [];
  for (const [index, raw] of (held ?? []).entries()) {
    if (
      typeof raw !== 'object' ||
      raw === null ||
      Array.isArray(raw) ||
      strOrNull((raw as Json).id) === null
    ) {
      problems.push(
        problem(
          'schema',
          `confirmed/summaries.json held ${String(index)} must be an object with a string id`,
        ),
      );
    }
  }
  for (const [index, raw] of items.entries()) {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
      problems.push(
        problem('schema', `confirmed/summaries.json item ${String(index)} must be an object`),
      );
      continue;
    }
    const missing = DIGEST_KEYS.filter((key) => !(key in (raw as Json)));
    if (missing.length > 0) {
      problems.push(
        problem(
          'schema',
          `confirmed/summaries.json item ${String(index)} is missing keys: ${missing.join(', ')}`,
        ),
      );
    }
    const digestSchedule = (raw as Json).schedule;
    if (
      'schedule' in (raw as Json) &&
      digestSchedule !== null &&
      !(typeof digestSchedule === 'string' && DIGEST_SCHEDULES.includes(digestSchedule))
    ) {
      problems.push(
        problem(
          'schema',
          `confirmed/summaries.json item ${String(index)} field schedule must be C, E, K1 or null`,
        ),
      );
    }
    const digestLine = (raw as Json).line;
    if ('line' in (raw as Json) && digestLine !== null && typeof digestLine !== 'string') {
      problems.push(
        problem(
          'schema',
          `confirmed/summaries.json item ${String(index)} field line must be a string or null`,
        ),
      );
    }
    if ('tied' in (raw as Json) && typeof (raw as Json).tied !== 'boolean') {
      problems.push(
        problem(
          'schema',
          `confirmed/summaries.json item ${String(index)} field tied must be true or false`,
        ),
      );
    }
  }
  return problems;
}

function incrementalLedgerProblems(workspace: string, knownIds?: readonly string[]): Problem[] {
  if (knownIds === undefined && !existsSync(join(workspace, 'confirmed', 'summaries.json'))) {
    return [];
  }
  const ledger = loadJson(join(workspace, 'out', REQUIRED_LEDGER));
  if (!Array.isArray(ledger)) {
    return [
      problem(
        'schema',
        `${REQUIRED_LEDGER} must be a JSON list${ledger === null ? ', not valid JSON' : `, got ${typeName(ledger)}`}`,
      ),
    ];
  }
  // No short-circuit on an empty digest: a workspace whose rows are all held still bounds the
  // next run's ids (design note 8.6 item 6). A malformed digest is reported as schema.
  const known = new Set(knownIds ?? knownLedgerIds(workspace));
  let highest: { id: string; n: number } | null = null;
  for (const id of known) {
    const n = idNumber(id);
    if (n !== null && (highest === null || n > highest.n)) highest = { id, n };
  }
  const problems: Problem[] = [];
  for (const [index, raw] of ledger.entries()) {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) continue;
    const id = strOrNull((raw as Json).id);
    if (id === null) continue;
    // The addition contract: new ids continue past the confirmed and held
    // ones, and neither is ever re-stated.
    if (known.has(id)) {
      problems.push(
        problem('invariant', `${REQUIRED_LEDGER} re-states confirmed or held id ${id}`),
      );
      continue;
    }
    const n = idNumber(id);
    if (n === null) {
      problems.push(
        problem(
          'schema',
          `${REQUIRED_LEDGER} item ${String(index)} has an id that is not L0001-style, so additions cannot be ordered against the confirmed ids`,
        ),
      );
      continue;
    }
    if (highest !== null && n <= highest.n) {
      problems.push(
        problem(
          'invariant',
          `${REQUIRED_LEDGER} id ${id} must sort past the highest confirmed or held id ${highest.id}`,
        ),
      );
    }
  }
  return problems;
}

/**
 * The code-assigned-id gate (task 11.8): the ids in out/ledger.json must be the ones
 * `assignLedgerIds` would write. Runs on a first run too — where the incremental gate above
 * returns nothing and a shape-only `id` check would let any unique model string through — so the
 * code, not the model, owns the ids on every path. An item the incremental gate already names
 * (missing, non-L, re-stated, or below the high-water) is left to that gate; this one reports the
 * plausible-but-wrong assignment only.
 */
function assignedIdProblems(workspace: string, knownIds?: readonly string[]): Problem[] {
  const ledger = loadJson(join(workspace, 'out', REQUIRED_LEDGER));
  if (!Array.isArray(ledger)) return [];
  const known = new Set(knownIds ?? knownLedgerIds(workspace));
  const highest = ledgerHighWater([...known]);
  // The incremental gate runs whenever a baseline is known: a passed id list (the importer, from
  // Postgres) or the digest file (the agent's own run). It names a non-L, re-stated or below-water
  // id; this gate reports the plausible-but-wrong assignment only, so the two never duplicate.
  const gateNamesOrdering =
    knownIds !== undefined || existsSync(join(workspace, 'confirmed', 'summaries.json'));
  const expected = assignLedgerIds(ledger, [...known]);
  const problems: Problem[] = [];
  for (const [index, raw] of ledger.entries()) {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) continue;
    const id = strOrNull((raw as Json).id);
    if (id === null) continue;
    const n = idNumber(id);
    if (gateNamesOrdering) {
      if (n === null) continue;
      if (known.has(id)) continue;
      if (n <= highest) continue;
    }
    if (id !== expected[index]) {
      problems.push(
        problem(
          'invariant',
          `${REQUIRED_LEDGER} item ${String(index)} carries an id the code did not assign; ids come from the item facts, not the model`,
        ),
      );
    }
  }
  return problems;
}

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * This batch's document tokens (task 11.4, ADR 0088): the file names in a workspace's `inbox/`
 * (the eval path's originals) together with the stems of its staged `extractions/*.json` —
 * `doc_118` for the product path's readings. One set feeds the document arm, the coverage check
 * and the importer's provenance move, so the three can never disagree about what the batch was.
 */
export function batchNamesOf(workspace: string): Set<string> {
  const names = new Set<string>();
  const inbox = join(workspace, 'inbox');
  if (existsSync(inbox)) {
    for (const name of readdirSync(inbox)) names.add(name);
  }
  const extractions = join(workspace, 'extractions');
  if (existsSync(extractions)) {
    for (const name of readdirSync(extractions)) {
      if (name.endsWith('.json')) names.add(name.slice(0, -'.json'.length));
    }
  }
  return names;
}

// Kept for the eval harness's recorded workspaces, which stage their originals under `inbox/`
// alone; the batch predicate above is the one the gates read.
export function inboxNamesOf(workspace: string): Set<string> {
  const inbox = join(workspace, 'inbox');
  return new Set(existsSync(inbox) ? readdirSync(inbox) : []);
}

/** Whether a `source_file` names a batch token: by basename, or by basename minus its
 *  extension — so a reading staged as `extractions/IMG_2041.json` arms the same change its
 *  original `inbox/IMG_2041.png` would. */
function namesBatchToken(file: string, batchNames: ReadonlySet<string>): boolean {
  const name = basename(file);
  return batchNames.has(name) || batchNames.has(withoutExtension(name));
}

/**
 * The `source_file` that arms a ledger change, when it names a document in this batch, or null.
 * The one predicate for "armed by a batch document": the arming check below and the importer's
 * provenance move both read it.
 */
export function documentArmingSource(
  change: Record<string, unknown>,
  batchNames: ReadonlySet<string>,
): string | null {
  const file = change['source_file'];
  return typeof file === 'string' && namesBatchToken(file, batchNames) ? file : null;
}

/**
 * The document a ledger change gives its row: the `to` of a `source_file` change (null when it
 * clears it); otherwise the arming inbox `source_file`; otherwise undefined, meaning the change
 * leaves the row's provenance where it was.
 */
export function changeProvenance(
  change: Record<string, unknown>,
  inboxNames: ReadonlySet<string>,
): string | null | undefined {
  if (change['field'] === 'source_file') {
    const to = change['to'];
    return typeof to === 'string' ? to : null;
  }
  return documentArmingSource(change, inboxNames) ?? undefined;
}

/** The prefix of the problem a change under a confirmed trip's answer gets (issue #1022). */
export const TRIP_MOVED_BY_BOOKETTE = 'trip_moved_by_bookette';

/** The prefix of the problem a vendor, date or amount change armed by the changed item's own
 *  document gets (issue #984): a newer reading of the line's own document that disagrees is a
 *  finding, never a change. A superseding document of the batch (a corrected 1099) arms one. */
export const REREAD_IS_A_FINDING = 'reread_is_a_finding';

/** The fields a re-read of the line's own document never changes (issue #984). */
const REREAD_FIELDS = ['amount', 'date', 'vendor'];

/** The prefix of the problem a model change gets when the person's later answer decides the same
 *  field of the same item (issue #1376, the 0088 amendment; issue #1537 for a later placement). */
export const LATER_WORD_IS_THE_PERSONS = 'later_word_is_the_persons';

/** The prefix of the problem a document-armed `line` change gets on an item whose category the
 *  person corrected (issue #1376): the person's pick holds against every document. */
export const CATEGORY_IS_THE_PERSONS = 'category_is_the_persons';

/** The prefix of the problem a document-armed `entity` change gets on an item the person moved
 *  (issue #1782): the person's place holds against every document. */
export const PLACE_IS_THE_PERSONS = 'place_is_the_persons';

/**
 * The person's later word (issue #1376, the 0088 amendment): a model change armed by an answer
 * that stands earlier in answers.json than a later answer citing the same item, on the field that
 * later answer decides, whether the later one is consumed yet or not. A `line` change
 * under an earlier category answer yields to a later `correct_category:` pick, and an `entity`
 * change under any earlier answer to a later answer that decides the item's place
 * (`laterWordCites`: a `move_lines:` move, or a placement or register answer that places it or
 * takes it off its place). Without it, an earlier answer
 * the model applies "until the digest carries its key" lands over the person's later word once
 * Bookette's pair has consumed it. The crossing `line` change an entity answer arms is not a
 * category answer's, so a move onto the other schedule still chooses its line there.
 */
function supersededByLaterWord(change: Json, answers: ReadonlyMap<string, StagedAnswer>): boolean {
  const key = change.answer_key;
  const id = change.id;
  if (typeof key !== 'string' || typeof id !== 'string') return false;
  const staged = answers.get(key);
  if (staged === undefined) return false;
  if (change.field === 'entity') return laterWordCites(answers, key, id);
  if (change.field !== 'line') return false;
  const effect = optionEffectOf(staged);
  if (effect === null || effect['kind'] !== 'ledger' || effect['field'] !== 'category') {
    return false;
  }
  return laterAnswerCites(answers, key, id, CORRECT_CATEGORY_KEY_PREFIX);
}

/** Whether an answer under `prefix` that stands after `key` in answers.json cites the item. */
function laterAnswerCites(
  answers: ReadonlyMap<string, StagedAnswer>,
  key: string,
  id: string,
  prefix: string,
): boolean {
  const keys = [...answers.keys()];
  const at = keys.indexOf(key);
  if (at < 0) return false;
  return keys
    .slice(at + 1)
    .some((later) => later.startsWith(prefix) && answers.get(later)?.cites.includes(id) === true);
}

/** The code a refusal adds when a change's `to` is an object (issue #1143): the change carries
 *  the plain value, never the option effect's `to` object it was read from. */
export const CHANGE_TO_OBJECT = 'change_to_object';

/** The clause naming the expected shape when a change's `to` is an object, empty otherwise. It
 *  names the field and the shape and never echoes the object, which can carry a place's name. */
function objectToClause(change: Json): string {
  const to = change.to;
  if (to === null || typeof to !== 'object' || Array.isArray(to)) return '';
  const shape =
    change.field === 'entity'
      ? "an entity change's to is the entity key as a string (the effect's to.entityKey)"
      : change.field === 'line'
        ? "a line change's to is the schedule line as a string (the effect's to.scheduleLine), with a tag in a tag change of its own"
        : "a change's to is the plain value";
  return `; ${CHANGE_TO_OBJECT}: its to is an object, but ${shape}, never an option effect's to object`;
}

/** The confirmed digest's rows as the code-applied rule reads them. The digest carries no held
 *  row, currency or place, so the pairs read from them stay a superset of the importer's. */
function digestCodeAppliedRows(digest: ReadonlyMap<string, Json>): CodeAppliedRow[] {
  return [...digest.entries()].map(([ledgerId, item]) => ({
    ledgerId,
    status: 'CONFIRMED',
    answerKeys: stringList(item.answer_keys),
    amount: strOrNull(item.amount) ?? undefined,
    date: strOrNull(item.date) ?? undefined,
    vendor: strOrNull(item.vendor),
    line: strOrNull(item.line),
    schedule: strOrNull(item.schedule),
    sourceFile: strOrNull(item.source_file),
  }));
}

function ledgerChangesProblems(workspace: string): Problem[] {
  const path = join(workspace, 'out', 'ledger_changes.json');
  if (!existsSync(path)) return [];
  const value = loadJson(path);
  if (!Array.isArray(value)) {
    return [
      problem(
        'schema',
        `ledger_changes.json must be a JSON list${value === null ? ', not valid JSON' : `, got ${typeName(value)}`}`,
      ),
    ];
  }
  const digest = digestItems(workspace);
  const answers = answersOf(workspace);
  const batchNames = batchNamesOf(workspace);
  const crossings = scheduleCrossings(
    workspace,
    value.filter(
      (raw): raw is Json => typeof raw === 'object' && raw !== null && !Array.isArray(raw),
    ),
    answers,
  );
  const problems: Problem[] = [];
  // The pairs Bookette applies itself for a person's code-owned answer (issue #658): an agent
  // change on one would be a second writer of the same field.
  const owned = new Set<string>();
  const digestRows = digestCodeAppliedRows(digest);
  const staged = stagedEntitySchedules(workspace);
  // The slots a live correction guards, applied or skipped: the agent writes nothing there.
  const guarded = correctionGuardedSlots(answers, digestRows);
  try {
    for (const pair of codeAppliedChanges(answers, digestRows, undefined, batchNames, staged)) {
      owned.add(`${pair.id}\u0000${pair.field}`);
    }
  } catch (error) {
    if (!(error instanceof CodeAppliedError)) throw error;
    problems.push(
      problem('schema', 'answers.json carries a code-applied answer Bookette cannot apply'),
    );
  }
  const movedByPerson = personMovedLines(answers, staged);
  // Per id, the first provenance claim: every change to one row that claims a source must claim
  // the same one, so a value read from one document cannot be moved under another's name by a
  // later change to the same row (design note 8.6 item 4). A claim is a document (compared as
  // the exact string) or a source_file change to null; an answer-only change claims nothing and
  // conflicts with nothing.
  const provenanceById = new Map<string, { key: string; index: number }>();
  for (const [index, raw] of value.entries()) {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
      problems.push(
        problem('schema', `ledger_changes.json entry ${String(index)} must be an object`),
      );
      continue;
    }
    const entry = raw as Json;
    const missing = REQUIRED_CHANGE_KEYS.filter((key) => !(key in entry));
    if (missing.length > 0) {
      problems.push(
        problem(
          'schema',
          `ledger_changes.json entry ${String(index)} is missing keys: ${missing.join(', ')}`,
        ),
      );
      continue;
    }
    const id = strOrNull(entry.id);
    const field = strOrNull(entry.field);
    const confirmed = id === null ? undefined : digest.get(id);
    if (confirmed === undefined) {
      // A change names a confirmed item; ids are never echoed when the digest
      // does not carry them.
      problems.push(
        problem(
          'invariant',
          `ledger_changes.json entry ${String(index)} names an id the confirmed digest does not carry`,
        ),
      );
      continue;
    }
    if (field === null || !CHANGEABLE_FIELDS.includes(field)) {
      problems.push(
        problem(
          'schema',
          `ledger_changes.json entry ${String(index)} changes a field outside the changeable set: ${CHANGEABLE_FIELDS.join(', ')}`,
        ),
      );
      continue;
    }
    if (BASELINE_FIELDS.includes(field)) {
      if (!('from' in entry)) {
        problems.push(
          problem(
            'schema',
            `ledger_changes.json entry ${String(index)} changing ${field} requires from, the confirmed value it replaces`,
          ),
        );
      } else if (
        !deepEqual(entry.from, Object.hasOwn(confirmed, field) ? confirmed[field] : undefined)
      ) {
        // The baseline the entry claims must be the digest's own value, so a
        // change cannot be anchored to a fabricated prior state.
        problems.push(
          problem(
            'schema',
            `ledger_changes.json entry ${String(index)} does not carry the confirmed baseline for ${field}`,
          ),
        );
      }
    }
    // The crossing `line` change an entity answer arms is that answer's to write even where a
    // category pick owns the line in this call: the sandbox knows no row's place, so it cannot see
    // that the importer's pick yields to the move (code-applied.ts), and the move must choose its
    // line on the other schedule.
    const crossingLine =
      field === 'line' &&
      id !== null &&
      typeof entry.answer_key === 'string' &&
      crossings.get(id)?.armingKey === entry.answer_key;
    if (
      (owned.has(`${String(id)}\u0000${field}`) && !crossingLine) ||
      guarded.has(`${String(id)}\u0000${field}`)
    ) {
      problems.push(
        problem(
          'invariant',
          `ledger_changes.json entry ${String(index)} changes a field an answer applied by Bookette covers; remove it`,
        ),
      );
      continue;
    }
    // A move or correction answer's key is Bookette's: the model never writes a change under it,
    // even on a pair Bookette does not emit (a consumed, skipped or yielded one), but the crossing
    // pair a move arms on a row it has not moved yet, as an entity answer arms it (issue #1782):
    // the row's own schedule is not its target's, so its line is chosen again there.
    const appliesCrossingMove =
      (field === 'entity' || field === 'line') &&
      id !== null &&
      typeof entry.answer_key === 'string' &&
      crossings.get(id)?.armingKey === entry.answer_key &&
      !stringList(confirmed['answer_keys']).includes(entry.answer_key);
    if (
      typeof entry.answer_key === 'string' &&
      isCodeApplied(entry.answer_key) &&
      !appliesCrossingMove
    ) {
      problems.push(
        problem(
          'invariant',
          `ledger_changes.json entry ${String(index)} cites an answer key Bookette applies itself; remove it`,
        ),
      );
      continue;
    }
    // A confirmed trip takes its lines through Bookette at import (issue #1022): a change under
    // its answer's key would be the model's second writer of the same tie.
    const arming = typeof entry.answer_key === 'string' ? answers.get(entry.answer_key) : undefined;
    if (
      arming !== undefined &&
      (isTripRegisterAnswer(arming) || (entry.field === 'trip' && confirmsFoundPlaceTrips(arming)))
    ) {
      problems.push(
        problem(
          'invariant',
          `${TRIP_MOVED_BY_BOOKETTE}: ledger_changes.json entry ${String(index)} cites a trip answer; Bookette moves the lines a confirmed trip covers onto it, so remove it`,
        ),
      );
      continue;
    }
    const answerArmed = answerArmsChange(entry, answers, crossings);
    const armingDocument = documentArmingSource(entry, batchNames);
    if (answerArmed && supersededByLaterWord(entry, answers)) {
      problems.push(
        problem(
          'invariant',
          `${LATER_WORD_IS_THE_PERSONS}: ledger_changes.json entry ${String(index)} changes ${field} under an answer that stands before a later answer of the person's deciding the same field of the same item; the later answer decides, so remove it, and write the item's change under the later answer's key unless Bookette applies that answer itself`,
        ),
      );
      continue;
    }
    // A corrected category is the person's word against every document (issue #1376): a newer
    // reading never re-maps the line, as a re-read never changes its vendor, date or amount. A
    // document-armed move of a corrected line onto the other schedule is refused too, since its
    // crossing needs a `line` change: the person moves it with an answer instead.
    if (
      !answerArmed &&
      armingDocument !== null &&
      field === 'line' &&
      stringList(confirmed['answer_keys']).some((key) =>
        key.startsWith(CORRECT_CATEGORY_KEY_PREFIX),
      )
    ) {
      problems.push(
        problem(
          'invariant',
          `${CATEGORY_IS_THE_PERSONS}: ledger_changes.json entry ${String(index)} changes line armed by a document on an item whose category the person corrected; a document never changes the person's category, so remove it and record a finding if the document disagrees`,
        ),
      );
      continue;
    }
    // The person's place is their word against every document too (issue #1782), while it stands:
    // a row a move moved and that still has a place, or one a move still decides, takes its place
    // only from an answer. A row a later answer took off its place is free again.
    const movedThere =
      strOrNull(confirmed['schedule']) !== null &&
      stringList(confirmed['answer_keys']).some((key) => key.startsWith(MOVE_LINES_KEY_PREFIX));
    if (
      !answerArmed &&
      armingDocument !== null &&
      field === 'entity' &&
      id !== null &&
      (movedThere || movedByPerson.has(id))
    ) {
      problems.push(
        problem(
          'invariant',
          `${PLACE_IS_THE_PERSONS}: ledger_changes.json entry ${String(index)} changes entity armed by a document on an item the person moved; a document never changes the place the person chose, so remove it and record a finding if the document disagrees`,
        ),
      );
      continue;
    }
    if (!answerArmed && armingDocument === null) {
      problems.push(
        problem(
          'invariant',
          `ledger_changes.json entry ${String(index)} is armed by neither an answer in answers.json whose question cites it and whose option's effect covers the field, nor a document in this batch${objectToClause(entry)}`,
        ),
      );
    }
    // A newer reading of the document the confirmed line itself cites is a disagreement (issue
    // #984): it never arms a change to the line's vendor, date or amount. Only another document
    // of the batch that supersedes it, such as a corrected 1099, does. "Its own document" is
    // sameDocument, the match step 1's `matched: source` candidate uses, so
    // `extractions/lumen_1099nec.json` is `inbox/lumen_1099nec.jpg`.
    if (
      !answerArmed &&
      armingDocument !== null &&
      REREAD_FIELDS.includes(field) &&
      typeof confirmed['source_file'] === 'string' &&
      sameDocument(armingDocument, confirmed['source_file'])
    ) {
      problems.push(
        problem(
          'invariant',
          `${REREAD_IS_A_FINDING}: ledger_changes.json entry ${String(index)} changes ${field} armed by the document the item's own source_file names; a newer reading of the line's own document that disagrees is a finding, not a change, so remove it and record the finding`,
        ),
      );
      continue;
    }
    const provenance = changeProvenance(entry, batchNames);
    if (provenance === undefined || id === null) continue;
    const key = provenance === null ? 'none' : `document:${provenance}`;
    const first = provenanceById.get(id);
    if (first === undefined) {
      provenanceById.set(id, { key, index });
    } else if (first.key !== key) {
      problems.push(
        problem(
          'invariant',
          `ledger_changes.json entries ${String(first.index)} and ${String(index)} change one item from different source documents`,
        ),
      );
    }
  }
  return problems;
}

/** The staged `profile.json` (Postgres-built) entity schedules; empty when absent or malformed. */
function stagedEntitySchedules(workspace: string): Map<string, string> {
  return entitySchedulesFrom(loadJson(join(workspace, 'profile.json')));
}

/** The entry index, change and last position of each id's last `entity` change in file order,
 *  whatever its `to`: the order the importer's union folds, so the last one decides the row. */
function lastEntityChanges(
  changes: readonly Json[],
  digest: ReadonlyMap<string, Json>,
): Map<string, { index: number; change: Json }> {
  const last = new Map<string, { index: number; change: Json }>();
  for (const [index, change] of changes.entries()) {
    const id = strOrNull(change.id);
    if (change.field !== 'entity' || id === null || !digest.has(id)) continue;
    last.set(id, { index, change });
  }
  return last;
}

/**
 * The rows a run's changes move onto another schedule (issue #680): per id, the last `entity`
 * change in file order decides, whatever its `to`, and the row crosses when that `to` is a key of
 * the staged `profile.json` whose staged schedule is C or E and differs from the digest item's
 * `schedule` (null for an unassigned row). A last change to null, or to a same-schedule entity,
 * cancels an earlier crossing one. `armingKey` is that change's answer key when an `entity`
 * effect arms it. Pure over the workspace files; the importer calls it over its rebuilt copy.
 */
export function scheduleCrossings(
  workspace: string,
  changes: readonly Record<string, unknown>[],
  answers: ReadonlyMap<string, StagedAnswer>,
): Map<string, ScheduleCrossing> {
  const digest = digestItems(workspace);
  const staged = stagedEntitySchedules(workspace);
  const crossings = new Map<string, ScheduleCrossing>();
  for (const [id, { change }] of lastEntityChanges(changes, digest)) {
    const to = strOrNull(change.to);
    const target = to === null ? undefined : staged.get(to);
    if (target !== 'C' && target !== 'E') continue;
    const from = strOrNull(digest.get(id)?.schedule);
    if (from === target) continue;
    crossings.set(id, {
      schedule: target,
      armingKey: answerArmsChange(change, answers, new Map())
        ? (strOrNull(change.answer_key) ?? null)
        : null,
    });
  }
  return crossings;
}

function scheduleTables(rules: YearRules): Record<string, Record<string, unknown>> | null {
  const loaded = loadJson(join(rules.dir, 'schedule_lines.json'));
  if (loaded === null || typeof loaded !== 'object' || Array.isArray(loaded)) return null;
  const tables: Record<string, Record<string, unknown>> = {};
  for (const schedule of ['C', 'E']) {
    const table = (loaded as Json)[schedule];
    if (table === null || typeof table !== 'object' || Array.isArray(table)) return null;
    tables[schedule] = table as Record<string, unknown>;
  }
  return tables;
}

/**
 * Every precondition `build_books` places a confirmed row under that a change can break, as one
 * judgment the sandbox and the importer share (issue #680): the sandbox's own build sees only
 * the additions, so without this a change the importer's union rebuild refuses would pass step 8
 * and wedge every run. A finding names the entry index and never a value. Line changes are judged
 * against the row's post-move schedule whatever their order relative to the entity change.
 */
function scheduleMoveProblems(workspace: string, rules: YearRules): Problem[] {
  const value = loadJson(join(workspace, 'out', 'ledger_changes.json'));
  if (!Array.isArray(value)) return [];
  const tables = scheduleTables(rules);
  if (tables === null) {
    return [problem('schema', `the skill ships no readable ${rules.label}schedule_lines.json`)];
  }
  const digest = digestItems(workspace);
  const answers = answersOf(workspace);
  const staged = stagedEntitySchedules(workspace);
  const resolved = entitySchedulesOf(workspace);
  const stagedNames = entityNamesFrom(loadJson(join(workspace, 'profile.json')));
  const resolvedNames = entityNamesFrom(loadJson(join(workspace, 'out', 'profile.resolved.json')));
  const changes = value.map((raw): Json | null =>
    typeof raw === 'object' && raw !== null && !Array.isArray(raw) ? (raw as Json) : null,
  );
  const objects = changes.filter((change): change is Json => change !== null);
  const crossings = scheduleCrossings(workspace, objects, answers);
  const lastEntity = lastEntityChanges(objects, digest);
  const trips = new Set<string>();
  const profile = loadJson(join(workspace, 'out', 'profile.resolved.json'));
  const tripList =
    profile !== null && typeof profile === 'object' && !Array.isArray(profile)
      ? (profile as Json).trips
      : undefined;
  if (Array.isArray(tripList)) {
    for (const raw of tripList) {
      const key =
        typeof raw === 'object' && raw !== null && !Array.isArray(raw)
          ? strOrNull((raw as Json).key)
          : null;
      if (key !== null) trips.add(key);
    }
  }
  // The post-move schedule of a row: the last entity change's target, else the digest's own.
  // undefined when the change names no staged entity (that entry is refused on its own).
  const postSchedule = (id: string): string | null | undefined => {
    const last = lastEntity.get(id);
    if (last === undefined) return strOrNull(digest.get(id)?.schedule);
    const to = strOrNull(last.change.to);
    if (to === null) return null;
    return staged.get(to);
  };
  const lineKey = (to: unknown): string | null =>
    typeof to === 'string' || typeof to === 'number' ? String(to) : null;
  const fits = (schedule: string | null, to: unknown): boolean => {
    const key = lineKey(to);
    if (key === null) return false;
    if (schedule === 'K1') return key !== '';
    if (schedule === 'C' || schedule === 'E') {
      return Object.hasOwn(tables[schedule] ?? {}, key);
    }
    return Object.hasOwn(tables.C ?? {}, key) || Object.hasOwn(tables.E ?? {}, key);
  };
  const problems: Problem[] = [];
  const lineChanged = new Map<string, boolean>();
  for (const [index, change] of changes.entries()) {
    if (change === null) continue;
    const id = strOrNull(change.id);
    if (id === null || !digest.has(id)) continue;
    const name = `ledger_changes.json entry ${String(index)}`;
    if (change.field === 'line') {
      const post = postSchedule(id);
      if (post === undefined) continue;
      lineChanged.set(id, true);
      if (!fits(post, change.to)) {
        problems.push(
          problem(
            'invariant',
            `${name} sets a line that does not fit the schedule its row sits on after the move${objectToClause(change)}`,
          ),
        );
      }
    } else if (change.field === 'trip') {
      if (typeof change.to === 'string' && !trips.has(change.to)) {
        problems.push(
          problem('invariant', `${name} names a trip out/profile.resolved.json does not carry`),
        );
      }
    } else if (change.field === 'entity') {
      const to = strOrNull(change.to);
      if (strOrNull(digest.get(id)?.schedule) === 'K1') {
        problems.push(problem('invariant', `${name} moves an item off a K-1 interest`));
        continue;
      }
      if (to === null) continue;
      const target = staged.get(to);
      if (target === undefined) {
        problems.push(
          problem('invariant', `${name} names an entity the staged profile does not carry`),
        );
      } else if (target !== 'C' && target !== 'E') {
        problems.push(
          problem('invariant', `${name} moves an item onto an entity that is not a C or E entity`),
        );
      } else if (resolved.get(to) !== target) {
        problems.push(
          problem(
            'invariant',
            `${name} names an entity whose schedule out/profile.resolved.json changed from the staged one`,
          ),
        );
      } else if (resolvedNames.get(to) !== stagedNames.get(to)) {
        // The write joins an entity through its profile name (#658's name-join guard): a name the
        // agent changed lands the change on another register row or none.
        problems.push(
          problem(
            'invariant',
            `${name} names an entity whose name out/profile.resolved.json changed from the staged one`,
          ),
        );
      }
    }
  }
  for (const id of crossings.keys()) {
    const last = lastEntity.get(id);
    if (last === undefined) continue;
    const name = `ledger_changes.json entry ${String(last.index)}`;
    if (digest.get(id)?.tied === true) {
      problems.push(
        problem(
          'invariant',
          `${name} moves a trip- or vehicle-tied item to another schedule; edit its trip or vehicle first`,
        ),
      );
    } else if (lineChanged.get(id) !== true) {
      problems.push(
        problem(
          'invariant',
          `${name} moves an item to another schedule without a line change to a line of the target schedule; a line number means something else there`,
        ),
      );
    }
  }
  return problems;
}

/** A date span: earliest start through latest end, as ISO days. */
type Span = { from: string; to: string };

/**
 * The spans applies_to references name, resolvable from out/: a trip's
 * earliest segment start through its latest segment end, or a ledger item's
 * date. Anything else - an unknown key shape, a trip or id out/ does not
 * carry - is absent from the maps and is not checked. Built once per gate
 * run, not once per reference.
 */
function appliesSpans(workspace: string): { trips: Map<string, Span>; ledger: Map<string, Span> } {
  const trips = new Map<string, Span>();
  const profile = loadJson(join(workspace, 'out', 'profile.resolved.json'));
  if (profile !== null && typeof profile === 'object' && !Array.isArray(profile)) {
    const list = (profile as Json).trips;
    if (Array.isArray(list)) {
      for (const raw of list) {
        if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) continue;
        const trip = raw as Json;
        if (typeof trip.key !== 'string' || !Array.isArray(trip.segments)) continue;
        const starts: string[] = [];
        const ends: string[] = [];
        for (const segment of trip.segments) {
          if (typeof segment !== 'object' || segment === null || Array.isArray(segment)) continue;
          const start = strOrNull((segment as Json).start);
          const end = strOrNull((segment as Json).end);
          if (start !== null && isValidDay(start)) starts.push(start);
          if (end !== null && isValidDay(end)) ends.push(end);
        }
        starts.sort();
        ends.sort();
        const from = starts[0];
        const to = ends[ends.length - 1];
        if (from !== undefined && to !== undefined) trips.set(trip.key, { from, to });
      }
    }
  }
  const ledger = new Map<string, Span>();
  const items = loadJson(join(workspace, 'out', REQUIRED_LEDGER));
  if (Array.isArray(items)) {
    for (const raw of items) {
      if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) continue;
      const item = raw as Json;
      const id = strOrNull(item.id);
      const date = strOrNull(item.date);
      if (id === null || date === null || !isValidDay(date)) continue;
      ledger.set(id, { from: date, to: date });
    }
  }
  return { trips, ledger };
}

function webValuesProblems(
  workspace: string,
  rulesDir: string,
  rulesCovered: (key: string) => boolean,
): Problem[] {
  const out = join(workspace, 'out');
  const path = join(out, 'web_values.json');
  if (!existsSync(path)) return [];
  const value = loadJson(path);
  if (!Array.isArray(value)) {
    return [
      problem(
        'schema',
        `web_values.json must be a JSON list${value === null ? ', not valid JSON' : `, got ${typeName(value)}`}`,
      ),
    ];
  }
  const problems: Problem[] = [];
  const entries: [number, Json][] = [];
  for (const [index, raw] of value.entries()) {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
      problems.push(problem('schema', `web_values.json item ${String(index)} must be an object`));
      continue;
    }
    const entry = raw as Json;
    const missing = WEB_VALUE_KEYS.filter((key) => !(key in entry));
    if (missing.length > 0) {
      problems.push(
        problem(
          'schema',
          `web_values.json item ${String(index)} is missing keys: ${missing.join(', ')}`,
        ),
      );
      continue;
    }
    entries.push([index, entry]);
  }

  const confirmedValues = readWebValues(join(workspace, 'confirmed', 'web_values.json'));
  const answers = optionAnsweredKeysOf(workspace);
  const spans = appliesSpans(workspace);
  const flagged = new Set<number>();
  // Abacus resolves a key case-insensitively and takes the first matching
  // entry, so two entries of one folded key with overlapping periods and
  // different citations leave the value it uses to search order. The same rule
  // as the stickiness check below; named by index only.
  const byFoldedKey = new Map<string, [number, Json, Period][]>();
  for (const [index, entry] of entries) {
    const entryKey = strOrNull(entry.key);
    const entryPeriod = parsePeriod(entry.effective_period);
    if (entryKey === null || entryPeriod === null) continue;
    const folded = foldValueKey(entryKey);
    const group = byFoldedKey.get(folded) ?? [];
    for (const [earlier, earlierEntry, earlierPeriod] of group) {
      if (periodsOverlap(earlierPeriod, entryPeriod) && !sameCitation(earlierEntry, entry)) {
        problems.push(
          problem(
            'invariant',
            `web_values.json items ${String(earlier)} and ${String(index)} record one key for overlapping periods with different citations`,
          ),
        );
      }
    }
    group.push([index, entry, entryPeriod]);
    byFoldedKey.set(folded, group);
  }
  for (const [index, entry] of entries) {
    // Field-level schema: the citation must be well formed before any
    // contract question about it is worth asking.
    const name = `web_values.json item ${String(index)}`;
    const key = strOrNull(entry.key);
    const parsedKey = key === null ? null : parseValueKey(key);
    if (parsedKey === null) {
      problems.push(
        problem(
          'schema',
          `${name} has a key that is not a rules address; write it as plain dotted names, per_diem.oconus_mie.locations.Taipei.mie`,
        ),
      );
    } else if (!existsSync(join(rulesDir, parsedKey.file))) {
      problems.push(problem('schema', `${name} names a rules file the rules data does not carry`));
    } else if (rulesCovered(key ?? '')) {
      problems.push(
        problem(
          'invariant',
          `${name} addresses a key the rules data already carries; rules win, so nothing is recorded for it`,
        ),
      );
    }
    const url = strOrNull(entry.url);
    let parsedUrl: URL | null = null;
    if (url === null) {
      problems.push(problem('schema', `${name} url must be a string`));
    } else {
      try {
        parsedUrl = new URL(url);
      } catch {
        parsedUrl = null;
      }
      if (parsedUrl === null || parsedUrl.protocol !== 'https:') {
        problems.push(problem('schema', `${name} url must be an https URL`));
      } else if (!parsedUrl.hostname.endsWith('.gov')) {
        problems.push(problem('schema', `${name} url host must end in .gov`));
      }
    }
    const fetchedAt = strOrNull(entry.fetched_at);
    if (
      fetchedAt === null ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/.test(fetchedAt) ||
      Number.isNaN(Date.parse(fetchedAt))
    ) {
      problems.push(problem('schema', `${name} fetched_at must be an ISO-8601 timestamp`));
    }
    const quoted = entry.quoted_text;
    if (typeof quoted !== 'string' || quoted.trim().length === 0) {
      problems.push(problem('schema', `${name} quoted_text must be a non-empty string`));
    } else if (quoted.length >= 2000) {
      problems.push(problem('schema', `${name} quoted_text must stay under 2000 characters`));
    }
    if (typeof entry.value !== 'string' || !/^[+-]?\d+(\.\d{1,12})?$/.test(entry.value)) {
      problems.push(problem('schema', `${name} value must be a decimal string`));
    }
    const period = parsePeriod(entry.effective_period);
    if (period === null) {
      problems.push(
        problem('schema', `${name} effective_period must be {from, to?} with ISO days`),
      );
    }
    if (
      !Array.isArray(entry.applies_to) ||
      entry.applies_to.some((ref) => typeof ref !== 'string')
    ) {
      problems.push(
        problem('schema', `${name} applies_to must be a list of trip or ledger references`),
      );
    }
    if (
      !Array.isArray(entry.answer_keys) ||
      entry.answer_keys.some((ref) => typeof ref !== 'string')
    ) {
      problems.push(problem('schema', `${name} answer_keys must be a list of answer keys`));
    }

    // The period the source states must actually cover the whole span of
    // what the entry applies to, where out/ resolves the reference - the
    // same whole-span rule the builder resolves rates by; unresolved
    // references are not checked.
    if (period !== null && Array.isArray(entry.applies_to)) {
      for (const [refIndex, ref] of entry.applies_to.entries()) {
        if (typeof ref !== 'string') continue;
        const span = ref.startsWith('trip:')
          ? spans.trips.get(ref.slice(5))
          : spans.ledger.get(ref);
        if (
          span === undefined ||
          (periodCovers(period, span.from) && periodCovers(period, span.to))
        )
          continue;
        problems.push(
          problem(
            'invariant',
            `${name} effective period does not cover applies_to item ${String(refIndex)}`,
          ),
        );
      }
    }

    // Stickiness: a confirmed value is reused verbatim - fetched_at is
    // inherently per-run and answer_keys carry the one way to change it - so
    // every other field must match the confirmed record.
    if (parsedKey !== null && period !== null) {
      for (const confirmed of confirmedValues) {
        if (
          typeof confirmed.key !== 'string' ||
          key === null ||
          foldValueKey(confirmed.key) !== foldValueKey(key)
        )
          continue;
        const confirmedPeriod = parsePeriod(confirmed.effective_period);
        if (confirmedPeriod === null || !periodsOverlap(period, confirmedPeriod)) continue;
        if (sameCitation(confirmed, entry)) break;
        const armed =
          Array.isArray(entry.answer_keys) &&
          entry.answer_keys.some((ref) => typeof ref === 'string' && answers.has(ref));
        if (armed) break;
        if (!flagged.has(index)) {
          flagged.add(index);
          problems.push(
            problem(
              'invariant',
              `${name} contradicts the confirmed record for its key and period; only an answer key may change a confirmed value`,
            ),
          );
        }
        break;
      }
    }
  }
  return problems;
}

// --- the question and findings contract (task 11.5) -----------------------------------------

interface CatalogEffect {
  kind: string;
  field?: string;
}
interface CatalogEntry {
  key: string;
  effects: CatalogEffect[];
  blast_radius: string;
}

/** The effect list of one catalog object (an entry or the `open` object), parsed leniently: an
 *  entry that is not an object, or an effect that is malformed, contributes nothing. */
function parseCatalogEffects(effects: unknown): CatalogEffect[] {
  const parsed: CatalogEffect[] = [];
  if (!Array.isArray(effects)) return parsed;
  for (const rawEffect of effects) {
    if (typeof rawEffect !== 'object' || rawEffect === null || Array.isArray(rawEffect)) continue;
    const kind = strOrNull((rawEffect as Json).kind);
    if (kind === null) continue;
    if (kind === 'ledger') {
      // A ledger entry must name the one field it allows; an absent or unknown field is a
      // malformed entry, so it allows nothing rather than any field (fail closed).
      const field = strOrNull((rawEffect as Json).field);
      if (
        field === 'category' ||
        field === 'entity' ||
        field === 'trip_assignment' ||
        field === 'settled'
      ) {
        parsed.push({ kind, field });
      }
    } else {
      parsed.push({ kind });
    }
  }
  return parsed;
}

interface QuestionCatalog {
  /** The catalog keys, each with the effects its entry allows. */
  entries: Map<string, CatalogEntry>;
  /** The contract of the agent's own `open_` questions; null when the skill ships none readable,
   *  which refuses every open key (fail closed). */
  open: CatalogEntry | null;
  /** The key recipe's fact kinds (`open.facts`), each with what its subject names; empty when
   *  the skill ships none readable, which refuses every open key, a staged one included (fail
   *  closed). */
  openFacts: Map<string, OpenQuestionSubject>;
  /** The fact kinds whose questions may mark one option `recommended` (issue #1070): the
   *  `open.facts` entries carrying `"recommended": true`. Empty when none does, which refuses the
   *  flag on every question (fail closed). */
  recommendedFacts: Set<string>;
  /** The fact kinds whose `open.facts` entry fixes its options (issue #1153): each option's id,
   *  label and effect kind, in order. */
  fixedOptions: Map<string, FixedOption[]>;
}

/** One option a fact's catalog entry fixes: the id, the label as the person reads it, and the
 *  effect kind (with its field, for a ledger effect). */
interface FixedOption {
  id: string;
  label: string;
  effect: CatalogEffect;
}

/** The `open.facts` entries carrying an `options` list, each option parsed strictly: an entry
 *  with a malformed option fixes none of its options, so its questions are refused (fail closed). */
function parseFixedOptions(raw: unknown): Map<string, FixedOption[]> {
  const fixed = new Map<string, FixedOption[]>();
  if (!Array.isArray(raw)) return fixed;
  for (const entry of raw) {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) continue;
    const fact = strOrNull((entry as Json).fact);
    const options = (entry as Json).options;
    if (fact === null || options === undefined) continue;
    const parsed: FixedOption[] = [];
    for (const raw of Array.isArray(options) ? options : []) {
      const head = optionHeadOf(raw);
      if (typeof head === 'string' || head.label === null) break;
      const [effect] = parseCatalogEffects([head.option.effect]);
      if (effect === undefined) break;
      parsed.push({ id: head.id, label: head.label, effect });
    }
    fixed.set(fact, Array.isArray(options) && parsed.length === options.length ? parsed : []);
  }
  return fixed;
}

/** The fact kinds of the catalog's `open.facts` that carry `"recommended": true`. */
function parseRecommendedFacts(raw: unknown): Set<string> {
  const facts = new Set<string>();
  if (!Array.isArray(raw)) return facts;
  for (const entry of raw) {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) continue;
    const fact = strOrNull((entry as Json).fact);
    if (fact !== null && (entry as Json).recommended === true) facts.add(fact);
  }
  return facts;
}

/** The catalog the skill ships; null when it is absent or malformed. */
function loadQuestionCatalog(skillDir: string): QuestionCatalog | null {
  const value = loadJson(join(skillDir, 'rules', 'question_catalog.json'));
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
  const entries = (value as Json).entries;
  if (!Array.isArray(entries)) return null;
  const catalog = new Map<string, CatalogEntry>();
  for (const raw of entries) {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) continue;
    const key = strOrNull((raw as Json).key);
    const effects = (raw as Json).effects;
    if (key === null || !Array.isArray(effects)) continue;
    catalog.set(key, {
      key,
      effects: parseCatalogEffects(effects),
      blast_radius: strOrNull((raw as Json).blast_radius) ?? 'none',
    });
  }
  const openRaw = (value as Json).open;
  const openEffects =
    typeof openRaw === 'object' && openRaw !== null && !Array.isArray(openRaw)
      ? (openRaw as Json).effects
      : undefined;
  const open: CatalogEntry | null = Array.isArray(openEffects)
    ? { key: '<open>', effects: parseCatalogEffects(openEffects), blast_radius: 'derived' }
    : null;
  const factsRaw =
    typeof openRaw === 'object' && openRaw !== null && !Array.isArray(openRaw)
      ? (openRaw as Json).facts
      : undefined;
  const openFacts = parseOpenFacts(factsRaw);
  return {
    entries: catalog,
    open,
    openFacts,
    recommendedFacts: parseRecommendedFacts(factsRaw),
    fixedOptions: parseFixedOptions(factsRaw),
  };
}

/**
 * An option's effect is allowed for its key when the catalog lists its kind; for a `ledger` effect
 * the catalog's field must equal the effect's field *and* the value's own type, so a
 * category-only key cannot carry an entity reassignment through a mislabelled payload.
 */
function effectAllowed(entry: CatalogEntry, effect: Effect): boolean {
  return entry.effects.some((allowed) => catalogEffectMatches(allowed, effect));
}

/** Whether an effect is of one catalog effect's kind: for a `ledger` effect, on its field, with
 *  the value's own type that field. */
function catalogEffectMatches(allowed: CatalogEffect, effect: Effect): boolean {
  if (allowed.kind !== effect.kind) return false;
  if (effect.kind !== 'ledger') return true;
  return allowed.field === effect.field && effect.to.type === effect.field;
}

/** An option's object, its id and its label, read alike by the question loop and the catalog's
 *  fixed options: `object` when it is no object, `id` when it carries no non-empty string id, and
 *  a null label when it carries no string one. */
function optionHeadOf(
  raw: unknown,
): { option: Json; id: string; label: string | null } | 'object' | 'id' {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return 'object';
  const option = raw as Json;
  const id = strOrNull(option.id);
  if (id === null || id === '') return 'id';
  return { option, id, label: strOrNull(option.label) };
}

/**
 * Every `questions.json` item must carry a catalog key or an `open_` key (the importer derives the
 * kind from the key, so the item writes none), a prompt of 1 to 300 characters, and every option a
 * string id and a parseable effect the key allows (0019 item 7). A run whose key is neither, whose
 * prompt or option is malformed or untypeable, or whose label, prompt or payload string quotes a
 * money figure is a failure, before any person sees the question.
 */
function questionProblems(workspace: string, skillDir: string, rules: YearRules): Problem[] {
  const catalog = loadQuestionCatalog(skillDir);
  if (catalog === null) {
    return [problem('schema', 'the skill ships no readable rules/question_catalog.json')];
  }
  const questions = loadJson(join(workspace, 'out', 'questions.json'));
  if (!Array.isArray(questions)) return [];
  const problems: Problem[] = [];
  const profileEntities = entitySchedulesOf(workspace);
  // A K-1 interest's items carry box numbers, not lines, so no move onto or off one is offered
  // (issue #680, founder ruling 3): the entity is K-1 by either profile's word, the cited item by
  // the digest's schedule or, for an addition, its own schedule or entity.
  const stagedEntities = stagedEntitySchedules(workspace);
  const isK1Entity = (key: string): boolean =>
    stagedEntities.get(key) === 'K1' || profileEntities.get(key) === 'K1';
  const digest = digestItems(workspace);
  const additions = new Map<string, Json>();
  const additionList = loadJson(join(workspace, 'out', REQUIRED_LEDGER));
  if (Array.isArray(additionList)) {
    for (const raw of additionList) {
      if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) continue;
      const id = strOrNull((raw as Json).id);
      if (id !== null) additions.set(id, raw as Json);
    }
  }
  const citesK1Item = (cites: unknown): boolean =>
    Array.isArray(cites) &&
    cites.some((cite) => {
      if (typeof cite !== 'string') return false;
      if (strOrNull(digest.get(cite)?.schedule) === 'K1') return true;
      const addition = additions.get(cite);
      if (addition === undefined) return false;
      const entity = strOrNull(addition.entity);
      return addition.schedule === 'K1' || (entity !== null && isK1Entity(entity));
    });
  // A register option's cited lines will be booked under the declared row by the next run (0123
  // item 8, the 0088 amendment), so the question may cite only lines that move can take: never
  // a trip- or vehicle-tied row, a held row, or an addition that is held once imported (a status
  // other than `confirmed`: the importer stores `flagged` and `unclassified` as held rows that
  // take no change) or is tied to a trip or a vehicle — each a line `scheduleMoveProblems` or the importer would refuse to
  // move, so the sentence would promise what the run cannot keep. The importer may still lower a
  // confirmed addition to flagged after this check (a could-not-read source): that residual
  // stays with the next run, which finds the row held.
  const heldIds = heldDigestIds(workspace);
  // This run's trip and line changes, read only when a placement question needs them.
  let runChanges: RunLineChanges | null = null;
  let tripDocuments: ((source: string) => boolean) | null = null;
  const citesUnmovableLine = (cites: unknown): boolean =>
    Array.isArray(cites) &&
    cites.some((cite) => {
      if (typeof cite !== 'string') return false;
      if (heldIds.has(cite)) return true;
      const row = digest.get(cite);
      if (row !== undefined) return row.tied === true;
      const addition = additions.get(cite);
      if (addition === undefined) return false;
      return (
        addition.status !== 'confirmed' ||
        strOrNull(addition.trip) !== null ||
        strOrNull(addition.vehicle) !== null
      );
    });
  // The cap (G7): code can count entries only, so a re-ask counts too; a stable key the run could
  // not ask is asked by the run the answers queue.
  // A stored placement (issue #1384) is shown, never asked, so it is not counted.
  const askedCount = askedQuestionCount(questions);
  if (askedCount > MAX_QUESTIONS_PER_RUN) {
    problems.push(
      problem(
        'schema',
        `questions.json asks ${String(askedCount)} questions; a run asks at most ${String(MAX_QUESTIONS_PER_RUN)} - keep the ones the books need most, the rest can be asked next run`,
      ),
    );
  }
  const answered = answersOf(workspace);
  const movedLines = personMovedLines(answered, stagedEntities);
  const offeredSchedules = new Map<string, string>();
  const stagedProfile = loadJson(join(workspace, 'profile.json'));
  const stagedKinds = entityKindsFrom(stagedProfile);
  const resolvedKinds = entityKindsFrom(loadJson(join(workspace, 'out', 'profile.resolved.json')));
  // The applier's parity (decision record 0123, issue #907 part B): every `entity_register`
  // option must be one the person could confirm, so the names the staged profile carries are
  // folded as the declare core folds them for its duplicate refusal, and the register options of
  // the whole file are compared with each other by fold and by key.
  // A staged business's aliases are names it goes by (issue #1159), so a register option naming
  // one would declare a second place under a name the first already answers to.
  const stagedNameKeys = new Set(
    [
      ...stagedEntityNames(stagedProfile),
      ...[...stagedKinds.values()].flatMap((entity) => entity.aliases),
    ].map(entityNameKey),
  );
  // A staged rental's reserved names (issue #1388): the bare channel names of the places the person
  // folded into it, which the declare core refuses as a folded place's name, so a register option
  // naming one could never be confirmed.
  const reservedNameKeys = new Set(
    [...stagedKinds.values()].flatMap((entity) => entity.reservedNames).map(entityNameKey),
  );
  // The listings the staged rentals carry that name an id (issue #1387).
  const stagedListings = [...stagedKinds.values()].flatMap((entity) =>
    entity.listings.filter((listing) => listingDigits(listing).length > 0),
  );
  // The name each profile key carries, the staged profile's over the resolved one's: an entity
  // move names its target by the name the person confirms, and the confirm compares it with the
  // row the key names, which a run's resolved profile cannot rename (issue #1070's review: a
  // sentence naming one place must not write to another, nor dead-end at the confirm).
  const profileNames = new Map([
    ...entityNamesFrom(loadJson(join(workspace, 'out', 'profile.resolved.json'))),
    ...entityNamesFrom(stagedProfile),
  ]);
  const registerKeyByName = new Map<string, string>();
  const registerQuestionByKey = new Map<string, number>();
  // The address each declared place's match carries, across the file (issue #1070).
  const matchedAddresses = new Map<string, string>();
  // The aliases each declared business's matches carry, folded, across the file (issue #1159):
  // every one may be confirmed, so together with the staged ones they keep the declaration's bound.
  const matchedAliases = new Map<string, Set<string>>();
  // The listings each declared rental's matches carry, by listing key, and the rental each
  // listing is matched onto, across the file (issue #1387): every one may be confirmed, so they
  // keep the declaration's bound together with the staged ones, and one listing is one rental's.
  const matchedListings = new Map<string, Set<string>>();
  const listingMatchedOnto = new Map<
    string,
    { readonly target: string; readonly question: number }
  >();
  // The key recipe's inputs (reference/steps/4-ask.md, src/scripts/question_keys.ts): a staged
  // open question keeps the key it was asked under; every other open key must be the one
  // `pipeline.js build` spells from its fact, cites and options and what the run knows.
  const recipe = keyContextOf(workspace, skillDir, catalog.openFacts);
  // Whether a question's cited documents print a listing (issue #1387), each document read once.
  const printed = printedListingsOf(workspace, skillDir, recipe);
  // The staged places carrying a found address, by fold or by a cited reading's standard form.
  const addressHolders = stagedAddressHoldersOf(workspace, recipe);
  const seenQuestionKeys = new Set<string>();
  const stagedOpenEntries = stagedOpenEntriesOf(workspace);
  problems.push(
    ...stagedRegisterDroppedProblems(
      workspace,
      new Set(questions.map((raw) => strOrNull(recordOf(raw)?.key)).filter((k) => k !== null)),
      answered,
      recipe.facts,
      movedLines,
    ),
  );
  const placementLineAskedBy = new Map<string, number>();
  // The lines a pass-through question holds (issue #1153): those an answered one cited — the
  // person said whether they are income of their own — and those a staged OPEN one asks about,
  // which no other question takes while it waits, so no later answer can place a line the person
  // may yet settle. No question asks where any of them belongs.
  const settledByPassThrough = passThroughHeldLines(workspace, recipe.facts);
  // Of those, the lines an `inside` answer settled: no question of any kind cites them.
  const settledLines = settledLinesOf(workspace, recipe.facts);
  // This run's open-column lines: only the pass_through question asks about them.
  const openColumn = openColumnLines(workspace, [...additions.values()]);
  for (const [index, raw] of questions.entries()) {
    const name = `questions.json item ${String(index)}`;
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
      problems.push(problem('schema', `${name} must be an object`));
      continue;
    }
    const question = raw as Json;
    const key = strOrNull(question.key);
    if (key === null) {
      problems.push(
        problem(
          'schema',
          typeof question.fact === 'string'
            ? `${name} has no key; run pipeline.js build, which spells it from the question's fact${keyReason(question, recipe)}`
            : `${name} has no key`,
        ),
      );
      continue;
    }
    // One question per fact: the importer equates questions by key, so a second one would
    // overwrite the first.
    if (seenQuestionKeys.has(key)) {
      problems.push(
        problem('schema', `${name} repeats an earlier question's key; ask one question per fact`),
      );
      continue;
    }
    seenQuestionKeys.add(key);
    // Review orders a run's questions by a code rule over their effects (decision record 0166):
    // a rank the agent writes is refused rather than ignored, so no run believes it orders them.
    const ranked = QUESTION_RANK_FIELDS.filter((field) => field in question);
    if (ranked.length > 0) {
      problems.push(
        problem(
          'schema',
          `${name} carries ${ranked.join(', ')}: Review orders the questions itself, so a question carries no rank`,
        ),
      );
    }
    // Options naming two treatments of one cost ask the person to choose what invariant 5 leaves
    // to the accountant (issue #1080): the report shows both readings and a finding names the
    // choice. Read before the key is resolved, so a question under a retired or unknown key
    // hears the reason too. The message names the alternative, never a value it carries.
    const choice = treatmentChoiceOf(question);
    if (choice !== null) {
      problems.push(
        problem(
          'invariant',
          `${name} offers a choice between ${choice}, which is the accountant's: ask only for facts, and write a method_comparison finding (step 7)`,
        ),
      );
    }
    const isOpen = isOpenQuestionKey(key);
    let entry: CatalogEntry | undefined;
    if (isOpen) {
      if (catalog.open === null || catalog.openFacts.size === 0) {
        problems.push(
          problem(
            'schema',
            `${name} is an open_ question but the skill ships no readable open-question contract`,
          ),
        );
        continue;
      }
      entry = catalog.open;
    } else {
      entry = catalog.entries.get(key);
      if (entry === undefined) {
        problems.push(
          problem(
            'schema',
            key.startsWith(OPEN_QUESTION_KEY_PREFIX)
              ? `${name} key starts with open_ but is not snake_case of at most 64 characters`
              : `${name} key is not in the question catalog and is not an open_ key`,
          ),
        );
        continue;
      }
    }
    // The kind is never read: Bookette derives it from the key (ADR 0104 item 2).
    const rawPrompt = typeof question.prompt === 'string' ? question.prompt : '';
    const prompt = rawPrompt.trim();
    if (prompt === '') {
      problems.push(problem('schema', `${name} has no prompt`));
      continue;
    }
    if (prompt.length > QUESTION_PROMPT_MAX_LENGTH || rawPrompt.includes('\u0000')) {
      problems.push(
        problem(
          'schema',
          `${name} prompt is longer than ${String(QUESTION_PROMPT_MAX_LENGTH)} characters or carries a control character`,
        ),
      );
      continue;
    }
    if (questionHelpOf(question.help) === null) {
      problems.push(
        problem(
          'schema',
          `${name} has no help line of 1 to ${String(QUESTION_HELP_MAX_LENGTH)} characters with no control character`,
        ),
      );
      continue;
    }
    const freeText = question.allow_free_text;
    if (freeText !== undefined && typeof freeText !== 'boolean') {
      problems.push(problem('schema', `${name} allow_free_text is not true or false`));
      continue;
    }
    if (freeText === true && !isOpen) {
      problems.push(problem('schema', `${name} allow_free_text is allowed on an open_ key only`));
      continue;
    }
    if (isOpen && answered.has(key)) {
      problems.push(
        problem(
          'invariant',
          `${name} is an answered open_ key and may not be asked again; a follow-up is a question of the same fact, which pipeline.js build keys with _2 (then _3)`,
        ),
      );
    }
    if (key === UNASSIGNED_LINE_ENTITY_KEY && answered.has(key)) {
      problems.push(
        problem(
          'invariant',
          `${name} is an answered ${UNASSIGNED_LINE_ENTITY_KEY} and may not be asked again; ask the lines' property or business under an open_ key`,
        ),
      );
    }
    const options = question.options;
    if (!Array.isArray(options) || (options.length === 0 && freeText !== true)) {
      problems.push(problem('schema', `${name} has no options and does not allow a typed answer`));
      continue;
    }
    // The question's fact kind, from its key or its hint: an address and a recommended option
    // ride only the kinds the rules below name.
    const questionFact = isOpen ? (questionFactOf(question, recipe.facts)?.fact ?? null) : null;
    const seenOptionIds = new Set<string>();
    const recommendedAt: number[] = [];
    let recommendedEffect: Effect | null = null;
    let hasLedgerEffect = false;
    let hasEntityOption = false;
    const registerSchedules = new Set<string>();
    const thisQuestionOffers = new Map<string, string>();
    const optionEffects: Effect[] = [];
    // A found rental's question offers every staged rental (issue #1387): the places its options
    // book the lines to, and whether one of its register options proposes a rental.
    const offeredEntities = new Set<string>();
    let registersRental = false;
    // The listing a payout-found rental's register option carries (issue #1468): every rental
    // option of the same question carries it too, so a manual pick records it.
    const registerListing = registerListingOf(options);
    for (const [optionIndex, rawOption] of options.entries()) {
      const optionName = `${name} option ${String(optionIndex)}`;
      const head = optionHeadOf(rawOption);
      if (head === 'object') {
        problems.push(problem('schema', `${optionName} must be an object`));
        continue;
      }
      if (head === 'id') {
        problems.push(problem('schema', `${optionName} has no id`));
        continue;
      }
      const { option, id: optionId } = head;
      if (seenOptionIds.has(optionId)) {
        problems.push(problem('schema', `${optionName} repeats an earlier option id`));
        continue;
      }
      seenOptionIds.add(optionId);
      if (head.label === null) {
        problems.push(problem('schema', `${optionName} has no label`));
        continue;
      }
      // The recommended flag (issue #1070) is written as `true` on the one option it marks, and
      // never as anything else.
      if (option.recommended !== undefined) {
        if (option.recommended === true) {
          recommendedAt.push(optionIndex);
          // The recommended answer names a place: the matched place's move or the register
          // option. A `none` answer is never chosen for the person.
          const marked = parseEffect(option.effect);
          recommendedEffect ??= marked;
          if (marked?.kind === 'none') {
            problems.push(
              problem(
                'schema',
                `${optionName} is a none option marked recommended; recommend the matched place's option or the entity_register option`,
              ),
            );
          }
        } else {
          problems.push(
            problem(
              'schema',
              `${optionName} recommended is not true; write it only on the option you recommend, as true`,
            ),
          );
        }
      }
      // A trip rides the option's effect (`parseEffect`'s `trips`); one beside it lands nowhere.
      if (option.trips !== undefined) {
        problems.push(
          problem(
            'schema',
            `${optionName} carries trips beside its effect; write them as the effect's trips (reference/steps/4-ask.md)`,
          ),
        );
      }
      const effect = parseEffect(option.effect);
      if (effect === null) {
        problems.push(
          problem(
            'schema',
            registerPlacementRefused(option.effect)
              ? `${optionName} entity_register effect must carry exactly one of address and listing when it registers a rental, and neither when it registers a business; write the address the documents print, or the listing a payout statement prints (${REGISTER_PLACEMENT})`
              : `${optionName} effect is untypeable: a ledger effect is {kind:"ledger", field, from, to} with to one of {type:"category", scheduleLine, tag}, {type:"entity", entityKey, entityName} or {type:"trip_assignment", tripClass}; reference/steps/4-ask.md spells every effect kind as exact JSON`,
          ),
        );
        continue;
      }
      optionEffects.push(effect);
      // A listing rides an entity's `to` value alone (issue #1387): the parse reads it nowhere
      // else, so a listing anywhere else is refused here rather than dropped unseen.
      if (strayListing(option.effect)) {
        problems.push(
          problem(
            'schema',
            `${optionName} effect carries a listing outside an entity's to value; only a found rental's match records one, on the to value of the option that books its lines to that rental`,
          ),
        );
      }
      if (effect.kind === 'ledger' && effect.to.type === 'entity') {
        offeredEntities.add(effect.to.entityKey);
      }
      if (effect.kind === 'entity_register' && effect.entityKind !== 'BUSINESS') {
        registersRental = true;
      }
      if (
        effect.kind === 'ledger' &&
        effect.field === 'settled' &&
        questionFact !== PASS_THROUGH_FACT
      ) {
        problems.push(
          problem(
            'schema',
            `${optionName} offers to settle lines off the books, which only a pass_through question's inside option does`,
          ),
        );
      }
      if (effect.kind === 'ledger') {
        hasLedgerEffect = true;
        // An entity assignment names entities of this run's profile (issue #658, D5): the
        // importer resolves the key against the same profile, so a key it does not carry could
        // only fail the import. This closes the 8.6 residual.
        if (effect.field === 'entity') {
          hasEntityOption = true;
          if (effect.to.type === 'entity' && isK1Entity(effect.to.entityKey)) {
            problems.push(
              problem('schema', `${optionName} effect moves a line onto a K-1 interest entity`),
            );
          }
          const named = [effect.to, effect.from];
          const unknown = named.some(
            (value) =>
              value !== null && value.type === 'entity' && !profileEntities.has(value.entityKey),
          );
          if (unknown) {
            problems.push(
              problem(
                'schema',
                `${optionName} effect names an entity out/profile.resolved.json does not carry`,
              ),
            );
          }
        }
        for (const value of [effect.to, effect.from]) {
          if (value?.type !== 'entity') continue;
          const carried = profileNames.get(value.entityKey);
          if (carried !== undefined && entityNameKey(carried) !== entityNameKey(value.entityName)) {
            problems.push(
              problem(
                'schema',
                `${optionName} effect names an entity by another name than the profile gives its key; copy the profile's name for the key`,
              ),
            );
          }
        }
        problems.push(
          ...matchAddressProblems(optionName, effect, questionFact, stagedKinds, (address) =>
            addressHolders(address, question.cites),
          ),
        );
        const aliasProblems = matchAliasProblems(optionName, effect, questionFact, stagedKinds);
        problems.push(...aliasProblems);
        if (
          aliasProblems.length === 0 &&
          effect.to.type === 'entity' &&
          effect.to.alias !== undefined
        ) {
          const key = effect.to.entityKey;
          const aliases = matchedAliases.get(key) ?? new Set<string>();
          aliases.add(entityNameKey(effect.to.alias));
          matchedAliases.set(key, aliases);
          const staged = stagedKinds.get(key)?.aliases.length ?? 0;
          if (staged + aliases.size > DECLARED_ALIASES_MAX_COUNT) {
            problems.push(
              problem(
                'schema',
                `${optionName} effect carries one more name than a business may keep with the names profile.json and the file's earlier options give it; ask about the rest in a later run`,
              ),
            );
          }
        }
        const listingProblems = matchListingProblems(
          optionName,
          effect,
          questionFact,
          stagedKinds,
          (listing) => printed(listing, question.cites),
        );
        problems.push(...listingProblems);
        if (
          listingProblems.length === 0 &&
          effect.to.type === 'entity' &&
          effect.to.listing !== undefined
        ) {
          const target = effect.to.entityKey;
          const key = listingKey(effect.to.listing);
          const onto = listingMatchedOnto.get(key);
          // The options of one question are alternatives, so a register option's listing rides each
          // of its rental options (issue #1468); across questions one listing is one place's.
          const alternatives = onto?.question === index && key === registerListing?.key;
          if (onto !== undefined && onto.target !== target && !alternatives) {
            problems.push(
              problem(
                'schema',
                `${optionName} effect carries a listing an earlier option records on another rental; one listing belongs to one rental, so record it only on the option the documents point to`,
              ),
            );
          } else if (onto === undefined) {
            listingMatchedOnto.set(key, { target, question: index });
          }
          const listings = matchedListings.get(target) ?? new Set<string>();
          listings.add(key);
          matchedListings.set(target, listings);
          const staged = stagedKinds.get(target)?.listings.length ?? 0;
          if (staged + listings.size > DECLARED_LISTINGS_MAX_COUNT) {
            problems.push(
              problem(
                'schema',
                `${optionName} effect carries one more listing than a rental may keep with the listings profile.json and the file's earlier options give it; ask about the rest in a later run`,
              ),
            );
          }
        }
        problems.push(
          ...foundRentalListingProblems(
            optionName,
            effect,
            questionFact,
            registerListing,
            stagedKinds,
          ),
        );
        // One recorded field per option (issue #1387): a statement printing a listing records the
        // listing, and the address path serves one that prints none, so no confirm writes two.
        const recorded =
          effect.to.type === 'entity'
            ? [effect.to.address, effect.to.alias, effect.to.listing].filter(
                (field) => field !== undefined,
              ).length
            : 0;
        if (recorded > 1) {
          problems.push(
            problem(
              'schema',
              `${optionName} effect records more than one of an address, an alias and a listing; an option records one, the listing when the statement prints one`,
            ),
          );
        }
        // One address per declared place across the file (issue #1070's review): two found
        // places matched to one place with two spellings would refuse the second confirm of one
        // batch as a place that already has another address.
        if (effect.to.type === 'entity' && effect.to.address !== undefined) {
          const earlier = matchedAddresses.get(effect.to.entityKey);
          if (earlier !== undefined && earlier !== effect.to.address) {
            problems.push(
              problem(
                'schema',
                `${optionName} effect carries another address for a place an earlier option already gives one; write the one address the documents print for it on each`,
              ),
            );
          } else {
            matchedAddresses.set(effect.to.entityKey, effect.to.address);
          }
        }
      }
      if (effect.kind === 'entity_register') {
        // The treatment gate (G9, ADR 0104 item 3): Schedule E or C for a short-term rental is the
        // accountant's call, so an option never registers one, never names one the profile
        // already carries as one, and never moves an entity to another schedule. Checked on every
        // key. Messages name the option, never the entity.
        registerSchedules.add(effect.schedule);
        const staged = effect.entityKey;
        const carriedAsStr =
          stagedKinds.get(staged)?.kind === 'short_term_rental' ||
          resolvedKinds.get(staged)?.kind === 'short_term_rental';
        if (effect.entityKind === 'STR_RENTAL' || carriedAsStr) {
          problems.push(
            problem(
              'schema',
              `${optionName} offers to register a short-term rental; its schedule is the accountant's call - record the facts and write a fair_rental_days finding`,
            ),
          );
        }
        // The entity's schedule as the staged profile has it, else as the run's resolved profile
        // has it; and across the file, the schedule an earlier question offered for the key.
        const stagedSchedule = stagedEntities.get(staged) ?? profileEntities.get(staged);
        const offered = offeredSchedules.get(staged);
        if (offered !== undefined && offered !== effect.schedule) {
          problems.push(
            problem(
              'schema',
              `${optionName} offers entity_register options on different schedules; that is a treatment choice`,
            ),
          );
        }
        thisQuestionOffers.set(staged, effect.schedule);
        if (stagedSchedule !== undefined && stagedSchedule !== effect.schedule) {
          problems.push(
            problem(
              'schema',
              `${optionName} offers to move an entity to another schedule; that is a treatment choice`,
            ),
          );
        }
        // The applier's parity (0123 items 3 to 5, 7; issue #907 part B): what the confirm
        // would refuse is refused here, so the person never meets a dead end on an option
        // the run wrote. The name and share go through the declaration's own validator (the
        // code and the field name the reason, never the value); the schedule must be the
        // kind's own; the name must not fold onto a staged entity's (the core's duplicate
        // refusal) or onto another register option's under a different key; and one question
        // offers each key, since one row is declared per confirmed option.
        const validated = validateDeclaredEntity(
          {
            kind: effect.entityKind,
            name: effect.entityName,
            ownershipPct: effect.ownershipPct === null ? null : String(effect.ownershipPct),
            ...(effect.address !== undefined ? { address: effect.address } : {}),
          },
          // The effect carries no ended month, the one field the year bounds; the year is the
          // staged profile's, the one the rules-year gate resolved.
          { taxYear: rules.year },
        );
        if (!validated.ok) {
          problems.push(
            problem(
              'schema',
              `${optionName} entity_register ${validated.field} would be refused at the confirmation (${validated.code}); word it as a person could type it`,
            ),
          );
        }
        if (effect.schedule !== scheduleOfKind(effect.entityKind)) {
          problems.push(
            problem(
              'schema',
              `${optionName} offers a schedule that is not its kind's own; a rental is Schedule E and a business Schedule C`,
            ),
          );
        }
        problems.push(
          ...registerPlacementProblems(
            optionName,
            effect,
            stagedKinds,
            (listing) => printed(listing, question.cites),
            (address) => addressHolders(address, question.cites),
          ),
        );
        if (effect.listing !== undefined) {
          const registeredKey = listingKey(effect.listing);
          const earlier = listingMatchedOnto.get(registeredKey);
          const target = `register:${effect.entityKey}`;
          if (earlier !== undefined && earlier.target !== target && earlier.question !== index) {
            problems.push(
              problem(
                'schema',
                `${optionName} entity_register effect carries a listing another question records on another place; one listing belongs to one place`,
              ),
            );
          } else if (earlier === undefined) {
            listingMatchedOnto.set(registeredKey, { target, question: index });
          }
        }
        const nameKey = entityNameKey(effect.entityName);
        if (reservedNameKeys.has(nameKey)) {
          problems.push(
            problem(
              'schema',
              `${optionName} offers to register a place under a name the person folded into a staged rental (${RESERVED_NAME_REGISTER}); a reserved name names none of the person's places, so ask which of them the lines belong to as a placement question`,
            ),
          );
        }
        if (stagedNameKeys.has(nameKey)) {
          problems.push(
            problem(
              'schema',
              `${optionName} offers to register a business or property the staged profile already carries; offer the existing one with a ledger/entity option instead`,
            ),
          );
        }
        // A listing a staged rental carries names that rental (issue #1387): a place found under
        // it is not found, so its lines book to the rental and nothing is asked. A name naming it
        // anywhere in its words counts, not only as its first word.
        if (stagedListings.some((listing) => nameCarriesListing(effect.entityName, listing))) {
          problems.push(
            problem(
              'schema',
              `${optionName} offers to register a place under a listing a staged rental carries in profile.json; a place profile.json carries by listing is not found, so book its lines to that rental and ask nothing`,
            ),
          );
        }
        const earlierKey = registerKeyByName.get(nameKey);
        if (earlierKey !== undefined && earlierKey !== staged) {
          problems.push(
            problem(
              'schema',
              `${optionName} repeats another entity_register option's name under a different key; one key per found place`,
            ),
          );
        } else if (earlierKey === undefined) {
          registerKeyByName.set(nameKey, staged);
        }
        // A found place has no row yet: only the run bundle stages the `ent_<id>` shape, from
        // the answer's link to the row its confirmation declared, so an option written under
        // that namespace would claim a row that does not exist.
        if (/^ent_\d+$/.test(staged)) {
          problems.push(
            problem(
              'schema',
              `${optionName} offers an entity_register option under an ent_ key; a found place takes a key of your own until its confirmation declares the row`,
            ),
          );
        }
        // The key recipe: a found place's key is spelled from its name (pipeline.js build writes
        // it), so two runs reading the same document key it alike.
        if (staged !== placeSubject(effect.entityName, recipe.flagged)) {
          problems.push(
            problem(
              'schema',
              `${optionName} entity_register entityKey is not the one pipeline.js build spells from its entityName; run the build, which writes it`,
            ),
          );
        }
        if (citesUnmovableLine(question.cites)) {
          problems.push(
            problem(
              'schema',
              `${name} offers an entity_register option but cites a line no move can take - a trip- or vehicle-tied row or a held row; cite only the lines the place would book`,
            ),
          );
        }
        const earlierQuestion = registerQuestionByKey.get(staged);
        if (earlierQuestion !== undefined && earlierQuestion !== index) {
          problems.push(
            problem(
              'schema',
              `${optionName} offers an entity key questions.json item ${String(earlierQuestion)} already offers; ask one question per found place`,
            ),
          );
        } else if (earlierQuestion === undefined) {
          registerQuestionByKey.set(staged, index);
        }
      }
      if (!effectAllowed(entry, effect)) {
        problems.push(problem('schema', `${optionName} effect kind is not allowed for this key`));
      }
    }
    for (const [offeredKey, offeredSchedule] of thisQuestionOffers) {
      offeredSchedules.set(offeredKey, offeredSchedule);
    }
    if (registerSchedules.size > 1) {
      problems.push(
        problem(
          'schema',
          `${name} offers entity_register options on different schedules; that is a treatment choice`,
        ),
      );
    }
    // A found rental may be any rental the person declared (issue #1387): its register question
    // offers each staged rental's ledger/entity option beside the register option, however many
    // there are, so the person can say which one it is.
    const stagedEntry = isOpen ? recordOf(stagedOpenEntries.get(key)) : null;
    const reasksStagedPlace =
      questionFact === 'register' &&
      stagedEntry !== null &&
      !optionEffects.some((effect) => effect.kind === 'entity_register');
    const reasked = reasksStagedPlace
      ? reaskedPlaceProblems(
          name,
          key,
          options,
          stagedKinds,
          stagedEntry,
          question.cites,
          digestItems(workspace),
          additions,
          (listing) => printed(listing, question.cites),
          movedLines,
        )
      : null;
    if (
      questionFact === 'register' &&
      (registersRental || reasked?.rental === true) &&
      [...stagedKinds].some(
        ([key, entity]) =>
          entity.kind !== null &&
          PROPERTY_PROFILE_KINDS.has(entity.kind) &&
          !offeredEntities.has(key),
      )
    ) {
      problems.push(
        problem(
          'schema',
          `${name} asks about a found rental without a ledger/entity option for every rental profile.json stages; offer each staged rental beside the entity_register option, even past four options`,
        ),
      );
    }
    if (reasked !== null) problems.push(...reasked.problems);
    // A fact whose catalog entry fixes its options (issue #1153) is asked with exactly them, and
    // carries `recommended` only where the build's tie-out puts it (issue #1530).
    const fixed = questionFact === null ? undefined : catalog.fixedOptions.get(questionFact);
    // The recommended option (issue #1070): the Review card pre-selects it, so it is the first
    // option, there is at most one, and only a question whose fact the catalog lets carry one
    // (`open.facts` `recommended`: a found place, which place a line belongs to) marks one — on
    // any other question a pre-selected answer would be Bookette choosing for the person, and on
    // a category or a repair question a treatment (rule 4). A placement's recommended answer is a
    // place (issue #1534): its `ledger`/`entity` option. A staged key spelled before the recipe
    // whose options place lines is a placement here too, as its trips are (decision record 0164).
    const placesAsStagedKey =
      questionFact === null && stagedEntry !== null && optionEffects.some(placesLines);
    const recommendingFact = placesAsStagedKey ? 'placement' : questionFact;
    if (recommendedAt.length > 0 && fixed === undefined) {
      if (recommendingFact === null || !catalog.recommendedFacts.has(recommendingFact)) {
        const recommending = [...catalog.recommendedFacts].sort().join(', ');
        problems.push(
          problem(
            'schema',
            `${name} marks an option recommended, which only a question of a fact the catalog lets recommend may (rules/question_catalog.json open.facts: ${recommending === '' ? 'none' : recommending}); write no recommended flag on it`,
          ),
        );
      } else if (recommendedAt.length > 1) {
        problems.push(
          problem(
            'schema',
            `${name} marks more than one option recommended; mark only the most likely one`,
          ),
        );
      } else if (recommendedAt[0] !== 0) {
        problems.push(
          problem(
            'schema',
            `${name} marks an option recommended that is not its first option; put the recommended option first`,
          ),
        );
      } else if (
        options.some(
          (option) =>
            typeof option === 'object' && option !== null && (option as Json).placed === true,
        )
      ) {
        problems.push(
          problem(
            'schema',
            `${name} marks an option both placed and recommended; a recommendation is asked, never placed, so write one flag or the other`,
          ),
        );
      } else if (
        recommendingFact === 'placement' &&
        recommendedEffect !== null &&
        recommendedEffect.kind !== 'none' &&
        !(
          recommendedEffect.kind === 'ledger' &&
          recommendedEffect.field === 'entity' &&
          recommendedEffect.to.type === 'entity'
        )
      ) {
        problems.push(
          problem(
            'schema',
            `${name} marks a placement option recommended that books the lines to no place; recommend only its first ledger/entity option`,
          ),
        );
      }
    }
    if (fixed !== undefined) {
      const tie =
        questionFact === PASS_THROUGH_FACT
          ? passThroughTieOf(
              Array.isArray(question.cites) ? (question.cites as unknown[]) : [],
              [...additions.values()],
              documentEntriesOf(workspace).map(({ entry }) => entry),
            )
          : null;
      problems.push(...fixedOptionProblems(name, question, fixed, tie));
    }
    if (questionFact === PASS_THROUGH_FACT) {
      problems.push(...passThroughProblems(name, question, additions));
    }
    // A ledger effect is scoped by selector — the lines the question cites — so the question must
    // cite at least one ledger id; an empty selector has nothing to apply the answer to.
    const cites = question.cites;
    const citesALine =
      Array.isArray(cites) && cites.some((cite) => typeof cite === 'string' && /^L\d+$/.test(cite));
    if (hasEntityOption && citesK1Item(question.cites)) {
      problems.push(
        problem('schema', `${name} offers an entity move for a line on a K-1 interest`),
      );
    }
    if (hasLedgerEffect && !citesALine) {
      problems.push(problem('schema', `${name} carries a ledger effect but cites no ledger line`));
    }
    const target = isOpen ? questionFactOf(question, recipe.facts) : null;
    if (isOpen && !recipe.stagedOpenKeys.has(key) && !answered.has(key)) {
      const spelled =
        target === null
          ? null
          : spellOpenQuestionKey(
              {
                ...target,
                cites: Array.isArray(cites) ? cites : [],
                effects: optionEffects,
              },
              recipe,
            );
      if (spelled === null || !spelled.ok) {
        problems.push(
          problem(
            'schema',
            `${name} ${spelled === null ? 'names no fact kind of the catalog (open.facts)' : spelled.reason}; reference/steps/4-ask.md's Key recipe paragraph`,
          ),
        );
      } else if (spelled.key !== key) {
        problems.push(
          problem(
            'schema',
            `${name} key is not the one pipeline.js build spells from its fact, cites and options; run the build, which writes it`,
          ),
        );
      }
    }
    // One question per fact: a line's property or business is asked once — a found-place
    // question settles the lines its place books — so no line is cited by two questions about
    // where it belongs. A document cited without any of its
    // lines stands for every line booked from it. A staged pair whose keys name no fact kind
    // (asked before the recipe) is not counted: its keys are kept as staged.
    const placement =
      key === UNASSIGNED_LINE_ENTITY_KEY || (target !== null && PLACEMENT_FACTS.has(target.fact));
    if (
      !placement &&
      Array.isArray(cites) &&
      cites.some((cite) => typeof cite === 'string' && settledLines.has(cite))
    ) {
      problems.push(
        problem(
          'schema',
          `${name} cites a line the person settled; a settled line is cited by no question`,
        ),
      );
    } else if (
      !placement &&
      optionEffects.some((effect) => effect.kind === 'ledger') &&
      Array.isArray(cites) &&
      cites.some((cite) => typeof cite === 'string' && settledByPassThrough.has(cite))
    ) {
      // A line a pass_through question holds takes no change but that question's answer arms, so
      // a line_category_q, or any question whose option writes a field on the line, could never be
      // applied: its answer would be dropped silently (round 4's review).
      problems.push(
        problem(
          'schema',
          `${name} offers a change to a line a pass_through question holds; only that question's answer changes it`,
        ),
      );
    }
    if (placement && Array.isArray(cites)) {
      const asked = placementLines(cites, recipe);
      if ([...asked].some((id) => (placementLineAskedBy.get(id) ?? index) !== index)) {
        problems.push(
          problem(
            'schema',
            `${name} cites a line an earlier question of this run already asks the place of; ask one question per fact`,
          ),
        );
      }
      for (const id of asked)
        if (!placementLineAskedBy.has(id)) placementLineAskedBy.set(id, index);
      if (target?.fact !== PASS_THROUGH_FACT && [...asked].some((id) => openColumn.has(id))) {
        problems.push(
          problem(
            'schema',
            `${name} cites an unplaced income line booked from a document under the vendor of its placed gross; only the pass_through question asks about it`,
          ),
        );
      }
      if ([...asked].some((id) => settledByPassThrough.has(id))) {
        problems.push(
          problem(
            'schema',
            `${name} cites a line a pass_through question asks about or the person answered; ask nothing more about where it belongs`,
          ),
        );
      }
    }
    // A trip's travel or meal line is asked only carrying its trip (decision records 0160, 0164):
    // a question placing a line no trip ties whose document prints where the trip went carries
    // that trip in the effect of every option that places it, so never the catalog's
    // unassigned-line key, which carries none (issue #1257). A staged key spelled before the
    // recipe is held to it too. A fare, a ride or a meal printing no city is asked as it is.
    const asksPlace =
      key === UNASSIGNED_LINE_ENTITY_KEY ||
      target?.fact === 'placement' ||
      (isOpen && target === null && optionEffects.some(placesLines));
    if (asksPlace && Array.isArray(cites)) {
      const carriesTrips =
        key !== UNASSIGNED_LINE_ENTITY_KEY &&
        optionEffects.some(placesLines) &&
        optionEffects
          .filter(placesLines)
          .every(
            (effect) =>
              (effect.kind === 'ledger' || effect.kind === 'entity_register') &&
              (effect.trips ?? []).length > 0,
          );
      const uncarried =
        !carriesTrips &&
        [...placementLines(cites, recipe)].some((id) => {
          const addition = additions.get(id);
          const untied =
            addition !== undefined
              ? isUntiedTravelAddition(addition)
              : isUntiedTravelConfirmed(id, digest, (runChanges ??= runLineChangesOf(workspace)));
          const source =
            addition !== undefined
              ? strOrNull(addition.source_file)
              : strOrNull(digest.get(id)?.source_file);
          return (
            untied && source !== null && (tripDocuments ??= tripDocumentsOf(workspace))(source)
          );
        });
      if (uncarried) {
        problems.push(
          problem(
            'schema',
            `${name} asks the property or business of a travel or meal line no trip ties, whose document prints where the trip went (a lodging bill, an airline ticket, or a receipt printing a city away from the travel home); carry that trip in the effect's trips of every option that places it (reference/steps/4-ask.md), or record it (step 5)`,
          ),
        );
      }
    }
  }
  return problems;
}

/** The fact kinds that decide which property or business a line belongs to: a pass-through
 *  column's answer books its lines to the gross's place or leaves them with none (issue #1153). */
const PLACEMENT_FACTS: ReadonlySet<string> = new Set(['register', 'placement', PASS_THROUGH_FACT]);

export const PLACED_QUESTION = 'placed_question';

/**
 * A stored placement is one only a `sort_then_show` run may make (issue #1384, decision record
 * 0150): the run books a line it would ask the place of on the place its documents or earlier
 * answers point to, writes the placement question as it would ask it with that place's
 * `ledger`/`entity` option first carrying `"placed": true`, and the importer stores the question
 * `PLACED` instead of asking it (`placedOptionOf`). Every rule here keeps the flag to that case:
 * - the flag is `true` where it is written, and only under a `review_mode.json` that stages
 *   `sort_then_show` (`reviewModeOf`: any other file, or none, is `ask`);
 * - it never rides a key already asked - one `open_questions.json` stages or `answers.json`
 *   answers - which is asked again, never placed;
 * - it rides an `open_` question whose key names the `placement` fact (the key alone decides, never
 *   a `fact` hint) - a found place is a declaration only the person makes, and every other fact is
 *   asked in every mode - as its first option, a `ledger`/`entity` one;
 * - every line the question asks about (`placementLines`: its cited lines, and every line booked
 *   from a document it cites without one) is this run's addition, since a line already in the
 *   books moves only on an answer; booked on that option's place, so the question says where the
 *   line is; `confirmed` and tied to no trip or vehicle, the lines a placement may move; and no
 *   income line, because the pass-through gate counts only income with no place, so a placed fee
 *   column would count income twice.
 * The question must still cite a line (the ledger-effect rule in `questionProblems`). The
 * messages name the item and the rule, never a line, a place or a value.
 */
function placedQuestionProblems(workspace: string, skillDir: string): Problem[] {
  const questions = listOf(loadJson(join(workspace, 'out', 'questions.json')));
  const flagged = questions.some((raw) =>
    listOf(recordOf(raw)?.options).some((option) => recordOf(option)?.placed !== undefined),
  );
  if (!flagged) return [];
  const catalog = loadQuestionCatalog(skillDir);
  if (catalog === null) return [];
  const sortThenShow = reviewModeOf(workspace) === 'sort_then_show';
  const recipe = keyContextOf(workspace, skillDir, catalog.openFacts);
  const additions = new Map<string, Json>();
  for (const raw of listOf(loadJson(join(workspace, 'out', REQUIRED_LEDGER)))) {
    const item = recordOf(raw);
    const id = strOrNull(item?.id);
    if (item !== null && id !== null) additions.set(id, item);
  }
  const problems: Problem[] = [];
  for (const [index, raw] of questions.entries()) {
    const question = recordOf(raw);
    if (question === null) continue;
    const name = `${PLACED_QUESTION}: questions.json item ${String(index)}`;
    const options = listOf(question.options);
    const marked = options.flatMap((option, optionIndex) =>
      recordOf(option)?.placed === undefined ? [] : [optionIndex],
    );
    if (marked.length === 0) continue;
    const refuse = (code: ProblemCode, rule: string): void => {
      problems.push(problem(code, `${name} ${rule} (reference/steps/4-ask.md)`));
    };
    if (marked.some((optionIndex) => recordOf(options[optionIndex])?.placed !== true)) {
      refuse('schema', 'carries a placed flag that is not true; write it only as true');
      continue;
    }
    if (!sortThenShow) {
      refuse(
        'invariant',
        'marks an option placed, but review_mode.json does not stage sort_then_show: ask the question',
      );
      continue;
    }
    if (marked.length > 1 || marked[0] !== 0) {
      refuse('schema', 'marks an option placed that is not its first option, or more than one');
      continue;
    }
    const key = strOrNull(question.key);
    // A question the person was already asked keeps being asked: a staged open question re-asked
    // under its key, or an answered key, is never placed, so a run cannot supersede it unseen.
    if (key !== null && (recipe.stagedOpenKeys.has(key) || recipe.answered.has(key))) {
      refuse('invariant', 'a key already asked is asked again, never placed');
      continue;
    }
    // The fact comes from the key alone, never from a `fact` hint, which a written key overrules.
    const fact =
      key === null
        ? null
        : (parseOpenQuestionKey(key, [...catalog.openFacts.keys()])?.fact ?? null);
    if (fact !== 'placement') {
      refuse(
        'schema',
        'places lines under a question that is not an open_ placement question; ask a found place, a fact and every other question',
      );
      continue;
    }
    const effect = parseEffect(recordOf(options[0])?.effect);
    if (effect?.kind !== 'ledger' || effect.to.type !== 'entity') {
      refuse(
        'schema',
        'marks an option placed that is not a ledger/entity option; place lines on one place',
      );
      continue;
    }
    const place = effect.to.entityKey;
    const lines = [...placementLines(listOf(question.cites), recipe)];
    const owned = lines.map((id) => additions.get(id));
    if (owned.some((line) => line === undefined)) {
      refuse(
        'invariant',
        'places a line this run did not add; a line already in the books moves only on an answer, so ask it',
      );
    } else if (owned.some((line) => strOrNull(line?.entity) !== place)) {
      refuse(
        'invariant',
        "places a line it does not book on the placed option's place; book each line it cites there",
      );
    } else if (
      owned.some(
        (line) =>
          line?.status !== 'confirmed' ||
          strOrNull(line.trip) !== null ||
          strOrNull(line.vehicle) !== null,
      )
    ) {
      refuse(
        'invariant',
        'places a line that is not confirmed or that a trip or vehicle ties; ask it',
      );
    } else if (owned.some((line) => line?.kind === 'income')) {
      refuse(
        'invariant',
        'places an income line; income is never placed without asking, so ask it',
      );
    }
  }
  return problems;
}

/**
 * A question of a fact whose catalog entry fixes its options (issue #1153): exactly those
 * options, in order, each with the catalog's id and label and an effect of the catalog's kind (a
 * ledger effect on the catalog's field, its `from` null), and no typed answer. One option carries
 * `recommended` only when it is the one `tie` names, the pass-through tie-out the build wrote and
 * this check re-derives (issue #1530); with no tie, none does. The messages name the rule, never a
 * label or a value the question carries.
 */
function fixedOptionProblems(
  name: string,
  question: Json,
  fixed: readonly FixedOption[],
  tie: PassThroughTie | null,
): Problem[] {
  const options = Array.isArray(question.options) ? (question.options as unknown[]) : [];
  const matches =
    fixed.length > 0 &&
    options.length === fixed.length &&
    fixed.every((want, at) => {
      const head = optionHeadOf(options[at]);
      if (typeof head === 'string') return false;
      const effect = parseEffect(head.option.effect);
      return (
        head.id === want.id &&
        head.label === want.label &&
        effect !== null &&
        catalogEffectMatches(want.effect, effect) &&
        (effect.kind !== 'ledger' || effect.from === null)
      );
    });
  const problems: Problem[] = [];
  if (!matches) {
    problems.push(
      problem(
        'schema',
        `${name} asks a fact whose options the catalog fixes; offer exactly its options (rules/question_catalog.json open.facts), in order, with their ids, labels and effect kinds, and a ledger effect's from null`,
      ),
    );
  }
  const flagged = options.filter(
    (raw) => typeof raw === 'object' && raw !== null && (raw as Json).recommended !== undefined,
  ) as Json[];
  const [flag] = flagged;
  if (
    flagged.length > 0 &&
    !(flagged.length === 1 && flag !== undefined && tie !== null && flag.id === tie)
  ) {
    problems.push(
      problem(
        'schema',
        `${name} marks an option recommended that the 1099-K tie-out does not support; a fact whose options the catalog fixes carries the flag only where pipeline.js build writes it, from the one 1099-K whose box 1a equals the booked gross, or the gross plus the cited column lines, to the cent (reference/steps/4-ask.md)`,
      ),
    );
  }
  if (question.allow_free_text === true) {
    problems.push(
      problem(
        'schema',
        `${name} asks a fact whose options the catalog fixes; allow no typed answer`,
      ),
    );
  }
  return problems;
}

/**
 * A pass-through question (issue #1153) is asked by the run that books its export, so it cites
 * this run's additions only — a confirmed row carries no kind or place to check — and exactly:
 * the lines of the export's open columns (one question covers them all), income booked confirmed
 * with no entity and no trip or vehicle, all from one document, beside that one document. It is
 * asked only while the export's gross books to exactly one place `profile.json` stages — every
 * other income line this run books from the document carries that one entity — and its
 * `own_income` option moves the lines there; otherwise step 3 books the gross alone and writes
 * its note. The messages name the rule, never a line, a place or a value.
 */
function passThroughProblems(
  name: string,
  question: Json,
  additions: ReadonlyMap<string, Json>,
): Problem[] {
  const cites = Array.isArray(question.cites) ? (question.cites as unknown[]) : [];
  const lines = cites.filter(
    (cite): cite is string => typeof cite === 'string' && /^L\d+$/.test(cite),
  );
  const documents = cites.filter((cite) => !lines.includes(cite as string));
  const sources = new Set<string | null>();
  const columnLines = lines.every((id) => {
    const addition = additions.get(id);
    if (addition === undefined) return false;
    sources.add(strOrNull(addition.source_file));
    return (
      addition.kind === 'income' &&
      strOrNull(addition.entity) === null &&
      addition.status === 'confirmed' &&
      strOrNull(addition.trip) === null &&
      strOrNull(addition.vehicle) === null
    );
  });
  const [source] = [...sources];
  const [document] = documents;
  if (
    lines.length === 0 ||
    !columnLines ||
    sources.size !== 1 ||
    typeof source !== 'string' ||
    documents.length !== 1 ||
    typeof document !== 'string' ||
    !sameDocument(document, source)
  ) {
    return [
      problem(
        'schema',
        `${name} asks a pass_through fact; cite this run's lines of the one column it asks about - confirmed income lines booked with no entity, none tied, all from one document - and that one document`,
      ),
    ];
  }
  // The gross: every other income line this run books from the document. One with no entity
  // (a found place's, or one a placement question still asks) is no place.
  const places = new Set<string | null>();
  for (const [id, addition] of additions) {
    if (lines.includes(id) || addition.source_file !== source || addition.kind !== 'income') {
      continue;
    }
    places.add(strOrNull(addition.entity));
  }
  const [place] = [...places];
  // Every move the question offers names that place: the fixed options carry exactly one.
  const targets: (string | null)[] = [];
  for (const raw of Array.isArray(question.options) ? (question.options as unknown[]) : []) {
    const head = optionHeadOf(raw);
    const effect = typeof head === 'string' ? null : parseEffect(head.option.effect);
    // The settled option moves nothing; every other ledger option is a move.
    if (effect?.kind === 'ledger' && effect.field !== 'settled') {
      targets.push(effect.to.type === 'entity' ? effect.to.entityKey : null);
    }
  }
  const movesToGross =
    places.size === 1 &&
    typeof place === 'string' &&
    targets.length > 0 &&
    targets.every((target) => target === place);
  return movesToGross
    ? []
    : [
        problem(
          'schema',
          `${name} asks a pass_through fact, which is asked only while the export's gross books to exactly one place profile.json stages; its own_income option moves the lines to that place, and otherwise step 3 books the gross alone and writes its note`,
        ),
      ];
}

/** The chosen option id of a staged answer, or null. */
function chosenOptionOf(staged: StagedAnswer | undefined): unknown {
  const answer = staged?.answer;
  return typeof answer === 'object' && answer !== null && !Array.isArray(answer)
    ? (answer as Json).optionId
    : null;
}

/** The staged answers whose key names the pass_through fact (issue #1153). */
function passThroughAnswers(
  workspace: string,
  facts: ReadonlyMap<string, OpenQuestionSubject>,
): Map<string, StagedAnswer> {
  return new Map(
    [...answersOf(workspace)].filter(
      ([key]) => questionFactOf({ key }, facts)?.fact === PASS_THROUGH_FACT,
    ),
  );
}

/** The lines an answered pass_through question's `inside` answer cited: the settled lines. */
function settledLinesOf(
  workspace: string,
  facts: ReadonlyMap<string, OpenQuestionSubject>,
): Set<string> {
  const lines = new Set<string>();
  for (const staged of passThroughAnswers(workspace, facts).values()) {
    if (chosenOptionOf(staged) === 'inside') for (const id of staged.cites) lines.add(id);
  }
  return lines;
}

/** The entries `open_questions.json` stages, by key; empty when the file is absent or malformed. */
function stagedOpenEntriesOf(workspace: string): Map<string, unknown> {
  const open = recordOf(loadJson(join(workspace, 'open_questions.json')));
  return new Map(open === null ? [] : Object.entries(open));
}

/** The kind of place a profile kind is: a rental, a business, or neither (a K-1 interest). */
function placeClassOf(kind: string | null): 'rental' | 'business' | null {
  if (kind === null) return null;
  return PROPERTY_PROFILE_KINDS.has(kind) ? 'rental' : kind === 'business' ? 'business' : null;
}

/**
 * A staged `register` question re-asked as a placement (issue #1468, step 4): the person has since
 * declared its place, so the question offers no `entity_register` option. Its first option is the
 * `ledger`/`entity` option onto a staged place, marked recommended; the place is a rental or a
 * business, the kind of the staged place the key spells (by its name, alias or listing whole, or
 * its address as a prefix, folded with the build's `keyWords`), else the kind of the recommended
 * place. When a staged place matches the key, the recommended place is one that matches. Only a
 * rental's question offers every staged rental. It cites every ledger line the staged entry
 * cites that the books still carry and the person has not moved, so the confirm arms the move.
 * Messages name the question or option and the rule, never a key, line or place.
 */
function reaskedPlaceProblems(
  name: string,
  key: string,
  options: unknown,
  stagedKinds: ReadonlyMap<string, StagedEntityFacts>,
  stagedEntry: Json | null,
  cites: unknown,
  digest: ReadonlyMap<string, Json>,
  additions: ReadonlyMap<string, Json>,
  printedByCite: (listing: string) => boolean,
  movedLines: ReadonlySet<string>,
): { readonly problems: Problem[]; readonly rental: boolean } {
  const problems: Problem[] = [];
  const first = recordOf(Array.isArray(options) ? options[0] : undefined);
  const effect = first === null ? null : parseEffect(first.effect);
  const target =
    effect?.kind === 'ledger' && effect.field === 'entity' && effect.to.type === 'entity'
      ? effect.to.entityKey
      : null;
  const targetClass = target === null ? null : placeClassOf(stagedKinds.get(target)?.kind ?? null);
  let rental = targetClass === 'rental';
  if (first === null || targetClass === null || first.recommended !== true) {
    problems.push(
      problem(
        'schema',
        `${name} re-asks a place profile.json now carries but its first option is not the recommended ledger/entity option onto a staged rental or business`,
      ),
    );
  } else {
    const subject = key.replace(/^open_/, '').replace(/_register(_\d+)?$/, '');
    // The build cuts a place's subject at 40 characters, so a subject at the limit matches a
    // longer name by its leading words, as an address does; a text that spells no word hashes raw.
    const atLimit = subject.length >= PLACE_SUBJECT_LIMIT;
    const whole = (text: string): boolean =>
      placeSubject(text, () => false) === subject ||
      hashSubject(text) === subject ||
      (atLimit && `${keyWords(text).join('_')}_`.startsWith(`${subject}_`));
    const matching = [...stagedKinds].filter(
      ([, entity]) =>
        [entity.name, ...entity.aliases, ...entity.listings].some(
          (text) => text !== null && whole(text),
        ) ||
        (entity.address !== null &&
          (keyWords(entity.address).join('_') + '_').startsWith(`${subject}_`)),
    );
    if (matching.length > 0) {
      rental = placeClassOf(stagedKinds.get(matching[0]?.[0] ?? '')?.kind ?? null) === 'rental';
      if (!matching.some(([entityKey]) => entityKey === target)) {
        problems.push(
          problem(
            'schema',
            `${name} re-asks a place profile.json now carries but recommends another place than the one that carries it`,
          ),
        );
      }
    } else if (target !== null) {
      // Nothing matches the key: the recommended place carries a listing a cited document prints,
      // or is a rental when a cited line is line 3 (rents received): any other line number is ambiguous between Schedules C and E and implies nothing.
      const lines = stringList(Array.isArray(cites) ? cites : [])
        .filter((id) => /^L\d+$/.test(id))
        .flatMap((id) => {
          const row = digest.get(id) ?? additions.get(id);
          return row === undefined || row.kind === 'expense' ? [] : [String(row.line)];
        });
      const implied = lines.includes('3') ? 'rental' : null;
      const carriesPrinted = (stagedKinds.get(target)?.listings ?? []).some(printedByCite);
      if (!carriesPrinted && implied !== null && targetClass !== implied) {
        problems.push(
          problem(
            'schema',
            `${name} re-asks a place profile.json now carries but recommends a place that carries no listing the cited documents print and is not the rental the cited rents lines imply`,
          ),
        );
      }
    }
  }
  const asked = new Set(Array.isArray(cites) ? cites : []);
  // A line the person moved is theirs (issue #1782): no question asks where it goes again.
  const owed = stringList(stagedEntry?.cites).filter(
    (id) => /^L\d+$/.test(id) && (digest.has(id) || additions.has(id)) && !movedLines.has(id),
  );
  if (owed.some((id) => !asked.has(id))) {
    problems.push(
      problem(
        'schema',
        `${name} is re-asked under a staged key but drops a line the staged question cites; cite the lines it cites so the confirm arms their move`,
      ),
    );
  }
  return { problems, rental };
}

const PLACE_SUBJECT_LIMIT = 40;

export const STAGED_REGISTER_DROPPED = 'staged_register_dropped';

/**
 * A staged `register` question is neither re-asked nor answered while a line it cites is still an
 * unassigned digest item (issue #1468): its OPEN row would stay on Review with its old register
 * option and the lines would stay stuck. A line the books no longer carry, a held row, a tied line,
 * a line this run places and a line the person moved (issue #1782) owe nothing. The message names
 * the rule and the count, never a key.
 */
function stagedRegisterDroppedProblems(
  workspace: string,
  askedKeys: ReadonlySet<string>,
  answered: ReadonlyMap<string, unknown>,
  facts: ReadonlyMap<string, OpenQuestionSubject>,
  moved: ReadonlySet<string>,
): Problem[] {
  const digest = digestItems(workspace);
  if (digest.size === 0) return [];
  const placed = runLineChangesOf(workspace).placed;
  let dropped = 0;
  for (const [key, entry] of stagedOpenEntriesOf(workspace)) {
    if (askedKeys.has(key) || answered.has(key)) continue;
    if (questionFactOf({ key }, facts)?.fact !== 'register') continue;
    const stuck = stringList(recordOf(entry)?.cites).some((id) => {
      const row = digest.get(id);
      return (
        row !== undefined &&
        row.schedule === null &&
        row.tied !== true &&
        !placed.has(id) &&
        !moved.has(id)
      );
    });
    if (stuck) dropped += 1;
  }
  return dropped === 0
    ? []
    : [
        problem(
          'invariant',
          `${STAGED_REGISTER_DROPPED}: ${String(dropped)} staged register question(s) cite lines that are still unassigned and are neither asked nor answered; re-ask each under its staged key (reference/steps/4-ask.md)`,
        ),
      ];
}

/** The lines a pass_through question holds: every line an answered one cited, and every line a
 *  staged OPEN one (`open_questions.json`) asks about. */
function passThroughHeldLines(
  workspace: string,
  facts: ReadonlyMap<string, OpenQuestionSubject>,
): Set<string> {
  const lines = new Set<string>();
  for (const staged of passThroughAnswers(workspace, facts).values()) {
    for (const id of staged.cites) lines.add(id);
  }
  const open = loadJson(join(workspace, 'open_questions.json'));
  if (open !== null && typeof open === 'object' && !Array.isArray(open)) {
    for (const [key, entry] of Object.entries(open as Json)) {
      if (questionFactOf({ key }, facts)?.fact !== PASS_THROUGH_FACT) continue;
      const cites =
        entry !== null && typeof entry === 'object' && !Array.isArray(entry)
          ? (entry as Json).cites
          : undefined;
      for (const id of Array.isArray(cites) ? cites : []) {
        if (typeof id === 'string') lines.add(id);
      }
    }
  }
  return lines;
}

/**
 * The settled marker and the lines it settles (issue #1153), over `ledger_changes.json` and
 * `findings.json`. Each message names the entry or the rule, never a line, a key, a place or a
 * value:
 * - a `settled` change is `to: true` on a line with no place that an answered `pass_through`
 *   question cites, armed by that key's own `inside` answer named in `answer_key` — never by a
 *   batch document, which would otherwise arm it like any field (reference/incremental.md);
 * - a settled line takes no other change of any field and no finding cites it;
 * - any other line a pass_through question holds — one a staged OPEN question cites, or one an
 *   `own_income` answer cites — takes no change of any field but the `entity` change and the
 *   crossing `line` change that answer arms, named in `answer_key`: a batch document or another
 *   answer would otherwise move or reline it before the person answers, or after, and count it
 *   twice;
 * - an `inside` answer is applied: each line it cites that the confirmed digest carries with no
 *   place and without the key in its `answer_keys` (the importer appends the key when it writes
 *   the marker) takes its `settled` change in this run. A cited line that now has a place is
 *   skipped: the held-lines rule of the question gate keeps any later question from placing one,
 *   and skipping keeps a workspace that reached that state before the rule from being refused
 *   forever, since a placed line can never be settled.
 */
function settledChangeProblems(workspace: string, skillDir: string): Problem[] {
  const facts = loadQuestionCatalog(skillDir)?.openFacts;
  if (facts === undefined) return [];
  const answers = passThroughAnswers(workspace, facts);
  const citing = (id: string): string[] =>
    [...answers].filter(([, staged]) => staged.cites.includes(id)).map(([key]) => key);
  const settled = settledLinesOf(workspace, facts);
  const held = passThroughHeldLines(workspace, facts);
  const changes = listOf(loadJson(join(workspace, 'out', 'ledger_changes.json'))).map((raw) =>
    typeof raw === 'object' && raw !== null && !Array.isArray(raw) ? (raw as Json) : null,
  );
  const digest = digestItems(workspace);
  const placed = (id: string): boolean => strOrNull(digest.get(id)?.schedule) !== null;
  const problems: Problem[] = [];
  for (const [index, change] of changes.entries()) {
    const id = change === null ? null : strOrNull(change.id);
    if (change === null || id === null) continue;
    const keys = citing(id);
    if (change.field === 'settled') {
      const key = strOrNull(change.answer_key);
      // Only a line with no place is settled: a settled line is in no book, so one on a place
      // would vanish from that place's books.
      const armed =
        change.to === true &&
        key !== null &&
        keys.includes(key) &&
        chosenOptionOf(answers.get(key)) === 'inside' &&
        !placed(id);
      if (!armed) {
        problems.push(
          problem(
            'invariant',
            `out/ledger_changes.json entry ${String(index)} settles a line no answered pass_through question's inside answer cites, a line on a place, or settles it as anything but true; only that answer, named in answer_key, settles a line with no place`,
          ),
        );
      }
      continue;
    }
    if (settled.has(id)) {
      problems.push(
        problem(
          'invariant',
          `out/ledger_changes.json entry ${String(index)} changes a line the person settled; a settled line takes no change but its settled marker`,
        ),
      );
      continue;
    }
    if (!held.has(id)) continue;
    const key = strOrNull(change.answer_key);
    const armed =
      key !== null &&
      keys.includes(key) &&
      chosenOptionOf(answers.get(key)) === 'own_income' &&
      (change.field === 'entity' || change.field === 'line');
    if (!armed) {
      problems.push(
        problem(
          'invariant',
          `out/ledger_changes.json entry ${String(index)} changes a line a pass_through question holds; only that question's own_income answer, named in answer_key, moves it`,
        ),
      );
    }
  }
  const unapplied = [...answers].some(
    ([key, staged]) =>
      chosenOptionOf(staged) === 'inside' &&
      staged.cites.some((id) => {
        const row = digest.get(id);
        if (row === undefined || placed(id) || stringList(row.answer_keys).includes(key)) {
          return false;
        }
        return !changes.some(
          (change) =>
            change !== null &&
            change.id === id &&
            change.field === 'settled' &&
            change.to === true &&
            change.answer_key === key,
        );
      }),
  );
  if (unapplied) {
    problems.push(
      problem(
        'invariant',
        `out/ledger_changes.json settles none of the lines an answered pass_through question's inside answer cites; write {"id", "field": "settled", "to": true, "answer_key"} for each (reference/steps/5-apply.md)`,
      ),
    );
  }
  for (const [index, raw] of listOf(loadJson(join(workspace, 'out', 'findings.json'))).entries()) {
    const cites =
      raw !== null && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Json).cites : null;
    if (
      Array.isArray(cites) &&
      cites.some((cite) => typeof cite === 'string' && settled.has(cite))
    ) {
      problems.push(
        problem(
          'invariant',
          `findings.json item ${String(index)} cites a line the person settled; a settled line is cited by no finding`,
        ),
      );
    }
  }
  return problems;
}

/**
 * The open column of step 3 among this run's additions (issue #1153): a confirmed, untied income
 * line with no place, booked from a document under the same vendor as a placed income line of
 * that document, whose placed income lines all book to one place. The column's lines carry the
 * export's vendor, its fee-only rows included, while an unrelated deposit carries another payer.
 * Any document with income rows is read alike; the document's type is not.
 *
 * A document a `note` finding of this run cites — by its name, or by a line booked from it — is
 * exempt (the coordinator's ruling on round 4's review): it is step 3's record of a gross part of
 * which waits with no entity for a question about its place, such as one export covering a
 * declared listing and a found one, so its unplaced lines are asked as found places or
 * placements. An agent that writes the note to dodge the question breaches step 3's note rule,
 * which the question eval grades.
 */
function openColumnLines(workspace: string, additions: readonly Json[]): Set<string> {
  const vendorOf = (line: Json): string => (strOrNull(line.vendor) ?? '').trim().toLowerCase();
  const bySource = new Map<string, Json[]>();
  const sourceById = new Map<string, string>();
  for (const item of additions) {
    const source = strOrNull(item.source_file);
    if (source === null) continue;
    if (typeof item.id === 'string') sourceById.set(item.id, source);
    if (item.kind !== 'income') continue;
    bySource.set(source, [...(bySource.get(source) ?? []), item]);
  }
  const noted: string[] = [];
  for (const raw of listOf(loadJson(join(workspace, 'out', 'findings.json')))) {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) continue;
    if ((raw as Json).kind !== 'note') continue;
    const cites = (raw as Json).cites;
    for (const cite of Array.isArray(cites) ? cites : []) {
      if (typeof cite === 'string') noted.push(sourceById.get(cite) ?? cite);
    }
  }
  const lines = new Set<string>();
  for (const [source, income] of bySource) {
    if (noted.some((cite) => sameDocument(cite, source))) continue;
    const placed = income.filter((line) => strOrNull(line.entity) !== null);
    if (new Set(placed.map((line) => strOrNull(line.entity))).size !== 1) continue;
    const placedVendors = new Set(placed.map(vendorOf));
    for (const line of income) {
      if (
        strOrNull(line.entity) === null &&
        line.status === 'confirmed' &&
        strOrNull(line.trip) === null &&
        strOrNull(line.vehicle) === null &&
        placedVendors.has(vendorOf(line)) &&
        typeof line.id === 'string'
      ) {
        lines.add(line.id);
      }
    }
  }
  return lines;
}

/**
 * The pass_through question is owed (issue #1153): a run that books the open column of step 3
 * (`openColumnLines`) asks the pass_through question citing its lines in the same run, before the
 * cap, never deferred, because no later run can ask it (the export's reading is not staged again)
 * and the line would otherwise wait unasked and be placed as income twice. A line a staged
 * pass_through question already holds owes nothing. A document whose gross books to no place or
 * to several has no open column: step 3 writes its note instead. The message names the rule,
 * never a line, a document or a value.
 */
function passThroughOwedProblems(workspace: string, skillDir: string): Problem[] {
  const facts = loadQuestionCatalog(skillDir)?.openFacts;
  if (facts === undefined) return [];
  const additions = listOf(loadJson(join(workspace, 'out', REQUIRED_LEDGER))).filter(
    (item): item is Json => typeof item === 'object' && item !== null && !Array.isArray(item),
  );
  const asked = new Set<string>(passThroughHeldLines(workspace, facts));
  for (const raw of listOf(loadJson(join(workspace, 'out', 'questions.json')))) {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) continue;
    const question = raw as Json;
    if (questionFactOf(question, facts)?.fact !== PASS_THROUGH_FACT) continue;
    for (const cite of Array.isArray(question.cites) ? question.cites : []) {
      if (typeof cite === 'string') asked.add(cite);
    }
  }
  const owed = [...openColumnLines(workspace, additions)].some((id) => !asked.has(id));
  return owed
    ? [
        problem(
          'invariant',
          `questions.json asks no pass_through question for an unplaced income line this run books from a document under the vendor of its placed gross, which books to one place: ask it in this run, before the cap (reference/steps/4-ask.md)`,
        ),
      ]
    : [];
}

/** What this run's `ledger_changes.json` does to a confirmed line's tie and line (issue #1257):
 *  the ids a `trip` change ties to a trip (its `to` a key), the ids an `entity` change moves to a
 *  place, and each id's line after its `line` changes in file order (the last one stands, the order
 *  the importer folds them in). One read of the file serves both gates. */
interface RunLineChanges {
  readonly tripTied: ReadonlySet<string>;
  readonly placed: ReadonlySet<string>;
  /** The ids any `entity` change with a `to` names, a malformed one included: the run acted on
   *  the line, and the change gates judge the change itself. */
  readonly moved: ReadonlySet<string>;
  /** The ids an `entity` change to null takes off their place (a stored placement's un-place,
   *  issue #1384). */
  readonly unplaced: ReadonlySet<string>;
  readonly lines: ReadonlyMap<string, string | null>;
}

function runLineChangesOf(workspace: string): RunLineChanges {
  const tripTied = new Set<string>();
  const placed = new Set<string>();
  const moved = new Set<string>();
  const unplaced = new Set<string>();
  const lines = new Map<string, string | null>();
  for (const raw of listOf(loadJson(join(workspace, 'out', 'ledger_changes.json')))) {
    const change = recordOf(raw);
    const id = strOrNull(change?.id);
    if (change === null || id === null) continue;
    if (change.field === 'trip' && typeof change.to === 'string') tripTied.add(id);
    if (change.field === 'entity' && typeof change.to === 'string') placed.add(id);
    if (change.field === 'entity' && change.to !== null && change.to !== undefined) moved.add(id);
    if (change.field === 'entity' && change.to === null) unplaced.add(id);
    if (change.field === 'line') lines.set(id, strOrNull(change.to));
  }
  return { tripTied, placed, moved, unplaced, lines };
}

/** Whether an option's effect places lines on a place: a found place's `entity_register`, or a
 *  `ledger`/`entity` move. */
function placesLines(effect: Effect): boolean {
  return (
    effect.kind === 'entity_register' || (effect.kind === 'ledger' && effect.field === 'entity')
  );
}

/** The documents whose travel or meal line a question asks only with its trip (decision records
 *  0160, 0164): one that prints where the trip went — a hotel folio or an airline receipt by its
 *  out/documents.json type, or any other reading but a card or bank export with an address the
 *  reader placed in a city and none in the travel home's (profile.resolved.json's, else
 *  profile.json's; `printsCityAwayFromHome`) — that no trip
 *  of out/profile.resolved.json lists among its `documents` (a fare bought before a recorded trip
 *  is asked as it is). With no travel home known, only the folio and the airline receipt count. */
function tripDocumentsOf(workspace: string): (source: string) => boolean {
  const entries = documentEntriesOf(workspace);
  const resolved = recordOf(loadJson(join(workspace, 'out', 'profile.resolved.json')));
  const listed = listOf(resolved?.trips).flatMap((trip) => stringList(recordOf(trip)?.documents));
  const home =
    strOrNull(resolved?.home) ??
    strOrNull(recordOf(loadJson(join(workspace, 'profile.json')))?.home);
  return (source) => {
    const entry = documentOf(entries, source)?.entry;
    const type = entry?.doc_type;
    const printsWhere =
      type === 'hotel_folio' ||
      type === 'airline_receipt' ||
      (entry !== undefined &&
        type !== 'card_or_bank_export' &&
        home !== null &&
        printsCityAwayFromHome(readingAddressesOf(recordOf(entry.fields)?.addresses), home));
    return printsWhere && !listed.some((document) => sameDocument(document, source));
  };
}

/**
 * A travel or meal addition no trip ties (decision records 0160, 0164): a meal, or a line on a
 * travel line of its provisional schedule (`TRIP_TRAVEL_LINES`), carrying no trip. A question
 * placing one asks it only carrying its trip when its document prints where the trip went
 * (`tripDocumentsOf`).
 */
function isUntiedTravelAddition(addition: Json): boolean {
  const schedule = strOrNull(addition.schedule);
  const line = strOrNull(addition.line);
  return (
    (addition.meal === true ||
      (schedule !== null && line !== null && (TRIP_TRAVEL_LINES[schedule] ?? []).includes(line))) &&
    strOrNull(addition.trip) === null
  );
}

/** A confirmed travel line no trip ties (decision record 0132, issue #1257): one on Schedule C line
 *  24a (Travel), the only line table that carries 24a, read from the digest and this run's changes:
 *  its line (the digest's, or the one this run's `line` changes leave it on), its schedule (null
 *  when unassigned, since the database stores none for a row with no place), and `tied` or a `trip`
 *  change of this run. A sort request's waiting one may wait under an `entity_unestablished`
 *  finding. */
function isUntiedTravelConfirmed(
  id: string,
  digest: ReadonlyMap<string, Json>,
  changes: RunLineChanges,
): boolean {
  const row = digest.get(id);
  if (row === undefined) return false;
  const line = changes.lines.has(id) ? changes.lines.get(id) : row.line;
  return (
    (row.schedule === 'C' || row.schedule === null) &&
    line === '24a' &&
    row.tied !== true &&
    !changes.tripTied.has(id)
  );
}

/** Whether a staged schedule is a place an answer can book lines onto: staged, and not a K-1
 *  interest, onto which no line ever moves. */
function isPlaceSchedule(schedule: string | undefined): boolean {
  return schedule !== undefined && schedule !== 'K1';
}

/**
 * The lines whose place the person's move decides (issue #1782): those a live `move_lines:` answer
 * cites onto a place `profile.json` stages (`isPlaceSchedule`), unless a later answer of the
 * person's decides the line's place (`laterWordCites`). No question of a run asks where one goes,
 * and no document moves it. A move onto a place no longer staged or a K-1 interest, or one the
 * person's later word overrides, decides nothing, so its lines are askable again.
 */
function personMovedLines(
  answers: ReadonlyMap<string, StagedAnswer>,
  staged: ReadonlyMap<string, string>,
): Set<string> {
  const lines = new Set<string>();
  for (const [key, answer] of answers) {
    const target = placingTarget(optionEffectOf(answer));
    if (!key.startsWith(MOVE_LINES_KEY_PREFIX) || target === null) continue;
    if (!isPlaceSchedule(staged.get(target))) continue;
    for (const id of answer.cites) if (!laterWordCites(answers, key, id)) lines.add(id);
  }
  return lines;
}

export const QUESTION_CITES_MOVED_LINE = 'question_cites_moved_line';

/**
 * No question of a run asks where a line the person moved goes (issue #1782): the person's move
 * is their answer, and a later answer would override it. A question that decides a line's place —
 * `unassigned_line_entity_q`, an `open_` placement or register question
 * (`PLACEMENT_QUESTION_KEY_PATTERN`) or a `pass_through` question — may not ask about a line a
 * live `move_lines:` answer cites, a document cited without its lines counting as citing every line
 * booked from it (`placementLines`), so a question about a document's other lines cites them by id.
 * The message names the code and the count, never a line, a key or a document.
 */
function questionCitesMovedLineProblems(workspace: string, skillDir: string): Problem[] {
  const moved = personMovedLines(answersOf(workspace), stagedEntitySchedules(workspace));
  if (moved.size === 0) return [];
  const catalog = loadQuestionCatalog(skillDir);
  if (catalog === null) return [];
  const context = keyContextOf(workspace, skillDir, catalog.openFacts);
  let citing = 0;
  for (const raw of listOf(loadJson(join(workspace, 'out', 'questions.json')))) {
    const question = recordOf(raw);
    const key = strOrNull(question?.key);
    if (question === null || key === null) continue;
    const decidesPlace =
      PLACEMENT_KEY.test(key) ||
      questionFactOf(question, catalog.openFacts)?.fact === PASS_THROUGH_FACT;
    if (!decidesPlace) continue;
    if ([...placementLines(listOf(question.cites), context)].some((id) => moved.has(id))) {
      citing += 1;
    }
  }
  return citing === 0
    ? []
    : [
        problem(
          'schema',
          `${QUESTION_CITES_MOVED_LINE}: questions.json holds ${String(citing)} question(s) asking where a line goes that the person moved; the person's move decides its place, so cite only lines no move_lines answer cites, by id where a document's other lines moved (reference/steps/5-apply.md)`,
        ),
      ];
}

export const WAITING_LINES_UNASKED = 'waiting_lines_unasked';

/**
 * The person's "Sort these out" is asked (issue #1249, part 1 of #1248). The worker stages
 * `waiting_lines.json` only for the run that carries the request. A waiting line is owed a
 * question unless a live answer in `answers.json` to a question that decides where it goes cites
 * it: a `pass_through` answer settles or moves it, a person's move (`move_lines:`, issue #1782)
 * puts it where they chose — applying that move is `answer_unapplied`'s, never a question's —
 * and a placement or register answer
 * (`PLACEMENT_QUESTION_KEY_PATTERN`, the sort request's own rule) places it or, answered
 * `personal` or `not_mine`, leaves it unassigned for good, so step 4 owes it no question (issue
 * #1257; reference/steps/4-ask.md). A typed answer, with no option chosen, and `per_document`
 * owe a follow-up, so their lines stay owed, as the sort request's `answeredLineCondition` keeps
 * them waiting. An answer of any other kind — `line_category_q`, a
 * correction, a trip or another `open_` fact — places nothing, so its line is still owed. The run
 * passes when it acts on at
 * least one owed line — a question of this run cites it, a document cited without any of its
 * lines counting as citing every line booked from it (`placementLines`, 4-ask.md's key recipe),
 * or this run's `ledger_changes.json` moves it to a place — since one question is enough within
 * the 15 and the lines left over wait for a later run. Otherwise it passes only when no owed
 * line can be asked at all: each is a line no placement question may take — one whose trip or
 * vehicle decides its place (`tied` in the digest, or tied to a trip by this run's `trip`
 * change), or a travel line no trip ties (`isUntiedTravelConfirmed`, issue #1257) — and an
 * `entity_unestablished` finding cites it (reference/steps/7-findings.md). The message names the
 * code and the count, never a line, a vendor, an amount or a document.
 */
function waitingLinesUnaskedProblems(workspace: string, skillDir: string): Problem[] {
  const waiting = waitingLineIds(workspace);
  if (waiting.length === 0) return [];
  const catalog = loadQuestionCatalog(skillDir);
  if (catalog === null) return [];
  const answered = new Set<string>();
  const placementKey = new RegExp(PLACEMENT_QUESTION_KEY_PATTERN);
  for (const [key, staged] of answersOf(workspace)) {
    // A typed answer (no option) and `per_document` owe a follow-up, so their lines stay owed.
    const option = chosenOptionOf(staged);
    if (
      !placementKey.test(key) ||
      typeof option !== 'string' ||
      option === PER_DOCUMENT_OPTION_ID
    ) {
      continue;
    }
    for (const id of staged.cites) answered.add(id);
  }
  for (const staged of passThroughAnswers(workspace, catalog.openFacts).values()) {
    for (const id of staged.cites) answered.add(id);
  }
  const staged = stagedEntitySchedules(workspace);
  for (const id of personMovedLines(answersOf(workspace), staged)) answered.add(id);
  const owed = new Set(waiting.filter((id) => !answered.has(id)));
  if (owed.size === 0) return [];
  const actedOn = new Set<string>();
  const context = keyContextOf(workspace, skillDir, catalog.openFacts);
  for (const raw of listOf(loadJson(join(workspace, 'out', 'questions.json')))) {
    const question = recordOf(raw);
    if (question === null) continue;
    for (const id of placementLines(listOf(question.cites), context)) actedOn.add(id);
  }
  const changes = runLineChangesOf(workspace);
  for (const id of changes.placed) actedOn.add(id);
  if ([...owed].some((id) => actedOn.has(id))) return [];
  const unestablished = new Set<string>();
  for (const raw of listOf(loadJson(join(workspace, 'out', 'findings.json')))) {
    const finding = recordOf(raw);
    if (finding?.kind === 'entity_unestablished') {
      for (const cite of stringList(finding.cites)) unestablished.add(cite);
    }
  }
  const digest = digestItems(workspace);
  const unaskable = [...owed].every(
    (id) =>
      (digest.get(id)?.tied === true ||
        changes.tripTied.has(id) ||
        isUntiedTravelConfirmed(id, digest, changes)) &&
      unestablished.has(id),
  );
  return unaskable
    ? []
    : [
        problem(
          'invariant',
          `${WAITING_LINES_UNASKED}: waiting_lines.json holds ${String(owed.size)} line(s) the person asked to sort and this run asks about none of them; ask about them before every other question (reference/steps/4-ask.md)`,
        ),
      ];
}

export const TRAVEL_LINE_UNASKED = 'travel_line_unasked';

/**
 * No travel line lands nowhere (issue #1563, reference/steps/4-ask.md's Trips no document places
 * paragraph): a fare, a hotel night, a ride or a meal this run books with no place, no trip and no
 * receipt attached to a trip — a meal, or an expense on a travel line of its provisional schedule
 * (`TRIP_TRAVEL_LINES`), `confirmed` — is cited by a question of this run (its line, or a
 * document cited without its lines), or by a live answer to a question that decides where it goes
 * (`personal` and `not_mine` included; `per_document` and a typed answer owe a follow-up, as the
 * sort request's rule reads them). It may wait under an `entity_unestablished` finding only while
 * the run asks its cap of questions or profile.json stages no place to offer. The message names the
 * code and the count, never a line, a vendor, an amount or a document.
 */
function travelLinesUnaskedProblems(workspace: string, skillDir: string): Problem[] {
  const owed = ledgerItemsOf(workspace).flatMap(([, item]) => {
    const id = strOrNull(item.id);
    const schedule = strOrNull(item.schedule);
    const line = strOrNull(item.line);
    const source = strOrNull(item.source_file);
    const travel =
      item.meal === true ||
      (schedule !== null && line !== null && (TRIP_TRAVEL_LINES[schedule] ?? []).includes(line));
    return id !== null &&
      travel &&
      item.kind !== 'income' &&
      item.status === 'confirmed' &&
      strOrNull(item.entity) === null &&
      strOrNull(item.trip) === null &&
      (source === null || attachTargetOf(workspace, source, 'trip') === null)
      ? [id]
      : [];
  });
  if (owed.length === 0) return [];
  const catalog = loadQuestionCatalog(skillDir);
  if (catalog === null) return [];
  const covered = new Set<string>();
  const placementKey = new RegExp(PLACEMENT_QUESTION_KEY_PATTERN);
  for (const [key, staged] of answersOf(workspace)) {
    const option = chosenOptionOf(staged);
    if (
      !placementKey.test(key) ||
      typeof option !== 'string' ||
      option === PER_DOCUMENT_OPTION_ID
    ) {
      continue;
    }
    for (const id of staged.cites) covered.add(id);
  }
  const context = keyContextOf(workspace, skillDir, catalog.openFacts);
  const questions = listOf(loadJson(join(workspace, 'out', 'questions.json')));
  for (const raw of questions) {
    const question = recordOf(raw);
    if (question === null) continue;
    for (const id of placementLines(listOf(question.cites), context)) covered.add(id);
  }
  const waitable =
    askedQuestionCount(questions) >= MAX_QUESTIONS_PER_RUN ||
    ![...stagedEntitySchedules(workspace).values()].some(
      (schedule) => schedule in TRIP_TRAVEL_LINES,
    );
  const unestablished = new Set<string>();
  if (waitable) {
    for (const raw of listOf(loadJson(join(workspace, 'out', 'findings.json')))) {
      const finding = recordOf(raw);
      if (finding?.kind === 'entity_unestablished') {
        for (const cite of stringList(finding.cites)) unestablished.add(cite);
      }
    }
  }
  const unasked = owed.filter((id) => !covered.has(id) && !unestablished.has(id));
  return unasked.length === 0
    ? []
    : [
        problem(
          'invariant',
          `${TRAVEL_LINE_UNASKED}: ledger.json books ${String(unasked.length)} travel or meal line(s) with no place and no trip, and no question asks where they belong; ask one placement question per trip or group of them, carrying the trip its documents show (reference/steps/4-ask.md)`,
        ),
      ];
}

export const ANSWER_UNAPPLIED = 'answer_unapplied';

/** How the personal tool's importer pairs a rebuild's answers with its lines (decision record
 *  0134), handed to the check of a run staged without `confirmed/`. */
export interface RebuiltAnswerLines {
  /** Each prior ledger id's rebuilt id: a cite it does not pair names no line of the run. */
  readonly ids: ReadonlyMap<string, string>;
  /** The answers the importer applies to their rebuilt lines by code, whatever the run wrote. */
  readonly codeApplied: ReadonlySet<string>;
}

/** A ledger field's value, an empty string read as none, as the importer reads one. */
function filledOrNull(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null;
}

/** The staged answers with each cite re-pointed to its rebuilt line, and one `ids` does not pair
 *  (a line the rebuild dropped, or a document) left out. */
function repointedAnswers(
  answers: ReadonlyMap<string, StagedAnswer>,
  ids: ReadonlyMap<string, string>,
): Map<string, StagedAnswer> {
  return new Map(
    [...answers].map(([key, answer]) => [
      key,
      { ...answer, cites: answer.cites.flatMap((id) => ids.get(id) ?? []) },
    ]),
  );
}

/** A rebuild's `confirmed` lines by id, a held one left out as the digest leaves it out, each
 *  `tied` when the run ties it to a trip or a vehicle, as the digest marks a row. */
function rebuiltRows(workspace: string): Map<string, Json> {
  const rows = new Map<string, Json>();
  for (const [, item] of ledgerItemsOf(workspace)) {
    const id = strOrNull(item.id);
    if (id === null || item.status !== 'confirmed') continue;
    const tied = filledOrNull(item.trip) !== null || filledOrNull(item.vehicle) !== null;
    rows.set(id, { ...item, tied });
  }
  return rows;
}

const PLACEMENT_KEY = new RegExp(PLACEMENT_QUESTION_KEY_PATTERN);

/**
 * Whether the person's later word decides where a line goes, so an earlier answer citing it owes
 * nothing there (the later-word rule): an answer standing after `key` in answers.json that cites
 * the line and is a `move_lines:` move, or a placement or register answer that places it
 * (`placingTarget`) or takes it off its place (`unplacesPlacement`) — such as the per-document
 * question a `per_document` answer owes. A later answer that decides nothing (typed text, a
 * `none` option that un-places nothing) leaves the earlier one standing. The personal tool's
 * importer reads the same rule over a rebuild's carried answers.
 */
export function laterWordCites(
  answers: ReadonlyMap<string, StagedAnswer>,
  key: string,
  id: string,
): boolean {
  let after = false;
  for (const [later, answer] of answers) {
    if (later === key) {
      after = true;
      continue;
    }
    if (!after || !answer.cites.includes(id)) continue;
    if (later.startsWith(MOVE_LINES_KEY_PREFIX)) return true;
    if (
      PLACEMENT_KEY.test(later) &&
      (placingTarget(optionEffectOf(answer)) !== null || unplacesPlacement(later, answer))
    ) {
      return true;
    }
  }
  return false;
}

/** The entity an answer's chosen option places its lines on: a `ledger`/`entity` effect's `to`, or
 *  an `entity_register` effect's `entityKey`; null for any other effect, `none` included. */
function placingTarget(effect: Json | null): string | null {
  if (effect === null) return null;
  if (effect.kind === 'entity_register') return strOrNull(effect.entityKey);
  if (effect.kind !== 'ledger' || effect.field !== 'entity') return null;
  const to = recordOf(effect.to);
  return to?.type === 'entity' ? strOrNull(to.entityKey) : null;
}

/** A profile's entity names by key; empty for a malformed profile. */
function entityNamesByKey(profile: unknown): Map<string, string> {
  const names = new Map<string, string>();
  for (const raw of listOf(recordOf(profile)?.entities)) {
    const entity = recordOf(raw);
    const key = strOrNull(entity?.key);
    const name = strOrNull(entity?.name);
    if (key !== null && name !== null) names.set(key, name);
  }
  return names;
}

/**
 * A live answer that places lines is applied (issue #1257, the R1 bisect): a run that never opened
 * `answers.json` applied none of the person's answers, and since #1261 a line a placement or
 * register answer covers is out of the waiting set, so the line was left unplaced with nothing to
 * ask about it again. The answers judged are those to a question that decides where a line goes
 * (`PLACEMENT_QUESTION_KEY_PATTERN`) whose chosen option places lines on an entity
 * (`placingTarget`); a `none` answer (`personal`, `not_mine`, `per_document`) places nothing. One
 * is unapplied when a line it cites is in the confirmed digest with no place (`schedule` null) and
 * this run writes no `entity` change for it. reference/steps/5-apply.md's own deferrals are not
 * refused, each named:
 * - the line is already placed, or no longer in the digest (deleted, or held), or already carries
 *   the answer's key (applied by an earlier run);
 * - the target is not staged in `profile.json`: "leave that item until a later run stages the
 *   entity" — a register answer whose declared row is not staged yet among them;
 * - the target is a K-1 interest: "never move an item onto or off a K-1 interest";
 * - the target's name changes in this run's resolved profile: "the move is refused, so apply it
 *   on the next run";
 * - the line is tied to a trip or a vehicle (`tied`, or this run's `trip` change): "never move a
 *   `tied` item to another schedule", and an unassigned line's every move crosses schedules;
 * - a `move_lines:` answer later in answers.json cites the line: the person's later word decides
 *   where it goes, and the model writes no change under the earlier answer there (issue #1376);
 *   so does a later placement or register answer that decides where it goes (`laterWordCites`);
 * - the move waits for a category answer: this run asks `line_category_q` citing the line, or an
 *   `entity_unestablished` finding cites it while `line_category_q` "cannot be asked again" for
 *   it — an answer to it is already staged, this run already asks it for other lines (one key,
 *   one target schedule per run), or this run asks its cap of questions.
 * An answer to a stored placement (issue #1384, decision record 0150: its first option carries
 * `"placed": true`) is judged on its lines wherever they sit, because the run booked them on the
 * placed option's place: the answer that keeps that option has nothing to apply; and one that
 * names another place is unapplied while a cited line lacks its key and this run writes no
 * `entity` change for it, the deferrals above aside. A `none` answer (`personal`, `not_mine`,
 * `per_document`) to any `open_` placement question, a stored placement or one the person sent
 * back and a run asked again alike, is unapplied while a cited line still has a place, lacks its
 * key and this run writes no `entity` change to null for it, unless a trip or vehicle ties it.
 * A rebuild (a run staged without `confirmed/`, decision record 0134) is judged over its own
 * lines once the personal tool's importer pairs the answers' cites with them (`rebuilt`): each
 * re-pointed line the run books `confirmed` owes its answer while it is not where the answer put
 * it — on another place, or on none, or still on a place after an un-placing answer — the
 * deferrals above aside (a tie is the `trip` or `vehicle` the run writes on the line), and an
 * answer the importer applies by code owes nothing. Without the
 * pairing a run with no digest is not judged: its ids are numbered afresh, so a prior id names no
 * line of it.
 * A person's move (a `move_lines:` answer, issue #1782) is judged on its crossing rows, each a
 * cited line whose digest `schedule` is not its target's staged one and which lacks the move's
 * key: it is unapplied while one gets no `entity` change in this run, the deferrals above aside
 * and two more — a row on a K-1 interest, and a row a `pass_through` question or its answer holds
 * (a settled row among them), which takes no change but that answer's. A rebuild judges no move:
 * its lines carry no stored schedule to tell a crossing by.
 * The message names the code and the count of answers, never a key, line, vendor or entity. The
 * importer re-runs this over the bundle it rebuilds, which stages the same live answers.
 */
function answerUnappliedProblems(
  workspace: string,
  skillDir: string,
  rebuilt?: RebuiltAnswerLines,
): Problem[] {
  const stagedAnswers = answersOf(workspace);
  if (stagedAnswers.size === 0) return [];
  const confirmed = digestItems(workspace);
  const rebuild = confirmed.size === 0 && rebuilt !== undefined;
  if (confirmed.size === 0 && !rebuild) return [];
  const staged = stagedEntitySchedules(workspace);
  const answers = rebuild ? repointedAnswers(stagedAnswers, rebuilt.ids) : stagedAnswers;
  const digest = rebuild ? rebuiltRows(workspace) : confirmed;
  const stagedNames = entityNamesByKey(loadJson(join(workspace, 'profile.json')));
  const resolvedNames = entityNamesByKey(loadJson(join(workspace, 'out', 'profile.resolved.json')));
  let changes: RunLineChanges | null = null;
  let deferred: Set<string> | null = null;
  let held: Set<string> | null = null;
  const passThroughHeld = (): Set<string> => {
    const facts = loadQuestionCatalog(skillDir)?.openFacts;
    return facts === undefined ? new Set() : passThroughHeldLines(workspace, facts);
  };
  const deferredMoves = (): Set<string> => {
    const lines = new Set<string>();
    const asked = listOf(loadJson(join(workspace, 'out', 'questions.json')));
    let asksCategory = false;
    for (const raw of asked) {
      const question = recordOf(raw);
      if (question?.key !== 'line_category_q') continue;
      asksCategory = true;
      for (const id of stringList(question.cites)) lines.add(id);
    }
    // `line_category_q` is one catalog key per run with one target schedule, so a move it cannot
    // carry — already staged, already asked this run for other lines, or the run at its cap of
    // questions — waits behind an `entity_unestablished` finding.
    if (
      answers.has('line_category_q') ||
      asksCategory ||
      askedQuestionCount(asked) >= MAX_QUESTIONS_PER_RUN
    ) {
      for (const raw of listOf(loadJson(join(workspace, 'out', 'findings.json')))) {
        const finding = recordOf(raw);
        if (finding?.kind === 'entity_unestablished') {
          for (const id of stringList(finding.cites)) lines.add(id);
        }
      }
    }
    return lines;
  };
  let unapplied = 0;
  let placedUnapplied = 0;
  for (const [key, answer] of answers) {
    const move = key.startsWith(MOVE_LINES_KEY_PREFIX);
    if (move ? rebuild : !PLACEMENT_KEY.test(key) || rebuilt?.codeApplied.has(key) === true) {
      continue;
    }
    const effect = optionEffectOf(answer);
    const placed = move ? null : placedOptionOf(answer.options);
    // The person kept the stored placement: its lines are already where the run booked them.
    if (placed !== null && chosenOptionOf(answer) === placed['id']) continue;
    const unplaces = !move && unplacesPlacement(key, answer);
    const target = placingTarget(effect);
    if (target === null && !unplaces) continue;
    const targetSchedule = target === null ? undefined : staged.get(target);
    if (target !== null) {
      if (!isPlaceSchedule(targetSchedule)) continue;
      const renamed = resolvedNames.get(target);
      if (renamed !== undefined && renamed !== stagedNames.get(target)) continue;
    }
    const owedRow = answer.cites
      .map((id) => digest.get(id))
      .find((row) => {
        if (row === undefined || row.tied === true) return false;
        const id = String(row.id);
        if (rebuild) {
          // A rebuilt line is the run's own booking: it owes the answer until it sits where the
          // answer put it.
          const entity = filledOrNull(row.entity);
          if (unplaces ? entity === null : entity === target) return false;
        } else if (move) {
          if (row.schedule === targetSchedule || row.schedule === 'K1') return false;
          if (stringList(row.answer_keys).includes(key)) return false;
          held ??= passThroughHeld();
          if (held.has(id)) return false;
        } else {
          // A line owes the move while it has no place; a stored placement's while it lacks the
          // key, wherever it sits, and its un-place while it still has a place.
          if (unplaces ? row.schedule === null : placed === null && row.schedule !== null) {
            return false;
          }
          if (stringList(row.answer_keys).includes(key)) return false;
        }
        // The person's later word on the line decides where it goes (the later-word rule): a
        // `move_lines:` move, or a later placement or register answer citing it, such as the
        // per-document question a `per_document` answer owes.
        if (laterWordCites(answers, key, id)) return false;
        if (rebuild && unplaces) return true;
        if (!rebuild) {
          changes ??= runLineChangesOf(workspace);
          if (changes.tripTied.has(id)) return false;
          if (unplaces) return !changes.unplaced.has(id);
          if (changes.moved.has(id)) return false;
        }
        deferred ??= deferredMoves();
        return !deferred.has(id);
      });
    if (owedRow === undefined) continue;
    // A rebuild's message follows where the owed line sits; a digest's, the answer it owes.
    const leftPlaced = rebuild
      ? filledOrNull(owedRow.entity) !== null
      : move
        ? owedRow.schedule !== null
        : placed !== null || unplaces;
    if (leftPlaced) placedUnapplied += 1;
    else unapplied += 1;
  }
  const problems: Problem[] = [];
  if (unapplied > 0) {
    problems.push(
      problem(
        'invariant',
        `${ANSWER_UNAPPLIED}: answers.json holds ${String(unapplied)} answer(s) that place lines on a property or business, and this run leaves a line one of them cites unassigned; write the entity change for each cited line (reference/steps/5-apply.md)`,
      ),
    );
  }
  if (placedUnapplied > 0) {
    problems.push(
      problem(
        'invariant',
        `${ANSWER_UNAPPLIED}: answers.json holds ${String(placedUnapplied)} answer(s) that move a placed line to another place or off every place, and this run leaves a line one of them cites where it sits; write the entity change for each cited line, to null for a personal, not_mine or per_document answer to a placement (reference/steps/5-apply.md)`,
      ),
    );
  }
  return problems;
}

/** The lines a placement question asks about: the ledger ids it cites, and for a document it
 *  cites none of whose lines it names, every line booked from that document. */
function placementLines(cites: readonly unknown[], context: KeyContext): Set<string> {
  const lines = new Set<string>();
  const namedDocuments = new Set<string>();
  for (const cite of cites) {
    if (typeof cite === 'string' && /^L\d+$/.test(cite)) {
      lines.add(cite);
      const source = context.lines.get(cite)?.sourceFile;
      if (source !== undefined && source !== null) namedDocuments.add(source);
    }
  }
  for (const cite of cites) {
    if (typeof cite === 'string' && /^L\d+$/.test(cite)) continue;
    const document = citedDocument(cite, context);
    if (document === null || namedDocuments.has(document)) continue;
    for (const [id, line] of context.lines) if (line.sourceFile === document) lines.add(id);
  }
  return lines;
}

/** The recipe's reason a question with a fact hint and no key spells none, as a clause. */
function keyReason(question: Json, context: WorkspaceKeyContext): string {
  const target = questionFactOf(question, context.facts);
  if (target === null) return '; its fact is no fact kind of the catalog (open.facts)';
  const spelled = spellOpenQuestionKey(
    {
      ...target,
      cites: Array.isArray(question.cites) ? question.cites : [],
      effects: questionEffects(question),
    },
    context,
  );
  return spelled.ok ? '' : `, but it ${spelled.reason}`;
}

/** The recipe fact whose typed answer may record a property's purchase (decision record 0161). */
const PURCHASE_FACT = 'purchase';

/** A typed answer to a `purchase` question: the subject its key is spelled from and the figures
 *  the person's text prints. */
interface TypedPurchaseAnswer {
  readonly subject: string;
  readonly figures: TypedFigures;
}

/** The staged answers the person typed to a `purchase` question, by key: a key whose recipe fact
 *  is `purchase`, first ask or follow-up. */
function typedPurchaseAnswersOf(
  workspace: string,
  skillDir: string,
): Map<string, TypedPurchaseAnswer> {
  const purchases = new Map<string, TypedPurchaseAnswer>();
  const catalog = loadQuestionCatalog(skillDir);
  if (catalog === null) return purchases;
  const facts = [...catalog.openFacts.keys()];
  for (const [key, staged] of answersOf(workspace)) {
    const text = typedTextOf(staged);
    const parts = parseOpenQuestionKey(key, facts);
    if (text === null || parts?.fact !== PURCHASE_FACT) continue;
    purchases.set(key, { subject: parts.subject, figures: typedFigures(text) });
  }
  return purchases;
}

/** A decimal-dollar register value as whole cents, or null when it is not a plain decimal. */
function decimalCents(value: unknown): number | null {
  const cents = typeof value === 'string' ? readingTotalCents(value) : null;
  return cents === null ? null : Number(cents);
}

/** Whether an asset is the purchase a typed answer states in full (decision record 0161): a
 *  `real_property` asset whose price, land value and first-rented day the person's text prints,
 *  on the entity the answer's question is about. */
function recordsTypedPurchase(
  answer: TypedPurchaseAnswer,
  entitySubject: string | null,
  asset: Json,
): boolean {
  const costBasisCents = decimalCents(asset.cost_basis);
  const landValueCents = decimalCents(asset.land_value);
  const placedInService = strOrNull(asset.placed_in_service);
  return (
    answer.subject === entitySubject &&
    asset.kind === 'real_property' &&
    costBasisCents !== null &&
    landValueCents !== null &&
    placedInService !== null &&
    statesPurchase(answer.figures, { costBasisCents, landValueCents, placedInService })
  );
}

/** The typed code a follow-up whose option only repeats the purchase figures the person typed is
 *  refused with (issue #1562, decision record 0161); the message never carries a figure. */
export const TYPED_PURCHASE_REASKED = 'typed_purchase_reasked';

/**
 * A typed purchase answer stating the price, the land value and the first-rented day is recorded,
 * never asked back (decision record 0161): an `asset_register` option writing all three figures,
 * each one a typed `purchase` answer about the same entity prints, is refused wherever a question
 * of this run offers it. An option carrying a figure the person did not type, such as a closing
 * statement's that differs from theirs, is a question of its own and passes.
 */
function typedPurchaseReaskedProblems(workspace: string, skillDir: string): Problem[] {
  const purchases = [...typedPurchaseAnswersOf(workspace, skillDir).values()];
  if (purchases.length === 0) return [];
  const flagged = keyFlagOf(skillDir);
  const problems: Problem[] = [];
  for (const [index, raw] of listOf(loadJson(join(workspace, 'out', 'questions.json'))).entries()) {
    const question = recordOf(raw);
    if (question === null) continue;
    for (const option of listOf(question.options)) {
      const effect = parseEffect(recordOf(option)?.effect);
      if (
        effect?.kind !== 'asset_register' ||
        effect.costBasisCents === undefined ||
        effect.landValueCents === undefined ||
        effect.placedInService === undefined
      ) {
        continue;
      }
      const purchase = {
        costBasisCents: effect.costBasisCents,
        landValueCents: effect.landValueCents,
        placedInService: effect.placedInService,
      };
      const subject = profileKeySubject(effect.entityKey, PURCHASE_FACT, flagged);
      if (
        !purchases.some(
          (answer) => answer.subject === subject && statesPurchase(answer.figures, purchase),
        )
      ) {
        continue;
      }
      problems.push(
        problem(
          'invariant',
          `${TYPED_PURCHASE_REASKED}: out/questions.json entry ${String(index)} option ${String(recordOf(option)?.id)} asks the person to confirm the purchase figures they typed; record the purchase from their answer instead (reference/steps/5-apply.md)`,
        ),
      );
    }
  }
  return problems;
}

/** The recipe fact whose typed answer may place lines on a place a register answer created
 *  (decision record 0167). */
const PLACEMENT_FACT = 'placement';

/** A typed `placement` answer naming one place: the parts its key is spelled from and the place. */
interface TypedPlacement {
  readonly subject: string;
  readonly followUp: number | null;
  readonly entity: string;
}

/**
 * The typed `placement` answers, by key, whose text names exactly one place `profile.json`
 * stages, that place one a register answer of the same `answers.json` created (decision record
 * 0167): the person typed the place because the question, asked before it existed, had no option
 * for it. A place is named by its staged name or the name its register option carried. A text
 * naming no place or several, or a place no register answer created, places nothing.
 */
function typedPlacementsOf(workspace: string): Map<string, TypedPlacement> {
  const placements = new Map<string, TypedPlacement>();
  const answers = answersOf(workspace);
  const registered = new Map<string, string>();
  for (const staged of answers.values()) {
    const effect = optionEffectOf(staged);
    const entity = effect?.kind === 'entity_register' ? strOrNull(effect.entityKey) : null;
    if (entity !== null) registered.set(entity, strOrNull(effect?.entityName) ?? '');
  }
  if (registered.size === 0) return placements;
  const places: NamedPlace[] = [...entityNamesByKey(loadJson(join(workspace, 'profile.json')))].map(
    ([key, name]) => ({ key, names: [name, registered.get(key) ?? ''] }),
  );
  for (const [key, staged] of answers) {
    const text = typedTextOf(staged);
    const parts = parseOpenQuestionKey(key, [PLACEMENT_FACT]);
    if (text === null || parts?.fact !== PLACEMENT_FACT) continue;
    const named = placesNamed(text, places);
    const [entity] = named;
    if (named.length !== 1 || entity === undefined || !registered.has(entity)) continue;
    placements.set(key, { subject: parts.subject, followUp: parts.followUp, entity });
  }
  return placements;
}

/** The typed code a follow-up offering the place the person typed is refused with (issue #1571,
 *  decision record 0167); the message never names the place. */
export const TYPED_PLACEMENT_REASKED = 'typed_placement_reasked';

/** The typed code a line placed from a typed answer that no `note` finding shows is refused with
 *  (issue #1571, decision record 0167). */
export const TYPED_PLACEMENT_UNSHOWN = 'typed_placement_unshown';

/**
 * A placement the person typed before its place existed is applied once a register answer creates
 * it, never asked back (decision record 0167). A follow-up of the typed answer's key offering a
 * `ledger`/`entity` option onto the place the text names is refused, unless it cites a confirmed
 * line, which moves only on a confirmed option, or a placing option carries a trip, which the person
 * did not type and which lands only on their answer. Every ledger addition booked from the typed
 * answer is cited, by its id or its document, by a `note` finding of this run, so the accountant sees
 * the placement came from the person's words.
 */
function typedPlacementProblems(workspace: string): Problem[] {
  const placements = [...typedPlacementsOf(workspace)];
  if (placements.length === 0) return [];
  const confirmed = digestItems(workspace);
  const problems: Problem[] = [];
  for (const [index, raw] of listOf(loadJson(join(workspace, 'out', 'questions.json'))).entries()) {
    const question = recordOf(raw);
    const key = strOrNull(question?.key);
    const parts = key === null ? null : parseOpenQuestionKey(key, [PLACEMENT_FACT]);
    if (question === null || parts?.fact !== PLACEMENT_FACT || parts.followUp === null) continue;
    const followUp = parts.followUp;
    const typed = placements.find(
      ([, placement]) =>
        placement.subject === parts.subject && (placement.followUp ?? 1) < followUp,
    )?.[1];
    if (typed === undefined) continue;
    if (stringList(question.cites).some((cite) => confirmed.has(cite))) continue;
    const placing = listOf(question.options)
      .map(recordOf)
      .filter((option): option is Json => {
        const effect = recordOf(option?.effect);
        return effect?.kind === 'ledger' && effect.field === 'entity';
      });
    if (placing.some((option) => listOf(recordOf(option.effect)?.trips).length > 0)) continue;
    const repeating = placing.find(
      (option) => recordOf(recordOf(option.effect)?.to)?.entityKey === typed.entity,
    );
    if (repeating === undefined) continue;
    problems.push(
      problem(
        'invariant',
        `${TYPED_PLACEMENT_REASKED}: out/questions.json entry ${String(index)} option ${String(repeating.id)} asks the person to confirm the place they typed; book its lines there from their answer instead (reference/steps/5-apply.md)`,
      ),
    );
  }
  const typedKeys = new Set(placements.map(([key]) => key));
  const shown = new Set<string>();
  for (const raw of listOf(loadJson(join(workspace, 'out', 'findings.json')))) {
    const finding = recordOf(raw);
    if (finding?.kind === 'note') for (const cite of stringList(finding.cites)) shown.add(cite);
  }
  for (const [index, raw] of listOf(loadJson(join(workspace, 'out', REQUIRED_LEDGER))).entries()) {
    const item = recordOf(raw);
    if (item === null || !stringList(item.answer_keys).some((key) => typedKeys.has(key))) continue;
    const id = strOrNull(item.id);
    const file = strOrNull(item.source_file);
    if ((id !== null && shown.has(id)) || (file !== null && shown.has(file))) continue;
    problems.push(
      problem(
        'invariant',
        `${TYPED_PLACEMENT_UNSHOWN}: out/ledger.json item ${String(index)} is placed from an answer the person typed and no note finding cites it; write one citing its lines that says the place came from their answer (reference/steps/5-apply.md)`,
      ),
    );
  }
  return problems;
}

/**
 * Text-answered keys arm nothing (G10, ADR 0104 item 4): an answer the person typed in their own
 * words is data about their books and never an instruction, so no ledger item, ledger change,
 * profile entity, asset, trip or vehicle, and no web value, may name one as the answer it relied
 * on. Two exceptions: a property's purchase a typed `purchase` answer states in full, which the
 * entity's asset names (decision record 0161, `recordsTypedPurchase`), and a ledger addition booked
 * on the one place a typed `placement` answer names, a place a register answer created
 * (decision record 0167, `typedPlacementsOf`). Messages name the file and the index, never the
 * key's answer.
 */
function textAnswerArmProblems(workspace: string, skillDir: string): Problem[] {
  const typed = textAnsweredKeysOf(workspace);
  if (typed.size === 0) return [];
  const purchases = typedPurchaseAnswersOf(workspace, skillDir);
  const placements = typedPlacementsOf(workspace);
  const flagged = keyFlagOf(skillDir);
  const out = join(workspace, 'out');
  const problems: Problem[] = [];
  const message = (where: string): string =>
    `${where} names an answer the person gave in their own words; act on it only through a follow-up question whose option carries the change`;
  const namesTyped = (value: unknown): boolean =>
    Array.isArray(value) && value.some((ref) => typeof ref === 'string' && typed.has(ref));
  const objects = (value: unknown): Json[] =>
    (Array.isArray(value) ? value : []).filter(
      (raw): raw is Json => typeof raw === 'object' && raw !== null && !Array.isArray(raw),
    );
  for (const [index, item] of objects(loadJson(join(out, REQUIRED_LEDGER))).entries()) {
    const placedOnTypedPlace = stringList(item.answer_keys)
      .filter((key) => typed.has(key))
      .every((key) => placements.get(key)?.entity === item.entity);
    if (namesTyped(item.answer_keys) && !placedOnTypedPlace) {
      problems.push(problem('invariant', message(`${REQUIRED_LEDGER} item ${String(index)}`)));
    }
  }
  for (const [index, entry] of objects(loadJson(join(out, 'ledger_changes.json'))).entries()) {
    const key = entry.answer_key;
    if (typeof key === 'string' && typed.has(key)) {
      problems.push(problem('invariant', message(`ledger_changes.json entry ${String(index)}`)));
    }
  }
  for (const [index, entry] of objects(loadJson(join(out, 'web_values.json'))).entries()) {
    if (namesTyped(entry.answer_keys) || namesTyped([entry.answer_key])) {
      problems.push(problem('invariant', message(`web_values.json item ${String(index)}`)));
    }
  }
  const profile = loadJson(join(out, 'profile.resolved.json'));
  if (profile !== null && typeof profile === 'object' && !Array.isArray(profile)) {
    const record = profile as Json;
    for (const [index, trip] of objects(record.trips).entries()) {
      if (namesTyped(trip.answer_keys)) {
        problems.push(problem('invariant', message(`profile.resolved.json trip ${String(index)}`)));
      }
    }
    for (const [index, vehicle] of objects(record.vehicles).entries()) {
      if (namesTyped(vehicle.answer_keys)) {
        problems.push(
          problem('invariant', message(`profile.resolved.json vehicle ${String(index)}`)),
        );
      }
    }
    for (const [index, entity] of objects(record.entities).entries()) {
      if (namesTyped(entity.answer_keys)) {
        problems.push(
          problem('invariant', message(`profile.resolved.json entity ${String(index)}`)),
        );
      }
      const entitySubject =
        typeof entity.key === 'string'
          ? profileKeySubject(entity.key, PURCHASE_FACT, flagged)
          : null;
      const recordsTypedPurchaseOf = (asset: Json): boolean =>
        stringList(asset.answer_keys)
          .filter((key) => typed.has(key))
          .every((key) => {
            const answer = purchases.get(key);
            return answer !== undefined && recordsTypedPurchase(answer, entitySubject, asset);
          });
      for (const [assetIndex, asset] of objects(entity.assets).entries()) {
        if (namesTyped(asset.answer_keys) && !recordsTypedPurchaseOf(asset)) {
          problems.push(
            problem(
              'invariant',
              message(`profile.resolved.json entity ${String(index)} asset ${String(assetIndex)}`),
            ),
          );
        }
      }
    }
    for (const [index, asset] of objects(record.assets).entries()) {
      if (namesTyped(asset.answer_keys)) {
        problems.push(
          problem('invariant', message(`profile.resolved.json asset ${String(index)}`)),
        );
      }
    }
  }
  return problems;
}

/**
 * The home office's open items (issue #661; issue #1080, decision record 0011's #1080
 * amendment). No question asks the method: Abacus shows both readings and the method is the
 * accountant's, so the run records the open item instead. While the readings recomputed here from
 * the profile and the staged costs - never the possibly stale out/books.json - carry both a
 * simplified and a regular figure, findings.json must carry a method_comparison finding citing at
 * least one document the home costs come from, so a comparison finding about another row cannot
 * stand in for it. Step 7 asks for every one of them, so the finding keeps one identity from run
 * to run; the gate asks for one. Every cost names its document (the staging gate refuses an
 * empty source_file). While the regular figure is missing, a missing_receipt finding for the
 * missing area or costs. Messages echo no value.
 */
function homeOfficeOpenItemProblems(workspace: string, skillDir: string): Problem[] {
  const row = loadHomeOfficeReadings(workspace, skillDir).rows[0];
  if (row === undefined) return [];
  const findings = listOf(loadJson(join(workspace, 'out', 'findings.json'))).filter(
    (raw): raw is Json => typeof raw === 'object' && raw !== null && !Array.isArray(raw),
  );
  if (row.regular_cents === null) {
    if (findings.some((finding) => finding.kind === 'missing_receipt')) return [];
    return [
      problem(
        'schema',
        'the home office has no regular reading, so findings.json must carry a missing_receipt finding for the missing area or costs',
      ),
    ];
  }
  const costDocuments = listOf(row.costs)
    .map((cost) =>
      typeof cost === 'object' && cost !== null ? strOrNull((cost as Json).source_file) : null,
    )
    .filter((file): file is string => file !== null);
  const cited = findings.some(
    (finding) =>
      finding.kind === 'method_comparison' &&
      stringList(finding.cites).some((cite) =>
        costDocuments.some((file) => sameDocument(file, cite)),
      ),
  );
  if (cited) return [];
  return [
    problem(
      'schema',
      "the home office carries both readings, so findings.json must carry a method_comparison finding naming the method as the accountant's choice and citing the documents its home costs come from",
    ),
  ];
}

/** The documents every `note` finding of out/findings.json cites. */
function noteCitesOf(findings: unknown): string[] {
  return listOf(findings).flatMap((raw) =>
    typeof raw === 'object' && raw !== null && (raw as Json).kind === 'note'
      ? stringList((raw as Json).cites)
      : [],
  );
}

/** A profile file's entities, the object entries only. */
function profileEntitiesOf(profile: unknown): Json[] {
  return profile !== null && typeof profile === 'object' && !Array.isArray(profile)
    ? listOf((profile as Json).entities).filter(
        (raw): raw is Json => typeof raw === 'object' && raw !== null && !Array.isArray(raw),
      )
    : [];
}

/** profile.json's staged entities, the run's keys aliased onto them, and out/places.json's
 *  standard form of each staged place by its staged key. */
function stagedPlacesOf(workspace: string): {
  stagedEntities: Json[];
  aliases: Map<string, string>;
  places: Map<string, StandardAddress | null>;
} {
  const stagedEntities = profileEntitiesOf(loadJson(join(workspace, 'profile.json')));
  const aliases = stagedKeyAliases(workspace, stagedEntities);
  const { places } = placesFileOf(workspace, stagedEntities, aliases, false);
  return { stagedEntities, aliases, places };
}

/** The addresses a document prints: its documents.json entry's and its staged reading's. */
function documentAddressesOf(
  workspace: string,
  file: string,
  entry: Json | null,
): ReadingAddress[] {
  return [(entry?.fields ?? {}) as Json, ...stagedPageFields(workspace, file)].flatMap((fields) =>
    readingAddressesOf(fields.addresses),
  );
}

/** The typed code a payment whose parcel no entity claims is refused with while its bill prints a
 *  staged place's address; the message names the place's key, never an address or a parcel. */
export const PARCEL_CLAIM_OWED = 'parcel_claim_owed';

/** The words a `note` finding's message opens with to say a bill's matched address is the
 *  owner's mailing address and not the property's location, the one escape from the claim. */
export const MAILING_ADDRESS_NOTE = 'Mailing address:';

/** The documents the mailing-address notes of out/findings.json cite. */
function mailingAddressNoteCitesOf(findings: unknown): string[] {
  return listOf(findings).flatMap((raw) => {
    const finding = recordOf(raw);
    return finding?.kind === 'note' &&
      typeof finding.message === 'string' &&
      finding.message.startsWith(MAILING_ADDRESS_NOTE)
      ? stringList(finding.cites)
      : [];
  });
}

/** What the parcel gate reads once per check: documents.json, the staged places' standard forms,
 *  and the parcels each staged place's entity claims in out/profile.resolved.json, normalized. */
type ParcelAnchors = {
  readonly documents: readonly DocumentEntry[];
  readonly places: readonly { readonly key: string; readonly standard: StandardAddress }[];
  readonly claimedByPlace: ReadonlyMap<string, ReadonlySet<string>>;
};

function parcelAnchorsOf(workspace: string): ParcelAnchors {
  const { aliases, places } = stagedPlacesOf(workspace);
  const claimedByPlace = new Map<string, Set<string>>();
  for (const entity of profileEntitiesOf(
    loadJson(join(workspace, 'out', 'profile.resolved.json')),
  )) {
    const key = strOrNull(entity.key);
    if (key === null) continue;
    const placeKey = aliases.get(key) ?? key;
    const claimed = claimedByPlace.get(placeKey) ?? new Set<string>();
    for (const parcel of listOf(entity.parcels)) {
      if (typeof parcel === 'string') claimed.add(normalizeParcel(parcel));
    }
    claimedByPlace.set(placeKey, claimed);
  }
  return {
    documents: documentEntriesOf(workspace),
    places: [...places].flatMap(([key, standard]) =>
      standard === null ? [] : [{ key, standard }],
    ),
    claimedByPlace,
  };
}

const lineTokens = (address: StandardAddress): number =>
  addressFold(address.usps_standard ?? '')
    .split(' ')
    .filter(Boolean).length;

/**
 * The staged place an unclaimed parcel's bill belongs to by the address anchor, or null. Only the
 * bill's own printed addresses anchor it (documents.json or its staged reading), never the payment
 * evidence, which prints the payer's. A printed line covers a place whose standard line is it or
 * its prefix (`sameStandardAddress`, the purchase gate's bill match): a unit's bill covers the
 * building's place, a building's bill never one unit's. Several covered places narrow to the one an
 * address equals exactly (`sameStandardForm`); still several, or none, owe no claim. A place whose
 * entity already claims one of the bill's parcels owes none either: the bill's other parcels may
 * be another property's. The model claims the parcel (reference/steps/5-apply.md).
 */
function parcelClaimOwedPlace(
  workspace: string,
  anchors: ParcelAnchors,
  bill: string,
  billParcels: readonly string[],
): string | null {
  const printed = documentAddressesOf(
    workspace,
    bill,
    documentOf(anchors.documents, bill)?.entry ?? null,
  );
  const covered = anchors.places.filter(({ standard }) =>
    printed.some(
      (address) =>
        sameStandardAddress(address, standard) && lineTokens(standard) <= lineTokens(address),
    ),
  );
  const exact = covered.filter(({ standard }) =>
    printed.some((address) => sameStandardForm(address, standard)),
  );
  const [only, ...more] = covered.length > 1 ? exact : covered;
  if (only === undefined || more.length > 0) return null;
  const claimed = anchors.claimedByPlace.get(only.key);
  return billParcels.some((parcel) => claimed?.has(parcel) === true) ? null : only.key;
}

/** The typed code a purchase option writing a basis and no land value is refused with while the
 *  batch carries the property's tax bill (issue #1561); the message never carries a figure. */
export const PURCHASE_LAND_VALUE = 'purchase_land_value';

/** The pages of a document's staged reading (`extractions/<stem>.json`), in page order; none
 *  when it has no reading. */
function stagedPages(workspace: string, document: string): Json[] {
  const reading = recordOf(loadJson(join(workspace, 'extractions', readingNameOf(document))));
  return listOf(reading?.['pages']).flatMap((page): Json[] => {
    const record = recordOf(page);
    return record === null ? [] : [record];
  });
}

/** The `fields` of each page of a document's staged reading, in page order. */
function stagedPageFields(workspace: string, document: string): Json[] {
  return stagedPages(workspace, document).flatMap((page): Json[] => {
    const fields = recordOf(page['fields']);
    return fields === null ? [] : [fields];
  });
}

/** An amount as a person types it: an optional `-` or `(`, an optional `$`, whole dollars plain or
 *  grouped by commas in threes, an optional fraction and a closing `)` — the reader's correction
 *  rule (`TYPED_TOTAL`, packages/reader/src/correction.ts), so `334.000,00` is no amount. */
const STAGED_AMOUNT = /^([-(]?)\$?(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?(\)?)$/;

/** A staged reading's amount in cents, signed, or null when it is not an amount: the reader writes
 *  plain decimals, but a reading a person corrected may print `$` or thousands separators. */
function stagedAmountCents(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const typed = STAGED_AMOUNT.exec(value.trim());
  if (typed === null) return null;
  const [, opening = '', whole = '', fraction = '', closing = ''] = typed;
  const cents = readingTotalCents(`${opening}${whole.replaceAll(',', '')}${fraction}${closing}`);
  return cents === null ? null : Number(cents);
}

/** The land value a document's staged reading carries as a tax bill's `other.land_value`, in
 *  cents, from the first page carrying one at or above zero; null when none does. */
function stagedLandValueCents(workspace: string, document: string): number | null {
  for (const fields of stagedPageFields(workspace, document)) {
    const other = fields['other'];
    if (typeof other !== 'object' || other === null || Array.isArray(other)) continue;
    const cents = stagedAmountCents((other as Json)['land_value']);
    if (cents !== null && cents >= 0) return cents;
  }
  return null;
}

/**
 * A purchase option carries the land value the property's tax bill prints (issue #1561): an
 * `asset_register` option writing a `REAL_PROPERTY` asset's `costBasisCents` with no
 * `landValueCents` is refused while this batch's documents.json carries a `property_tax_bill` of
 * that property and no `note` finding cites the bill, the run's word that the bill prints none.
 * A bill whose staged reading carries `fields.other.land_value` (issue #1565) prints one an
 * option can carry, so no note excuses it, unless one of the property's bills stages a land value
 * above the basis, which no option can carry.
 * A bill is the property's when the question cites it, when it states a parcel the property's
 * `parcels` list (resolved or staged), or when the reader's USPS standard form of an address it
 * prints, in documents.json or its staged reading, is the property's in out/places.json
 * (`sameStandardAddress`, issue #1628); a property
 * staged with an address and no such form there is refused, since no bill could be tied to it by
 * address. A closing statement's allocation is the skill text's rule alone: the checker cannot
 * tell whether one prints it.
 */
function purchaseLandValueProblems(workspace: string): Problem[] {
  const questions = listOf(loadJson(join(workspace, 'out', 'questions.json')));
  const bills = documentEntriesOf(workspace).filter(
    (document) => document.entry.doc_type === 'property_tax_bill',
  );
  if (questions.length === 0 || bills.length === 0) return [];
  const billAddresses = new Map(
    bills.map(({ file, entry }) => [file, documentAddressesOf(workspace, file, entry)]),
  );
  const notedCites = noteCitesOf(loadJson(join(workspace, 'out', 'findings.json')));
  const { stagedEntities, aliases, places } = stagedPlacesOf(workspace);
  const entities = [
    ...profileEntitiesOf(loadJson(join(workspace, 'out', 'profile.resolved.json'))),
    ...stagedEntities,
  ];
  const stagedAddressed = new Set(
    stagedEntities.flatMap((entity) =>
      strOrNull(entity.address) === null ? [] : (strOrNull(entity.key) ?? []),
    ),
  );
  const problems: Problem[] = [];
  for (const [index, raw] of questions.entries()) {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) continue;
    const question = raw as Json;
    const cites = stringList(question.cites);
    for (const option of listOf(question.options)) {
      if (typeof option !== 'object' || option === null) continue;
      const effect = (option as Json).effect;
      if (typeof effect !== 'object' || effect === null) continue;
      const fields = effect as Json;
      if (
        fields.kind !== 'asset_register' ||
        fields.assetKind !== 'REAL_PROPERTY' ||
        fields.costBasisCents === undefined ||
        fields.landValueCents !== undefined
      ) {
        continue;
      }
      const property = entities.filter(
        (entity) =>
          (typeof fields.entityKey === 'string' && entity.key === fields.entityKey) ||
          (typeof fields.entityName === 'string' && entity.name === fields.entityName),
      );
      const parcels = new Set(entityParcelsOf({ entities: property }));
      const placeKeys = new Set(
        property.flatMap((entity) => {
          const key = strOrNull(entity.key);
          return key === null ? [] : [aliases.get(key) ?? key];
        }),
      );
      const standards = [...placeKeys].flatMap((key) => places.get(key) ?? []);
      const unstandardized = [...placeKeys].filter(
        (key) => stagedAddressed.has(key) && !places.has(key),
      );
      if (unstandardized.length > 0) {
        problems.push(
          problem(
            'schema',
            `${PURCHASE_LAND_VALUE}: out/questions.json entry ${String(index)} option ${String((option as Json).id)} writes a property's cost basis while out/places.json carries no well-formed entry for it ({usps_standard, city, region, country}, its delivery line keeping any house number the address prints), so no tax bill can be tied to it by address; write the place's standard address (reference/steps/3-propose.md)`,
          ),
        );
      }
      const propertyBills = bills.filter(({ file, entry }) => {
        const stated = (entry.fields ?? {}) as Json;
        return (
          cites.some((cite) => sameDocument(file, cite)) ||
          stringList(stated.parcel_numbers).some((parcel) =>
            parcels.has(normalizeParcel(parcel)),
          ) ||
          (billAddresses.get(file) ?? []).some((printed) =>
            standards.some((standard) => sameStandardAddress(printed, standard)),
          )
        );
      });
      // A staged land value above the basis no option can carry (the effect refuses it): with
      // one on any of the property's bills, the note stays the way out for each, since the skill
      // takes the latest bill's figure and the checker cannot date the bills.
      const basis = typeof fields.costBasisCents === 'number' ? fields.costBasisCents : null;
      const stagedLand = new Map(
        propertyBills.map(({ file }) => [file, stagedLandValueCents(workspace, file)]),
      );
      const aboveBasis = [...stagedLand.values()].some(
        (land) => land !== null && (basis === null || land > basis),
      );
      for (const { file } of propertyBills) {
        const staged = !aboveBasis && stagedLand.get(file) != null;
        if (!staged && notedCites.some((cite) => sameDocument(file, cite))) continue;
        problems.push(
          problem(
            'schema',
            `${PURCHASE_LAND_VALUE}: out/questions.json entry ${String(index)} option ${String((option as Json).id)} writes a property's cost basis and no landValueCents while this batch carries its tax bill ${file}; ${staged ? 'its staged reading carries fields.other.land_value, so write that land value and cite the bill' : 'write the land value the bill prints and cite it, or, when it prints none or one above the basis, a note finding citing the bill'}`,
          ),
        );
      }
    }
  }
  return problems;
}

/** The typed code a purchase option whose basis is not its cited closing statement's staged total
 *  is refused with (issue #1779); the message never carries a figure. */
export const PURCHASE_BASIS_READING = 'purchase_basis_reading';

/** The totals of each page a document's staged reading types `closing_statement`, in cents, and
 *  whether a page prints one that is not an amount: a statement read in chunks may carry a total on
 *  more than one page. */
function stagedClosingTotalsOf(
  workspace: string,
  document: string,
): { readonly cents: number[]; readonly unreadable: boolean } {
  const cents: number[] = [];
  let unreadable = false;
  for (const page of stagedPages(workspace, document)) {
    if (page['doc_type'] !== 'closing_statement') continue;
    const total = recordOf(page['fields'])?.['total'];
    if (total === null || total === undefined) continue;
    const amount = stagedAmountCents(total);
    if (amount === null) unreadable = true;
    else cents.push(amount);
  }
  return { cents, unreadable };
}

/**
 * A property's basis is the closing statement's reading (issue #1779): an `asset_register` option
 * writing a `REAL_PROPERTY` asset's `costBasisCents` is refused when its question cites a document
 * whose staged reading is a closing statement with a total and the basis is none of those totals.
 * A staged total that is not an amount fails closed: no basis matches it. A cite with no staged
 * reading or no total is not this check's, nor is a basis a typed `purchase` answer about the same
 * entity prints (decision record 0161).
 */
function purchaseBasisReadingProblems(workspace: string, skillDir: string): Problem[] {
  const questions = listOf(loadJson(join(workspace, 'out', 'questions.json')));
  const typed = [...typedPurchaseAnswersOf(workspace, skillDir).values()];
  const problems: Problem[] = [];
  for (const [index, raw] of questions.entries()) {
    const question = recordOf(raw);
    if (question === null) continue;
    const staged = stringList(question.cites).map((cite) => stagedClosingTotalsOf(workspace, cite));
    const totals = staged.flatMap((statement) => statement.cents);
    const unreadable = staged.some((statement) => statement.unreadable);
    if (totals.length === 0 && !unreadable) continue;
    for (const option of listOf(question.options)) {
      const effect = parseEffect(recordOf(option)?.effect);
      if (
        effect?.kind !== 'asset_register' ||
        effect.assetKind !== 'REAL_PROPERTY' ||
        effect.costBasisCents === undefined
      ) {
        continue;
      }
      const basis = effect.costBasisCents;
      if (totals.includes(basis)) continue;
      const typedByPerson = typed.some(
        (answer) =>
          answer.figures.cents.has(basis) &&
          answer.subject ===
            profileKeySubject(effect.entityKey, PURCHASE_FACT, keyFlagOf(skillDir)),
      );
      if (typedByPerson) continue;
      problems.push(
        problem(
          'invariant',
          `${PURCHASE_BASIS_READING}: out/questions.json entry ${String(index)} option ${String(recordOf(option)?.id)} writes a property's cost basis other than the total of the closing statement it cites; ${totals.length === 0 ? 'its staged total is not an amount, so write no basis from it and ask the person' : 'write the total its staged reading carries'} (reference/steps/4-ask.md)`,
        ),
      );
    }
  }
  return problems;
}

/**
 * Whether a text carries a word of the policy list, an underscore read as a space: to a word
 * boundary `_` is a word character, so a snake_case key or value such as `deductible_memo` would
 * otherwise hide its word. The default list is the generated copy of rules/policy.md, which
 * scan.spec holds equal to the file.
 */
function carriesPolicyPhrase(
  text: string,
  banned: readonly RegExp[] = bannedPolicyPhrases(),
): boolean {
  const words = text.replace(/_/g, ' ');
  return banned.some((phrase) => phrase.test(words));
}

/**
 * Visit every string reachable in a JSON value, with a `/`-joined path for the message; the
 * optional visitKey sees each object key with its parent's path.
 */
function walkStrings(
  value: unknown,
  path: string,
  visit: (text: string, path: string) => void,
  visitKey?: (key: string, path: string) => void,
): void {
  if (typeof value === 'string') {
    visit(value, path);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      walkStrings(item, `${path}/${String(index)}`, visit, visitKey);
    });
    return;
  }
  if (typeof value === 'object' && value !== null) {
    for (const [key, item] of Object.entries(value as Json)) {
      visitKey?.(key, path);
      walkStrings(item, `${path}/${pathSegment(key)}`, visit, visitKey);
    }
  }
}

/**
 * The path segment a problem message prints for an object key. A model-authored key can itself
 * carry an identifier or URL shape, a character Postgres refuses or a word the policy list
 * forbids, and the path is printed in the problem message, so such a key is replaced rather than
 * echoed.
 */
function pathSegment(key: string): string {
  return scanForIdentifiers(key) !== null ||
    hasUrlShape(key) ||
    unstorableAdvice(key) !== null ||
    carriesPolicyPhrase(key)
    ? '*'
    : key;
}

/**
 * Scan the strings a person or the accountant will read — the whole question objects and each
 * finding message — for identifier shapes and URLs (`identifier`) and for the policy list's words
 * (`policy`). Both fail closed and name the path, never the matched value (0019 item 7, 0011 item 4).
 */
const POINTER_QUOTE_PATH = /^\/out\/questions\.json\/\d+\/options\/\d+\/pointer\/quote$/;

function modelTextProblems(workspace: string, skillDir: string): Problem[] {
  const banned = policyFilePhrases(skillDir);
  const problems: Problem[] = [];
  const scan = (text: string, path: string): void => {
    if (scanForIdentifiers(text) !== null || hasUrlShape(text)) {
      problems.push(problem('identifier', path));
    }
    // A pointer's quote is document or person text copied verbatim and never shown, like a
    // vendor name (0011's 2026-10-13 amendment), so only the identifier and URL scan holds it.
    if (POINTER_QUOTE_PATH.test(path)) return;
    if (banned.some((phrase) => phrase.test(text))) {
      problems.push(problem('policy', `${path} carries wording the policy list forbids`));
    }
  };
  // A key the run chose is kept with its object, so it is held to the policy list too (issue #1035).
  const scanKey = (key: string, path: string): void => {
    if (carriesPolicyPhrase(key, banned)) {
      problems.push(problem('policy', `${path}/* carries wording the policy list forbids`));
    }
  };
  const questions = loadJson(join(workspace, 'out', 'questions.json'));
  if (Array.isArray(questions)) {
    // Only a name the person wrote in the staged profile.json is exempt (issue #746): the run
    // writes profile.resolved.json, so a name only that file carries is the run's.
    const profileNames = stagedEntityNames(loadJson(join(workspace, 'profile.json')));
    questions.forEach((item, index) => {
      walkStrings(item, `/out/questions.json/${String(index)}`, scan, scanKey);
      // Every number a person reads comes from Abacus (invariant 5, ADR 0104 item 3): a prompt, a
      // label and an effect's free strings carry no figure - the figure goes in the option's typed
      // effect and the label names its source. Typed cents are numbers and are not checked.
      const classes = new Set<string>();
      for (const text of questionDisplayStrings(item, profileNames)) {
        for (const figureClass of moneyFigureClasses(text)) classes.add(figureClass);
      }
      if (classes.size > 0) {
        problems.push(
          problem(
            'policy',
            `/out/questions.json/${String(index)} carries a money figure in its prompt, its help, a label or a payload string (${[...classes].join(', ')}); put the figure in the option's typed effect and name its source in the label`,
          ),
        );
      }
    });
  }
  const findings = loadJson(join(workspace, 'out', 'findings.json'));
  if (Array.isArray(findings)) {
    findings.forEach((item, index) => {
      if (typeof item !== 'object' || item === null || Array.isArray(item)) return;
      const message = (item as Json).message;
      if (typeof message !== 'string') return;
      const path = `/out/findings.json/${String(index)}/message`;
      scan(message, path);
      // Every number a person reads comes from Abacus (invariant 5): a finding names its item and
      // leaves the amounts to the cited lines and books.json. Questions stay with 15.10.
      const figureClasses = moneyFigureClasses(message);
      if (figureClasses.length > 0) {
        problems.push(
          problem(
            'policy',
            `${path} carries a money figure (${figureClasses.join(', ')}); name the item and leave its amounts to the cited lines and books.json`,
          ),
        );
      }
    });
  }
  // The closing summary is read first on Review (issue #1639): scanned and held to no money
  // figure exactly like a finding's message.
  const summary = loadJson(join(workspace, 'out', RUN_SUMMARY_FILE));
  const summaryText =
    summary !== null && typeof summary === 'object' && !Array.isArray(summary)
      ? (summary as Json).summary
      : undefined;
  if (typeof summaryText === 'string') {
    const path = `/out/${RUN_SUMMARY_FILE}/summary`;
    scan(summaryText, path);
    const figureClasses = moneyFigureClasses(summaryText);
    if (figureClasses.length > 0) {
      problems.push(
        problem(
          'policy',
          `${path} carries a money figure (${figureClasses.join(', ')}); name what booked and what needs a look, and leave the amounts to the books`,
        ),
      );
    }
  }
  // The contributions listing is model-written like the questions and findings (ADR 0068): a
  // document's own wording can carry an identifier shape or a URL, and a string the accountant
  // will read is scanned before anyone sees it, the same as the files above.
  // The organization is a name copied as the receipt prints it, outside the policy list (the
  // founder's ruling of 2026-10-13 on #1038); the identifier scan still reads it.
  const donations = loadJson(join(workspace, 'out', 'donations.json'));
  if (Array.isArray(donations)) {
    donations.forEach((item, index) => {
      const base = `/out/donations.json/${String(index)}`;
      walkStrings(
        item,
        base,
        (text, path) => {
          if (path !== `${base}/organization`) {
            scan(text, path);
          } else if (scanForIdentifiers(text) !== null || hasUrlShape(text)) {
            problems.push(problem('identifier', path));
          }
        },
        scanKey,
      );
    });
  }
  problems.push(...keptWordingProblems(workspace, banned));
  // A short-term rental's services note is model-written prose the accountant reads (issue
  // #110): it joins the scan, and a violation names the field path, never the note.
  const profile = resolvedProfileOf(workspace, skillDir);
  if (profile !== null) {
    const entities = profile.entities;
    if (Array.isArray(entities)) {
      entities.forEach((raw, index) => {
        if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return;
        const note = (raw as Json).services_note;
        if (typeof note === 'string') {
          scan(note, `/out/profile.resolved.json/${String(index)}/services_note`);
        }
      });
    }
    // A trip's name and stops, and the travel home, are the run's words on the Trips screen and
    // the Review (issue #1068): the identifier and URL shapes, beside the policy scan they get.
    const shapes = (text: unknown, path: string): void => {
      if (typeof text === 'string' && (scanForIdentifiers(text) !== null || hasUrlShape(text))) {
        problems.push(problem('identifier', path));
      }
    };
    shapes(profile['home'], '/out/profile.resolved.json/home');
    const trips = profile['trips'];
    if (Array.isArray(trips)) {
      trips.forEach((raw, index) => {
        if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return;
        const base = `/out/profile.resolved.json/trips/${String(index)}`;
        shapes((raw as Json)['name'], `${base}/name`);
        // A purpose suggestion is the run's words in the Trips screen's picker (issue #1195): the
        // shapes, and no figure, as a question's prompt and label carry none.
        const suggestions = (raw as Json)['purpose_suggestions'];
        if (Array.isArray(suggestions)) {
          suggestions.forEach((suggestion, suggestionIndex) => {
            if (
              typeof suggestion !== 'object' ||
              suggestion === null ||
              Array.isArray(suggestion)
            ) {
              return;
            }
            const text = (suggestion as Json)['text'];
            const path = `${base}/purpose_suggestions/${String(suggestionIndex)}/text`;
            shapes(text, path);
            if (typeof text === 'string' && moneyFigureClasses(text).length > 0) {
              problems.push(
                problem(
                  'policy',
                  `${path} carries a money figure; a purpose suggestion names an activity, never an amount`,
                ),
              );
            }
          });
        }
        const segments = (raw as Json)['segments'];
        if (Array.isArray(segments)) {
          segments.forEach((segment, segmentIndex) => {
            if (typeof segment !== 'object' || segment === null || Array.isArray(segment)) return;
            shapes(
              (segment as Json)['location'],
              `${base}/segments/${String(segmentIndex)}/location`,
            );
          });
        }
      });
    }
  }
  return problems;
}

// The keys a kept object's wording scan leaves out while their value is a string (withoutTextKeys):
// a file reference, a date and a figure, which carry no words. Every other string - a ledger line's description, and its enum words and keys
// too, which the personal tool keeps whole and which no enum value spells with a listed word - is
// scanned (issue #1035).
const UNWORDED_KEYS = new Set(['source_file', 'payment_source', 'bill_source', 'date', 'amount']);

// A name copied as the document prints it is the document's, not Bookette's voice, so the policy
// list does not reach it (founder ruling of 2026-10-13 on #1038, decision record 0011's amendment):
// a ledger line's vendor, a document's vendor or payer, a change's new vendor, a contribution's
// organization, and an entity's name and payers in the resolved profile, each while it is a
// string. The identifier scan still reads every one of them.
const LEDGER_UNWORDED_KEYS = new Set([...UNWORDED_KEYS, 'vendor']);
const TRANSCRIBED_PROFILE_NAME =
  /^\/out\/profile\.resolved\.json\/entities\/\d+\/(?:name|payers\/\d+)$/;

// The ledger_changes fields whose `to` is a file reference, a date, a figure or a printed name.
const UNWORDED_CHANGE_FIELDS = new Set(['source_file', 'date', 'amount', 'vendor']);

/**
 * The object's entries other than the named keys whose value is a string, for a walk that leaves
 * those out. A named key holding anything else (an object, a list) is walked like any other: the
 * personal tool keeps the whole object, so `vendor: {name: ...}` is the run's wording, not a name.
 */
function withoutTextKeys(value: Json, keys: ReadonlySet<string>): Json {
  return Object.fromEntries(
    Object.entries(value).filter(([key, item]) => !(keys.has(key) && typeof item === 'string')),
  );
}

/**
 * Visit every string of a JSON value with its printed path (`pathSegment`'s) and its address: the
 * same path with an array element that carries a string `key` addressed by that key rather than
 * its index, so an entity, trip or vehicle has one address however a profile orders its list.
 */
function walkAddressed(
  value: unknown,
  path: string,
  address: string,
  visit: (text: string, path: string, address: string) => void,
  visitKey: (key: string, path: string, address: string) => void,
): void {
  if (typeof value === 'string') {
    visit(value, path, address);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      const key = recordOf(item)?.key;
      const step = typeof key === 'string' ? `[key=${key}]` : String(index);
      walkAddressed(item, `${path}/${String(index)}`, `${address}/${step}`, visit, visitKey);
    });
    return;
  }
  const record = recordOf(value);
  if (record === null) return;
  for (const [key, item] of Object.entries(record)) {
    visitKey(key, path, address);
    walkAddressed(item, `${path}/${pathSegment(key)}`, `${address}/${key}`, visit, visitKey);
  }
}

function recordOf(value: unknown): Json | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Json)
    : null;
}

/**
 * The policy list's words in every other model-written string an importer keeps (issue #1035,
 * invariant 5): every string of a ledger line, a home cost and a tax payment but its file
 * references, date, amount and (a line's) vendor; a ledger change's `to` but for a source_file,
 * date, amount or vendor change; a document's notes; a finding's keys beyond its kind, cites and
 * the message the scan above already reads; and every string of the resolved profile but its
 * services notes (scanned above) and its entities' names and payers. An object key the run chose
 * is scanned too, and walked as `*` (walkStrings). A violation is `policy`, named by file, index
 * (and a ledger line's code-assigned id) and field, never by the word. Left out on purpose: a name
 * copied as the document prints it (LEDGER_UNWORDED_KEYS above); a document's reading fields, which
 * transcribe the document's own printed labels; a web value's `quoted_text`, which must be the
 * source's own sentence verbatim; and, in the resolved profile, a string the staged profile.json
 * carries exactly and at the same address (walkAddressed), which is the person's own wording (or
 * a past run's, gated when it landed) that the run must carry forward unchanged.
 */
function keptWordingProblems(workspace: string, banned: readonly RegExp[]): Problem[] {
  const problems: Problem[] = [];
  const scanWith =
    (suffix: string) =>
    (text: string, path: string): void => {
      if (carriesPolicyPhrase(text, banned)) {
        problems.push(
          problem('policy', `${path}${suffix} carries wording the policy list forbids`),
        );
      }
    };
  const scan = scanWith('');
  const scanKey = (key: string, path: string): void => {
    scan(key, `${path}/*`);
  };
  const out = join(workspace, 'out');

  listOf(loadJson(join(out, REQUIRED_LEDGER))).forEach((raw, index) => {
    const item = recordOf(raw);
    if (item === null) return;
    // The id is code-assigned (L0001-style) once the build ran; any other spelling is not echoed.
    const id = typeof item.id === 'string' && /^L\d+$/.test(item.id) ? ` (${item.id})` : '';
    walkStrings(
      withoutTextKeys(item, LEDGER_UNWORDED_KEYS),
      `/out/ledger.json/${String(index)}`,
      scanWith(id),
      (key, path) => {
        scanWith(id)(key, `${path}/*`);
      },
    );
  });

  for (const name of [OPTIONAL_HOME_COSTS, OPTIONAL_TAX_PAYMENTS]) {
    listOf(loadJson(join(out, name))).forEach((raw, index) => {
      const entry = recordOf(raw);
      if (entry === null) return;
      walkStrings(
        withoutTextKeys(entry, UNWORDED_KEYS),
        `/out/${name}/${String(index)}`,
        scan,
        scanKey,
      );
    });
  }

  listOf(loadJson(join(out, 'ledger_changes.json'))).forEach((raw, index) => {
    const change = recordOf(raw);
    if (change === null) return;
    const { field, to } = change;
    if (typeof to === 'string' && typeof field === 'string' && UNWORDED_CHANGE_FIELDS.has(field)) {
      return;
    }
    walkStrings(to, `/out/ledger_changes.json/${String(index)}/to`, scan, scanKey);
  });

  listOf(loadJson(join(out, REQUIRED_DOCUMENTS))).forEach((raw, index) => {
    const entry = recordOf(raw);
    if (entry === null) return;
    const path = `/out/documents.json/${String(index)}`;
    if (typeof entry.notes === 'string') scan(entry.notes, `${path}/notes`);
  });

  const findingCoveredKeys = new Set(['kind', 'message']);
  listOf(loadJson(join(out, 'findings.json'))).forEach((raw, index) => {
    const finding = recordOf(raw);
    if (finding === null) return;
    // `cites` is a list of file and ledger references, left out only while it is one.
    const { cites, ...rest } = finding;
    const citesAreRefs = Array.isArray(cites) && cites.every((cite) => typeof cite === 'string');
    walkStrings(
      withoutTextKeys(citesAreRefs ? rest : finding, findingCoveredKeys),
      `/out/findings.json/${String(index)}`,
      scan,
      scanKey,
    );
  });

  const resolved = loadJson(join(out, 'profile.resolved.json'));
  if (recordOf(resolved) !== null) {
    // A staged string is exempt only at its own address: a string the staged profile carries in
    // one field (a payer a past run wrote and the place re-staged, say) is the run's wording again
    // when the run writes it into another, so it cannot be laundered from field to field.
    const staged = new Set<string>();
    walkAddressed(
      loadJson(join(workspace, 'profile.json')),
      '',
      '',
      (text, _path, address) => staged.add(`${address}\0${text}`),
      (key, _path, address) => staged.add(`${address}\0key\0${key}`),
    );
    const servicesNote = /^\/out\/profile\.resolved\.json\/entities\/\d+\/services_note$/;
    walkAddressed(
      resolved,
      '/out/profile.resolved.json',
      '',
      (text, path, address) => {
        if (
          staged.has(`${address}\0${text}`) ||
          servicesNote.test(path) ||
          TRANSCRIBED_PROFILE_NAME.test(path)
        ) {
          return;
        }
        scan(text, path);
      },
      (key, path, address) => {
        if (!staged.has(`${address}\0key\0${key}`)) scanKey(key, path);
      },
    );
  }
  return problems;
}

/**
 * Every `applies_to` reference of the form `trip:<key>` must name a trip in `out/profile.resolved.json`
 * (0019 item 7 closing the S.1 trip-key residual). The reference is checked for presence, not for a
 * segment span: a trip whose dates are not valid days is still a trip.
 */
function tripReferenceProblems(workspace: string): Problem[] {
  const values = loadJson(join(workspace, 'out', 'web_values.json'));
  if (!Array.isArray(values)) return [];
  const profile = loadJson(join(workspace, 'out', 'profile.resolved.json'));
  const tripKeys = new Set<string>();
  if (profile !== null && typeof profile === 'object' && !Array.isArray(profile)) {
    const trips = (profile as Json).trips;
    if (Array.isArray(trips)) {
      for (const trip of trips) {
        if (typeof trip !== 'object' || trip === null || Array.isArray(trip)) continue;
        const key = strOrNull((trip as Json).key);
        if (key !== null) tripKeys.add(key);
      }
    }
  }
  const problems: Problem[] = [];
  for (const [index, raw] of values.entries()) {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) continue;
    const applies = (raw as Json).applies_to;
    if (!Array.isArray(applies)) continue;
    for (const ref of applies) {
      if (typeof ref !== 'string' || !ref.startsWith('trip:')) continue;
      if (!tripKeys.has(ref.slice('trip:'.length))) {
        problems.push(
          problem(
            'invariant',
            `web_values.json item ${String(index)} applies_to names a trip profile.resolved.json does not carry`,
          ),
        );
      }
    }
  }
  return problems;
}

/** The entity keys of `out/profile.resolved.json` mapped to the schedule each carries; a profile
 *  that is absent or malformed contributes nothing (the profile's own gate reports that). */
function entitySchedulesOf(workspace: string): Map<string, string> {
  return entitySchedulesFrom(loadJson(join(workspace, 'out', 'profile.resolved.json')));
}

/** What a profile entity carries that a found place's match is judged against: its kind, address,
 *  schedule, name, aliases and listings (each null, or empty, for an entry with none). */
interface StagedEntityFacts {
  readonly kind: string | null;
  readonly address: string | null;
  readonly schedule: string | null;
  readonly name: string | null;
  readonly aliases: readonly string[];
  readonly listings: readonly string[];
  /** The bare names of the places folded into a rental (issue #1388): reserved, never registered. */
  readonly reservedNames: readonly string[];
}

/** The entity keys of a parsed profile mapped to the facts each carries; a malformed profile
 *  contributes nothing. */
function entityKindsFrom(profile: unknown): Map<string, StagedEntityFacts> {
  const kinds = new Map<string, StagedEntityFacts>();
  if (profile === null || typeof profile !== 'object' || Array.isArray(profile)) return kinds;
  const entities = (profile as Json).entities;
  if (!Array.isArray(entities)) return kinds;
  for (const raw of entities) {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) continue;
    const key = strOrNull((raw as Json).key);
    if (key !== null) {
      const aliases = (raw as Json).aliases;
      kinds.set(key, {
        kind: strOrNull((raw as Json).kind),
        address: strOrNull((raw as Json).address),
        schedule: strOrNull((raw as Json).schedule),
        name: strOrNull((raw as Json).name),
        aliases: stringList(aliases),
        listings: stringList((raw as Json).listings),
        reservedNames: stringList((raw as Json).reserved_names),
      });
    }
  }
  return kinds;
}

/**
 * The address a found place's match carries (issue #1070): a `ledger`/`entity` option on a
 * register question may write on its `to` value the address the documents print for a place
 * the person declared without one, and confirming it records that address on the place through
 * the declare core. So it rides only that option, names a property the staged profile carries
 * with no address (a run never replaces an address the person gave), is no other staged place's
 * address by fold or by a cited reading's standard form (`stagedAddressHoldersOf`), passes the
 * person-text gate the declaration applies at the confirmation, and never sits on the `from`
 * value. Messages name the option and the rule, never the address.
 */
function matchAddressProblems(
  optionName: string,
  effect: LedgerEffect,
  questionFact: string | null,
  stagedKinds: ReadonlyMap<string, StagedEntityFacts>,
  holdersOf: (address: string) => ReadonlySet<string>,
): Problem[] {
  const problems: Problem[] = [];
  if (effect.from?.type === 'entity' && effect.from.address !== undefined) {
    problems.push(
      problem(
        'schema',
        `${optionName} effect carries an address on its from value; only to takes one`,
      ),
    );
  }
  if (effect.to.type !== 'entity' || effect.to.address === undefined) return problems;
  if (questionFact !== 'register') {
    problems.push(
      problem(
        'schema',
        `${optionName} effect carries an address, which only a found place's register question may, on the option that books its lines to a staged place`,
      ),
    );
    return problems;
  }
  const staged = stagedKinds.get(effect.to.entityKey);
  if (staged === undefined || staged.kind === null || !PROPERTY_PROFILE_KINDS.has(staged.kind)) {
    problems.push(
      problem(
        'schema',
        `${optionName} effect carries an address for an entity that is not a property profile.json stages; an address belongs on a rental only`,
      ),
    );
  } else if (staged.address !== null) {
    problems.push(
      problem(
        'schema',
        `${optionName} effect carries an address for a place profile.json already gives one; the person's address stays, so write no address`,
      ),
    );
  }
  // Two places with one address would match one tax bill's situs twice.
  const targetKey = effect.to.entityKey;
  if ([...holdersOf(effect.to.address)].some((key) => key !== targetKey)) {
    problems.push(
      problem(
        'schema',
        `${optionName} effect carries the address another staged place already has; one address belongs to one place`,
      ),
    );
  }
  const text = personTextProblem(effect.to.address, DECLARED_ADDRESS_MAX_LENGTH);
  if (text !== null) {
    problems.push(
      problem(
        'schema',
        `${optionName} effect address would be refused at the confirmation (${text}); copy it as the documents print it`,
      ),
    );
  }
  return problems;
}

/**
 * The alias a found business's match carries (issue #1159): a `ledger`/`entity` option on a
 * register question may write on its `to` value the name the documents print for a business the
 * person declared under another name, and confirming it appends that name to the business's
 * aliases through the declare core. So it rides only that option, names a Schedule C business the
 * staged profile carries, is not already that business's name or one of its aliases, is no other
 * staged place's name or alias (one name names one place), and passes the person-text gate the
 * declaration applies at the confirmation; it never sits on the `from` value. Messages name the
 * option and the rule, never the name.
 */
function matchAliasProblems(
  optionName: string,
  effect: LedgerEffect,
  questionFact: string | null,
  stagedKinds: ReadonlyMap<string, StagedEntityFacts>,
): Problem[] {
  const problems: Problem[] = [];
  if (effect.from?.type === 'entity' && effect.from.alias !== undefined) {
    problems.push(
      problem(
        'schema',
        `${optionName} effect carries an alias on its from value; only to takes one`,
      ),
    );
  }
  if (effect.to.type !== 'entity' || effect.to.alias === undefined) return problems;
  if (questionFact !== 'register') {
    problems.push(
      problem(
        'schema',
        `${optionName} effect carries an alias, which only a found place's register question may, on the option that books its lines to a staged business`,
      ),
    );
    return problems;
  }
  const targetKey = effect.to.entityKey;
  const staged = stagedKinds.get(targetKey);
  const folded = entityNameKey(effect.to.alias);
  const namesOf = (entity: StagedEntityFacts): string[] =>
    [...(entity.name === null ? [] : [entity.name]), ...entity.aliases].map(entityNameKey);
  if (staged === undefined || staged.schedule !== 'C') {
    problems.push(
      problem(
        'schema',
        `${optionName} effect carries an alias for an entity that is not a business profile.json stages; an alias belongs on a business only`,
      ),
    );
  } else if (namesOf(staged).includes(folded)) {
    problems.push(
      problem(
        'schema',
        `${optionName} effect carries an alias the business already goes by in profile.json; a name profile.json carries is not found, so book its lines there and ask nothing`,
      ),
    );
  }
  if (
    [...stagedKinds].some(([key, entity]) => key !== targetKey && namesOf(entity).includes(folded))
  ) {
    problems.push(
      problem(
        'schema',
        `${optionName} effect carries an alias another staged place already goes by; one name belongs to one place`,
      ),
    );
  }
  const text = personTextProblem(effect.to.alias, DECLARED_ALIAS_MAX_LENGTH);
  if (text !== null) {
    problems.push(
      problem(
        'schema',
        `${optionName} effect alias would be refused at the confirmation (${text}); copy it as the documents print it`,
      ),
    );
  }
  return problems;
}

/** The typed code an `entity_register` option naming a staged rental's reserved name is refused
 *  with (issue #1388); the message never carries the name. */
export const RESERVED_NAME_REGISTER = 'reserved_name_register';

/** The typed code a match's listing whose id is shorter than {@link LISTING_ID_MIN_DIGITS} is
 *  refused with; the message never carries the listing. */
export const LISTING_ID_TOO_SHORT = 'listing_id_too_short';

/** A text's letter runs and digit runs, folded as `listingKey` folds a listing. */
function wordsAndDigitsOf(text: string): { words: Set<string>; digits: Set<string> } {
  const folded = foldForScan(text).normalize('NFKC').toLowerCase();
  return {
    words: new Set(folded.match(/\p{L}+/gu) ?? []),
    digits: new Set(folded.match(/\d+/g) ?? []),
  };
}

/** Whether a name carries a listing (issue #1387): its words include the listing's platform word,
 *  when the listing has one, and its digit runs every digit run of the listing's id, wherever they
 *  stand in the name ("Payouts for Vrbo 4820193" carries "Vrbo 4820193"). */
function nameCarriesListing(name: string, listing: string): boolean {
  const own = listingDigits(listing);
  if (own.length === 0) return false;
  const { words, digits } = wordsAndDigitsOf(name);
  // The platform word is the listing's first letter run, as `listingKey` reads it.
  const platform = foldForScan(listing)
    .normalize('NFKC')
    .toLowerCase()
    .match(/\p{L}+/u)?.[0];
  return (platform === undefined || words.has(platform)) && own.every((run) => digits.has(run));
}

/**
 * The listing a found rental's match carries (issue #1387): a `ledger`/`entity` option on a
 * register question may write on its `to` value the platform and listing id a payout statement
 * prints for a rental the person declared without that listing, and confirming it appends the
 * listing to the rental's listings through the declare core. So it rides only that option, names
 * a rental the staged profile carries, is no listing any staged place carries already (a place a
 * staged rental carries by listing is not found), passes the listings gate the declaration applies
 * at the confirmation, has an id of at least {@link LISTING_ID_MIN_DIGITS} digits, and is printed
 * by a document the question cites: each digit run of its key is a whole digit run of that
 * document's printed values (`documentDigitRuns`). It never sits on the `from` value. Messages
 * name the option and the rule, never the listing.
 */
function matchListingProblems(
  optionName: string,
  effect: LedgerEffect,
  questionFact: string | null,
  stagedKinds: ReadonlyMap<string, StagedEntityFacts>,
  printedByCite: (listing: string) => boolean,
): Problem[] {
  const problems: Problem[] = [];
  if (effect.from?.type === 'entity' && effect.from.listing !== undefined) {
    problems.push(
      problem(
        'schema',
        `${optionName} effect carries a listing on its from value; only to takes one`,
      ),
    );
  }
  if (effect.to.type !== 'entity' || effect.to.listing === undefined) return problems;
  if (questionFact !== 'register') {
    problems.push(
      problem(
        'schema',
        `${optionName} effect carries a listing, which only a found place's register question may, on the option that books its lines to a staged rental`,
      ),
    );
    return problems;
  }
  const listing = effect.to.listing;
  const staged = stagedKinds.get(effect.to.entityKey);
  if (staged === undefined || staged.kind === null || !PROPERTY_PROFILE_KINDS.has(staged.kind)) {
    problems.push(
      problem(
        'schema',
        `${optionName} effect carries a listing for an entity that is not a rental profile.json stages; a listing belongs on a rental only`,
      ),
    );
  }
  problems.push(...listingGateProblems(optionName, 'effect', listing, stagedKinds, printedByCite));
  return problems;
}

/** The rules a listing passes wherever an option records one (issue #1387, #1468): no staged
 *  place carries it already, the declaration's listings gate takes it, its id is long enough and a
 *  document the question cites prints it. `subject` names the effect in the message; no message
 *  carries the listing. */
function listingGateProblems(
  optionName: string,
  subject: string,
  listing: string,
  stagedKinds: ReadonlyMap<string, StagedEntityFacts>,
  printedByCite: (listing: string) => boolean,
): Problem[] {
  const problems: Problem[] = [];
  const key = listingKey(listing);
  if ([...stagedKinds.values()].some((entity) => entity.listings.map(listingKey).includes(key))) {
    problems.push(
      problem(
        'schema',
        `${optionName} ${subject} carries a listing a staged place already carries in profile.json; a place profile.json carries by listing is not found, so book its lines there and ask nothing`,
      ),
    );
  }
  const text = listingTextProblem(listing, DECLARED_LISTING_MAX_LENGTH);
  if (text !== null) {
    problems.push(
      problem(
        'schema',
        `${optionName} ${subject} listing would be refused at the confirmation (${text}); copy it as the statement prints it`,
      ),
    );
  } else if (!listingIdLongEnough(listing)) {
    problems.push(
      problem(
        'schema',
        `${optionName} ${subject} carries a listing whose id is shorter than ${String(LISTING_ID_MIN_DIGITS)} digits (${LISTING_ID_TOO_SHORT}); a run that short is printed by nearly every statement, so record no listing for it`,
      ),
    );
  } else if (!printedByCite(listing)) {
    problems.push(
      problem(
        'schema',
        `${optionName} ${subject} carries a listing no document the question cites prints; write the platform and the id the cited statement prints, or no listing`,
      ),
    );
  }
  return problems;
}

/** The typed code a register option that places a rental by neither or both of an address and a
 *  listing, or a business by either, is refused with (issue #1468). */
export const REGISTER_PLACEMENT = 'register_placement';

/** Whether a raw effect is an `entity_register` whose only fault is its placement: the same
 *  effect parses once it carries what its kind needs. */
function registerPlacementRefused(raw: unknown): boolean {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return false;
  const effect = raw as Json;
  if (effect.kind !== 'entity_register') return false;
  const fixed = Object.fromEntries(
    Object.entries(effect).filter(([field]) => field !== 'address' && field !== 'listing'),
  );
  return (
    parseEffect(effect.entityKind === 'BUSINESS' ? fixed : { ...fixed, address: 'placed' }) !== null
  );
}

/** The listing a question's register option carries, as the option-by-option rules read it. */
function registerListingOf(options: unknown): { readonly key: string } | null {
  if (!Array.isArray(options)) return null;
  for (const option of options) {
    if (typeof option !== 'object' || option === null || Array.isArray(option)) continue;
    const effect = parseEffect((option as Json).effect);
    if (effect?.kind === 'entity_register' && effect.listing !== undefined) {
      return { key: listingKey(effect.listing) };
    }
  }
  return null;
}

/**
 * What a register option's address or listing must pass (issue #1468, decision record 0157): a
 * listing passes the rules a found rental's match listing passes; an address is no address a
 * staged place carries, by fold or by a cited reading's standard form (`stagedAddressHoldersOf`),
 * because a place profile.json carries by address is not found. The
 * address's text goes through the declaration's validator with the rest of the register's fields.
 */
function registerPlacementProblems(
  optionName: string,
  effect: EntityRegisterEffect,
  stagedKinds: ReadonlyMap<string, StagedEntityFacts>,
  printedByCite: (listing: string) => boolean,
  holdersOf: (address: string) => ReadonlySet<string>,
): Problem[] {
  if (effect.listing !== undefined) {
    return listingGateProblems(
      optionName,
      'entity_register effect',
      effect.listing,
      stagedKinds,
      printedByCite,
    );
  }
  if (effect.address === undefined) return [];
  if (holdersOf(effect.address).size > 0) {
    return [
      problem(
        'schema',
        `${optionName} entity_register effect carries an address a staged place already has in profile.json; a place profile.json carries by address is not found, so book its lines there and ask nothing`,
      ),
    ];
  }
  return [];
}

/**
 * A found rental's question whose register option records a printed listing (issue #1468): each
 * `ledger`/`entity` option naming a staged rental carries that same listing on its `to`, so
 * whichever rental the person picks records it and the next statement books with no question.
 * Messages name the option and the rule, never the listing.
 */
function foundRentalListingProblems(
  optionName: string,
  effect: LedgerEffect,
  questionFact: string | null,
  registerListing: { readonly key: string } | null,
  stagedKinds: ReadonlyMap<string, StagedEntityFacts>,
): Problem[] {
  if (questionFact !== 'register' || registerListing === null) return [];
  if (effect.field !== 'entity' || effect.to.type !== 'entity') return [];
  const staged = stagedKinds.get(effect.to.entityKey);
  if (staged === undefined || staged.kind === null || !PROPERTY_PROFILE_KINDS.has(staged.kind)) {
    return [];
  }
  if (effect.to.listing === undefined) {
    return [
      problem(
        'schema',
        `${optionName} effect books a found rental's lines to a staged rental without the listing the question's entity_register option carries; every rental option records the printed listing on its to value`,
      ),
    ];
  }
  if (listingKey(effect.to.listing) !== registerListing.key) {
    return [
      problem(
        'schema',
        `${optionName} effect carries another listing than the question's entity_register option; every rental option records the one printed listing`,
      ),
    ];
  }
  return [];
}

/** Whether a raw option effect carries a `listing` key anywhere but on an entity value (issue
 *  #1387): on the effect itself, or on a `to` or `from` value of another type. */
function strayListing(raw: unknown): boolean {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return false;
  const effect = raw as Json;
  if (effect.kind === 'entity_register') return false;
  if (Object.hasOwn(effect, 'listing')) return true;
  return [effect.to, effect.from].some(
    (value) =>
      typeof value === 'object' &&
      value !== null &&
      !Array.isArray(value) &&
      (value as Json).type !== 'entity' &&
      Object.hasOwn(value, 'listing'),
  );
}

/** Every value of a parsed JSON value, strings and numbers, one per line. */
function jsonText(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') out.push(value);
  else if (typeof value === 'number') out.push(String(value));
  else if (Array.isArray(value)) for (const item of value) jsonText(item, out);
  else if (typeof value === 'object' && value !== null) {
    for (const item of Object.values(value)) jsonText(item, out);
  }
  return out;
}

/** The values a staged reading's pages print: each page's extracted `fields` (the statement's
 *  rows, grid and header fields), never the reading's metadata — the page number and status, the
 *  upload hint, the confidence, the reader's notes. */
function readingFieldText(reading: unknown): string[] {
  const out: string[] = [];
  const pages = reading !== null && typeof reading === 'object' ? (reading as Json)['pages'] : null;
  for (const page of listOf(pages)) {
    if (typeof page !== 'object' || page === null || Array.isArray(page)) continue;
    jsonText(printedFieldsOf((page as Json)['fields']), out);
  }
  return out;
}

/**
 * The digit runs a document prints (issue #1387), folded as the identifier scan reads them: the
 * values of its staged reading's extracted fields (`extractions/<stem>.json`, `readingFieldText`)
 * together with its original's, when this batch's inbox holds one the skill's sheet reader reads
 * (`originalSheetText`); null when neither path reads one, so a hand-read PDF with no reading
 * prints no listing the checker can see. The set is kept in memory and never logged.
 */
function documentDigitRuns(
  workspace: string,
  skillDir: string,
  document: string,
): Set<string> | null {
  const name = basename(document);
  const dot = name.lastIndexOf('.');
  const reading = loadJson(
    join(workspace, 'extractions', `${dot > 0 ? name.slice(0, dot) : name}.json`),
  );
  const original = originalSheetText(workspace, skillDir, document)?.text ?? null;
  if (reading === null && original === null) return null;
  const text = [...(reading === null ? [] : readingFieldText(reading)), original ?? ''].join('\n');
  return new Set(foldForScan(text).normalize('NFKC').match(/\d+/g) ?? []);
}

/** Whether a document's digit runs print a listing: its id reaches {@link LISTING_ID_MIN_DIGITS}
 *  digits, and each of its digit runs is a whole digit run of the document. */
function printsListing(digits: ReadonlySet<string>, listing: string): boolean {
  const own = listingDigits(listing);
  return listingIdLongEnough(listing) && own.every((run) => digits.has(run));
}

/** The memoized digit runs of the workspace's documents, by document path. */
function documentDigitsOf(
  workspace: string,
  skillDir: string,
): (document: string) => Set<string> | null {
  const read = new Map<string, Set<string> | null>();
  return (document) => {
    if (!read.has(document)) read.set(document, documentDigitRuns(workspace, skillDir, document));
    return read.get(document) ?? null;
  };
}

/** Whether a question's cites name a document that prints a listing: each cite's document (a
 *  line's source file, an inbox path or a staged reading's `doc_<id>`), read once per check. */
function printedListingsOf(
  workspace: string,
  skillDir: string,
  recipe: KeyContext,
): (listing: string, cites: unknown) => boolean {
  const digitsOf = documentDigitsOf(workspace, skillDir);
  return (listing, cites) =>
    Array.isArray(cites) &&
    cites.some((cite) => {
      const document = citedDocument(cite, recipe);
      const digits = document === null ? null : digitsOf(document);
      return digits !== null && printsListing(digits, listing);
    });
}

/** The entity keys of a parsed profile mapped to the name each carries. */
function entityNamesFrom(profile: unknown): Map<string, string> {
  const names = new Map<string, string>();
  if (profile === null || typeof profile !== 'object' || Array.isArray(profile)) return names;
  const entities = (profile as Json).entities;
  if (!Array.isArray(entities)) return names;
  for (const raw of entities) {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) continue;
    const key = strOrNull((raw as Json).key);
    const name = strOrNull((raw as Json).name);
    if (key !== null && name !== null) names.set(key, name);
  }
  return names;
}

/**
 * The staged profile's entity schedules are Postgres's, and the importer's union reads the
 * agent's out profile for the rest of the books: a schedule the agent relabelled or dropped on
 * any staged entity - whether or not a change touches it - would reject every confirmed row of
 * that entity at import, and a dropped one throws inside the write for a short-term rental
 * (issue #680). Names no entity and echoes no key.
 */
function profileScheduleProblems(workspace: string): Problem[] {
  const staged = stagedEntitySchedules(workspace);
  if (staged.size === 0) return [];
  // Looked up by key, not through entitySchedulesFrom, which skips an entry with no string
  // schedule - exactly the dropped case.
  const outEntries = new Map<string, Json>();
  const profile = loadJson(join(workspace, 'out', 'profile.resolved.json'));
  const list =
    profile !== null && typeof profile === 'object' && !Array.isArray(profile)
      ? (profile as Json).entities
      : undefined;
  if (Array.isArray(list)) {
    for (const raw of list) {
      if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) continue;
      const key = strOrNull((raw as Json).key);
      if (key !== null && !outEntries.has(key)) outEntries.set(key, raw as Json);
    }
  }
  const changed = [...staged].some(([key, schedule]) => {
    const entry = outEntries.get(key);
    return entry !== undefined && entry.schedule !== schedule;
  });
  return changed
    ? [
        problem(
          'invariant',
          'profile.resolved.json relabels or drops the schedule of a staged entity; a schedule comes from the staged profile',
        ),
      ]
    : [];
}

/**
 * A run never adds an entity (SKILL.md step 5; decision record 0123, issue #907 part B): the
 * person declares their businesses and properties, and a place the documents point to is asked
 * for with an `entity_register` option whose confirmation declares the row before the next run.
 * So when the staged `profile.json` carries an entity list, every entry of the run's resolved
 * profile must be one it stages — by key, or by name, the two joins the importer resolves a row
 * through, key first: an entry the staging carries neither way has no register row behind it,
 * the importer would insert none, and the lines booked under it would silently go unassigned.
 * `invariant`, as the schedule relabel above; names the entry index and never a key or name.
 * Dormant with no staged profile (a recorded corpus or a scenario without one); an entry with no
 * key is left to the profile gate's own shape checks, and a nameless one is judged by its key.
 */
function unstagedEntityProblems(workspace: string): Problem[] {
  const staged = loadJson(join(workspace, 'profile.json'));
  if (staged === null || typeof staged !== 'object' || Array.isArray(staged)) return [];
  const stagedList = (staged as Json).entities;
  if (!Array.isArray(stagedList)) return [];
  const stagedKeys = new Set<string>();
  for (const raw of stagedList) {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) continue;
    const key = strOrNull((raw as Json).key);
    if (key !== null) stagedKeys.add(key);
  }
  const stagedNames = stagedEntityNames(staged);
  const profile = loadJson(join(workspace, 'out', 'profile.resolved.json'));
  const list =
    profile !== null && typeof profile === 'object' && !Array.isArray(profile)
      ? (profile as Json).entities
      : undefined;
  if (!Array.isArray(list)) return [];
  const problems: Problem[] = [];
  for (const [index, raw] of list.entries()) {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) continue;
    const key = strOrNull((raw as Json).key);
    const name = strOrNull((raw as Json).name);
    // An entry with no key is the shape every entity gate skips; a nameless entry is judged by
    // its key alone, since the name join has nothing to join.
    if (key === null) continue;
    if (stagedKeys.has(key) || (name !== null && stagedNames.has(name))) continue;
    problems.push(
      problem(
        'invariant',
        `profile.resolved.json entity entry ${String(index)} is not an entity profile.json stages; a run never adds one - ask with an entity_register option and write an entity_unestablished finding`,
      ),
    );
  }
  return problems;
}

/** The entity keys of a parsed profile mapped to the schedule each carries; a profile that is
 *  malformed contributes nothing. Read from the staged `profile.json` by the schedule-move
 *  judgment and the importer's union (issue #680), and from the agent's resolved profile above. */
export function entitySchedulesFrom(profile: unknown): Map<string, string> {
  const schedules = new Map<string, string>();
  if (profile === null || typeof profile !== 'object' || Array.isArray(profile)) return schedules;
  const entities = (profile as Json).entities;
  if (!Array.isArray(entities)) return schedules;
  for (const raw of entities) {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) continue;
    const entry = raw as Json;
    const key = strOrNull(entry.key);
    const schedule = strOrNull(entry.schedule);
    if (key !== null && schedule !== null) schedules.set(key, schedule);
  }
  return schedules;
}

/**
 * The line-table arm: every `out/ledger.json` addition is an `expense` or an `income` line and
 * carries a schedule the line tables carry - `C` or `E` with a line of that schedule's table in
 * the staged year's `rules/ty<tax_year>/schedule_lines.json` - whether or not it carries an
 * entity. A K-1 books no line (issue #1161): a `k1_income` line or one on `K1` is refused here as
 * an unknown kind or schedule (a kind left null reads as an expense, as Abacus reads it; the kind
 * arm is this checker's own, which the importer runs before its gate). The schedule and line arms
 * are the product importer's own gate (apps/worker/src/importer/import-saved-output.ts, the same
 * sentences), run here so a run
 * that writes an unassigned line with a `null` schedule, or a line off its schedule's table,
 * fails its own step-8 check instead of passing the verdict and being refused at import:
 * build_books reads no schedule for an entity-less line, so nothing before this gate catches it.
 * The message names the item, never the value it carries.
 */
function ledgerLineTableProblems(workspace: string, rules: YearRules): Problem[] {
  const ledger = loadJson(join(workspace, 'out', REQUIRED_LEDGER));
  if (!Array.isArray(ledger)) return []; // schemaProblems already reports the malformed ledger
  const tables = scheduleTables(rules);
  if (tables === null) {
    return [problem('schema', `the skill ships no readable ${rules.label}schedule_lines.json`)];
  }
  const problems: Problem[] = [];
  for (const [index, raw] of ledger.entries()) {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) continue;
    const item = raw as Json;
    const name = `${REQUIRED_LEDGER} item ${String(index)}`;
    const schedule = item['schedule'];
    const line = item['line'];
    const lineKey = typeof line === 'string' || typeof line === 'number' ? String(line) : null;
    const kind = item['kind'];
    if (kind !== null && kind !== undefined && kind !== 'expense' && kind !== 'income') {
      problems.push(problem('schema', `${name} field kind is outside the ledger kinds`));
    }
    const table = schedule === 'C' || schedule === 'E' ? tables[schedule] : undefined;
    if (table === undefined) {
      problems.push(
        problem('schema', `${name} field schedule is outside the schedules the line tables carry`),
      );
      continue;
    }
    if (lineKey === null || !Object.hasOwn(table, lineKey)) {
      problems.push(problem('schema', `${name} field line is not in its schedule's line table`));
    }
  }
  return problems;
}

/** The catalog key that asks whether bills at an address no place carries are the home office's
 *  home's (issue #1042), and its two option ids. */
export const OFFICE_HOME_BILLS_KEY = 'office_home_bills_q';
export const OFFICE_HOME_BILLS_OPTIONS = ['same_home', 'other_place'] as const;

/** A K-1's document type (decision record 0135): the partnership's or S corporation's finished
 *  form, handed to the accountant. It books nothing — no line is booked from it and no change is
 *  armed by it — so `documentGateProblems` refuses either as `k1_books_nothing` (issue #1257),
 *  where the ledger-kind arm refuses only the old `k1_income` and `K1` shapes. */
const K1_DOC_TYPE = 'schedule_k1';

/** The typed prefixes of the issue #1042 gates, so a reader of the problems can find each. */
export const DOCUMENT_GATES = {
  status: 'document_status',
  bookedNothing: 'booked_books_nothing',
  zeroAmount: 'zero_amount_line',
  currency: 'line_currency',
  formDate: 'form_date',
  k1BooksNothing: 'k1_books_nothing',
  exportRowsShape: 'export_rows_shape',
  exportRowUnaccounted: 'export_row_unaccounted',
  exportRowBooked: 'export_row_booked_unmatched',
  exportRowBookedBeside: 'export_row_booked_beside',
  exportTable: 'export_table_invalid',
  exportRowRestated: 'export_row_restated_unmatched',
  exportRowSupport: 'export_row_support_exceeds',
  exportRowForeign: 'export_row_foreign_usd',
  unprinted: 'unprinted_amount',
  folioTotalWithMeal: 'folio_total_with_meal',
  tripName: 'trip_name_not_key',
  tripCite: 'trip_cite_unknown',
  officeHomeBills: 'office_home_bills',
  statementBlock: 'statement_block',
  attachLineBooksNothing: 'attach_line_books_nothing',
  statementFigures: 'statement_figures',
  statementMismatch: 'statement_mismatch_note',
  addressShape: 'document_address_shape',
} as const;

type DocumentEntry = { readonly index: number; readonly file: string; readonly entry: Json };

/** out/documents.json's entries carrying a string `file`, in order. */
function documentEntriesOf(workspace: string): DocumentEntry[] {
  const entries: DocumentEntry[] = [];
  const listed = listOf(loadJson(join(workspace, 'out', REQUIRED_DOCUMENTS)));
  for (const [index, raw] of listed.entries()) {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) continue;
    const file = strOrNull((raw as Json).file);
    if (file !== null) entries.push({ index, file, entry: raw as Json });
  }
  return entries;
}

/** The documents.json entry a `source_file` names (by basename or basename minus its extension). */
function documentOf(entries: readonly DocumentEntry[], source: string): DocumentEntry | undefined {
  return entries.find((candidate) => sameDocument(candidate.file, source));
}

/** out/ledger.json's object items, each with its index. */
function ledgerItemsOf(workspace: string): [number, Json][] {
  const items: [number, Json][] = [];
  for (const [index, raw] of listOf(loadJson(join(workspace, 'out', REQUIRED_LEDGER))).entries()) {
    if (typeof raw === 'object' && raw !== null && !Array.isArray(raw))
      items.push([index, raw as Json]);
  }
  return items;
}

/**
 * The booked line a staged reading attaches its document to as the receipt (`attach_to.line`, a
 * code-built top-level key of `extractions/<stem>.json`, task 37.26), or null. The reading is the
 * batch's own, so a name that stages none attaches nothing.
 */
function attachLineTargetOf(workspace: string, source: string): string | null {
  return attachTargetOf(workspace, source, 'line');
}

/** The staged reading's `attach_to` target of one type (`line` or `trip`), or null. */
function attachTargetOf(workspace: string, source: string, type: 'line' | 'trip'): string | null {
  const name = basename(source);
  const dot = name.lastIndexOf('.');
  const reading = loadJson(
    join(workspace, 'extractions', `${dot > 0 ? name.slice(0, dot) : name}.json`),
  );
  if (reading === null || typeof reading !== 'object' || Array.isArray(reading)) return null;
  const attach = (reading as Json)['attach_to'];
  if (attach === null || typeof attach !== 'object' || Array.isArray(attach)) return null;
  const target = (attach as Json)[type];
  return typeof target === 'string' && target !== '' ? target : null;
}

/** Every amount a staged reading prints, as absolute cents: each decimal string or number under
 *  its pages' `fields`, the transactions, boxes and `other` included. */
function readingFigures(reading: unknown): Set<bigint> {
  const figures = new Set<bigint>();
  const walk = (value: unknown): void => {
    if (typeof value === 'string' || typeof value === 'number') {
      const cents = absoluteCents(String(value));
      if (cents !== null) figures.add(cents);
    } else if (Array.isArray(value)) {
      for (const item of value) walk(item);
    } else if (value !== null && typeof value === 'object') {
      for (const item of Object.values(value)) walk(item);
    }
  };
  const record = reading !== null && typeof reading === 'object' ? (reading as Json) : null;
  for (const page of listOf(record?.['pages'])) {
    if (typeof page === 'object' && page !== null && !Array.isArray(page)) {
      walk((page as Json)['fields']);
    }
  }
  return figures;
}

function dayNumber(iso: string): number {
  return Math.round(Date.parse(`${iso}T00:00:00Z`) / 86_400_000);
}

/** The `source_file` spellings the books book or stage from: this run's ledger additions, its
 *  changes' arming documents and `source_file` targets, its donations, home costs and payments,
 *  and what the confirmed state already carries (a document read again whose lines stand). */
function documentsBookedFrom(workspace: string, changes: readonly Json[]): string[] {
  const out = join(workspace, 'out');
  const batchNames = batchNamesOf(workspace);
  const spelled: (string | null)[] = [
    ...handedSourceFiles(workspace),
    ...carriedSourceFiles(workspace),
  ];
  for (const [, item] of ledgerItemsOf(workspace)) spelled.push(strOrNull(item.source_file));
  for (const change of changes) {
    spelled.push(documentArmingSource(change, batchNames));
    if (change.field === 'source_file') spelled.push(strOrNull(change.to));
  }
  const fieldOf = (raw: unknown, field: string): string | null =>
    typeof raw === 'object' && raw !== null && !Array.isArray(raw)
      ? strOrNull((raw as Json)[field])
      : null;
  for (const raw of listOf(loadJson(join(out, OPTIONAL_DONATIONS)))) {
    spelled.push(fieldOf(raw, 'source_file'));
  }
  for (const raw of listOf(loadJson(join(out, OPTIONAL_HOME_COSTS)))) {
    spelled.push(fieldOf(raw, 'source_file'));
  }
  for (const raw of listOf(loadJson(join(out, OPTIONAL_TAX_PAYMENTS)))) {
    spelled.push(fieldOf(raw, 'payment_source'), fieldOf(raw, 'bill_source'));
  }
  return spelled.filter((file): file is string => file !== null && file !== '');
}

/**
 * The document gates of issue #1042, each a shape the skill text names and a run can get wrong:
 *
 * - every documents.json `status` is a word of the vocabulary (`document-status.ts`), and a
 *   `booked` document is one a line, a change, a donation, a home cost or a tax payment cites, of
 *   this run or of the confirmed state: one that books nothing of its own is `support`;
 * - no ledger addition books a printed zero, and each carries a three-letter currency code;
 * - a K-1 books nothing (decision record 0135, issue #1257): no addition is booked from a
 *   `schedule_k1` document and no change is armed by one or names one as its source;
 * - a line from a tax-year form (a 1099-NEC, a 1099-MISC, a 1098 or a K-1, which print no date) is
 *   dated the tax year's last day, and no change moves a confirmed line's date under such a
 *   form's arm;
 * - a card or bank export's row never books beside the receipt it restates in this batch: the same
 *   currency and amount within three days, the vendors sharing a word;
 * - a line from a staged reading that prints figures books one of them, never a computed one
 *   (issue #1025: a folio's lodging line takes its printed subtotal, or its printed charges);
 * - a line's `trip` is the trip's key, never its name, and a finding citing `trip:<key>` names a
 *   trip the resolved profile carries;
 * - `office_home_bills_q` carries its two `none` options, and its answer decides where the cited
 *   bills go (`officeHomeBillsProblems`).
 *
 * Messages name files, indices and keys, never a value.
 */
function documentGateProblems(
  workspace: string,
  rules: YearRules,
  statementFigures: ReadonlyMap<string, Set<bigint>>,
): Problem[] {
  const out = join(workspace, 'out');
  const problems: Problem[] = [];
  const documents = documentEntriesOf(workspace);
  const ledger = ledgerItemsOf(workspace);
  const changes = listOf(loadJson(join(out, 'ledger_changes.json'))).filter(
    (raw): raw is Json => typeof raw === 'object' && raw !== null && !Array.isArray(raw),
  );
  const batchNames = batchNamesOf(workspace);

  // The status vocabulary, and a booked document that books nothing.
  const bookedFrom = documentsBookedFrom(workspace, changes);
  for (const { index, file, entry } of documents) {
    const status = documentStatus(entry.status);
    if ('status' in entry && status === null) {
      problems.push(
        problem(
          'schema',
          `${DOCUMENT_GATES.status}: ${REQUIRED_DOCUMENTS} item ${String(index)} field status is outside the step-2 words`,
        ),
      );
    }
    const addresses = recordOf(entry.fields)?.addresses;
    if (
      addresses !== undefined &&
      (!Array.isArray(addresses) || readingAddressesOf(addresses).length !== addresses.length)
    ) {
      problems.push(
        problem(
          'schema',
          `${DOCUMENT_GATES.addressShape}: ${REQUIRED_DOCUMENTS} item ${String(index)} field addresses holds an entry that is not the reader's address object; write each address as the reader does, {as_printed, usps_standard, city, region, country}`,
        ),
      );
    }
    if (status === 'booked' && !bookedFrom.some((source) => sameDocument(source, file))) {
      problems.push(
        problem(
          'invariant',
          `${DOCUMENT_GATES.bookedNothing}: ${REQUIRED_DOCUMENTS} item ${String(index)} is booked, and no line, change, donation, home cost or tax payment cites it; a document that books nothing of its own is support`,
        ),
      );
    }
  }

  // Each addition: no zero, a currency code, a form's year-end date, a printed figure, a trip key.
  const yearEnd = `${String(rules.year)}-12-31`;
  const profile = loadJson(join(out, 'profile.resolved.json'));
  const tripKeys = new Set<string>();
  const tripNames = new Set<string>();
  const profileRecord = profile !== null && typeof profile === 'object' ? (profile as Json) : null;
  for (const raw of listOf(profileRecord?.['trips'])) {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) continue;
    const key = strOrNull((raw as Json).key);
    const name = strOrNull((raw as Json).name);
    if (key !== null) tripKeys.add(key);
    if (name !== null) tripNames.add(name);
  }
  const extractions = join(workspace, 'extractions');
  const figuresByStem = new Map<string, Set<bigint>>();
  const figuresOf = (source: string): Set<bigint> | null => {
    const name = basename(source);
    const dot = name.lastIndexOf('.');
    const stem = dot > 0 ? name.slice(0, dot) : name;
    // A code-read platform statement's allowed set is the recompute's figures alone (issue
    // #1106): it replaces the walk below, whose every grid cell would let the components book
    // beside the totals. The empty set is that replacement too, not this function's null: a
    // recompute that prints no figure (every summed cell blank or zero) allows no amount from
    // that file, where an ordinary reading with no decimals constrains nothing.
    const statement = statementFigures.get(stem);
    if (statement !== undefined) return statement;
    let figures = figuresByStem.get(stem);
    if (figures === undefined) {
      const path = join(extractions, `${stem}.json`);
      figures = existsSync(path) ? readingFigures(loadJson(path)) : new Set<bigint>();
      figuresByStem.set(stem, figures);
    }
    return figures.size === 0 ? null : figures;
  };
  for (const [index, item] of ledger) {
    const at = `out/ledger.json item ${String(index)}`;
    const amount = strOrNull(item.amount);
    const cents = amount === null ? null : absoluteCents(amount);
    if (cents === 0n) {
      problems.push(
        problem(
          'schema',
          `${DOCUMENT_GATES.zeroAmount}: ${at} books a printed zero; a zero books no line`,
        ),
      );
    }
    const currency = item.currency;
    if ('currency' in item && (typeof currency !== 'string' || !/^[A-Z]{3}$/.test(currency))) {
      problems.push(
        problem(
          'schema',
          `${DOCUMENT_GATES.currency}: ${at} field currency must be a three-letter code in capitals, USD when the document prints none`,
        ),
      );
    }
    const source = strOrNull(item.source_file);
    const document = source === null ? undefined : documentOf(documents, source);
    if (document?.entry.doc_type === K1_DOC_TYPE) {
      problems.push(
        problem(
          'invariant',
          `${DOCUMENT_GATES.k1BooksNothing}: ${at} is booked from a K-1, which books nothing: file it as support and book no line from it`,
        ),
      );
    }
    if (document !== undefined && isYearForm(document.entry.doc_type) && item.date !== yearEnd) {
      problems.push(
        problem(
          'invariant',
          `${DOCUMENT_GATES.formDate}: ${at} is booked from a tax-year form, which prints no date: date it the tax year's last day`,
        ),
      );
    }
    const figures = source === null ? null : figuresOf(source);
    if (figures !== null && cents !== null && !figures.has(cents)) {
      problems.push(
        problem(
          'invariant',
          `${DOCUMENT_GATES.unprinted}: ${at} books an amount its staged reading does not print; book a printed figure (a subtotal, or each printed charge as its own line), never a computed one`,
        ),
      );
    }
    // A receipt the person attached to a booked line is that line's document and books nothing
    // (task 37.26): the line it names is the money event.
    const attachLine = source === null ? null : attachLineTargetOf(workspace, source);
    if (attachLine !== null) {
      problems.push(
        problem(
          'invariant',
          `${DOCUMENT_GATES.attachLineBooksNothing}: ${at} books a line from a document the person attached to a booked line as its receipt; the receipt is that line's document and books nothing`,
        ),
      );
    }
    const trip = strOrNull(item.trip);
    if (trip !== null && !tripKeys.has(trip) && tripNames.has(trip)) {
      problems.push(
        problem(
          'schema',
          `${DOCUMENT_GATES.tripName}: ${at} field trip names a trip by its name; write the trip's key from profile.resolved.json`,
        ),
      );
    }
  }
  for (const [index, change] of changes.entries()) {
    const armedBy = documentArmingSource(change, batchNames);
    const named = [armedBy, change.field === 'source_file' ? strOrNull(change.to) : null];
    if (
      named.some(
        (source) =>
          source !== null && documentOf(documents, source)?.entry.doc_type === K1_DOC_TYPE,
      )
    ) {
      problems.push(
        problem(
          'invariant',
          `${DOCUMENT_GATES.k1BooksNothing}: ledger_changes.json entry ${String(index)} books from a K-1, which books nothing: a K-1 arms no change and is no line's source`,
        ),
      );
    }
    // A change onto the tax year's last day puts a form's line on the date the form takes.
    if (change.field !== 'date' || change.to === yearEnd) continue;
    const source = armedBy;
    const document = source === null ? undefined : documentOf(documents, source);
    if (document !== undefined && isYearForm(document.entry.doc_type)) {
      problems.push(
        problem(
          'invariant',
          `${DOCUMENT_GATES.formDate}: ledger_changes.json entry ${String(index)} changes a date under a tax-year form, which prints none; a corrected form changes the amount and keeps the line's date`,
        ),
      );
    }
  }

  // A folio's lodging booked at the folio's printed total while the same folio books a meal line
  // counts the meal twice (issue #1025): the total carries the dining.
  for (const [index, item] of ledger) {
    if (item.meal === true) continue;
    const source = strOrNull(item.source_file);
    const document = source === null ? undefined : documentOf(documents, source);
    if (source === null || document?.entry.doc_type !== 'hotel_folio') continue;
    const totals = new Set<bigint>();
    const addTotal = (value: unknown): void => {
      const cents = typeof value === 'string' ? absoluteCents(value) : null;
      if (cents !== null) totals.add(cents);
    };
    const fields = document.entry.fields;
    if (fields !== null && typeof fields === 'object' && !Array.isArray(fields)) {
      addTotal((fields as Json)['total']);
    }
    const name = basename(source);
    const dot = name.lastIndexOf('.');
    const reading = loadJson(join(extractions, `${dot > 0 ? name.slice(0, dot) : name}.json`));
    const pages =
      reading !== null && typeof reading === 'object' ? (reading as Json)['pages'] : null;
    for (const page of listOf(pages)) {
      const pageFields =
        typeof page === 'object' && page !== null ? (page as Json)['fields'] : null;
      if (pageFields !== null && typeof pageFields === 'object') {
        addTotal((pageFields as Json)['total']);
      }
    }
    const cents = absoluteCents(strOrNull(item.amount) ?? '');
    const withMeal = ledger.some(
      ([, other]) =>
        other.meal === true &&
        typeof other.source_file === 'string' &&
        sameDocument(other.source_file, source),
    );
    if (cents !== null && totals.has(cents) && withMeal) {
      problems.push(
        problem(
          'invariant',
          `${DOCUMENT_GATES.folioTotalWithMeal}: out/ledger.json item ${String(index)} books a folio's printed total as lodging while a meal line books from the same folio; the total carries the dining, so book its room-and-tax subtotal or each room and tax charge`,
        ),
      );
    }
  }

  // A finding citing a trip names one the resolved profile carries.
  for (const [index, raw] of listOf(loadJson(join(out, 'findings.json'))).entries()) {
    const finding = typeof raw === 'object' && raw !== null ? (raw as Json) : null;
    for (const cite of stringList(finding?.['cites'])) {
      if (cite.startsWith('trip:') && !tripKeys.has(cite.slice('trip:'.length))) {
        problems.push(
          problem(
            'invariant',
            `${DOCUMENT_GATES.tripCite}: findings.json item ${String(index)} cites a trip profile.resolved.json does not carry; cite trip:<its key>`,
          ),
        );
      }
    }
  }

  problems.push(...officeHomeBillsProblems(workspace));
  return problems;
}

/** A typed, non-fatal item the check hands the agent as a verdict action row: no refusal. */
export type Notice = {
  /** A staged reading's platform_statement block the gate dropped for this import: the stored
   *  grid no longer matches the rules document it names (a rules correction), so the page books
   *  as an ordinary export and the founder's re-read re-matches it. */
  readonly kind: 'statement_mismatch';
  /** The staged reading's stem under extractions/. */
  readonly stem: string;
};

/** One transaction row of a card or bank export, as the export-row gates check it: its day, its
 *  amount as absolute cents, and the currency its reading or its currency column names. */
type ExportRow = {
  readonly day: number;
  readonly cents: bigint;
  readonly currency: string | null;
};

/**
 * An original sheet's text, read through the skill's own sheet reader (the code the agent runs:
 * `readCsvText` in-process for a CSV, `read_sheet.js` for a workbook, whose cells are tabbed), or
 * null when it cannot be read or is not a file of this batch's `inbox/`.
 */
function originalSheetText(
  workspace: string,
  skillDir: string,
  source: string,
): { text: string; tabbed: boolean } | null {
  // Only a file of this batch's inbox, by its basename: a model-written `source_file` never
  // chooses the path read (`../card.csv` reads nothing outside the workspace).
  const name = basename(source);
  if (!inboxNamesOf(workspace).has(name)) return null;
  const path = join(workspace, 'inbox', name);
  if (!existsSync(path)) return null;
  const lower = path.toLowerCase();
  try {
    if (lower.endsWith('.csv')) return { text: readCsvText(path), tabbed: false };
    if (lower.endsWith('.xlsx')) {
      const run = spawnSync(
        process.execPath,
        [join(skillDir, 'dist', 'scripts', 'read_sheet.js'), path],
        {
          encoding: 'utf8',
          timeout: 30_000,
          maxBuffer: 16 * 1024 * 1024,
        },
      );
      return run.status === 0 ? { text: run.stdout, tabbed: true } : null;
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * A card or bank export's transaction rows, in order, from its staged reading's rows when the
 * reading has them; else the original's records through the skill's sheet reader, which the
 * export's declared table reads (`exportRowsProblems`); else null. The rows are numbered from 1 in
 * this order: the numbering out/export_rows.json declares each row's disposition by. A sheet with
 * no dated cell has no row under any table, so it is left out as before.
 */
function exportRowsOf(
  workspace: string,
  skillDir: string,
  source: string,
): { rows: ExportRow[] } | { records: string[][] } | null {
  const name = basename(source);
  const dot = name.lastIndexOf('.');
  const reading = loadJson(
    join(workspace, 'extractions', `${dot > 0 ? name.slice(0, dot) : name}.json`),
  );
  const pages = reading !== null && typeof reading === 'object' ? (reading as Json)['pages'] : null;
  const staged: ExportRow[] = [];
  for (const page of listOf(pages)) {
    const fields = typeof page === 'object' && page !== null ? (page as Json)['fields'] : null;
    if (fields === null || typeof fields !== 'object' || Array.isArray(fields)) continue;
    const pageDate = strOrNull((fields as Json)['document_date']);
    const anchor = pageDate === null ? null : isoDate(pageDate);
    const currency = strOrNull((fields as Json)['currency']);
    for (const raw of listOf((fields as Json)['transactions'])) {
      if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) continue;
      const row = raw as Json;
      const date = strOrNull(row['date']);
      const iso = date === null ? null : isoDate(date, anchor);
      const cents = absoluteCents(strOrNull(row['amount']) ?? '');
      if (iso === null || cents === null) continue;
      staged.push({
        day: dayNumber(iso),
        cents,
        currency: currency === null ? null : currency.toUpperCase(),
      });
    }
  }
  if (staged.length > 0) return { rows: staged };
  const sheet = originalSheetText(workspace, skillDir, source);
  if (sheet === null) return null;
  const records = sheetRecords(sheet.text, sheet.tabbed);
  return hasDatedRecord(records) ? { records } : null;
}

/** The dispositions that name the document behind the row. */
const DOCUMENT_DISPOSITIONS: ReadonlySet<string> = new Set(['restated_by', 'support']);

/** One amount a document or an export's own lines carry, on the day it carries it. */
type DatedFigure = { readonly day: number; readonly cents: bigint };

/** A card or bank export booked row by row, with its transaction rows. */
type RowBookedExport = {
  readonly index: number;
  readonly file: string;
  readonly rows: readonly ExportRow[];
};

/** A row-booked export as `rowBookedExportsOf` finds it: its staged rows, or the original's
 *  records its entry's table must read. */
type FoundExport = Omit<RowBookedExport, 'rows'> &
  ({ rows: ExportRow[] } | { records: string[][] });

/**
 * The card or bank exports this batch books or keeps as support row by row, with the rows code
 * reads (`exportRowsOf`). An export no reader reads is left out, as a code-read platform statement
 * whose block the statement gate keeps, which books by figure; an export `personal`,
 * `needs_review`, `unreadable` or `near_duplicate_of` is classified as a whole.
 */
function rowBookedExportsOf(
  workspace: string,
  skillDir: string,
  statementFigures: ReadonlyMap<string, Set<bigint>>,
): FoundExport[] {
  const rowBooked: FoundExport[] = [];
  for (const { index, file, entry } of documentEntriesOf(workspace)) {
    if (entry.doc_type !== 'card_or_bank_export') continue;
    const status = documentStatus(entry.status);
    if (status !== 'booked' && status !== 'support') continue;
    const name = basename(file);
    const dot = name.lastIndexOf('.');
    if (statementFigures.has(dot > 0 ? name.slice(0, dot) : name)) continue;
    const read = exportRowsOf(workspace, skillDir, file);
    if (read !== null) rowBooked.push({ index, file, ...read });
  }
  return rowBooked;
}

/** Where a staged figure comes from: a reading's printed total, or a line, tax payment, home cost
 *  or donation staged from the document. */
type FigureKind = 'total' | 'line' | 'payment' | 'cost' | 'donation';

/** One amount a document carries on one day, as this run or the confirmed state stages it. */
type StagedFigure = DatedFigure & { readonly source: string; readonly kind: FigureKind };

/**
 * Every dated amount the export-row gates check a declaration against: each documents.json
 * entry's `total` on its `document_date`, and every line, tax payment, home cost and donation this
 * run or the confirmed state stages, with the document it names.
 */
function stagedFiguresOf(workspace: string): StagedFigure[] {
  const figures: StagedFigure[] = [];
  const add = (kind: FigureKind, source: unknown, date: unknown, amount: unknown): void => {
    const file = strOrNull(source);
    const iso = strOrNull(date);
    const cents = absoluteCents(strOrNull(amount) ?? '');
    if (file === null || iso === null || !isValidDay(iso) || cents === null) return;
    figures.push({ source: file, kind, day: dayNumber(iso), cents });
  };
  for (const { file, entry } of documentEntriesOf(workspace)) {
    const fields = recordOf(entry.fields) ?? {};
    const date = strOrNull(fields['document_date']);
    add('total', file, date === null ? null : isoDate(date), fields['total']);
  }
  for (const [, item] of ledgerItemsOf(workspace)) {
    add('line', item.source_file, item.date, item.amount);
  }
  const objects = (path: string): Json[] => listOf(loadJson(path)).flatMap(recordList);
  const summaries = recordOf(loadJson(join(workspace, 'confirmed', 'summaries.json'))) ?? {};
  for (const key of ['items', 'held'] as const) {
    for (const row of listOf(summaries[key]).flatMap(recordList)) {
      add('line', row.source_file, row.date, row.amount);
    }
  }
  for (const dir of ['out', 'confirmed'] as const) {
    for (const payment of objects(join(workspace, dir, OPTIONAL_TAX_PAYMENTS))) {
      add('payment', payment.payment_source, payment.date, payment.amount);
    }
    for (const cost of objects(join(workspace, dir, OPTIONAL_HOME_COSTS))) {
      add('cost', cost.source_file, cost.date, cost.amount);
    }
  }
  for (const gift of objects(join(workspace, 'out', OPTIONAL_DONATIONS))) {
    add('donation', gift.source_file, gift.date, gift.amount);
  }
  return figures;
}

/** A value as a one-item list when it is an object, else an empty one. */
function recordList(value: unknown): Json[] {
  const record = recordOf(value);
  return record === null ? [] : [record];
}

/** What an export stages from itself, each its own figure: two equal rows of one day are two
 *  lines. A `booked` row takes one of these. */
function ownFiguresOf(figures: readonly StagedFigure[], file: string): StagedFigure[] {
  return figures.filter((figure) => figure.kind !== 'total' && sameDocument(figure.source, file));
}

/**
 * The payments one document carries, as keys a `restated_by` row can claim: each day and amount
 * as many times as any one kind of figure repeats it, so a receipt's total and its own line are
 * one payment while two equal payments a history lists are two. Keyed by the document's stem, so
 * every spelling of one document claims the same figures.
 */
function documentPaymentsOf(
  figures: readonly StagedFigure[],
  document: string,
): { readonly key: string; readonly figure: DatedFigure }[] {
  const counts = new Map<string, { figure: DatedFigure; byKind: Map<FigureKind, number> }>();
  for (const figure of figures) {
    if (!sameDocument(figure.source, document)) continue;
    const at = `${String(figure.day)}:${String(figure.cents)}`;
    const entry = counts.get(at) ?? { figure, byKind: new Map<FigureKind, number>() };
    entry.byKind.set(figure.kind, (entry.byKind.get(figure.kind) ?? 0) + 1);
    counts.set(at, entry);
  }
  return [...counts.entries()].flatMap(([at, { figure, byKind }]) =>
    Array.from({ length: Math.max(...byKind.values()) }, (_, copy) => ({
      key: `${stemOf(document)}:${at}:${String(copy)}`,
      figure,
    })),
  );
}

/**
 * A one-to-one matching of claims to figure keys (Kuhn's augmenting paths): each claim takes at
 * most one key and each key one claim, the nearest first, so a claim a matching can meet is never
 * refused for the order claims are tried in. Returns the claims no key is left for, and the keys
 * taken.
 */
function matchOneToOne<Claim>(
  claims: readonly Claim[],
  candidatesOf: (claim: Claim) => readonly string[],
): { readonly unmatched: Claim[]; readonly taken: ReadonlySet<string> } {
  const candidates = claims.map(candidatesOf);
  const holder = new Map<string, number>();
  const augment = (at: number, seen: Set<string>): boolean => {
    for (const key of candidates[at] ?? []) {
      if (seen.has(key)) continue;
      seen.add(key);
      const other = holder.get(key);
      if (other === undefined || augment(other, seen)) {
        holder.set(key, at);
        return true;
      }
    }
    return false;
  };
  const unmatched = claims.filter((_, at) => !augment(at, new Set()));
  return { unmatched, taken: new Set(holder.keys()) };
}

/** One row's declared disposition, as out/export_rows.json carries it. */
type DeclaredRow = {
  readonly row: number;
  readonly disposition: ExportRowDisposition;
  readonly document: string | null;
};

/**
 * The export-row gates (issue #1631, replacing the restatement and row-completeness gates of
 * #1042 and #1119): the books agent declares in out/export_rows.json, for each export
 * `rowBookedExportsOf` returns, one disposition per transaction row — the rows counted from 1 in
 * the order `exportRowsOf` reads them, or for an export read from its file in the order its
 * entry's declared table reads them (decision record 0177) — and code checks what each declaration
 * claims against figures code staged, with no vendor word anywhere:
 *
 * - the table: the export's cells contradict none of it (`readExportTable`);
 * - coverage: every export has one entry, and its entry names every row exactly once;
 * - `booked`: a line, tax payment, home cost or donation staged from the export itself, this run's
 *   or the confirmed state's, carries the row's transaction amount within
 *   EXPORT_ROW_WINDOW_DAYS of it, each line one row's;
 * - no other row's amount carried by a figure its own export stages that no booked row took;
 * - `restated_by`: the named document, not the export, carries the row's amount within the window
 *   (`documentPaymentsOf`), each of its payments one row's across every export;
 * - `support`: the named documents.json entry, not the export, prints a `total`, and the rows every
 *   export says it supports sum to no more than it;
 * - `foreign`: the row's reading does not name US dollars.
 *
 * `personal` and `transfer` are the agent's word. A refusal names the entry and the rows'
 * positions, never a row's date, amount or description.
 */
function exportRowsProblems(
  workspace: string,
  skillDir: string,
  statementFigures: ReadonlyMap<string, Set<bigint>>,
): Problem[] {
  const rowBooked = rowBookedExportsOf(workspace, skillDir, statementFigures);
  const cardExports = documentEntriesOf(workspace)
    .filter(({ entry }) => entry.doc_type === 'card_or_bank_export')
    .map(({ file }) => file);
  const path = join(workspace, 'out', EXPORT_ROWS_FILE);
  const present = existsSync(path);
  if (rowBooked.length === 0 && !present) return [];
  const problems: Problem[] = [];
  const schema = (message: string): void => {
    problems.push(problem('schema', `${DOCUMENT_GATES.exportRowsShape}: ${message}`));
  };
  const raw = present ? loadJson(path) : [];
  if (!Array.isArray(raw)) {
    schema(`out/${EXPORT_ROWS_FILE} must be a JSON list`);
    return problems;
  }
  const declaredFound = new Map<FoundExport, DeclaredRow[]>();
  const readableOf = new Map<FoundExport, RowBookedExport>();
  for (const found of rowBooked) {
    if ('rows' in found)
      readableOf.set(found, { index: found.index, file: found.file, rows: found.rows });
  }
  // Exports read from their file whose entry was refused (its rows' shape, a missing table, or a
  // table its cells contradict): their rows are unknown, so coverage is not counted against them
  // on top of that refusal.
  const tableRefused = new Set<FoundExport>();
  for (const [at, item] of raw.entries()) {
    const entry = recordOf(item) ?? {};
    const file = strOrNull(entry['file']);
    const target =
      file === null ? undefined : rowBooked.find((each) => sameDocument(each.file, file));
    // An export code reads no rows of, or books by figure, has nothing to check its entry against.
    if (
      target === undefined &&
      file !== null &&
      cardExports.some((each) => sameDocument(each, file))
    ) {
      continue;
    }
    if (target === undefined) {
      schema(
        `out/${EXPORT_ROWS_FILE} item ${String(at)} must name, in \`file\`, a card or bank export of documents.json this batch books row by row`,
      );
      continue;
    }
    if (declaredFound.has(target)) {
      schema(
        `out/${EXPORT_ROWS_FILE} item ${String(at)} names documents.json item ${String(target.index)} again; one entry per export`,
      );
      continue;
    }
    const rows: DeclaredRow[] = [];
    let shaped = Array.isArray(entry['rows']);
    for (const value of listOf(entry['rows'])) {
      const row = recordOf(value) ?? {};
      const number = row['row'];
      const disposition = row['disposition'];
      const document = row['document'] ?? null;
      const named = DOCUMENT_DISPOSITIONS.has(String(disposition));
      if (
        typeof number !== 'number' ||
        !Number.isInteger(number) ||
        number < 1 ||
        !(EXPORT_ROW_DISPOSITIONS as readonly unknown[]).includes(disposition) ||
        (named ? typeof document !== 'string' || document === '' : document !== null)
      ) {
        shaped = false;
        continue;
      }
      rows.push({
        row: number,
        disposition: disposition as ExportRowDisposition,
        document: named ? (document as string) : null,
      });
    }
    if (!shaped) {
      if ('records' in target) tableRefused.add(target);
      schema(
        `out/${EXPORT_ROWS_FILE} item ${String(at)} must carry \`rows\`, a list of {row, disposition, document}: row a whole number from 1, disposition one of ${EXPORT_ROW_DISPOSITIONS.join(', ')}, and document the file a restated_by or support row names (null otherwise)`,
      );
      continue;
    }
    if ('records' in target) {
      const table = exportTableOf(entry['table']);
      if (table === null) {
        tableRefused.add(target);
        schema(
          `out/${EXPORT_ROWS_FILE} item ${String(at)} names an export read from its file, so it must carry \`table\`: {header, columns, date_order, decimal_mark, money_out}, as reference/steps/3-propose.md gives it`,
        );
        continue;
      }
      const read = readExportTable(target.records, table);
      if (read.problems.length > 0) {
        tableRefused.add(target);
        problems.push(
          problem(
            'invariant',
            `${DOCUMENT_GATES.exportTable}: out/${EXPORT_ROWS_FILE} item ${String(at)} declares a table documents.json item ${String(target.index)}'s cells contradict: ${read.problems.join(', ')}`,
          ),
        );
        continue;
      }
      readableOf.set(target, {
        index: target.index,
        file: target.file,
        rows: read.rows.map((row) => ({
          day: dayNumber(row.iso),
          cents: row.cents < 0n ? -row.cents : row.cents,
          currency: row.currency === '' ? null : row.currency.toUpperCase(),
        })),
      });
    }
    declaredFound.set(target, rows);
  }
  const readable = rowBooked.flatMap((found) => {
    const each = readableOf.get(found);
    return each === undefined ? [] : [each];
  });
  const declared = new Map<RowBookedExport, DeclaredRow[]>();
  for (const [found, rows] of declaredFound) {
    const each = readableOf.get(found);
    if (each !== undefined) declared.set(each, rows);
  }
  const positions = (list: readonly number[]): string =>
    `row${list.length === 1 ? '' : 's'} ${list.join(', ')}`;
  const refuse = (gate: string, target: RowBookedExport, rows: number[], why: string): void => {
    if (rows.length === 0) return;
    problems.push(
      problem(
        'invariant',
        `${gate}: documents.json item ${String(target.index)} is a card or bank export; ${positions(rows)} (counting its transaction rows from 1): ${why}`,
      ),
    );
  };
  for (const found of rowBooked) {
    if (tableRefused.has(found)) continue;
    const target = readableOf.get(found);
    if (target === undefined) {
      problems.push(
        problem(
          'invariant',
          `${DOCUMENT_GATES.exportRowUnaccounted}: documents.json item ${String(found.index)} is a card or bank export read from its file, with no entry in out/${EXPORT_ROWS_FILE}; write one with its \`table\` and one disposition per row`,
        ),
      );
      continue;
    }
    const rows = declared.get(target);
    if (rows === undefined) {
      refuse(
        DOCUMENT_GATES.exportRowUnaccounted,
        target,
        target.rows.map((_, at) => at + 1),
        `no disposition in out/${EXPORT_ROWS_FILE}; write one entry for the export with one disposition per row`,
      );
      continue;
    }
    const counts = new Map<number, number>();
    for (const { row } of rows) counts.set(row, (counts.get(row) ?? 0) + 1);
    const missing = target.rows.map((_, at) => at + 1).filter((row) => !counts.has(row));
    const extra = [...counts.entries()]
      .filter(([row, count]) => count > 1 || row > target.rows.length)
      .map(([row]) => row)
      .sort((a, b) => a - b);
    refuse(
      DOCUMENT_GATES.exportRowUnaccounted,
      target,
      missing,
      `no disposition in out/${EXPORT_ROWS_FILE}; the export has ${String(target.rows.length)} transaction rows and each takes exactly one`,
    );
    refuse(
      DOCUMENT_GATES.exportRowUnaccounted,
      target,
      extra,
      `declared twice, or past its last row, in out/${EXPORT_ROWS_FILE}; the export has ${String(target.rows.length)} transaction rows and each takes exactly one`,
    );
  }
  const near = (row: ExportRow, figure: DatedFigure): boolean =>
    Math.abs(row.day - figure.day) <= EXPORT_ROW_WINDOW_DAYS;
  const amountOf = (row: ExportRow): bigint => row.cents;
  type Claim = {
    readonly target: RowBookedExport;
    readonly number: number;
    readonly row: ExportRow;
    readonly document: string | null;
  };
  const declaredRows = (disposition: ExportRowDisposition): Claim[] =>
    [...declared.entries()].flatMap(([target, rows]) =>
      rows
        .filter((each) => each.disposition === disposition)
        .flatMap((each) => {
          const row = target.rows[each.row - 1];
          return row === undefined
            ? []
            : [{ target, number: each.row, row, document: each.document }];
        }),
    );
  const figures = stagedFiguresOf(workspace);
  const byExport = new Map<RowBookedExport, number[]>();
  const keep = (target: RowBookedExport, number: number): void => {
    byExport.set(target, [...(byExport.get(target) ?? []), number]);
  };
  const flush = (gate: string, why: string): void => {
    for (const [target, rows] of byExport) {
      refuse(
        gate,
        target,
        rows.sort((a, b) => a - b),
        why,
      );
    }
    byExport.clear();
  };
  const nearest =
    (row: ExportRow) =>
    (a: { readonly figure: DatedFigure }, b: { readonly figure: DatedFigure }): number =>
      Math.abs(a.figure.day - row.day) - Math.abs(b.figure.day - row.day);
  // booked: each row takes a figure its own export stages at its amount within the window.
  const ownOf = new Map(
    readable.map((target) => [
      target,
      ownFiguresOf(figures, target.file).map((figure, at) => ({
        key: `${String(target.index)}:${String(at)}`,
        figure,
      })),
    ]),
  );
  const ownAt = ({ target, row }: Claim) =>
    (ownOf.get(target) ?? [])
      .filter(({ figure }) => figure.cents === amountOf(row) && near(row, figure))
      .sort(nearest(row));
  const booked = matchOneToOne(declaredRows('booked'), (claim) =>
    ownAt(claim).map(({ key }) => key),
  );
  for (const claim of booked.unmatched) keep(claim.target, claim.number);
  flush(
    DOCUMENT_GATES.exportRowBooked,
    `declared booked, but no line booked from the export carries the row's amount within ${String(EXPORT_ROW_WINDOW_DAYS)} days of it, one line per row; book the row, or give it the disposition it has`,
  );
  // A row declared not booked whose amount a line of its own export still carries is booked
  // twice when another document restates it, and booked against its word otherwise.
  for (const disposition of ['restated_by', 'support', 'personal', 'transfer'] as const) {
    for (const claim of declaredRows(disposition)) {
      if (ownAt(claim).some(({ key }) => !booked.taken.has(key))) keep(claim.target, claim.number);
    }
  }
  flush(
    DOCUMENT_GATES.exportRowBookedBeside,
    `declared not booked, but a line, payment, cost or donation staged from the export carries the row's amount within ${String(EXPORT_ROW_WINDOW_DAYS)} days of it; remove what the export books for the row, or declare it booked`,
  );
  // restated_by: each row takes a payment of the named document at its amount within the window.
  const restated = matchOneToOne(declaredRows('restated_by'), ({ target, row, document }) =>
    document === null || sameDocument(document, target.file)
      ? []
      : documentPaymentsOf(figures, document)
          .filter(({ figure }) => figure.cents === amountOf(row) && near(row, figure))
          .sort(nearest(row))
          .map(({ key }) => key),
  );
  for (const claim of restated.unmatched) keep(claim.target, claim.number);
  flush(
    DOCUMENT_GATES.exportRowRestated,
    `declared restated_by a document that carries no figure at the row's amount within ${String(EXPORT_ROW_WINDOW_DAYS)} days of it, one row per figure; name the document that is this payment's evidence, or a summing document as support`,
  );
  // support: the rows a document supports sum to no more than the total it prints.
  const documents = documentEntriesOf(workspace);
  const supported = new Map<string, { total: bigint | null; claims: Claim[] }>();
  for (const claim of declaredRows('support')) {
    const document = claim.document === null ? undefined : documentOf(documents, claim.document);
    if (document === undefined || sameDocument(document.file, claim.target.file)) {
      keep(claim.target, claim.number);
      continue;
    }
    const total = absoluteCents(strOrNull((recordOf(document.entry.fields) ?? {})['total']) ?? '');
    const group = supported.get(document.file) ?? { total, claims: [] };
    group.claims.push(claim);
    supported.set(document.file, group);
  }
  for (const { total, claims } of supported.values()) {
    const sum = claims.reduce((acc, { row }) => acc + amountOf(row), 0n);
    if (total === null || total === 0n || sum > total) {
      for (const claim of claims) keep(claim.target, claim.number);
    }
  }
  flush(
    DOCUMENT_GATES.exportRowSupport,
    `declared support of a document that is not another documents.json entry printing a total, or whose supported rows sum past the total it prints; a support document is one whose printed total covers these rows, such as a 1099, a property manager's statement or a payout summary`,
  );
  for (const claim of declaredRows('foreign')) {
    if (claim.row.currency === 'USD') keep(claim.target, claim.number);
  }
  flush(
    DOCUMENT_GATES.exportRowForeign,
    `declared foreign, but the export's reading or its currency column names US dollars`,
  );
  return problems;
}

/**
 * `office_home_bills_q` (issue #1042): asked with exactly its two options, `same_home` then
 * `other_place`, each a `none` effect. Once answered, the documents its question cited go where
 * the answer says: `same_home`, each stays a home cost (in out/home_costs.json when the run
 * writes it, else in the confirmed set); `other_place`, none is a home cost a written file keeps.
 */
function officeHomeBillsProblems(workspace: string): Problem[] {
  const out = join(workspace, 'out');
  const problems: Problem[] = [];
  for (const [index, raw] of listOf(loadJson(join(out, 'questions.json'))).entries()) {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) continue;
    const question = raw as Json;
    if (question.key !== OFFICE_HOME_BILLS_KEY) continue;
    const options = listOf(question.options).map((option) =>
      typeof option === 'object' && option !== null ? (option as Json) : null,
    );
    const shaped =
      options.length === OFFICE_HOME_BILLS_OPTIONS.length &&
      OFFICE_HOME_BILLS_OPTIONS.every((id, at) => options[at]?.['id'] === id) &&
      options.every((option) => parseEffect(option?.['effect'])?.kind === 'none');
    if (!shaped) {
      problems.push(
        problem(
          'schema',
          `${DOCUMENT_GATES.officeHomeBills}: questions.json item ${String(index)} must offer exactly same_home then other_place, each with a none effect`,
        ),
      );
    }
  }
  const answers = loadJson(join(workspace, 'answers.json'));
  const answersRecord = answers !== null && typeof answers === 'object' ? (answers as Json) : null;
  const entry = answersRecord?.[OFFICE_HOME_BILLS_KEY];
  if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) return problems;
  const answer = (entry as Json).answer;
  const chosen =
    typeof answer === 'object' && answer !== null ? strOrNull((answer as Json).optionId) : null;
  if (chosen !== 'same_home' && chosen !== 'other_place') return problems;
  // Only a cite naming a document is a bill: one this run's documents.json or batch carries, or a
  // home cost's own document; a ledger id or any other cite (profile.json) is none.
  const batchNames = batchNamesOf(workspace);
  const documentNames = documentEntriesOf(workspace).map(({ file }) => file);
  const outCosts = join(out, OPTIONAL_HOME_COSTS);
  const written = existsSync(outCosts);
  const costs = listOf(
    loadJson(written ? outCosts : join(workspace, 'confirmed', OPTIONAL_HOME_COSTS)),
  )
    .map((raw) =>
      typeof raw === 'object' && raw !== null ? strOrNull((raw as Json).source_file) : null,
    )
    .filter((file): file is string => file !== null);
  const knownCosts = [
    ...costs,
    ...listOf(loadJson(join(workspace, 'confirmed', OPTIONAL_HOME_COSTS)))
      .map((raw) =>
        typeof raw === 'object' && raw !== null ? strOrNull((raw as Json).source_file) : null,
      )
      .filter((file): file is string => file !== null),
  ];
  const cited = [
    ...stringList((entry as Json).cites),
    ...stringList((entry as Json).documents),
  ].filter(
    (cite) =>
      namesBatchToken(cite, batchNames) ||
      documentNames.some((file) => sameDocument(file, cite)) ||
      knownCosts.some((file) => sameDocument(file, cite)),
  );
  for (const cite of cited) {
    const isCost = costs.some((file) => sameDocument(file, cite));
    if (chosen === 'same_home' && !isCost) {
      problems.push(
        problem(
          'invariant',
          `${DOCUMENT_GATES.officeHomeBills}: a document the answered ${OFFICE_HOME_BILLS_KEY} cites is the office's home's, so it stays a home cost`,
        ),
      );
    }
    if (chosen === 'other_place' && isCost) {
      problems.push(
        problem(
          'invariant',
          `${DOCUMENT_GATES.officeHomeBills}: a document the answered ${OFFICE_HOME_BILLS_KEY} cites is another place's, so it is no home cost; write out/home_costs.json without it`,
        ),
      );
    }
  }
  return problems;
}

/** The prefix of the out-of-year finding problem's message, so a reader of the typed problems
 *  can find it (issue #1364). */
export const OUTSIDE_YEAR_CITES_LINE = 'outside_year_cites_line';

/**
 * The tax year is a cut (decision record 0148): a line dated outside the year is booked on its own
 * date and the build lists it in books.json's `outside_year`, so it needs no finding. An
 * `outside_tax_year` finding is the record of a document that booked no line because its only
 * payment lies outside the year (reference/situations.md's installment), so one citing a ledger
 * id is refused. The importer's re-check runs this same function. The message names the item's
 * index, never a cite.
 */
function outsideYearFindingProblems(workspace: string): Problem[] {
  const problems: Problem[] = [];
  for (const [index, raw] of listOf(loadJson(join(workspace, 'out', 'findings.json'))).entries()) {
    const finding = recordOf(raw);
    if (finding?.kind !== 'outside_tax_year') continue;
    if (!listOf(finding.cites).some((cite) => typeof cite === 'string' && /^L\d+$/.test(cite))) {
      continue;
    }
    problems.push(
      problem(
        'invariant',
        `${OUTSIDE_YEAR_CITES_LINE}: findings.json item ${String(index)} is an outside_tax_year ` +
          'finding citing a ledger line; a line dated outside the tax year is listed by the build ' +
          'and needs no finding, so cite only the document whose payment lies outside the year, ' +
          'or remove the finding (reference/steps/7-findings.md)',
      ),
    );
  }
  return problems;
}

/** The prefix of the upload-hint problem's message, so a reader of the typed problems can find it. */
export const HINT_ENTITY_MISMATCH = 'hint_entity_mismatch';

/** The staged readings' upload hints, by the reading file's stem (`doc_118` -> `ent_3`). */
function stagedHintsOf(workspace: string): Map<string, string> {
  const hints = new Map<string, string>();
  const dir = join(workspace, 'extractions');
  if (!existsSync(dir)) return hints;
  for (const name of readdirSync(dir)) {
    if (!name.endsWith('.json')) continue;
    const reading = loadJson(join(dir, name));
    if (reading === null || typeof reading !== 'object' || Array.isArray(reading)) continue;
    const hint = (reading as Json)['hint_entity'];
    if (typeof hint === 'string') hints.set(name.slice(0, -'.json'.length), hint);
  }
  return hints;
}

/**
 * The platform-statement gate (epic #1017, issue #1106): every staged reading whose code-read
 * page carries a `fields.platform_statement` block has its figures re-derived here with the one
 * function the agent's `platform_statement.js` runs — Abacus over the stored grid, never the
 * agent's arithmetic (0019 item 1, 0033) — and that document's allowed-figure set is REPLACED
 * with the recompute's amounts alone. Not the grid walk extended: every grid cell is a decimal
 * string, and an allowed set of grid ∪ figures would let the agent book the components beside
 * the totals and re-import the double-count the per-(column, row class) exclusions exist to
 * prevent. A fabricated total refuses, and so does a component; a recompute that prints no
 * figure at all replaces the set with the empty one, which allows no amount from that file. A
 * grid the current rules no longer describe — its header renamed, or a row value no longer
 * classed, by a rules correction — degrades, never wedges: the block drops for this import (the
 * page books as an ordinary export, the ordinary walk its allowed set) and a `statement_mismatch`
 * notice names the stem; the founder's re-read re-matches the document under the corrected rules.
 * The degrade's record is required, not asked: the importer reads problems alone, never notices,
 * so each degraded stem must be cited by a `note` finding — the one staged-readings.md already
 * tells the agent to write — or the run does not pass and the mismatch cannot be silently lost
 * from the imported books. A summed cell that is not a plain decimal stays a typed `invariant`
 * refusal, the message naming the address only.
 */
function statementGateResult(
  workspace: string,
  rules: YearRules,
): { figures: Map<string, Set<bigint>>; problems: Problem[]; notices: Notice[] } {
  const figures = new Map<string, Set<bigint>>();
  const problems: Problem[] = [];
  const notices: Notice[] = [];
  const mismatchStems = new Set<string>();
  const mismatchOf = (stem: string): Notice => {
    mismatchStems.add(stem);
    return { kind: 'statement_mismatch', stem };
  };
  const dir = join(workspace, 'extractions');
  if (!existsSync(dir)) return { figures, problems, notices };
  for (const name of readdirSync(dir).sort()) {
    if (!name.endsWith('.json')) continue;
    const reading = loadJson(join(dir, name));
    const record = reading !== null && typeof reading === 'object' ? (reading as Json) : null;
    for (const page of listOf(record?.['pages'])) {
      if (typeof page !== 'object' || page === null || Array.isArray(page)) continue;
      const fields = (page as Json)['fields'];
      if (fields === null || typeof fields !== 'object' || Array.isArray(fields)) continue;
      const raw = (fields as Json)['platform_statement'];
      if (raw === undefined) continue;
      const stem = name.slice(0, -'.json'.length);
      const block = statementBlockOf(raw);
      if (block === null) {
        problems.push(
          problem(
            'invariant',
            `${DOCUMENT_GATES.statementBlock}: extractions/${name} carries a platform_statement block that is not the code-stored shape`,
          ),
        );
        continue;
      }
      const document = statementDocumentOf(rules.dir, block.platform, block.document);
      if (document === null) {
        notices.push(mismatchOf(stem));
        continue;
      }
      const result = computeStatementFigures(block.grid, document);
      if (result.ok) {
        figures.set(
          stem,
          new Set(result.figures.map((figure) => absoluteCents(figure.amount) ?? 0n)),
        );
        continue;
      }
      // A grid the current rules no longer describe — its header renamed by a correction, or a
      // row value the corrected grammar no longer classes — degrades, never wedges: the block
      // drops for this import, the ordinary walk is that document's allowed set, and the
      // founder's re-read re-matches the document under the corrected rules. A summed cell that
      // is not a plain decimal is the document misread, not rules drift, and stays the typed
      // `invariant` refusal.
      if (
        result.problem.code === 'statement_grid_mismatch' ||
        result.problem.code === 'statement_row_unclassed'
      ) {
        notices.push(mismatchOf(stem));
        continue;
      }
      problems.push(
        problem(
          'invariant',
          `${DOCUMENT_GATES.statementFigures}: extractions/${name} ${result.problem.message}`,
        ),
      );
    }
  }
  // The degrade's record, or the run does not pass: a notice stops at the agent's action rows,
  // and the importer reads problems alone, so the `note` finding staged-readings.md asks for is
  // required — one citing each degraded stem (any spelling that names the document: `doc_118`,
  // `extractions/doc_118.json`, the inbox file), or the mismatch the founder's re-read exists
  // for reaches no imported books.
  if (mismatchStems.size > 0) {
    const findings = listOf(loadJson(join(workspace, 'out', 'findings.json')));
    const notesStem = (stem: string): boolean =>
      findings.some(
        (raw) =>
          typeof raw === 'object' &&
          raw !== null &&
          !Array.isArray(raw) &&
          (raw as Json).kind === 'note' &&
          listOf((raw as Json).cites).some(
            (cite) => typeof cite === 'string' && sameDocument(cite, stem),
          ),
      );
    for (const stem of mismatchStems) {
      if (!notesStem(stem)) {
        problems.push(
          problem(
            'invariant',
            `${DOCUMENT_GATES.statementMismatch}: extractions/${stem}.json degrades to an ordinary export and no note finding cites it; write the note finding that names the re-read (staged-readings.md)`,
          ),
        );
      }
    }
  }
  return { figures, problems, notices };
}

/** Whether the staged answer under a key chose a place for its lines: its chosen option is a
 *  ledger `entity` effect naming the place, or an `entity_register` effect registering it. */
function placeChoiceOf(workspace: string): (key: string, entity: unknown) => boolean {
  const answers = answersOf(workspace);
  return (key, entity) => {
    const staged = answers.get(key);
    const effect = staged === undefined ? null : parseEffect(optionEffectOf(staged));
    if (effect === null) return false;
    if (effect.kind === 'entity_register') return effect.entityKey === entity;
    return (
      effect.kind === 'ledger' &&
      effect.field === 'entity' &&
      effect.to.type === 'entity' &&
      effect.to.entityKey === entity
    );
  };
}

/** The prefix of the two-rentals statement problem's message (issue #1387). */
export const LISTINGS_OF_TWO_RENTALS = 'listings_of_two_rentals';

/**
 * A statement printing the listings of two staged rentals (issue #1387): step 3 books a statement
 * to a rental by listing only when every listing it prints is that one rental's, so a line booked
 * from a document whose staged reading (or readable original) prints the listings of two or more
 * staged rentals carries no place unless the person chose it — its `answer_keys` names a staged
 * answer choosing that place, as for the upload hint. Its lines wait unassigned and step 4 asks.
 * A listing is printed as `matchListingProblems` reads it (`printsListing`): its id reaches
 * {@link LISTING_ID_MIN_DIGITS} digits and each digit run of its key is a whole digit run of the
 * document's printed values, so a short listing a rental carries is never read as printed by
 * every statement. The message names the item's index, never a listing or a place.
 */
function twoRentalsStatementProblems(workspace: string, skillDir: string): Problem[] {
  const rentals = [...entityKindsFrom(loadJson(join(workspace, 'profile.json')))].filter(
    ([, entity]) => entity.listings.some(listingIdLongEnough),
  );
  if (rentals.length < 2) return [];
  const digitsOf = documentDigitsOf(workspace, skillDir);
  const choosesPlace = placeChoiceOf(workspace);
  const problems: Problem[] = [];
  for (const [index, raw] of listOf(loadJson(join(workspace, 'out', REQUIRED_LEDGER))).entries()) {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) continue;
    const item = raw as Json;
    const file = strOrNull(item.source_file);
    const entity = item.entity;
    if (file === null || entity === null || entity === undefined) continue;
    const digits = digitsOf(file);
    if (digits === null) continue;
    const printing = rentals.filter(([, rental]) =>
      rental.listings.some((listing) => printsListing(digits, listing)),
    );
    if (printing.length < 2) continue;
    if (stringList(item.answer_keys).some((key) => choosesPlace(key, entity))) continue;
    problems.push(
      problem(
        'invariant',
        `${LISTINGS_OF_TWO_RENTALS}: out/ledger.json item ${String(index)} is booked to a place from a statement that prints the listings of two staged rentals; leave its entity null and step 4 asks which rental it belongs to`,
      ),
    );
  }
  return problems;
}

/**
 * The upload-hint gate (issue #900, check 7 above): the staging writes a reading's `hint_entity`
 * from the document row, and SKILL.md step 3 books a hinted document's lines there unless the
 * document names another of the person's places, when they stay unassigned and step 4 asks. A
 * line from a hinted reading that carries some other entity is refused unless the person chose that
 * place: its `answer_keys` names a staged answer whose chosen option is a ledger `entity` effect
 * naming the line's entity, or an `entity_register` effect (a place the person registered for it).
 * A category answer, a typed answer or an answer about anything else exempts nothing. The source spelling is matched
 * the way the arming gate matches a batch token, by basename or basename minus one extension.
 * The importer's re-check runs this same function. The message names the item's index and the
 * reading's file, never an entity or a value.
 */
function hintEntityProblems(workspace: string): Problem[] {
  const hints = stagedHintsOf(workspace);
  if (hints.size === 0) return [];
  const choosesPlace = placeChoiceOf(workspace);
  const problems: Problem[] = [];
  for (const [index, raw] of listOf(loadJson(join(workspace, 'out', REQUIRED_LEDGER))).entries()) {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) continue;
    const item = raw as Json;
    const file = strOrNull(item.source_file);
    if (file === null) continue;
    const name = basename(file);
    const dot = name.lastIndexOf('.');
    const stem = hints.has(name) ? name : dot > 0 ? name.slice(0, dot) : name;
    const hint = hints.get(stem);
    if (hint === undefined) continue;
    const entity = item.entity;
    if (entity === null || entity === undefined || entity === hint) continue;
    if (stringList(item.answer_keys).some((key) => choosesPlace(key, entity))) continue;
    problems.push(
      problem(
        'invariant',
        `${HINT_ENTITY_MISMATCH}: out/ledger.json item ${String(index)} is booked from ` +
          `extractions/${stem}.json to a place other than the one the person uploaded it for; ` +
          'book it to that place, or leave its entity null and ask which place it belongs to',
      ),
    );
  }
  return problems;
}

/** The prefixes of the typed-reading gate's two problems (issue #1766). */
export const TYPED_READING_GATES = {
  total: 'typed_total_unmatched',
  unstated: 'typed_reading_unstated',
} as const;

interface TypedReading {
  /** The typed pages' totals in cents, or null when one is not a decimal. */
  readonly totalCents: bigint | null;
  /** A typed page leaves its vendor or its date not given. */
  readonly unstated: boolean;
}

/** The staged readings whose pages carry the code-built `typed_by_person`, by file stem. */
function stagedTypedReadingsOf(workspace: string): Map<string, TypedReading> {
  const typed = new Map<string, TypedReading>();
  const dir = join(workspace, 'extractions');
  if (!existsSync(dir)) return typed;
  for (const name of readdirSync(dir)) {
    if (!name.endsWith('.json')) continue;
    const pages = listOf(recordOf(loadJson(join(dir, name)))?.['pages'])
      .map(recordOf)
      .filter((page): page is Json => page !== null && page['typed_by_person'] === true);
    if (pages.length === 0) continue;
    let totalCents: bigint | null = 0n;
    let unstated = false;
    for (const page of pages) {
      const fields = recordOf(page['fields']);
      const total = strOrNull(fields?.['total']);
      const cents = total === null ? null : absoluteCents(total);
      totalCents = totalCents === null || cents === null ? null : totalCents + cents;
      if (strOrNull(fields?.['vendor_or_payer']) === null) unstated = true;
      if (strOrNull(fields?.['document_date']) === null) unstated = true;
    }
    typed.set(name.slice(0, -'.json'.length), { totalCents, unstated });
  }
  return typed;
}

/**
 * The typed-reading gate (issue #1766): a person's typed value is never silently changed. What
 * this run takes from a reading the person typed — its ledger lines, donations, home costs and the
 * tax payments it is the payment evidence of — nets, in cents, to the total they typed; and when they left its vendor or date not given, a `note` finding cites the document or
 * one of those lines for the accountant. A document this run books nothing from is not held. The importer's re-check runs
 * this same function over the rebuilt readings. The messages name the reading's file, never a
 * figure.
 */
function typedReadingProblems(workspace: string): Problem[] {
  const typed = stagedTypedReadingsOf(workspace);
  if (typed.size === 0) return [];
  // Signed, so a discount or refund line nets against the charge; the total is compared unsigned.
  const booked = new Map<string, { cents: bigint | null; ids: Set<string> }>();
  const take = (source: unknown, rawAmount: unknown, id: unknown): void => {
    const file = strOrNull(source);
    const stem = file === null ? null : stemOf(file);
    if (stem === null || !typed.has(stem)) return;
    const amount = strOrNull(rawAmount);
    const cents = amount === null ? null : readingTotalCents(amount);
    const prior = booked.get(stem) ?? { cents: 0n, ids: new Set<string>() };
    const lineId = strOrNull(id);
    if (lineId !== null) prior.ids.add(lineId);
    booked.set(stem, {
      cents: prior.cents === null || cents === null ? null : prior.cents + cents,
      ids: prior.ids,
    });
  };
  for (const [, item] of ledgerItemsOf(workspace)) take(item.source_file, item.amount, item.id);
  // The other files a document's figure is recorded in: a donation and a home cost by their
  // `source_file`, a tax payment by its payment evidence. A payment's `bill_source` gives only
  // the parcels' weights, so no amount is taken from the bill.
  const outEntries = (name: string): Json[] =>
    listOf(loadJson(join(workspace, 'out', name)))
      .map(recordOf)
      .filter((entry): entry is Json => entry !== null);
  for (const entry of outEntries(OPTIONAL_DONATIONS)) take(entry.source_file, entry.amount, null);
  for (const entry of outEntries(OPTIONAL_HOME_COSTS)) take(entry.source_file, entry.amount, null);
  for (const entry of outEntries(OPTIONAL_TAX_PAYMENTS)) {
    take(entry['payment_source'], entry.amount, null);
  }
  // A `note` only: another kind citing the line (a method comparison) says nothing of the gap.
  const cites = listOf(loadJson(join(workspace, 'out', 'findings.json')))
    .map(recordOf)
    .filter((finding) => finding?.['kind'] === 'note')
    .flatMap((finding) =>
      listOf(finding?.['cites']).filter((cite): cite is string => typeof cite === 'string'),
    );
  const problems: Problem[] = [];
  for (const [stem, lines] of booked) {
    const reading = typed.get(stem);
    if (reading === undefined) continue;
    const sum = lines.cents === null ? null : lines.cents < 0n ? -lines.cents : lines.cents;
    if (sum === null || sum !== reading.totalCents) {
      problems.push(
        problem(
          'invariant',
          `${TYPED_READING_GATES.total}: what this run takes from extractions/${stem}.json, which the person typed, across out/ledger.json, donations.json, home_costs.json and tax_payments.json, does not add up to the total they typed; record it as typed (staged-readings.md)`,
        ),
      );
    }
    const cited = cites.some((cite) => sameDocument(cite, stem) || lines.ids.has(cite));
    if (reading.unstated && !cited) {
      problems.push(
        problem(
          'invariant',
          `${TYPED_READING_GATES.unstated}: extractions/${stem}.json, which the person typed, gives no vendor or no date and no note finding cites it or its lines; write the note for the accountant (staged-readings.md)`,
        ),
      );
    }
  }
  return problems;
}

/**
 * Gate the outputs. `knownIds` is the incremental baseline when the caller already knows it — the
 * importer passes the workspace's `line_items.ledger_id`s from Postgres, the database being the
 * source of truth. The agent's own CLI run passes nothing and the checker reads
 * `confirmed/summaries.json` from the workspace. `rebuilt` is the personal tool importer's pairing
 * of a rebuild's answers with its lines, which holds the run to the answers that move them.
 */
export function checkOutputs(
  workspace: string,
  skillDir: string = join(__dirname, '..', '..'),
  knownIds?: readonly string[],
  rebuilt?: RebuiltAnswerLines,
): CheckResult {
  // Every rate and table comes from the staged year's rules directory; a profile.json naming no
  // year the skill carries is a staging fault, refused before any gate reads rules data.
  const rules = rulesYearOf(workspace, skillDir);
  if (!rules.ok) return { problems: [problem(rules.code, rules.message)] };
  const problems: Problem[] = [];
  for (const match of identifierProblems(workspace)) problems.push(match);
  for (const match of schemaProblems(join(workspace, 'out'))) problems.push(match);
  for (const match of profileProblems(workspace)) problems.push(match);
  for (const match of profileVehicleProblems(workspace, skillDir, rules)) problems.push(match);
  for (const match of profileHomeOfficeProblems(workspace, skillDir)) problems.push(match);
  for (const match of stagedAssetsCarriedProblems(workspace, skillDir)) problems.push(match);
  for (const match of assetKindProblems(workspace, skillDir)) problems.push(match);
  for (const match of profileFactsHonoured(workspace, skillDir)) problems.push(match);
  for (const match of coverageProblems(workspace)) problems.push(match);
  for (const match of inboxReferenceProblems(workspace)) problems.push(match);
  for (const match of sourceFileSpellingProblems(workspace)) problems.push(match);
  for (const match of questionProblems(workspace, skillDir, rules)) problems.push(match);
  for (const match of modelTextProblems(workspace, skillDir)) problems.push(match);
  for (const match of tripReferenceProblems(workspace)) problems.push(match);
  for (const match of tripGateProblems(workspace, answersOf(workspace))) problems.push(match);
  for (const match of ledgerLineTableProblems(workspace, rules)) problems.push(match);
  for (const match of hintEntityProblems(workspace)) problems.push(match);
  for (const match of typedReadingProblems(workspace)) problems.push(match);
  for (const match of twoRentalsStatementProblems(workspace, skillDir)) problems.push(match);
  for (const match of outsideYearFindingProblems(workspace)) problems.push(match);
  for (const match of settledChangeProblems(workspace, skillDir)) problems.push(match);
  for (const match of passThroughOwedProblems(workspace, skillDir)) problems.push(match);
  for (const match of waitingLinesUnaskedProblems(workspace, skillDir)) problems.push(match);
  for (const match of questionCitesMovedLineProblems(workspace, skillDir)) problems.push(match);
  for (const match of travelLinesUnaskedProblems(workspace, skillDir)) problems.push(match);
  for (const match of unpointedPlacementProblems(workspace)) problems.push(match);
  for (const match of answerUnappliedProblems(workspace, skillDir, rebuilt)) problems.push(match);
  for (const match of placedQuestionProblems(workspace, skillDir)) problems.push(match);
  const statementGate = statementGateResult(workspace, rules);
  for (const match of statementGate.problems) problems.push(match);
  for (const match of documentGateProblems(workspace, rules, statementGate.figures)) {
    problems.push(match);
  }
  for (const match of exportRowsProblems(workspace, skillDir, statementGate.figures)) {
    problems.push(match);
  }
  for (const match of taxPaymentsProblems(workspace, skillDir, rules)) problems.push(match);
  for (const match of homeCostsProblems(workspace, rules)) problems.push(match);
  for (const match of homeOfficeOpenItemProblems(workspace, skillDir)) problems.push(match);
  for (const match of purchaseLandValueProblems(workspace)) problems.push(match);
  for (const match of purchaseBasisReadingProblems(workspace, skillDir)) problems.push(match);
  for (const match of textAnswerArmProblems(workspace, skillDir)) problems.push(match);
  for (const match of typedPurchaseReaskedProblems(workspace, skillDir)) problems.push(match);
  for (const match of typedPlacementProblems(workspace)) problems.push(match);
  const rulesCovered = rulesIndex(rules.dir);
  for (const match of confirmedProblems(workspace)) problems.push(match);
  for (const match of incrementalLedgerProblems(workspace, knownIds)) problems.push(match);
  for (const match of assignedIdProblems(workspace, knownIds)) problems.push(match);
  for (const match of ledgerChangesProblems(workspace)) problems.push(match);
  for (const match of profileScheduleProblems(workspace)) problems.push(match);
  for (const match of unstagedEntityProblems(workspace)) problems.push(match);
  for (const match of scheduleMoveProblems(workspace, rules)) problems.push(match);
  for (const match of webValuesProblems(workspace, rules.dir, rulesCovered)) problems.push(match);
  // Last, so a NUL a gate above already names (a question prompt, as schema) keeps its code first.
  for (const match of nulProblems(workspace)) problems.push(match);
  return {
    problems,
    notices: statementGate.notices,
  };
}

function main(argv: string[]): void {
  const workspace = argv[0];
  if (workspace === undefined) throw new Error('usage: check_outputs.js <workspace>');
  const skillDir = join(__dirname, '..', '..');
  const { problems } = checkOutputs(workspace, skillDir);
  if (problems.length > 0) {
    console.log('check_outputs failed; fix the named files and run again:');
    for (const match of problems) console.log(`  [${match.code}] ${match.message}`);
    process.exitCode = 1;
    return;
  }
  console.log('check_outputs: identifiers, schema, coverage and contract gates clean');
}

if (require.main === module) {
  main(process.argv.slice(2));
}

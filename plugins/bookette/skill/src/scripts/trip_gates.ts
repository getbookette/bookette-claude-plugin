/**
 * The trip gates of step 8 (issue #1068, decision record 0132): a run records the trips its
 * documents show into `out/profile.resolved.json` by default, and these gates are what keeps a
 * recorded trip a fact the documents carry rather than one the model chose.
 *
 * A resolved trip is the run's own record when profile.json does not stage its key and no
 * confirmed answer adds it (a `trip_register` add, or a trip a confirmed found place carries,
 * matched by place and segments as the code-applied moves match them). Such a trip:
 *
 * - sits under a place profile.json stages (a found place's trip rides its `entity_register`
 *   option's `trips` instead, and a trip no document places a `placement` question's options,
 *   each landing in the run that applies the answer);
 * - carries no purpose, unless the person's note for the trip's place or the year states it word
 *   for word, as one phrase of one note (the notes win), or its one purpose suggestion is an
 *   event's, whose name it then carries (task 37.8);
 * - names the documents it was read from (`documents`, this batch's) and why it sits under its
 *   place (`placed_by`), and every segment's first and last day is a day one of those documents
 *   prints: an ISO day in its out/documents.json `fields`, or the date of a line booked from it;
 * - ties only lines dated inside its segments;
 * - overlaps no other trip's days, and none a person's "Not a trip" answer took off the books;
 * - is listed for the accountant by a `trip_purpose_not_stated` finding while it has no purpose;
 * - may carry at most MAX_PURPOSE_SUGGESTIONS `purpose_suggestions` while it has no purpose (or
 *   the one event's name it carries), each `{text, document}` citing one of its own `documents` as
 *   that list spells it (issue #1195), an event's marked `event: true`, its text the event a page
 *   of that document's reading names (`other.event`, task 41.2): no other trip carries one;
 * - carries `travel: "flew"` only when one of its `documents` is an `airline_receipt`, and no other
 *   Trip log fact (task 37.8).
 *
 * On a run staged without `confirmed/` (a first run, or the personal tool's rebuild of the year,
 * decision record 0134) the run's findings replace the state's, so a staged trip and a trip the
 * person's own answer adds are listed by that finding too while they have no purpose.
 *
 * A trip the run records may also name documents an earlier run read (the confirmed digest's),
 * so a trip left unrecorded because no staged place took it is recorded once the person declares
 * the place; `placed_by: city` holds only where exactly one staged place's address is in a stop's
 * city, the city out/places.json gives it where profile.json's address prints it (task 41.2).
 *
 * Every trip: at most MAX_SEGMENTS segments, none sharing a day with another of the same trip,
 * every day inside the workspace's tax year (Abacus counts each segment day, so an overlap or a
 * day of another year would count a day twice or count a day these books do not keep). A staged
 * trip is carried as staged — its name, place, purpose, segments and Trip log facts (`travel`,
 * `vehicle`, `miles`, `personal_days`, `no_cost`) — unless the person's `trip_edit` answer for
 * its key changes them, or the person's note states the purpose of a trip staged with none: the
 * run never rewrites the person's register. The facts pass the shared `validateTripFacts`, a
 * vehicle is a staged one, and only the person's answer states them: a trip the run records
 * carries none but a flight from its ticket, and an answer's add carries exactly its answer's
 * (`trip_facts_invalid`).
 *
 * A trip the person declared (profile.json stages it, or their `trip_edit` answer adds it) covers
 * its days: a travel line of this batch on its place dated inside them ties a trip, a row printing
 * no city included, unless its staged reading prints an address in none of the trip's cities or
 * another trip lists its document (`trip_declared_days_untied`). A trip's `missing_receipt`
 * finding carries its closed `gap` word, never one the trip's `no_cost` lists, and a drive whose
 * miles are not stated takes one `mileage` finding, which a drive by own car must carry
 * (`trip_finding_gap`, `trip_miles_finding`; task 37.8).
 *
 * Beside them: a removed trip stays off the profile and a moved trip sits under the place its
 * answer names; a found place's trips are recorded under the place the confirmed answer gives its
 * lines (its register option, or an option placing them with a staged place) and come back on no
 * day a "Not a trip" answer removed; the trips a question's option carries are dated by this
 * batch's documents, ride only a found place's `register` question or a `placement` question
 * (issue #1563: a trip no document places is asked), the same trips on every option that places
 * the lines — but a trip dated only by card or bank rows, which each away place's option carries
 * to that place's city (decision record 0168) — on no day a recorded trip covers, and never on a
 * placed question, which no answer lands; a stop abroad within a week before a trip the run
 * writes is a segment of it, never a trip or an untied line of its own; and a travel home the run adds where profile.json stages none is named by a
 * `note` finding citing at least two distinct documents whose readings print its city, while a
 * staged home is never rewritten; on a run staged without `confirmed/`, a staged home an earlier
 * run read (`home_origin: "documents"`) is carried and named by that note again. Every message
 * names a key, an index or a rule, never a value.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';

import {
  TRIP_TRAVEL_LINES,
  answeredTrips,
  optionEffectOf,
  profileTripsOf,
  tripOfAnswer,
} from '../code-applied';
import type { AnsweredTrip, CodeAppliedTrip, StagedAnswer } from '../code-applied';
import { dayOrdinal, isValidDay, ordinalToDay } from '../dates';
import { placesFileOf, stagedKeyAliases } from '../place-addresses';
import { printedFieldsOf, type ReadingAddress, readingAddressesOf } from '../reading-addresses';
import { addressInCity, citedAddresses, printsCityName, stopCityOf } from '../stop-city';
import { quotedIn, verbatimFold } from '../verbatim-quote';
import {
  TRIP_GAP_WORDS,
  TRIP_NO_COST_GAPS,
  TRIP_PLACED_BY,
  TRIP_TRAVEL_WORDS,
  parseEffect,
} from '../effects';
import type { FoundPlaceTrip, TripSegmentInput } from '../effects';
import { MAX_SEGMENTS, validateTripFacts, validateTripSegments } from '../trip-facts';
import type { TripFactsCode, TripSegmentProblem } from '../trip-facts';
import type { Problem } from './check_outputs';

type Json = Record<string, unknown>;

/** The typed prefixes of the trip gates, so a reader of the problems can find each. */
export const TRIP_GATES = {
  place: 'trip_recorded_place',
  purpose: 'trip_recorded_purpose',
  documents: 'trip_recorded_documents',
  placedBy: 'trip_recorded_placed_by',
  undated: 'trip_recorded_undated',
  tiedOutside: 'trip_line_outside_days',
  overlap: 'trip_overlaps_trip',
  removedAgain: 'trip_removed_proposed',
  purposeFinding: 'trip_purpose_finding',
  removedKept: 'trip_removed_kept',
  placeNotMoved: 'trip_place_not_moved',
  foundTripMissing: 'trip_found_place_missing',
  foundTripUndated: 'trip_found_place_undated',
  stagedRewritten: 'trip_staged_rewritten',
  answeredRewritten: 'trip_answered_rewritten',
  carriedOutsideRegister: 'trip_carried_off_register',
  carriedUnevenly: 'trip_carried_unevenly',
  carriedPlaced: 'trip_carried_placed',
  businessUnrecommended: 'trip_business_unrecommended',
  itinerarySplit: 'trip_itinerary_split',
  segments: 'trip_segments_invalid',
  facts: 'trip_facts_invalid',
  cityPlacement: 'trip_placed_by_city',
  suggestions: 'trip_purpose_suggestions',
  declaredUntied: 'trip_declared_days_untied',
  attachTargetMismatch: 'attach_target_mismatch',
  gap: 'trip_finding_gap',
  milesFinding: 'trip_miles_finding',
  home: 'travel_home',
} as const;

/** The profile kinds of a property, the kinds a declared address and a listing belong on. */
export const PROPERTY_PROFILE_KINDS: ReadonlySet<string> = new Set([
  'residential_rental',
  'commercial_rental',
  'short_term_rental',
]);

/** The `open_` keys whose options may carry trips: a found place's `register` question and a
 *  `placement` question, follow-ups included (issue #1563). */
const TRIP_CARRIER_KEY = /^open_[a-z0-9_]+_(placement|register)(_[1-9][0-9]*)?$/;

/** The most purpose suggestions one recorded trip carries (issue #1195). */
export const MAX_PURPOSE_SUGGESTIONS = 2;

/** The longest suggestion text: a few words, the picker's option label. */
export const MAX_PURPOSE_SUGGESTION_CHARS = 120;

/** The segment cap, defined once with the shared segment rules (`../trip-facts`). */
export { MAX_SEGMENTS };

export const TRIP_PURPOSE_NOT_STATED = 'trip_purpose_not_stated';

const ISO_DAY = /\d{4}-\d{2}-\d{2}/g;

function loadJson(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

function record(value: unknown): Json | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Json)
    : null;
}

function records(value: unknown): Json[] {
  return Array.isArray(value)
    ? value.map(record).filter((entry): entry is Json => entry !== null)
    : [];
}

function str(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string')
    : [];
}

function problem(message: string): Problem {
  return { code: 'invariant', message };
}

/** A document reference as the batch names it: an inbox file by basename, a staged reading by
 *  its stem, either spelling matching (the arming gate's rule). */
function documentToken(reference: string): string[] {
  const name = basename(reference);
  const dot = name.lastIndexOf('.');
  return dot > 0 ? [name, name.slice(0, dot)] : [name];
}

function sameDocument(left: string, right: string): boolean {
  const mine = new Set(documentToken(left));
  return documentToken(right).some((token) => mine.has(token));
}

/** This batch's document tokens: the inbox files and the staged readings' stems. */
function batchNames(workspace: string): Set<string> {
  const names = new Set<string>();
  const inbox = join(workspace, 'inbox');
  if (existsSync(inbox)) for (const name of readdirSync(inbox)) names.add(name);
  const extractions = join(workspace, 'extractions');
  if (existsSync(extractions)) {
    for (const name of readdirSync(extractions)) {
      if (name.endsWith('.json')) names.add(name.slice(0, -'.json'.length));
    }
  }
  return names;
}

/** Every ISO day a value carries, at any depth: a field may print a day inside a longer string
 *  ("2026-07-10 to 2026-07-12"), and a reading's `other` nests the stay's and the legs' days. */
function daysIn(value: unknown, out: Set<string>): void {
  if (typeof value === 'string') {
    for (const match of value.matchAll(ISO_DAY)) if (isValidDay(match[0])) out.add(match[0]);
  } else if (Array.isArray(value)) {
    for (const item of value) daysIn(item, out);
  } else if (record(value) !== null) {
    for (const inner of Object.values(value as Json)) daysIn(inner, out);
  }
}

/** The days a set of documents prints: the ISO days of their out/documents.json `fields`, and the
 *  dates of this run's lines booked from them. */
function printedDays(
  documents: readonly string[],
  entries: readonly Json[],
  ledger: readonly Json[],
) {
  // `ledger` is this run's lines and, for a recorded trip, the confirmed digest's items too.
  const days = new Set<string>();
  for (const entry of entries) {
    const file = str(entry['file']);
    if (file !== null && documents.some((document) => sameDocument(document, file))) {
      daysIn(entry['fields'], days);
    }
  }
  for (const item of ledger) {
    const source = str(item['source_file']);
    const date = str(item['date']);
    if (source === null || date === null) continue;
    if (documents.some((document) => sameDocument(document, source))) days.add(date);
  }
  return days;
}

function words(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word !== '');
}

/** Whether a purpose is the person's own words: its words, in order and contiguous, in the
 *  note for the trip's place or in the year's note, so a phrase assembled from words scattered
 *  over a note is not one (case and punctuation aside). */
function noteStates(notes: Json | null, entity: string | null, purpose: string): boolean {
  const wanted = words(purpose);
  if (wanted.length === 0) return false;
  const year = str(notes?.['year']);
  const own = entity === null ? null : str(record(notes?.['entities'])?.[entity]);
  return [year, own].some((note) => {
    if (note === null) return false;
    const have = words(note);
    for (let start = 0; start + wanted.length <= have.length; start += 1) {
      if (wanted.every((word, offset) => have[start + offset] === word)) return true;
    }
    return false;
  });
}

function segmentsOf(trip: Json): TripSegmentInput[] {
  return records(trip['segments']).flatMap((segment) => {
    const location = str(segment['location']);
    const start = str(segment['start']);
    const end = str(segment['end']);
    return location !== null && start !== null && end !== null ? [{ location, start, end }] : [];
  });
}

function overlaps(left: readonly TripSegmentInput[], right: readonly TripSegmentInput[]): boolean {
  return left.some((mine) =>
    right.some((other) => mine.start <= other.end && other.start <= mine.end),
  );
}

/** Whether two segment lists are the same stops, in any order: a run that writes the staged
 *  segments in another order has not changed the trip. */
function sameSegments(left: readonly TripSegmentInput[], right: readonly TripSegmentInput[]) {
  const spelled = (segments: readonly TripSegmentInput[]): string[] =>
    segments
      .map((segment) => JSON.stringify([segment.start, segment.end, segment.location]))
      .sort();
  const mine = spelled(left);
  const theirs = spelled(right);
  return mine.length === theirs.length && mine.every((segment, index) => segment === theirs[index]);
}

/** The problems of one trip's segments, whoever wrote them, worded from the shared rules' codes
 *  (`validateTripSegments`): too many, a day that is no calendar day, an end before its start, a
 *  day outside the tax year, or two sharing a day. `name` names the entry, never a value. */
function segmentProblems(
  name: string,
  segments: readonly TripSegmentInput[],
  taxYear: number | null,
): Problem[] {
  return validateTripSegments(segments, taxYear).map((found) =>
    problem(`${TRIP_GATES.segments}: ${segmentSentence(name, found)}`),
  );
}

function segmentSentence(name: string, found: TripSegmentProblem): string {
  const segment = `${name} segment ${String(found.index ?? 0)}`;
  switch (found.code) {
    case 'too_many':
      return `${name} carries more than ${String(MAX_SEGMENTS)} segments; one segment per stop`;
    case 'no_locality':
      return `${segment} has a location with no locality before its last comma`;
    case 'malformed_day':
      return `${segment} has a day that is not a YYYY-MM-DD calendar day`;
    case 'end_before_start':
      return `${segment} ends before it starts`;
    case 'outside_year':
      return `${segment} has a day outside the tax year; a trip crossing the year's edge is recorded up to December 31 or from January 1`;
    case 'shared_day':
      return `${name} has two segments sharing a day; a day belongs to one stop (a leg landing the day it leaves starts the next stop's segment, and the earlier one ends the day before)`;
  }
}

function dayBefore(day: string): string {
  return ordinalToDay(dayOrdinal(day) - 1);
}

function dayAfter(day: string): string {
  return ordinalToDay(dayOrdinal(day) + 1);
}

/** The stay's own days a set of documents prints: a folio's arrival and departure and a ticket's
 *  leg days (`other.arrival`, `other.departure`, `other.legs[].date` in out/documents.json). */
function stayDays(documents: readonly string[], entries: readonly Json[]): Set<string> {
  const days = new Set<string>();
  for (const entry of entries) {
    const file = str(entry['file']);
    if (file === null || !documents.some((document) => sameDocument(document, file))) continue;
    const other = record(record(entry['fields'])?.['other']);
    daysIn(other?.['arrival'], days);
    daysIn(other?.['departure'], days);
    for (const leg of records(other?.['legs'])) daysIn(leg['date'], days);
  }
  return days;
}

/** How far across a year's edge a printed day may lie and still continue the stay over it. */
const EDGE_WINDOW_DAYS = 7;

/** Whether every segment's first and last day is dated: a day its documents print; the day before
 *  the next segment's dated start (the leg left and landed that day); or the tax year's edge,
 *  where the stay crosses it — a day printed within a week across the edge, the stay's own
 *  arrival or departure (or a ticket's leg) across it, or the segment's other end printed beside
 *  the edge. A day of another year that only dates the booking (an e-ticket's issue date) dates
 *  nothing across the edge. */
function segmentsDated(
  segments: readonly TripSegmentInput[],
  days: ReadonlySet<string>,
  taxYear: number | null,
  stay: ReadonlySet<string> = new Set(),
): boolean[] {
  const first = taxYear === null ? null : `${String(taxYear)}-01-01`;
  const last = taxYear === null ? null : `${String(taxYear)}-12-31`;
  const printsBefore =
    first !== null &&
    ([...days].some(
      (day) => day < first && dayOrdinal(first) - dayOrdinal(day) <= EDGE_WINDOW_DAYS,
    ) ||
      [...stay].some((day) => day < first));
  const printsAfter =
    last !== null &&
    ([...days].some(
      (day) => day > last && dayOrdinal(day) - dayOrdinal(last) <= EDGE_WINDOW_DAYS,
    ) ||
      [...stay].some((day) => day > last));
  return segments.map((segment) => {
    const startDated =
      days.has(segment.start) ||
      (segment.start === first &&
        (printsBefore ||
          (days.has(segment.end) && dayOrdinal(segment.end) - dayOrdinal(first) <= 1))) ||
      segments.some((other) => other.end === dayBefore(segment.start) && days.has(other.end));
    const endDated =
      days.has(segment.end) ||
      (segment.end === last &&
        (printsAfter ||
          (days.has(segment.start) && dayOrdinal(last) - dayOrdinal(segment.start) <= 1))) ||
      segments.some((other) => other.start === dayAfter(segment.end) && days.has(other.start));
    return startDated && endDated;
  });
}

/** The staged answers' trip edits: removals with the segments they removed, place moves, and the
 *  edits (by trip key) whose name, purpose and segments a staged trip takes. */
function tripEdits(answers: ReadonlyMap<string, StagedAnswer>) {
  const removed: { tripKey: string; segments: readonly TripSegmentInput[] }[] = [];
  const moved = new Map<string, string>();
  const edited = new Map<
    string,
    {
      segments: readonly TripSegmentInput[];
      name?: string;
      purpose?: string | null;
      facts: Partial<TripLogFacts>;
    }
  >();
  for (const staged of answers.values()) {
    const effect = parseEffect(optionEffectOf(staged));
    if (effect === null || effect.kind !== 'trip_register' || effect.tripKey === undefined) {
      continue;
    }
    if (effect.remove === true) {
      removed.push({ tripKey: effect.tripKey, segments: effect.segments });
      continue;
    }
    if (effect.entityKey !== undefined) moved.set(effect.tripKey, effect.entityKey);
    edited.set(effect.tripKey, {
      segments: effect.segments,
      ...(effect.name !== undefined ? { name: effect.name } : {}),
      ...(effect.purpose !== undefined ? { purpose: effect.purpose } : {}),
      facts: answeredFacts(effect),
    });
  }
  return { removed, moved, edited };
}

/** Where a resolved trip comes from: profile.json stages it, the person's answer adds it, a
 *  confirmed found place carries it, or the run records it from the documents. */
type TripOrigin = 'staged' | 'person' | 'found' | 'recorded';

/** A trip's Trip log facts as the profile spells them (`travel`, `vehicle`, `miles`,
 *  `personal_days`, `no_cost`), compared and validated with absent read as null (none). */
interface TripLogFacts {
  readonly travel: unknown;
  readonly vehicleKey: unknown;
  readonly miles: unknown;
  readonly personalDays: unknown;
  readonly noCost: unknown;
}

const NO_FACTS: TripLogFacts = {
  travel: null,
  vehicleKey: null,
  miles: null,
  personalDays: null,
  noCost: null,
};

function profileFacts(trip: Json): TripLogFacts {
  const of = (field: string): unknown => trip[field] ?? null;
  return {
    travel: of('travel'),
    vehicleKey: of('vehicle'),
    miles: of('miles'),
    personalDays: of('personal_days'),
    noCost: of('no_cost'),
  };
}

/** The facts an answer states, each only when it carries the field (null clears it). */
function answeredFacts(answer: AnsweredTrip): Partial<TripLogFacts> {
  return {
    ...(answer.travel !== undefined ? { travel: answer.travel } : {}),
    ...(answer.vehicleKey !== undefined ? { vehicleKey: answer.vehicleKey } : {}),
    ...(answer.miles !== undefined ? { miles: answer.miles } : {}),
    ...(answer.personalDays !== undefined ? { personalDays: answer.personalDays } : {}),
    ...(answer.noCost !== undefined ? { noCost: answer.noCost } : {}),
  };
}

function sameFacts(left: TripLogFacts, right: TripLogFacts): boolean {
  return JSON.stringify(left) === JSON.stringify({ ...NO_FACTS, ...right });
}

const FACT_SENTENCES: Readonly<Record<TripFactsCode, string>> = {
  travel_unknown: `field travel must be one of ${TRIP_TRAVEL_WORDS.join(', ')}, or absent`,
  flew_not_recorded:
    'carries travel flew, which only a trip already recorded as a flight from its ticket carries, or a trip the run records with an airline_receipt among its documents',
  vehicle_malformed: 'field vehicle must be a veh_<id> key',
  vehicle_without_own_car: 'carries a vehicle on a trip not travelled by own car',
  miles_malformed: 'field miles must be a whole number from 1 to 99999',
  miles_without_own_car: 'carries miles on a trip not travelled by own car',
  personal_days_malformed: 'field personal_days must be a list of YYYY-MM-DD days',
  personal_day_outside: 'carries a personal day on no day of its segments',
  personal_days_unsorted: 'carries personal days out of order or twice',
  no_cost_unknown: `field no_cost must list only ${TRIP_NO_COST_GAPS.join(', ')}`,
  no_cost_repeated: 'carries a no_cost word twice',
};

/** Which confirmed answer adds a resolved trip, by place and segments (the code-applied moves'
 *  own match): the person's `trip_register` add, or a trip a found place's option carries; null
 *  when none does. */
function answerAdds(
  trip: CodeAppliedTrip,
  answers: ReadonlyMap<string, StagedAnswer>,
): AnsweredTrip | null {
  for (const staged of answers.values()) {
    for (const added of answeredTrips(staged)) {
      if (added.tripKey !== undefined) continue;
      if (tripOfAnswer(added, [trip]) !== null) return added;
    }
  }
  return null;
}

/** A purpose as compared: absent, null and blank are all "none". */
function purposeOf(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

/**
 * A trip's event default (task 37.8): the name its purpose suggestions give when every one is an
 * event's (`event: true`) and they all carry one text (a registration and a badge of one event),
 * the purpose a trip the run records then carries; null otherwise, two that differ included, which
 * leave the purpose to the person's pick.
 */
function eventDefaultOf(trip: Json): string | null {
  const raw = trip['purpose_suggestions'];
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const texts = raw.map((entry) => {
    const suggestion = record(entry);
    const text = str(suggestion?.['text']);
    return suggestion?.['event'] === true && text !== null && text.trim() !== '' ? text : null;
  });
  const [first] = texts;
  return first !== null && first !== undefined && texts.every((text) => text === first)
    ? first
    : null;
}

/**
 * A trip's `purpose_suggestions` (issue #1195): what the run read the trip may have been for, each
 * grounded in one document of the trip. Only a trip the run records carries them, only while it
 * has no purpose but its event default (`eventDefaultOf`), at most MAX_PURPOSE_SUGGESTIONS, each
 * exactly `{text, document}` (an event's with `event: true` too, its text printed in its
 * document's reading) with a non-blank text of at most MAX_PURPOSE_SUGGESTION_CHARS characters and
 * a `document` among the trip's own `documents`. The text's identifier, URL and money scans sit
 * with the profile's other scans in check_outputs, and its policy scan with the resolved profile's
 * wording walk.
 */
function suggestionProblems(
  name: string,
  trip: Json,
  recorded: boolean,
  purposeStated: boolean,
  sources: readonly string[],
  documents: readonly Json[],
  readingOf: (document: string) => StagedReading | null,
): Problem[] {
  const raw = trip['purpose_suggestions'];
  // Absent and an explicit null both say none, the profile's convention for a field.
  if (raw === undefined || raw === null) return [];
  const say = (rule: string): Problem => problem(`${TRIP_GATES.suggestions}: ${name} ${rule}`);
  if (!Array.isArray(raw)) return [say('field purpose_suggestions must be a list')];
  if (raw.length === 0) return [];
  const out: Problem[] = [];
  if (!recorded) {
    out.push(
      say(
        'carries purpose_suggestions, which only a trip the run records from its documents carries; leave them off a staged trip and a trip an answer adds',
      ),
    );
  }
  const eventDefault = eventDefaultOf(trip);
  if (purposeStated && (eventDefault === null || purposeOf(trip['purpose']) !== eventDefault)) {
    out.push(
      say(
        "carries a purpose and purpose_suggestions; a trip with a purpose carries none but the one event's whose name it carries",
      ),
    );
  }
  if (raw.length > MAX_PURPOSE_SUGGESTIONS) {
    out.push(
      say(
        `carries more than ${String(MAX_PURPOSE_SUGGESTIONS)} purpose_suggestions; keep the ones its documents ground best`,
      ),
    );
  }
  for (const [index, entry] of raw.entries()) {
    const at = `purpose_suggestions entry ${String(index)}`;
    const suggestion = record(entry);
    if (suggestion === null) {
      out.push(say(`${at} must be an object {text, document}`));
      continue;
    }
    const extra = Object.keys(suggestion).filter(
      (key) => key !== 'text' && key !== 'document' && key !== 'event',
    );
    const text = str(suggestion['text']);
    const event = suggestion['event'];
    if (extra.length > 0 || text === null || text.trim() === '') {
      out.push(say(`${at} must be exactly {text, document} with a non-empty text`));
    } else if (event !== undefined && event !== true) {
      out.push(say(`${at} field event must be true on an event's suggestion, or absent`));
    } else if (text.length > MAX_PURPOSE_SUGGESTION_CHARS) {
      out.push(
        say(
          `${at} text is longer than ${String(MAX_PURPOSE_SUGGESTION_CHARS)} characters; a suggestion is a few words`,
        ),
      );
    }
    const document = str(suggestion['document']);
    const cited =
      document === null
        ? undefined
        : documents.find((entry) => {
            const file = str(entry['file']);
            return file !== null && sameDocument(file, document);
          });
    // An event's name is the one the reader wrote for its registration, badge or ticket.
    if (
      event === true &&
      text !== null &&
      (document === null || !eventNamed(text, readingOf(document), cited))
    ) {
      out.push(
        say(
          `${at} is an event's, but no page of its document's reading names an event of that text; mark event only where the reading's other.event names the event, its text that name exactly`,
        ),
      );
    }
    if (document === null || !sources.includes(document)) {
      out.push(
        say(
          `${at} must cite in document one of the trip's own documents, spelled as its documents list spells it: the one whose reading names the activity or the counterparty`,
        ),
      );
    }
  }
  return out;
}

/** The trips gates over a workspace; `answers` is the staged answers.json, as check_outputs read it. */
export function tripGateProblems(
  workspace: string,
  answers: ReadonlyMap<string, StagedAnswer>,
): Problem[] {
  const out = join(workspace, 'out');
  const resolved = record(loadJson(join(out, 'profile.resolved.json')));
  if (resolved === null) return []; // the schema gate reports the missing or malformed object
  const staged = record(loadJson(join(workspace, 'profile.json')));
  const stagedTrips = new Set(
    records(staged?.['trips'])
      .map((trip) => str(trip['key']))
      .filter((key): key is string => key !== null),
  );
  // The staged vehicles, the only ones a trip's `vehicle` may name.
  const stagedVehicles = new Set(
    records(staged?.['vehicles'])
      .map((vehicle) => str(vehicle['key']))
      .filter((key): key is string => key !== null),
  );
  // A staged place, by key or, for an entry the run keys its own way, by the name it stages.
  const stagedEntities = new Set(
    records(staged?.['entities'])
      .map((entity) => str(entity['key']))
      .filter((key): key is string => key !== null),
  );
  const stagedNames = new Set(
    records(staged?.['entities'])
      .map((entity) => str(entity['name']))
      .filter((name): name is string => name !== null),
  );
  const resolvedEntityNames = new Map<string, string>();
  for (const entity of records(resolved['entities'])) {
    const key = str(entity['key']);
    const name = str(entity['name']);
    if (key !== null && name !== null) resolvedEntityNames.set(key, name);
    if (key !== null && name !== null && stagedNames.has(name)) stagedEntities.add(key);
  }
  const stagedEntityNames = new Map(
    records(staged?.['entities']).flatMap((entity) => {
      const key = str(entity['key']);
      const name = str(entity['name']);
      return key === null || name === null ? [] : [[key, name] as const];
    }),
  );
  const notes = record(loadJson(join(workspace, 'notes.json')));
  const ledger = records(loadJson(join(out, 'ledger.json')));
  const digestItems = records(
    record(loadJson(join(workspace, 'confirmed', 'summaries.json')))?.['items'],
  );
  // A document an earlier run read: the source of a confirmed line.
  const digestSources = new Set(
    digestItems
      .map((item) => str(item['source_file']))
      .filter((source): source is string => source !== null)
      .flatMap(documentToken),
  );
  const taxYearRaw = resolved['tax_year'] ?? staged?.['tax_year'];
  const taxYear =
    typeof taxYearRaw === 'number' && Number.isInteger(taxYearRaw) ? taxYearRaw : null;
  const stagedById = new Map(
    records(staged?.['trips']).flatMap((trip) => {
      const key = str(trip['key']);
      return key === null ? [] : [[key, trip] as const];
    }),
  );
  const placeAddresses = placeAddressesOf(workspace, records(staged?.['entities']));
  const documents = records(loadJson(join(out, 'documents.json')));
  const findings = records(loadJson(join(out, 'findings.json')));
  // The staged readings, read once each: the run never writes them.
  const readings = new Map<string, StagedReading | null>();
  const readingOf = (document: string): StagedReading | null => {
    const stem = documentToken(document).at(-1) ?? document;
    if (!readings.has(stem)) readings.set(stem, stagedReadingOf(workspace, document));
    return readings.get(stem) ?? null;
  };
  const batch = batchNames(workspace);
  const inBatch = (reference: string): boolean =>
    documentToken(reference).some((token) => batch.has(token));
  const { removed, moved, edited } = tripEdits(answers);
  // A first run, or a rebuild of the year: nothing confirmed is staged, so this run's findings are
  // the whole list the accountant reads.
  const rebuild = !existsSync(join(workspace, 'confirmed'));
  const problems: Problem[] = [];

  const trips = records(resolved['trips']);
  const parsed = profileTripsOf(resolved);
  const purposeFindingCites = new Set(
    findings
      .filter((finding) => finding['kind'] === TRIP_PURPOSE_NOT_STATED)
      .flatMap((finding) => strings(finding['cites']))
      .filter((cite) => cite.startsWith('trip:'))
      .map((cite) => cite.slice('trip:'.length)),
  );

  // A trip is the run's own record unless profile.json stages it or a confirmed answer adds it.
  const addedBy = trips.map((trip): AnsweredTrip | null => {
    const key = str(trip['key']);
    if (key !== null && stagedTrips.has(key)) return null;
    const own = parsed.find((candidate) => candidate.key === key);
    return own === undefined ? null : answerAdds(own, answers);
  });
  const origins = trips.map((trip, index): TripOrigin => {
    const key = str(trip['key']);
    if (key !== null && stagedTrips.has(key)) return 'staged';
    const added = addedBy[index];
    if (added === null || added === undefined) return 'recorded';
    return added.foundPlace === true ? 'found' : 'person';
  });
  const recordedFlags = origins.map((origin) => origin === 'recorded');

  for (const [index, trip] of trips.entries()) {
    const name = `profile.resolved.json trip entry ${String(index)}`;
    const key = str(trip['key']);
    const entity = str(trip['entity']);
    const segments = segmentsOf(trip);
    const purpose = trip['purpose'];
    const purposeStated = typeof purpose === 'string' && purpose.trim() !== '';
    problems.push(...segmentProblems(name, segments, taxYear));

    // The Trip log's facts (task 37.8): sound by the shared rules, a flight only where the staged
    // trip already carries one or, on a trip the run records, where an airline receipt is among
    // its documents, and a vehicle only a staged one.
    const facts = profileFacts(trip);
    const stagedTrip = key === null ? undefined : stagedById.get(key);
    const flightTravel =
      origins[index] === 'recorded'
        ? ticketed(strings(trip['documents']), documents, readingOf)
          ? 'flew'
          : null
        : stagedTrip === undefined
          ? null
          : str(stagedTrip['travel']);
    for (const code of validateTripFacts(facts, segments, flightTravel)) {
      problems.push(problem(`${TRIP_GATES.facts}: ${name} ${FACT_SENTENCES[code]}`));
    }
    if (typeof facts.vehicleKey === 'string' && !stagedVehicles.has(facts.vehicleKey)) {
      problems.push(
        problem(
          `${TRIP_GATES.facts}: ${name} field vehicle names no vehicle profile.json stages; name a staged veh_<id> key`,
        ),
      );
    }
    // A trip the run records carries no fact but the flight its ticket shows (checked above).
    if (
      origins[index] === 'recorded' &&
      !sameFacts({ ...facts, travel: facts.travel === 'flew' ? null : facts.travel }, NO_FACTS)
    ) {
      problems.push(
        problem(
          `${TRIP_GATES.facts}: ${name} is a trip the run records and carries a travel word other than flew, or vehicle, miles, personal_days or no_cost; only the person's trip_edit answer states them, so leave them off (a recorded trip carries travel flew only when an airline_receipt is among its documents)`,
        ),
      );
    }

    // The person's register: a staged trip is carried as staged unless their own answer for its
    // key, or their note for a trip staged with no purpose, changes it.
    if (stagedTrip !== undefined && key !== null) {
      const edit = edited.get(key);
      const wantFacts: TripLogFacts = { ...profileFacts(stagedTrip), ...edit?.facts };
      const stagedName = str(stagedTrip['name']) ?? key;
      const stagedPurpose = purposeOf(stagedTrip['purpose']);
      const wantSegments = edit?.segments ?? segmentsOf(stagedTrip);
      const wantName = edit?.name ?? stagedName;
      const wantPurpose = edit?.purpose !== undefined ? purposeOf(edit.purpose) : stagedPurpose;
      const havePurpose = purposeOf(purpose);
      const purposeKept =
        havePurpose === wantPurpose ||
        (wantPurpose === null && havePurpose !== null && noteStates(notes, entity, havePurpose));
      // The same place under the run's own key for it counts as kept (a resolved entry named as
      // the staged one is, the way the place gate takes it).
      const stagedEntity = str(stagedTrip['entity']);
      const entityKept =
        moved.has(key) ||
        entity === stagedEntity ||
        (entity !== null &&
          stagedEntity !== null &&
          resolvedEntityNames.get(entity) !== undefined &&
          resolvedEntityNames.get(entity) === stagedEntityNames.get(stagedEntity));
      if (
        !sameSegments(segments, wantSegments) ||
        (str(trip['name']) ?? key) !== wantName ||
        !purposeKept ||
        !entityKept ||
        !sameFacts(facts, wantFacts)
      ) {
        problems.push(
          problem(
            `${TRIP_GATES.stagedRewritten}: ${name} is a trip profile.json stages; carry its name, place, purpose, segments, travel, vehicle, miles, personal_days and no_cost as staged, changed only by the person's trip_edit answer for its key (or a purpose their note states for a trip staged with none)`,
          ),
        );
      }
    }

    // A person's "Not a trip" takes a trip off the books, and "Change place" moves it.
    if (key !== null && removed.some((edit) => edit.tripKey === key)) {
      problems.push(
        problem(
          `${TRIP_GATES.removedKept}: ${name} is a trip the person took off the books ("Not a trip"); leave it out of the profile`,
        ),
      );
    }
    const target = key === null ? undefined : moved.get(key);
    if (target !== undefined && entity !== target) {
      problems.push(
        problem(
          `${TRIP_GATES.placeNotMoved}: ${name} is a trip the person moved to another place ("Change place"); write the entity its answer names`,
        ),
      );
    }

    // The days a trip the run records are its own: it covers no day another trip covers.
    for (const [otherIndex, other] of trips.entries()) {
      if (
        otherIndex <= index ||
        (recordedFlags[index] !== true && recordedFlags[otherIndex] !== true)
      ) {
        continue;
      }
      if (overlaps(segments, segmentsOf(other))) {
        problems.push(
          problem(
            `${TRIP_GATES.overlap}: ${name} covers a day trip entry ${String(otherIndex)} also covers; one trip per day, a trip with several stops is one trip with several segments`,
          ),
        );
      }
    }

    // Any trip carrying the word carries one of the closed set: the register's CHECK refuses any
    // other, and the import must refuse it before its claim, never throw after it.
    const placedBy = trip['placed_by'];
    if (
      recordedFlags[index] !== true &&
      placedBy !== undefined &&
      placedBy !== null &&
      !(TRIP_PLACED_BY as readonly unknown[]).includes(placedBy)
    ) {
      problems.push(
        problem(
          `${TRIP_GATES.placedBy}: ${name} field placed_by must be one of ${TRIP_PLACED_BY.join(', ')}, or absent`,
        ),
      );
    }

    // A trip an answer adds lands exactly as the answer carries it: a found place's with its
    // carried name, no purpose (listed for the accountant) and no placement word; the person's own
    // add with the name and purpose they gave and no placement word.
    const added = addedBy[index];
    if (added !== null && added !== undefined) {
      const placed = trip['placed_by'];
      const found = added.foundPlace === true;
      const wantName = added.name ?? key;
      const wantPurpose = found ? null : purposeOf(added.purpose);
      const listed = !found || purposeStated || (key !== null && purposeFindingCites.has(key));
      // The person's add states its own Trip log facts; a found place's trip carries none.
      const wantFacts: TripLogFacts = found ? NO_FACTS : { ...NO_FACTS, ...answeredFacts(added) };
      if (
        str(trip['name']) !== wantName ||
        purposeOf(purpose) !== wantPurpose ||
        (placed !== undefined && placed !== null) ||
        !listed ||
        !sameFacts(facts, wantFacts)
      ) {
        problems.push(
          problem(
            `${TRIP_GATES.answeredRewritten}: ${name} is a trip a confirmed answer adds; write exactly its name, purpose, travel, vehicle, miles, personal_days and no_cost (a found place's trip: its carried name, purpose null with its trip_purpose_not_stated finding, none of the five) and no placed_by`,
          ),
        );
      }
    }

    // A day the person took off the books comes back through no trip the run found, its own
    // record or one a found place carries.
    if (origins[index] === 'recorded' || origins[index] === 'found') {
      for (const edit of removed) {
        if (overlaps(segments, edit.segments)) {
          problems.push(
            problem(
              `${TRIP_GATES.removedAgain}: ${name} covers the days of a trip the person took off the books ("Not a trip"); never record it again`,
            ),
          );
        }
      }
    }

    // A run staged without confirmed/ (a rebuild, decision record 0134) replaces the findings the
    // state holds with its own, so it lists every trip that has no purpose, a staged one or the
    // person's own add included, never only the trips it records itself.
    if (
      rebuild &&
      (origins[index] === 'staged' || origins[index] === 'person') &&
      !purposeStated &&
      (key === null || !purposeFindingCites.has(key))
    ) {
      problems.push(
        problem(
          `${TRIP_GATES.purposeFinding}: ${name} has no purpose and no trip_purpose_not_stated finding cites trip:<its key>; a run staged without confirmed/ lists every trip with no purpose, staged ones too`,
        ),
      );
    }

    problems.push(
      ...suggestionProblems(
        name,
        trip,
        recordedFlags[index] === true,
        purposeStated,
        strings(trip['documents']),
        documents,
        readingOf,
      ),
    );

    if (recordedFlags[index] !== true) continue;

    if (entity === null || !stagedEntities.has(entity)) {
      problems.push(
        problem(
          `${TRIP_GATES.place}: ${name} is recorded by the run under a place profile.json does not stage; a trip sits under a staged place, a found place's trip rides its entity_register option (trips), and a trip with no place is not recorded (its lines stay unassigned with an entity_unestablished finding)`,
        ),
      );
    }
    // The purpose: the person's note's words, or the event default: the one event's name its only
    // suggestion carries (task 37.8).
    const eventDefault = eventDefaultOf(trip);
    if (purposeStated) {
      if (!noteStates(notes, entity, purpose) && purposeOf(purpose) !== eventDefault) {
        problems.push(
          problem(
            `${TRIP_GATES.purpose}: ${name} carries a purpose neither the person's notes state nor its one event suggestion names; write purpose null and the trip_purpose_not_stated finding`,
          ),
        );
      }
    } else if (eventDefault !== null) {
      problems.push(
        problem(
          `${TRIP_GATES.purpose}: ${name} carries one purpose suggestion, an event's, and no purpose; write the suggestion's text as its purpose and keep the suggestion`,
        ),
      );
    } else if (key === null || !purposeFindingCites.has(key)) {
      problems.push(
        problem(
          `${TRIP_GATES.purposeFinding}: ${name} has no purpose and no trip_purpose_not_stated finding cites trip:<its key>`,
        ),
      );
    }
    const sources = strings(trip['documents']);
    const readBefore = (reference: string): boolean =>
      documentToken(reference).some((token) => digestSources.has(token));
    if (sources.length === 0 || !sources.every((source) => inBatch(source) || readBefore(source))) {
      problems.push(
        problem(
          `${TRIP_GATES.documents}: ${name} must name in documents the documents its days were read from, this batch's or ones an earlier run read`,
        ),
      );
    }
    if (!(TRIP_PLACED_BY as readonly unknown[]).includes(trip['placed_by'])) {
      problems.push(
        problem(
          `${TRIP_GATES.placedBy}: ${name} field placed_by must be one of ${TRIP_PLACED_BY.join(', ')}`,
        ),
      );
    }
    // "Your only place in the trip's city": a stop's city holds exactly one staged place's
    // address, and it is the trip's.
    if (trip['placed_by'] === 'city') {
      const sole = segments.some((segment) => {
        const stop = stopCityOf(segment.location);
        const inCity = [...placeAddresses].filter(
          ([, address]) => stop !== null && addressInCity(address, stop),
        );
        return inCity.length === 1 && inCity[0]?.[0] === entity;
      });
      if (!sole) {
        problems.push(
          problem(
            `${TRIP_GATES.cityPlacement}: ${name} is placed by city, but no stop's city holds exactly one staged place's address, the trip's own (its city as out/places.json writes it and profile.json's address prints it); name the place another way or leave the trip unrecorded`,
          ),
        );
      }
    }
    const days = printedDays(sources, documents, [...ledger, ...digestItems]);
    const stay = stayDays(sources, documents);
    for (const [segmentIndex, dated] of segmentsDated(segments, days, taxYear, stay).entries()) {
      if (!dated) {
        problems.push(
          problem(
            `${TRIP_GATES.undated}: ${name} segment ${String(segmentIndex)} starts or ends on a day none of its documents prints; date each segment by its ticket, folio or receipts, writing the day into the document's fields`,
          ),
        );
      }
    }
    for (const [itemIndex, item] of ledger.entries()) {
      if (item['trip'] !== key) continue;
      const date = str(item['date']);
      if (
        date === null ||
        !segments.some((segment) => segment.start <= date && date <= segment.end)
      ) {
        problems.push(
          problem(
            `${TRIP_GATES.tiedOutside}: out/ledger.json item ${String(itemIndex)} is tied to a trip the run recorded but dated outside its days; leave its trip null`,
          ),
        );
      }
    }
  }

  const stagedSchedules = new Map(
    records(staged?.['entities']).flatMap((entity) => {
      const key = str(entity['key']);
      const schedule = str(entity['schedule']);
      return key === null || schedule === null ? [] : [[key, schedule] as const];
    }),
  );
  problems.push(...declaredDaysProblems(trips, origins, ledger, stagedSchedules, readingOf));
  problems.push(...attachTargetProblems(ledger, readingOf));
  problems.push(...gapProblems(trips, origins, findings, stagedById, rebuild));

  // A confirmed found place's trips land under it, with exactly the segments it carried, in the
  // run that applies the confirmation: one whose staged profile does not carry the trip yet and
  // whose digest carries no line the answer already moved. A trip the person removed since is not
  // asked back.
  const digestKeys = new Set(digestItems.flatMap((item) => strings(item['answer_keys'])));
  const stagedParsed = profileTripsOf(staged);
  for (const [answerKey, stagedAnswer] of answers) {
    const effect = parseEffect(optionEffectOf(stagedAnswer));
    if (effect === null || digestKeys.has(answerKey)) continue;
    // The place the confirmed answer gives the found place's lines: its register option (once the
    // click declared it, `ent_<id>`), or a staged place an `entity` option names.
    let target: string | null = null;
    if (effect.kind === 'entity_register' && /^ent_\d+$/.test(effect.entityKey)) {
      target = effect.entityKey;
    } else if (effect.kind === 'ledger' && effect.to.type === 'entity') {
      target = effect.to.entityKey;
    }
    const carriedTrips =
      effect.kind === 'entity_register' || effect.kind === 'ledger' ? (effect.trips ?? []) : [];
    if (target === null) continue;
    for (const carried of carriedTrips) {
      if (stagedParsed.some((trip) => sameSegments(trip.segments, carried.segments))) continue;
      if (removed.some((edit) => overlaps(edit.segments, carried.segments))) continue;
      const landed = parsed.some(
        (trip) => trip.entity === target && sameSegments(trip.segments, carried.segments),
      );
      if (!landed) {
        problems.push(
          problem(
            `${TRIP_GATES.foundTripMissing}: a confirmed found place carries a trip the profile does not record under it; add it under the place's key with exactly the segments its option carried`,
          ),
        );
      }
    }
  }

  // The trips a question's option carries are dated by this batch's documents, and ride only a
  // found place's `register` question or a `placement` question (issue #1563) — a staged key
  // spelled before the recipe whose options place lines among them (decision record 0164) — never
  // a catalog key; every option placing the lines carries the same trips, so the trip follows
  // whichever place the person picks, and a placed question, which no answer lands, carries none.
  const stagedOpenKeys = new Set(
    Object.keys(record(loadJson(join(workspace, 'open_questions.json'))) ?? {}),
  );
  const home = str(resolved['home']) ?? str(staged?.['home']);
  const documentEntryOf = (source: string): Json | undefined =>
    documents.find((entry) => {
      const file = str(entry['file']);
      return file !== null && sameDocument(source, file);
    });
  const docTypeOf = (source: string): string | null =>
    readingOf(source)?.docType ?? str(documentEntryOf(source)?.['doc_type']);
  // The trips this run writes, recorded or carried by a question: one itinerary is one of them.
  const ownTrips: OwnTrip[] = trips.flatMap((trip, index) =>
    origins[index] === 'recorded'
      ? [
          {
            name: `profile.resolved.json trip entry ${String(index)}`,
            segments: segmentsOf(trip),
            documents: strings(trip['documents']),
          },
        ]
      : [],
  );
  const onlyBusiness = onlyBusinessPointer(
    staged,
    notes,
    [...ledger, ...digestItems],
    placeAddresses,
    {
      texts: (source) => fieldTexts(readingOf(source), documentEntryOf(source)),
      addresses: (source) =>
        readingOf(source)?.addresses ??
        readingAddressesOf(record(documentEntryOf(source)?.['fields'])?.['addresses']),
    },
  );
  for (const [questionIndex, question] of records(
    loadJson(join(out, 'questions.json')),
  ).entries()) {
    const key = str(question['key']);
    const options = records(question['options']);
    const placing = options.flatMap((option): PlacingOption[] => {
      const effect = parseEffect(option['effect']);
      const pointer = option['pointer'];
      if (effect?.kind === 'entity_register') {
        return [{ place: null, trips: effect.trips ?? [], pointer }];
      }
      return effect?.kind === 'ledger' && effect.field === 'entity'
        ? [
            {
              place: effect.to.type === 'entity' ? effect.to.entityKey : null,
              trips: effect.trips ?? [],
              pointer,
            },
          ]
        : [];
    });
    const carrier =
      question['fact'] === 'register' ||
      question['fact'] === 'placement' ||
      (key !== null && TRIP_CARRIER_KEY.test(key)) ||
      (key !== null && stagedOpenKeys.has(key) && placing.length > 0);
    const carriedHere = placing.find((option) => option.trips.length > 0)?.trips ?? [];
    for (const [tripIndex, carried] of carriedHere.entries()) {
      ownTrips.push({
        name: `questions.json item ${String(questionIndex)} carried trip ${String(tripIndex)}`,
        segments: carried.segments,
        documents: carried.documents,
      });
    }
    if (carriedHere.length > 0) {
      const [first] = placing;
      const even = placing.every(
        (option) =>
          option.trips.length === first?.trips.length &&
          option.trips.every((trip, index) => {
            const other = first.trips[index];
            return other !== undefined && sameSegments(trip.segments, other.segments);
          }),
      );
      // A trip dated only by card or bank rows names no city of its own: the option's place does.
      const cityless = carriedHere.every((trip) =>
        trip.documents.every((source) => docTypeOf(source) === 'card_or_bank_export'),
      );
      const byPlace = carriedByPlace(placing, placeAddresses, home);
      if (cityless ? !byPlace : !even && !byPlace) {
        problems.push(
          problem(
            `${TRIP_GATES.carriedUnevenly}: questions.json item ${String(questionIndex)} carries trips on some of its placing options and not others, or different ones; every option that places the lines carries the same trips, but for a stay no document names the city of, whose option for each place away from the travel home carries the trip to that place's city`,
          ),
        );
      }
      if (options.some((option) => option['placed'] === true)) {
        problems.push(
          problem(
            `${TRIP_GATES.carriedPlaced}: questions.json item ${String(questionIndex)} is placed and carries trips; a question carrying a trip is asked, since the trip lands only on the person's answer`,
          ),
        );
      }
      // A placed question is refused above, and a recommendation is never placed. A stay carried
      // by place has no one trip to read stops from, so only an even question is held to it.
      const points =
        onlyBusiness !== null &&
        even &&
        !options.some((option) => option['placed'] === true) &&
        placing.every((option) => option.place !== null) &&
        placing.some((option) => option.place === onlyBusiness.key) &&
        onlyBusiness.pointsTo(
          carriedHere.flatMap((trip) => trip.segments.map((segment) => segment.location)),
          carriedHere.flatMap((trip) => trip.documents),
          placing,
        );
      const [lead] = options;
      const leadEffect = lead === undefined ? null : parseEffect(lead['effect']);
      const leads =
        lead?.['recommended'] === true &&
        leadEffect?.kind === 'ledger' &&
        leadEffect.field === 'entity' &&
        leadEffect.to.type === 'entity' &&
        leadEffect.to.entityKey === onlyBusiness?.key;
      if (points && !leads) {
        problems.push(
          problem(
            `${TRIP_GATES.businessUnrecommended}: questions.json item ${String(questionIndex)} carries a trip whose stops hold no staged rental's address, no document other than the trip's own booked to a rental prints an address in its city, no rental's option carries a pointer quoting the rental's note or such a document, and exactly one business that is not a rental is staged; list that business's option first with "recommended": true, or write that pointer where the rental's note or document names the trip's city or vendors (reference/steps/4-ask.md, Trips no document places)`,
          ),
        );
      }
    }
    for (const option of options) {
      const effect = parseEffect(option['effect']);
      if (effect === null || (effect.kind !== 'entity_register' && effect.kind !== 'ledger')) {
        continue;
      }
      if ((effect.trips ?? []).length > 0 && !carrier) {
        problems.push(
          problem(
            `${TRIP_GATES.carriedOutsideRegister}: questions.json item ${String(questionIndex)} carries trips on a question that is neither a found place's register question nor a placement question; a trip rides only those`,
          ),
        );
      }
      for (const [tripIndex, carried] of (effect.trips ?? []).entries()) {
        // A trip an option carries lands beside the run's own on the person's answer, so it shares
        // no day with one this profile records (issue #1563): that run would refuse the overlap.
        if (trips.some((trip) => overlaps(segmentsOf(trip), carried.segments))) {
          problems.push(
            problem(
              `${TRIP_GATES.overlap}: questions.json item ${String(questionIndex)} carried trip ${String(tripIndex)} covers a day a trip of profile.resolved.json covers; one trip per day, so tie its lines to that trip or carry none`,
            ),
          );
        }
        problems.push(
          ...segmentProblems(
            `questions.json item ${String(questionIndex)} carried trip ${String(tripIndex)}`,
            carried.segments,
            taxYear,
          ),
        );
        const days = printedDays(carried.documents, documents, ledger);
        const dated =
          carried.documents.every(inBatch) &&
          segmentsDated(
            carried.segments,
            days,
            taxYear,
            stayDays(carried.documents, documents),
          ).every(Boolean);
        if (!dated) {
          problems.push(
            problem(
              `${TRIP_GATES.foundTripUndated}: questions.json item ${String(questionIndex)} carries a found place's trip not dated by this batch's documents; name its documents and date each segment by them`,
            ),
          );
        }
      }
    }
  }

  if (home !== null) {
    const listed = [
      ...trips.flatMap((trip) => strings(trip['documents'])),
      ...ownTrips.flatMap((trip) => trip.documents),
    ];
    const printsHome = (source: string): boolean => {
      const reading = readingOf(source);
      const addresses =
        reading?.addresses ??
        readingAddressesOf(record(documentEntryOf(source)?.['fields'])?.['addresses']);
      return printsCity(addresses, home);
    };
    const homeBetween = (after: string, before: string): boolean =>
      [...ledger, ...digestItems].some((item) => {
        const date = str(item['date']);
        const source = str(item['source_file']);
        return (
          date !== null && source !== null && after < date && date < before && printsHome(source)
        );
      });
    problems.push(...itineraryProblems(ownTrips, ledger, listed, homeBetween));
  }
  problems.push(...homeProblems(staged, resolved, findings, documents, inBatch, rebuild));
  return problems;
}

/**
 * The only staged business pointer of a trip no document places (reference/steps/4-ask.md, issue
 * #1600): exactly one staged Schedule C entity that is not a property, no stop's city that of a
 * staged rental's address (out/places.json's, `placeAddressesOf`), no printed address of a
 * document other than the trip's own that a line books to a rental (its staged reading, else the
 * run's out/documents.json entry) in a stop's city, and no rental's option carrying a pointer that
 * quotes, verbatim, that rental's note (notes.json's entry under its key) or the printed fields of
 * such a document, which the agent writes where one names the trip's city or its vendors. Only the
 * staged profile's places count, never the run's resolved ones, so the run cannot switch the
 * pointer off. Null when no single business is staged.
 */
function onlyBusinessPointer(
  staged: Json | null,
  notes: Json | null,
  lines: readonly Json[],
  placeAddresses: ReadonlyMap<string, ReadingAddress>,
  printed: {
    readonly texts: (source: string) => readonly string[];
    readonly addresses: (source: string) => readonly ReadingAddress[];
  },
): {
  key: string;
  pointsTo: (
    stops: readonly string[],
    tripDocuments: readonly string[],
    placing: readonly PlacingOption[],
  ) => boolean;
} | null {
  const entities = records(staged?.['entities']);
  const isRental = (entity: Json): boolean =>
    entity['schedule'] === 'E' || PROPERTY_PROFILE_KINDS.has(str(entity['kind']) ?? '');
  const businesses = entities.filter((entity) => entity['schedule'] === 'C' && !isRental(entity));
  const key = businesses.length === 1 ? str(businesses[0]?.['key']) : null;
  if (key === null) return null;
  const rentalKeys = new Set(
    entities.filter(isRental).flatMap((entity) => str(entity['key']) ?? []),
  );
  const rentalAddresses = [...rentalKeys].flatMap((rental) => placeAddresses.get(rental) ?? []);
  // The documents a line books to a rental, each with the rentals it is booked to.
  const rentalsBySource = new Map<string, Set<string>>();
  for (const item of lines) {
    const entity = str(item['entity']);
    const source = str(item['source_file']);
    if (entity === null || source === null || !rentalKeys.has(entity)) continue;
    rentalsBySource.set(source, (rentalsBySource.get(source) ?? new Set()).add(entity));
  }
  const rentalNote = (rental: string): string | null => str(record(notes?.['entities'])?.[rental]);
  return {
    key,
    pointsTo: (stops, tripDocuments, placing) => {
      const cities = stops.flatMap((stop) => stopCityOf(stop) ?? []);
      const inCity = (address: ReadingAddress): boolean =>
        cities.some((city) => addressInCity(address, city));
      const otherSources = [...rentalsBySource].filter(
        ([source]) => !tripDocuments.some((document) => sameDocument(document, source)),
      );
      const quotes = (option: PlacingOption): boolean => {
        const place = option.place;
        const pointer = rentalPointerOf(option.pointer);
        if (place === null || !rentalKeys.has(place) || pointer === null) return false;
        if (pointer.kind === 'note') {
          const note = rentalNote(place);
          return pointer.source === place && note !== null && quotedIn([note], pointer.quote);
        }
        return otherSources.some(
          ([source, rentals]) =>
            rentals.has(place) &&
            sameDocument(source, pointer.source) &&
            quotedIn(printed.texts(source), pointer.quote),
        );
      };
      return (
        cities.length > 0 &&
        !rentalAddresses.some(inCity) &&
        !otherSources.some(([source]) => printed.addresses(source).some(inCity)) &&
        !placing.some(quotes)
      );
    },
  };
}

/** A rental option's pointer as the only-business rule reads it: `{note, quote}` or
 *  `{document, quote}`, nothing else; null otherwise. */
function rentalPointerOf(
  value: unknown,
): { kind: 'note' | 'document'; source: string; quote: string } | null {
  const pointer = record(value);
  const quote = str(pointer?.['quote']);
  if (pointer === null || quote === null || Object.keys(pointer).length !== 2) return null;
  const kind = (['note', 'document'] as const).find((name) => str(pointer[name]) !== null);
  return kind === undefined ? null : { kind, source: str(pointer[kind]) ?? '', quote };
}

/** A document's printed field values: its staged reading's, else its out/documents.json entry's. */
function fieldTexts(reading: StagedReading | null, entry: Json | undefined): string[] {
  if (reading !== null) return [...reading.values];
  const values: string[] = [];
  fieldValues(printedFieldsOf(entry?.['fields']), values);
  return values;
}

/** One placing option of a question: the staged place it books the lines to (null for a found
 *  place's register option) and the trips it carries. */
interface PlacingOption {
  readonly place: string | null;
  readonly trips: readonly FoundPlaceTrip[];
  /** The option's `pointer` as written: a quote of what names its place (step 4). */
  readonly pointer: unknown;
}

/** A trip this run writes: one it records, or one a question's placing options carry. */
interface OwnTrip {
  readonly name: string;
  readonly segments: readonly TripSegmentInput[];
  readonly documents: readonly string[];
}

/** Each staged place's address in the books agent's standard form (out/places.json, step 3; issue
 *  #1628), its printed line the address profile.json stages, so `addressInCity` takes the agent's
 *  city only where the person's own address prints it. A place staged with no address, or one the
 *  file does not carry, has none. */
function placeAddressesOf(
  workspace: string,
  entities: readonly Json[],
): Map<string, ReadingAddress> {
  const aliases = stagedKeyAliases(workspace, entities);
  const { places } = placesFileOf(workspace, entities, aliases, false);
  return new Map(
    entities.flatMap((entity) => {
      const key = str(entity['key']);
      const address = str(entity['address']);
      const standard = key === null ? undefined : places.get(key);
      return key === null || address === null || standard == null
        ? []
        : [[key, { as_printed: address, ...standard }] as const];
    }),
  );
}

/**
 * A stay no document names the city of (decision record 0168): card rows on consecutive days
 * print no city, so the place the person picks gives it. Each placing option for a staged place
 * whose address lies away from the travel home carries one trip with one segment in that address's
 * city (out/places.json's, printed in the staged address: `placeAddressesOf`), every such trip over
 * the same days and documents; an option for a place with no such city, or one in the home's city,
 * carries none. A register option, whose place is not staged, never
 * carries a trip this way.
 */
function carriedByPlace(
  placing: readonly PlacingOption[],
  placeAddresses: ReadonlyMap<string, ReadingAddress>,
  home: string | null,
): boolean {
  const homeCity = home === null ? null : stopCityOf(home);
  if (homeCity === null) return false;
  const reference = placing.find((option) => option.trips.length > 0)?.trips[0];
  const stay = (trip: FoundPlaceTrip | undefined): string | null => {
    const [segment, extra] = trip?.segments ?? [];
    return segment === undefined || extra !== undefined
      ? null
      : JSON.stringify([segment.start, segment.end, [...(trip?.documents ?? [])].sort()]);
  };
  const days = stay(reference);
  if (days === null) return false;
  return placing.every((option) => {
    if (option.place === null) return false;
    const address = placeAddresses.get(option.place);
    const away =
      address !== undefined &&
      citedAddresses([address]).length > 0 &&
      !addressInCity(address, homeCity);
    if (!away) return option.trips.length === 0;
    const [trip, extra] = option.trips;
    const stop = stopCityOf(trip?.segments[0]?.location ?? '');
    return (
      extra === undefined && stay(trip) === days && stop !== null && addressInCity(address, stop)
    );
  });
}

/** Whether a stop is abroad: its location spelled "City, Country", never "City, ST". */
function abroad(location: string): boolean {
  return (stopCityOf(location.trim())?.region ?? null) === null;
}

/** How close a stop abroad and the next stop lie to be one itinerary (step 3). */
const ITINERARY_WINDOW_DAYS = 7;

/**
 * One itinerary is one trip (decision records 0132 item 1, 0168): a stop abroad followed within a
 * week by another stop, with no line between them booked from a document printing the travel
 * home's city, is a segment of the next stop's trip. Among the trips this run writes — recorded,
 * or carried by a question's options — a trip whose last stop is abroad and ends within the week
 * before another begins is refused; so is an untied meal or travel line in another currency than
 * USD, dated within the week before such a trip begins, whose document no trip lists. A trip the
 * profile stages or an earlier answer added is the person's register, which no run rewrites, so it
 * joins no pair. Every message names an index and a rule, never a value.
 */
function itineraryProblems(
  own: readonly OwnTrip[],
  ledger: readonly Json[],
  listed: readonly string[],
  homeBetween: (after: string, before: string) => boolean,
): Problem[] {
  const problems: Problem[] = [];
  const startOf = (trip: OwnTrip): string | undefined =>
    trip.segments.map((segment) => segment.start).sort()[0];
  const joins = (from: string, next: OwnTrip): boolean => {
    const start = startOf(next);
    if (start === undefined || start <= from) return false;
    const gap = dayOrdinal(start) - dayOrdinal(from);
    return gap <= ITINERARY_WINDOW_DAYS && !homeBetween(from, start);
  };
  for (const trip of own) {
    const last = [...trip.segments].sort((left, right) => left.end.localeCompare(right.end)).at(-1);
    if (last === undefined || !abroad(last.location)) continue;
    for (const next of own) {
      if (next !== trip && joins(last.end, next)) {
        problems.push(
          problem(
            `${TRIP_GATES.itinerarySplit}: ${trip.name} ends abroad within a week before ${next.name} begins; one itinerary is one trip with a segment per city, placed where either stop's documents point`,
          ),
        );
      }
    }
  }
  for (const [itemIndex, item] of ledger.entries()) {
    const date = str(item['date']);
    const source = str(item['source_file']);
    const currency = str(item['currency']);
    const schedule = str(item['schedule']);
    const line = str(item['line']);
    const travel =
      item['meal'] === true ||
      (schedule !== null && line !== null && (TRIP_TRAVEL_LINES[schedule] ?? []).includes(line));
    if (
      date === null ||
      source === null ||
      currency === null ||
      currency === 'USD' ||
      !travel ||
      str(item['trip']) !== null ||
      listed.some((document) => sameDocument(document, source))
    ) {
      continue;
    }
    const next = own.find((trip) => joins(date, trip));
    if (next !== undefined) {
      problems.push(
        problem(
          `${TRIP_GATES.itinerarySplit}: out/ledger.json item ${String(itemIndex)} is a stop abroad within a week before ${next.name} begins and no trip lists its document; make it a segment of that trip, carried or recorded as one itinerary`,
        ),
      );
    }
  }
  return problems;
}

/**
 * A document's staged reading (`extractions/<stem>.json`), which the run never writes: the product
 * path rebuilds it from the stored reading before the import re-runs these gates. Its type is the
 * lowest-index read page's (SKILL.md step 2), its values every string and number its pages'
 * extracted `fields` print (never a key, the page metadata or the reader's notes) and its addresses
 * the printed lines of the pages' `fields.addresses`. Null when the batch stages no reading for the document (one read
 * by hand, the personal tool's), whose only record is the run's own out/documents.json.
 */
interface StagedReading {
  readonly docType: string | null;
  readonly values: readonly string[];
  /** The event names its pages' readings write (`other.event`). */
  readonly events: readonly string[];
  readonly addresses: readonly ReadingAddress[];
  /** The trip or booked line the person attached this document to as its receipt (task 37.26,
   *  issue #1402): a code-built top-level `attach_to` key, never the model's. */
  readonly attachTo: { readonly type: 'trip' | 'line'; readonly key: string } | null;
}

/** `attach_to` as staging wrote it (`run-bundle.ts`): `{trip: "trip_12"}` or `{line: "L0017"}`,
 *  one token of the run's own shape; anything else is no attach target. */
function attachToOf(reading: Json): StagedReading['attachTo'] {
  const attach = record(reading['attach_to']);
  if (attach === null) return null;
  const trip = str(attach['trip']);
  if (trip !== null && /^trip_[1-9]\d{0,15}$/.test(trip)) return { type: 'trip', key: trip };
  const line = str(attach['line']);
  if (line !== null && /^[A-Za-z]{1,8}\d{1,12}$/.test(line)) return { type: 'line', key: line };
  return null;
}

function fieldValues(value: unknown, out: string[]): void {
  if (typeof value === 'string') out.push(value);
  else if (typeof value === 'number') out.push(String(value));
  else if (Array.isArray(value)) for (const item of value) fieldValues(item, out);
  else if (record(value) !== null) {
    for (const item of Object.values(value as Json)) fieldValues(item, out);
  }
}

function stagedReadingOf(workspace: string, document: string): StagedReading | null {
  const name = basename(document);
  const dot = name.lastIndexOf('.');
  const reading = record(
    loadJson(join(workspace, 'extractions', `${dot > 0 ? name.slice(0, dot) : name}.json`)),
  );
  if (reading === null) return null;
  const pages = records(reading['pages']).sort(
    (left, right) => Number(left['page'] ?? 0) - Number(right['page'] ?? 0),
  );
  const read = pages.find(
    (page) => page['page_status'] === undefined || page['page_status'] === 'READ',
  );
  const values: string[] = [];
  const addresses: ReadingAddress[] = [];
  for (const page of pages) {
    const fields = record(page['fields']);
    fieldValues(printedFieldsOf(fields), values);
    addresses.push(...readingAddressesOf(fields?.['addresses']));
  }
  return {
    docType: str(read?.['doc_type']),
    values,
    events: eventsOf(pages.map((page) => page['fields'])),
    addresses,
    attachTo: attachToOf(reading),
  };
}

/**
 * Whether an event suggestion's text is the event its document's reading names: one page's
 * `other.event`, the name the reader copied from a registration, badge or ticket (task 41.2),
 * equal to the text, case and runs of white space aside. The staged reading is read where the batch
 * stages one; a document read by hand has only the run's own out/documents.json entry (the
 * residual the personal tool carries), which reference/extraction.md asks for the same field.
 */
function eventNamed(text: string, reading: StagedReading | null, entry: Json | undefined): boolean {
  const events = reading !== null ? reading.events : eventsOf([entry?.['fields']]);
  return events.some((name) => verbatimFold(name) === verbatimFold(text));
}

/** The event names pages' `fields.other.event` carry. */
function eventsOf(fields: readonly unknown[]): string[] {
  return fields.flatMap((value) => str(record(record(value)?.['other'])?.['event']) ?? []);
}

/** Whether one of a trip's documents is an airline receipt: the ticket a recorded flight is read
 *  from (task 37.8), typed by its staged reading where the batch stages one, else by the run's
 *  out/documents.json entry. */
function ticketed(
  sources: readonly string[],
  documents: readonly Json[],
  readingOf: (document: string) => StagedReading | null,
): boolean {
  return sources.some((source) => {
    const reading = readingOf(source);
    if (reading !== null) return reading.docType === 'airline_receipt';
    return documents.some((entry) => {
      const file = str(entry['file']);
      return file !== null && entry['doc_type'] === 'airline_receipt' && sameDocument(source, file);
    });
  });
}

/** Whether a line's staged reading prints an address in none of a trip's stop cities: a reading
 *  (never a card or bank export's, whose rows print no city) with an address the reader gave a
 *  city, none of them in a stop's city (`stop-city.ts`). A document with no staged reading has no
 *  such exemption. */
function printsAnotherCity(
  item: Json,
  segments: readonly TripSegmentInput[],
  readingOf: (document: string) => StagedReading | null,
): boolean {
  const source = str(item['source_file']);
  const reading = source === null ? null : readingOf(source);
  if (reading === null || reading.docType === 'card_or_bank_export') return false;
  return (
    citedAddresses(reading.addresses).length > 0 &&
    !segments.some((segment) => printsCity(reading.addresses, segment.location))
  );
}

/** Whether one of a page's addresses lies in a location's city, as the reader placed it. */
function printsCity(addresses: readonly ReadingAddress[], location: string): boolean {
  const city = stopCityOf(location);
  return city !== null && citedAddresses(addresses).some((address) => addressInCity(address, city));
}

/** Whether a reading's printed addresses put it in a city away from the travel home (decision
 *  records 0132 item 1, 0164): at least one address the reader gave a city, none of them in the
 *  home's city. */
export function printsCityAwayFromHome(
  addresses: readonly ReadingAddress[],
  home: string,
): boolean {
  return (
    stopCityOf(home) !== null &&
    citedAddresses(addresses).length > 0 &&
    !printsCity(addresses, home)
  );
}

/**
 * A trip the person declared covers its days (task 37.8, the founder's addendum: the trip they
 * declared is the note that names the city): profile.json stages it, or their `trip_edit` answer
 * adds it. The gate holds exactly the lines the code-applied trip moves tie (`tripRegisterChanges`):
 * an expense of this run booked to the trip's own place, on a meal or that place's schedule's
 * travel line (`TRIP_TRAVEL_LINES`), carrying no trip and no vehicle and dated inside one of its
 * segments, a row that prints no city included. A line whose staged reading prints an address in
 * none of the trip's cities, or whose document another trip lists (a ticket bought during this trip
 * for that one), keeps step 3's own rules. Every message names the line by its index, never a value.
 */
function declaredDaysProblems(
  trips: readonly Json[],
  origins: readonly TripOrigin[],
  ledger: readonly Json[],
  schedules: ReadonlyMap<string, string>,
  readingOf: (document: string) => StagedReading | null,
): Problem[] {
  const declared = trips.flatMap((trip, index) => {
    const entity = str(trip['entity']);
    return (origins[index] === 'staged' || origins[index] === 'person') && entity !== null
      ? [{ index, entity, segments: segmentsOf(trip) }]
      : [];
  });
  if (declared.length === 0) return [];
  const problems: Problem[] = [];
  for (const [itemIndex, item] of ledger.entries()) {
    const tied = item['trip'] !== undefined && item['trip'] !== null;
    const vehicle = item['vehicle'] !== undefined && item['vehicle'] !== null;
    const date = str(item['date']);
    const entity = str(item['entity']);
    const source = str(item['source_file']);
    if (tied || vehicle || item['kind'] !== 'expense' || date === null || entity === null) continue;
    // A receipt the person attached to a trip or to a line (task 37.26): code ties the lines, or
    // books none, so the model's untied line is never fought here — the click wins inside the
    // trip's days (the founder's ruling of 2026-10-30).
    const reading = source === null ? null : readingOf(source);
    if (reading !== null && reading.attachTo !== null) continue;
    const untied = declared.some((trip) => {
      if (trip.entity !== entity) return false;
      const lines = TRIP_TRAVEL_LINES[schedules.get(trip.entity) ?? ''] ?? [];
      const travel = item['meal'] === true || lines.includes(str(item['line']) ?? '');
      const inside = trip.segments.some((segment) => segment.start <= date && date <= segment.end);
      const anotherTrips =
        source !== null &&
        trips.some(
          (other, otherIndex) =>
            otherIndex !== trip.index &&
            strings(other['documents']).some((document) => sameDocument(document, source)),
        );
      return (
        travel && inside && !anotherTrips && !printsAnotherCity(item, trip.segments, readingOf)
      );
    });
    if (untied) {
      problems.push(
        problem(
          `${TRIP_GATES.declaredUntied}: out/ledger.json item ${String(itemIndex)} is a travel line of the place of a trip the person declared, dated inside its days, and ties no trip; set its trip to that trip's key, a row that prints no city included (the declared trip names the city)`,
        ),
      );
    }
  }
  return problems;
}

/**
 * A reading the person attached to a trip or to a line (task 37.26, issue #1402): the importer
 * ties its lines to the trip, or books none, so the model writes no `trip` on any line from that
 * reading — a model tie there would put the receipt's cost on a trip the person did not choose.
 */
function attachTargetProblems(
  ledger: readonly Json[],
  readingOf: (document: string) => StagedReading | null,
): Problem[] {
  const problems: Problem[] = [];
  for (const [itemIndex, item] of ledger.entries()) {
    const trip = item['trip'];
    if (trip === undefined || trip === null) continue;
    const source = str(item['source_file']);
    const reading = source === null ? null : readingOf(source);
    if (reading === null || reading.attachTo === null) continue;
    problems.push(
      problem(
        `${TRIP_GATES.attachTargetMismatch}: out/ledger.json item ${String(itemIndex)} books a line from a reading the person attached to a trip or a line and writes its own trip; leave its trip null, the importer ties the lines from the person's answer`,
      ),
    );
  }
  return problems;
}

/**
 * A trip's missing-receipt findings (task 37.8): a `missing_receipt` finding citing `trip:<key>`
 * carries one closed `gap` word (`TRIP_GAP_WORDS`), never one a cited trip's `no_cost` lists, and
 * no other finding carries `gap`. `mileage` is the finding of a drive whose miles are not stated:
 * one per trip, none once its miles are stated. A drive by own car with no miles stated is listed
 * by one in the run its gap findings are written by: every trip on a run staged without confirmed/,
 * else a trip the person's answer adds, or a staged trip their `trip_edit` answer makes such a drive
 * when it was not one as staged (by own car with no miles).
 */
function gapProblems(
  trips: readonly Json[],
  origins: readonly TripOrigin[],
  findings: readonly Json[],
  stagedById: ReadonlyMap<string, Json>,
  rebuild: boolean,
): Problem[] {
  const byKey = new Map(
    trips.flatMap((trip) => {
      const key = str(trip['key']);
      return key === null ? [] : [[key, trip] as const];
    }),
  );
  const problems: Problem[] = [];
  const mileageListed = new Set<string>();
  for (const [index, finding] of findings.entries()) {
    const name = `findings.json item ${String(index)}`;
    const tripKeys = strings(finding['cites'])
      .filter((cite) => cite.startsWith('trip:'))
      .map((cite) => cite.slice('trip:'.length));
    const gap = finding['gap'];
    if (finding['kind'] !== 'missing_receipt' || tripKeys.length === 0) {
      if (gap !== undefined && gap !== null) {
        problems.push(
          problem(
            `${TRIP_GATES.gap}: ${name} carries gap, which only a trip's missing_receipt finding carries; leave it off`,
          ),
        );
      }
      continue;
    }
    if (typeof gap !== 'string' || !(TRIP_GAP_WORDS as readonly string[]).includes(gap)) {
      problems.push(
        problem(
          `${TRIP_GATES.gap}: ${name} is a trip's missing_receipt finding and must carry gap, one of ${TRIP_GAP_WORDS.join(', ')}`,
        ),
      );
      continue;
    }
    for (const key of tripKeys) {
      const trip = byKey.get(key);
      if (trip === undefined) continue; // the trip-cite gate names a cite of no profile trip
      if (strings(trip['no_cost']).includes(gap)) {
        problems.push(
          problem(
            `${TRIP_GATES.gap}: ${name} names a gap the trip's no_cost lists; the person said the trip had no such cost, so write no finding for it`,
          ),
        );
      }
      if (gap !== 'mileage') continue;
      if (trip['miles'] !== undefined && trip['miles'] !== null) {
        problems.push(
          problem(
            `${TRIP_GATES.gap}: ${name} names the mileage gap of a trip whose miles are stated; write no mileage finding for it`,
          ),
        );
      } else if (mileageListed.has(key)) {
        problems.push(
          problem(
            `${TRIP_GATES.gap}: ${name} names the mileage gap of a trip another finding already names it for; a trip takes one mileage finding`,
          ),
        );
      }
      mileageListed.add(key);
    }
  }
  const unstatedDrive = (trip: Json | undefined): boolean =>
    trip !== undefined &&
    trip['travel'] === 'own_car' &&
    (trip['miles'] === undefined || trip['miles'] === null);
  for (const [index, trip] of trips.entries()) {
    const key = str(trip['key']);
    if (key === null || !unstatedDrive(trip) || mileageListed.has(key)) continue;
    const newlyOpen =
      rebuild ||
      origins[index] === 'person' ||
      (origins[index] === 'staged' && !unstatedDrive(stagedById.get(key)));
    if (!newlyOpen) continue;
    problems.push(
      problem(
        `${TRIP_GATES.milesFinding}: profile.resolved.json trip entry ${String(index)} is a drive by own car whose miles are not stated; write one missing_receipt finding citing trip:<its key> with gap mileage, saying the miles for the drive of its days are not stated`,
      ),
    );
  }
  return problems;
}

/** Where a staged travel home came from when an earlier run read it from the documents rather
 *  than the person giving it: the personal tool stages it so (decision record 0134). */
export const HOME_ORIGIN_DOCUMENTS = 'documents';

/** The travel home: a staged home is never rewritten; a home the run adds is named by a `note`
 *  finding that cites at least two distinct documents of this batch whose readings
 *  (out/documents.json `fields`) print its city, and reads as a place ("City, ST" or
 *  "City, Country"). On a run staged without confirmed/ (a rebuild, whose findings replace the
 *  state's), a staged home an earlier run read (`home_origin: "documents"`) is carried and named by
 *  that note again: dropping it, or carrying it with no note, is refused. */
function homeProblems(
  staged: Json | null,
  resolved: Json,
  findings: readonly Json[],
  documents: readonly Json[],
  inBatch: (reference: string) => boolean,
  rebuild: boolean,
): Problem[] {
  const stagedHome = str(staged?.['home']);
  const readBefore =
    rebuild && stagedHome !== null && staged?.['home_origin'] === HOME_ORIGIN_DOCUMENTS;
  if (readBefore && resolved['home'] !== stagedHome) {
    return [
      problem(
        `${TRIP_GATES.home}: profile.resolved.json home must carry the travel home an earlier run read, which profile.json stages, with its note finding`,
      ),
    ];
  }
  if (!('home' in resolved)) return [];
  const home = resolved['home'];
  if (stagedHome !== null && !readBefore) {
    return home === stagedHome
      ? []
      : [
          problem(
            `${TRIP_GATES.home}: profile.resolved.json home differs from the travel home profile.json stages; carry it forward`,
          ),
        ];
  }
  if (home === null) return [];
  const problems: Problem[] = [];
  if (typeof home !== 'string' || !/^[^,]*\S[^,]*,\s*\S/.test(home)) {
    problems.push(
      problem(
        `${TRIP_GATES.home}: profile.resolved.json home must read "City, ST" or "City, Country"`,
      ),
    );
  }
  // The note that records the home names its city and cites the documents that agree on it:
  // each a distinct batch document with a printed address the reader placed in that city.
  const city = typeof home === 'string' ? stopCityOf(home) : null;
  const placesHome = (cite: string): boolean =>
    typeof home === 'string' &&
    documents.some((entry) => {
      const file = str(entry['file']);
      return (
        file !== null &&
        sameDocument(file, cite) &&
        printsCity(readingAddressesOf(record(entry['fields'])?.['addresses']), home)
      );
    });
  const named = findings.some((finding) => {
    if (finding['kind'] !== 'note' || city === null) return false;
    const namesCity = printsCityName(str(finding['message']) ?? '', city.city);
    const agreeing = new Set(
      strings(finding['cites'])
        .filter((cite) => !cite.startsWith('trip:') && inBatch(cite) && placesHome(cite))
        .map((cite) => documentToken(cite).at(-1) ?? cite),
    );
    return namesCity && agreeing.size >= 2;
  });
  if (!named) {
    problems.push(
      problem(
        `${TRIP_GATES.home}: a travel home the run adds, or carries as an earlier run read it, needs a note finding that names its city and cites at least two distinct documents whose readings print it`,
      ),
    );
  }
  return problems;
}

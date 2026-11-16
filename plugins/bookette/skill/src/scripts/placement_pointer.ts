/**
 * The placement pointer gate of step 8 (issues #1591 and #1628, reference/steps/4-ask.md's No
 * pointer, no placement bullet). A placement question (a placement key or the `placement` fact,
 * no option carrying a trip or registering a place) is for lines a pointer ties to a staged
 * place, and a `recommended` or `placed` option is for lines a pointer ties to its own place.
 *
 * Code finds the pointers staged facts give: another line of the document booked on a place
 * that no placement question cites; the reading's `hint_entity`; a printed address of the
 * reading whose `usps_standard` matches the place's in out/places.json; a digest row of the
 * document or vendor, for any place on its schedule but never for `placed`; a line of this run
 * on a place whose vendor contains the line's; an earlier answer that placed lines there and
 * whose prompt names the vendor; and the only staged business, for a Schedule C line that no
 * rental's note names. Every other pointer is a quote the agent writes on the option,
 * `{document|note|answer, quote}`, found verbatim in the source it names (never the ledger
 * line's own description). An address quote (one carrying a printed address's house number or
 * line) ties by standard form alone; any other quote ties by a word of four letters or more that
 * the place alone of the staged places carries, and, unless it is the line's own
 * document, by a word shared with the vendor (a place's own note needs only the vendor's word,
 * an answer that and its choice placing lines there). A `placed` option is refused when any
 * pointer of its lines names another place.
 *
 * out/places.json (place-addresses.ts) carries each staged place's standard address as the agent
 * reads it. Messages name codes, indices and counts, never a key, line, vendor, document, quote
 * or address.
 */
import { basename, join } from 'node:path';

import { TRIP_TRAVEL_LINES } from '../code-applied';
import { type Json, loadJson, record, str } from '../json-values';
import { keyWords, PLACEMENT_QUESTION_KEY_PATTERN } from '../question-keys';
import {
  addressFold,
  placesFileOf,
  sameStandardAddress,
  stagedKeyAliases,
} from '../place-addresses';
import { printedFieldsOf, type ReadingAddress, readingAddressesOf } from '../reading-addresses';
import { quotedIn, verbatimFold } from '../verbatim-quote';
import { waitingLineIds } from '../waiting-lines';
import type { Problem } from './check_outputs';
import { PROPERTY_PROFILE_KINDS } from './trip_gates';

export const PLACEMENT_UNPOINTED = 'placement_unpointed';
const POINTER_MALFORMED = 'placement_pointer_malformed';
const POINTER_UNQUOTED = 'placement_pointer_unquoted';
const QUOTE_MAX_LENGTH = 300;

const PLACEMENT_KEY = new RegExp(PLACEMENT_QUESTION_KEY_PATTERN);
/** A digest row carries its schedule and no place, so it points to `*E` or `*C`. */
const ON_SCHEDULE = '*';

function records(value: unknown): Json[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item: unknown): Json[] => {
    const entry = record(item);
    return entry === null ? [] : [entry];
  });
}

/** Every string under a value, depth first. */
function texts(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) for (const item of value) texts(item, out);
  else if (record(value) !== null)
    for (const item of Object.values(value as Json)) texts(item, out);
  return out;
}

function containsPhrase(haystack: readonly string[], needle: readonly string[]): boolean {
  if (needle.length === 0) return false;
  for (let start = 0; start + needle.length <= haystack.length; start += 1) {
    if (needle.every((word, offset) => haystack[start + offset] === word)) return true;
  }
  return false;
}

/** `inbox/note_yard_work.jpg`, `note_yard_work` and `extractions/note_yard_work.json` alike. */
function stem(reference: string): string {
  const name = basename(reference);
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(0, dot) : name;
}

/** keyWords' letters-only words of four letters or more, so "Café Río" reads as "cafe". */
const anchorWords = (text: string): Set<string> =>
  new Set(keyWords(text).filter((word) => /^[a-z]{4,}$/.test(word)));
/** The house number of a printed address: the first digit run of its standard form, else of
 *  its printed line. */
const printedHouseNumber = (address: ReadingAddress): string | null =>
  /\d+/.exec(address.usps_standard ?? address.as_printed)?.[0] ?? null;
const sharesWord = (text: string, others: ReadonlySet<string>): boolean =>
  [...anchorWords(text)].some((word) => others.has(word));

/** Whether a line sits on a travel line of its schedule, or of any schedule while it has none. */
function travelLine(item: Json): boolean {
  const schedule = str(item['schedule']);
  const line = str(item['line']);
  if (line === null) return false;
  const tables =
    schedule === null ? Object.values(TRIP_TRAVEL_LINES) : [TRIP_TRAVEL_LINES[schedule]];
  return tables.some((lines) => (lines ?? []).includes(line));
}

/** The place a `ledger`/`entity` or `entity_register` effect books lines on, else null. */
function placeOf(effect: Json | null): string | null {
  if (effect?.['kind'] === 'entity_register') return str(effect['entityKey']);
  if (effect?.['kind'] !== 'ledger' || effect['field'] !== 'entity') return null;
  return str(record(effect['to'])?.['entityKey']);
}

/** Whether a question asks where its lines belong: a placement key, no trip, no register. */
function judgedPlacement(question: Json): boolean {
  const key = str(question['key']);
  if (key === null ? question['fact'] !== 'placement' : !PLACEMENT_KEY.test(key)) return false;
  if (key !== null && key.startsWith('open_') && /_register(_\d+)?$/.test(key)) return false;
  return records(question['options']).every((option) => {
    const effect = record(option['effect']);
    return effect?.['kind'] !== 'entity_register' && texts(effect?.['trips']).length === 0;
  });
}

interface Pointer {
  readonly kind: string;
  readonly source: string;
  readonly quote: string;
}

/** A pointer the agent wrote, its source's kind and name; null when it is not one. */
function pointerOf(value: unknown): Pointer | null {
  const pointer = record(value);
  if (pointer === null || Object.keys(pointer).length !== 2) return null;
  const kind = ['document', 'note', 'answer'].find((name) => name in pointer);
  const source = kind === undefined ? null : str(pointer[kind]);
  const quote = pointer['quote'];
  if (kind === undefined || source === null || typeof quote !== 'string') return null;
  if (verbatimFold(quote) === '' || quote.length > QUOTE_MAX_LENGTH || /\p{Cc}/u.test(quote)) {
    return null;
  }
  return { kind, source, quote };
}

export function unpointedPlacementProblems(workspace: string): Problem[] {
  const all = records(loadJson(join(workspace, 'out', 'questions.json')));
  const questions = all.filter(judgedPlacement);
  const entities = records(record(loadJson(join(workspace, 'profile.json')))?.['entities']);
  const required =
    questions.length > 0 && entities.some((entity) => str(entity['address']) !== null);
  const resolvedAliases = stagedKeyAliases(workspace, entities);
  const { places, problems } = placesFileOf(workspace, entities, resolvedAliases, required);
  if (questions.length === 0) return problems;
  const ledger = records(loadJson(join(workspace, 'out', 'ledger.json')));
  const documents = records(loadJson(join(workspace, 'out', 'documents.json')));
  const staged = new Set(entities.flatMap((entity) => str(entity['key']) ?? []));
  const stagedPlace = (key: string | null): string | null =>
    key === null ? null : (resolvedAliases.get(key) ?? key);
  const placeIn = (effect: unknown): string | null => stagedPlace(placeOf(record(effect)));
  const isRental = (entity: Json): boolean =>
    entity['schedule'] === 'E' || PROPERTY_PROFILE_KINDS.has(str(entity['kind']) ?? '');
  const businesses = entities.filter((entity) => entity['schedule'] === 'C' && !isRental(entity));
  const onlyBusiness = businesses.length === 1 ? str(businesses[0]?.['key']) : null;
  const scheduleOf = new Map(
    entities.map((entity) => [str(entity['key']), str(entity['schedule'])]),
  );
  const ownWords = entities.map((entity) => {
    const key = str(entity['key']);
    const named = [entity['name'], entity['aliases'], entity['listings']].flatMap((v) => texts(v));
    const standard = places.get(key ?? '')?.usps_standard ?? '';
    return [key, new Set([...named, standard].flatMap((text) => [...anchorWords(text)]))] as const;
  });
  // A word two places carry, a platform's "vrbo" or a shared "rental", anchors neither.
  const placesCarrying = new Map<string, number>();
  for (const [, words] of ownWords) {
    for (const word of words) placesCarrying.set(word, (placesCarrying.get(word) ?? 0) + 1);
  }
  const placeWords = new Map(
    ownWords.map(([key, words]) => [
      key,
      new Set([...words].filter((word) => placesCarrying.get(word) === 1)),
    ]),
  );
  const notes = record(loadJson(join(workspace, 'notes.json')));
  const placeNotes = record(notes?.['entities']) ?? {};
  const answers = record(loadJson(join(workspace, 'answers.json'))) ?? {};
  const chosenPlace = (answer: Json | null): string | null => {
    const chosen = str(record(answer?.['answer'])?.['optionId']);
    return placeIn(
      records(answer?.['options']).find((option) => option['id'] === chosen)?.['effect'],
    );
  };
  const waiting = new Set(waitingLineIds(workspace));
  const digest = records(
    record(loadJson(join(workspace, 'confirmed', 'summaries.json')))?.['items'],
  );
  const digestIds = new Set(digest.flatMap((item) => str(item['id']) ?? []));

  /** A document's printed strings and addresses: its staged reading's pages, else its entry. */
  const printedByStem = new Map<string, ReturnType<typeof readPrinted>>();
  const printedOf = (reference: string): ReturnType<typeof readPrinted> => {
    const known = printedByStem.get(stem(reference));
    if (known !== undefined) return known;
    const printed = readPrinted(reference);
    printedByStem.set(stem(reference), printed);
    return printed;
  };
  function readPrinted(reference: string) {
    const reading = record(loadJson(join(workspace, 'extractions', `${stem(reference)}.json`)));
    const entries =
      reading !== null
        ? records(reading['pages'])
        : documents.filter((entry) => stem(str(entry['file']) ?? '') === stem(reference));
    const fields = entries.map((entry) => record(entry['fields']));
    return {
      known: entries.length > 0,
      // What the page prints: an address by its printed line, never the model's standard form.
      strings: [
        ...texts(fields.map(printedFieldsOf)),
        ...entries.flatMap((entry) => texts(entry['notes'])),
      ],
      addresses: fields.flatMap((field) => readingAddressesOf(field?.['addresses'])),
      staged: reading !== null,
      hint: str(reading?.['hint_entity']),
    };
  }

  // The lines a question asks about, as check_outputs' placementLines reads its cites: the ids it
  // cites, and every line of a document it cites none of whose lines it names; null when one is a
  // digest line, which this gate does not judge.
  const citedLines = (question: Json): Json[] | null => {
    const cites = texts(question['cites']);
    const lineCites = new Set(cites.filter((cite) => /^L\d+$/.test(cite)));
    if ([...lineCites].some((id) => digestIds.has(id))) return null;
    const lines = ledger.filter((item) => lineCites.has(str(item['id']) ?? ''));
    const named = new Set(lines.flatMap((item) => stem(str(item['source_file']) ?? '')));
    const cited = new Set(
      cites
        .filter((cite) => !lineCites.has(cite))
        .map(stem)
        .filter((doc) => !named.has(doc)),
    );
    if (digest.some((item) => cited.has(stem(str(item['source_file']) ?? '')))) return null;
    return [...lines, ...ledger.filter((item) => cited.has(stem(str(item['source_file']) ?? '')))];
  };
  const asked = new Map(questions.map((question) => [question, citedLines(question)]));
  // A line a placement question asks about may sit where the run guessed, so none is evidence.
  const askedIds = new Set(
    [...asked.values()].flatMap((lines) => (lines ?? []).flatMap((item) => str(item['id']) ?? [])),
  );
  const evidence = ledger.filter(
    (item) =>
      item['status'] === 'confirmed' &&
      !askedIds.has(str(item['id']) ?? '') &&
      staged.has(stagedPlace(str(item['entity'])) ?? ''),
  );

  const exempt = (item: Json): boolean =>
    str(item['source_file']) === null ||
    item['kind'] === 'income' ||
    item['meal'] === true ||
    travelLine(item) ||
    item['status'] !== 'confirmed' ||
    str(item['trip']) !== null ||
    waiting.has(str(item['id']) ?? '');

  /** The places staged facts point a line to, the agent writing nothing. */
  const codePointers = (item: Json): Set<string> => {
    const source = stem(str(item['source_file']) ?? '');
    const vendor = keyWords(str(item['vendor']) ?? '');
    const sameDocOrVendor = (row: Json): boolean =>
      stem(str(row['source_file']) ?? '') === source ||
      containsPhrase(keyWords(str(row['vendor']) ?? ''), vendor);
    const printed = printedOf(str(item['source_file']) ?? '');
    const pointed = new Set<string>(
      evidence.filter(sameDocOrVendor).flatMap((row) => stagedPlace(str(row['entity'])) ?? []),
    );
    if (printed.hint !== null && staged.has(printed.hint)) pointed.add(printed.hint);
    for (const [place, standard] of places) {
      if (printed.staged && printed.addresses.some((a) => sameStandardAddress(a, standard))) {
        pointed.add(place);
      }
    }
    for (const row of digest.filter(sameDocOrVendor)) {
      const schedule = str(row['schedule']);
      if (schedule !== null) pointed.add(`${ON_SCHEDULE}${schedule}`);
    }
    for (const raw of Object.values(answers)) {
      const place = chosenPlace(record(raw));
      const prompt = keyWords(texts(record(raw)?.['prompt']).join(' '));
      if (place !== null && containsPhrase(prompt, vendor)) pointed.add(place);
    }
    return pointed;
  };

  /** Whether a verbatim quote of `pointer` ties `item` to `place`. */
  const quoteTies = (pointer: Pointer, item: Json, place: string): boolean => {
    const vendor = str(item['vendor']) ?? '';
    const vendorWords = anchorWords(vendor);
    const vendorTie =
      vendorWords.size > 0
        ? sharesWord(pointer.quote, vendorWords)
        : vendor !== '' && verbatimFold(pointer.quote).includes(verbatimFold(vendor));
    const placeTie = sharesWord(pointer.quote, placeWords.get(place) ?? new Set());
    if (pointer.kind === 'answer')
      return vendorTie && chosenPlace(record(answers[pointer.source])) === place;
    if (pointer.kind === 'note') return vendorTie && (pointer.source !== 'year' || placeTie);
    const quote = addressFold(pointer.quote);
    const quoteDigitRuns = new Set(pointer.quote.match(/\d+/g) ?? []);
    // An address quote names a printed address, by its house number or its line, and is never
    // tied by a word: "421 Birch St" shares "birch" with 412 Birch St.
    const quotedAddresses = printedOf(pointer.source).addresses.filter((address) => {
      const printed = addressFold(address.as_printed);
      const house = printedHouseNumber(address);
      return (
        (house !== null && quoteDigitRuns.has(house)) ||
        (printed !== '' && (quote.includes(printed) || printed.includes(quote)))
      );
    });
    const tie =
      quotedAddresses.length > 0
        ? quotedAddresses.some((address) => sameStandardAddress(address, places.get(place) ?? null))
        : placeTie;
    return tie && (stem(pointer.source) === stem(str(item['source_file']) ?? '') || vendorTie);
  };

  /** The strings a pointer may quote, or null when it names no source an option may quote. */
  const quoteSources = (pointer: Pointer, place: string | null): string[] | null => {
    if (pointer.kind === 'document') {
      const printed = printedOf(pointer.source);
      return printed.known ? printed.strings : null;
    }
    if (pointer.kind === 'answer') {
      const answer = record(answers[pointer.source]);
      return answer === null ? null : texts(answer['prompt']);
    }
    if (pointer.source === 'year') return texts(notes?.['year']);
    return pointer.source === place && pointer.source in placeNotes
      ? texts(placeNotes[pointer.source])
      : null;
  };

  /** The quote pointers of a question's options, checked against their sources. */
  const quotedOptions = (question: Json) =>
    records(question['options']).flatMap((option, optionIndex) => {
      if (option['pointer'] === undefined) return [];
      const name = `out/questions.json entry ${String(all.indexOf(question))} option ${String(optionIndex)}`;
      const place = placeIn(option['effect']);
      const pointer = pointerOf(option['pointer']);
      const sources = pointer === null ? null : quoteSources(pointer, place);
      if (pointer === null || sources === null || place === null) {
        problems.push({
          code: 'schema',
          message: `${POINTER_MALFORMED}: ${name} carries a pointer that is not {document|note|answer, quote} naming a staged document, the year's note or its own place's note, or an answer, with a quote of 1 to ${String(QUOTE_MAX_LENGTH)} characters, on an option placing lines (reference/steps/4-ask.md)`,
        });
        return [];
      }
      if (!quotedIn(sources, pointer.quote)) {
        problems.push({
          code: 'schema',
          message: `${POINTER_UNQUOTED}: ${name} quotes text its pointer's source does not carry; copy the quote verbatim from the document's printed text, the note or the answer's prompt (reference/steps/4-ask.md)`,
        });
        return [];
      }
      return [{ pointer, place }];
    });

  const refused = questions.filter((question) => {
    const quoted = quotedOptions(question);
    const lines = asked.get(question);
    if (lines === null || lines === undefined) return false;
    const recommendsBusiness = records(question['options']).some(
      (option) => option['recommended'] === true && placeIn(option['effect']) === onlyBusiness,
    );
    // A line's own place is the run's booking, never a pointer: it is judged wherever it sits.
    const pointers = lines.map((item) => {
      if (exempt(item)) return null;
      const pointed = codePointers(item);
      for (const { pointer, place } of quoted) {
        if (quoteTies(pointer, item, place)) pointed.add(place);
      }
      const vendor = keyWords(str(item['vendor']) ?? '');
      const rentalNamesVendor = entities.some(
        (entity) =>
          isRental(entity) &&
          texts(placeNotes[str(entity['key']) ?? '']).some((note) =>
            containsPhrase(keyWords(note), vendor),
          ),
      );
      if (
        recommendsBusiness &&
        onlyBusiness !== null &&
        (str(item['schedule']) ?? 'C') === 'C' &&
        !rentalNamesVendor &&
        [...pointed].every((place) => place === onlyBusiness || place === `${ON_SCHEDULE}C`)
      ) {
        pointed.add(onlyBusiness);
      }
      return pointed;
    });
    if (pointers.some((places) => places !== null && places.size === 0)) return true;
    return records(question['options']).some((option) => {
      if (option['recommended'] !== true && option['placed'] !== true) return false;
      const place = placeIn(option['effect']);
      if (place === null) return false;
      const placed = option['placed'] === true;
      const onSchedule = `${ON_SCHEDULE}${scheduleOf.get(place) ?? ''}`;
      const missing = (pointed: ReadonlySet<string>): boolean =>
        !pointed.has(place) && (placed || !pointed.has(onSchedule));
      // A placement is placed only where the documents point to that place alone.
      const elsewhere = (pointed: ReadonlySet<string>): boolean =>
        placed && [...pointed].some((other) => other !== place && !other.startsWith(ON_SCHEDULE));
      return pointers.some(
        (pointed) => pointed !== null && (missing(pointed) || elsewhere(pointed)),
      );
    });
  });
  if (refused.length > 0) {
    problems.push({
      code: 'invariant',
      message: `${PLACEMENT_UNPOINTED}: questions.json asks ${String(refused.length)} placement question(s) citing a line no pointer ties to a staged place, or recommending or placing lines on a place no pointer of theirs names, or placing them beside a pointer to another place; write pointer {document|note|answer, quote} on the option whose place the document, a note or an earlier answer names, quoting it verbatim, or ask nothing for such a line, leave it unassigned and write an entity_unestablished finding citing it that says its document names no property (reference/steps/4-ask.md)`,
    });
  }
  return problems;
}

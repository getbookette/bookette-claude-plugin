// The question vocabulary the books agent's questions share (plan task 15.10, ADR 0104): the two
// kinds the registry knows, the key shape the agent's own questions take, the per-run cap and the
// length limits. check_outputs' gates and the importer read these words from here. Pure code with no imports, so it resolves inside the runner image at
// /skill/bookette-books like the rest of the package.

/** The catalog key of the batch's one which-property-or-business question (SKILL.md step 4). */
export const UNASSIGNED_LINE_ENTITY_KEY = 'unassigned_line_entity_q';

/**
 * The keys of the questions that decide where a line goes (issues #1261 and #1257): the catalog's
 * `unassigned_line_entity_q` and the recipe's `open_<subject>_placement` and
 * `open_<subject>_register` keys with their numbered follow-ups (`spellOpenQuestionKey`: subject
 * words of `[a-z0-9]`, `_<n>` from 2; no other fact kind ends in either word). A live answer to one
 * has said where its cited lines go, or that they go nowhere (`personal`, `not_mine`), so neither
 * the sort request nor check_outputs' `waiting_lines_unasked` owes them a question again; an
 * answer of any other kind (`line_category_q`, a `correct_line:` or `correct_reading:`
 * correction, an `open_` question of another fact) settles something else, and the line still
 * waits for a place. A regular expression in a string, so Postgres (`~`) and JavaScript read the
 * same text: packages/db/src/sort-request.ts carries the same string, which cannot import this
 * package, and packages/config/test/placement-key-pattern.spec.ts pins the two equal.
 */
export const PLACEMENT_QUESTION_KEY_PATTERN =
  '^(unassigned_line_entity_q|open_[a-z0-9_]+_(placement|register)(_[0-9]+)?)$';

/** The option id of a found place's "each document on its own" answer (step 4's found places): it
 *  places nothing and owes one question per document, so like a typed answer (no `optionId`, a
 *  follow-up owed) it settles no waiting line. packages/db/src/sort-request.ts carries the same
 *  id, pinned equal by packages/config/test/placement-key-pattern.spec.ts. */
export const PER_DOCUMENT_OPTION_ID = 'per_document';

/** The registry's closed set of question kinds (0104 item 2). */
export const QUESTION_KINDS = ['question', 'open'] as const;

export type QuestionKind = (typeof QUESTION_KINDS)[number];

export const OPEN_QUESTION_KEY_PREFIX = 'open_';

/** The whole key, prefix included: 0104 item 2's "at most 64 characters". */
export const OPEN_QUESTION_KEY_MAX_LENGTH = 64;

/** snake_case after the prefix: runs of lowercase letters and digits joined by single underscores. */
export const OPEN_QUESTION_KEY_PATTERN = /^open_[a-z0-9]+(?:_[a-z0-9]+)*$/;

/** True for a well-formed key of the agent's own: the pattern and the whole-key length limit. */
export function isOpenQuestionKey(key: string): boolean {
  return key.length <= OPEN_QUESTION_KEY_MAX_LENGTH && OPEN_QUESTION_KEY_PATTERN.test(key);
}

/** The kind a key implies: `open` for a well-formed `open_` key, `question` for any other. */
export function questionKindOfKey(key: string): QuestionKind {
  return isOpenQuestionKey(key) ? 'open' : 'question';
}

// The key recipe: the key of a question of the agent's own is `open_<subject>_<fact>`, `_<n>`
// appended for the nth follow-up to an answered key. The agent writes the fact (one of the
// catalog's `open.facts`) and the question's cites and options; `pipeline.js build` spells the key
// with `spellOpenQuestionKey` and check_outputs refuses any other, so two runs over the same
// documents and state ask one fact under one key and an answer stored by key is found again. The
// build, check_outputs, the eval's scorer and the personal tool call these same functions, each
// passing the outputs' identifier, URL and policy scan as `flagged`, so this file stays
// import-free.

/** What a fact kind's subject names (the catalog's `open.facts[].subject`). */
export const OPEN_QUESTION_SUBJECTS = ['document', 'place', 'entity', 'vehicle', 'use'] as const;

export type OpenQuestionSubject = (typeof OPEN_QUESTION_SUBJECTS)[number];

/**
 * The fact kind of a pass-through column a payout export read by hand leaves open (issue #1153):
 * whether a column such as the cleaning fee the guest paid is already inside the income column
 * booked as the gross. Its subject is the export, so its key is `open_<document>_pass_through`.
 * The catalog's `open.facts` entry fixes its two options, `inside` (a `ledger`/`settled` effect:
 * the next run settles the column's lines as already inside the gross) and `own_income` (a `ledger`/`entity`
 * effect booking them to the gross's place), and check_outputs holds the question to them.
 */
export const PASS_THROUGH_FACT = 'pass_through';

/** The longest subject: with `open_`, the longest fact kind and a two-digit follow-up number, a
 *  key stays within OPEN_QUESTION_KEY_MAX_LENGTH. */
export const OPEN_QUESTION_SUBJECT_MAX_LENGTH = 43;

// The word budgets: a place's name, a document's name (a collision position and a vendor ride
// after it), and a vendor.
const PLACE_MAX = 40;
const DOCUMENT_MAX = 28;
const VENDOR_MAX = 11;

/** True when a text would fail the identifier, URL or policy scan the run's outputs pass. */
export type KeyFlag = (text: string) => boolean;

/** A stable subject for a name that spells none: `h` and the FNV-1a hash of its UTF-16 code
 *  units as eight hex digits, a shape no identifier scan flags. */
export function hashSubject(text: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `h${hash.toString(16).padStart(8, '0')}`;
}

/**
 * A text's key words: accents dropped (NFKD, combining marks removed), lowercased, the runs of
 * `a-z` and `0-9`, less every word that carries a run of nine or more digits (the shape of an
 * account, card, order or tax number). A name written only in another script has none.
 */
export function keyWords(text: string): string[] {
  const words =
    text
      .normalize('NFKD')
      .replace(/\p{M}/gu, '')
      .toLowerCase()
      .match(/[a-z0-9]+/g) ?? [];
  return words.filter((word) => !/\d{9}/.test(word));
}

/** Whole words while they fit in `max` characters joined by `_`; a first word longer is cut. */
function fitWords(words: readonly string[], max: number): string[] {
  const kept: string[] = [];
  let length = -1;
  for (const word of words) {
    if (length + 1 + word.length > max) {
      if (kept.length === 0) kept.push(word.slice(0, max));
      break;
    }
    kept.push(word);
    length += 1 + word.length;
  }
  return kept;
}

/**
 * The subject the words spell, safe inside its key: while the key would fail the scan, the last
 * digit-only word is dropped; no word left, or still flagged with no digit-only word to drop,
 * spells the source's hash.
 */
function safeSubject(
  words: readonly string[],
  fact: string,
  source: string,
  flagged: KeyFlag,
): string {
  const kept = [...words];
  for (;;) {
    if (kept.length === 0) return hashSubject(source);
    const subject = kept.join('_');
    if (!flagged(openQuestionKey(subject, fact))) return subject;
    let last = -1;
    kept.forEach((word, index) => {
      if (/^\d+$/.test(word)) last = index;
    });
    if (last === -1) return hashSubject(source);
    kept.splice(last, 1);
  }
}

/** A document's name below `inbox/` without its extension, folders included (`may/scan`). */
function documentName(path: string): string {
  const below = path.startsWith('inbox/') ? path.slice('inbox/'.length) : path;
  const slash = below.lastIndexOf('/');
  const file = below.slice(slash + 1);
  const dot = file.lastIndexOf('.');
  return `${below.slice(0, slash + 1)}${dot > 0 ? file.slice(0, dot) : file}`;
}

/** The words a document's name spells within the document budget. */
function documentWords(path: string): string[] {
  return fitWords(keyWords(documentName(path)), DOCUMENT_MAX);
}

/**
 * A found place's subject, which is also its `entity_register` option's `entityKey`: the words of
 * its `entityName` within 40 characters (`2207 Birch St` is `2207_birch_st`), scan-safe, the hash
 * of the name when it spells nothing, and never the `ent_<n>` shape a declared row's key takes.
 */
export function placeSubject(entityName: string, flagged: KeyFlag): string {
  const subject = safeSubject(
    fitWords(keyWords(entityName), PLACE_MAX),
    'register',
    entityName,
    flagged,
  );
  return /^ent_\d+$/.test(subject) ? `place_${subject}` : subject;
}

/** A profile key as a subject: itself when it is snake_case within 40 characters and scan-safe,
 *  else its hash. */
export function profileKeySubject(key: string, fact: string, flagged: KeyFlag): string {
  return /^[a-z0-9]+(?:_[a-z0-9]+)*$/.test(key) &&
    key.length <= PLACE_MAX &&
    !flagged(openQuestionKey(key, fact))
    ? key
    : hashSubject(key);
}

/** A recipe key's parts: its subject, its fact kind and its follow-up number (null on the first ask). */
export interface OpenQuestionKeyParts {
  readonly subject: string;
  readonly fact: string;
  readonly followUp: number | null;
}

/** The recipe key of a subject and a fact, `_<n>` appended for a follow-up (n from 2). */
export function openQuestionKey(
  subject: string,
  fact: string,
  followUp: number | null = null,
): string {
  const suffix = followUp === null ? '' : `_${String(followUp)}`;
  return `${OPEN_QUESTION_KEY_PREFIX}${subject}_${fact}${suffix}`;
}

/**
 * A well-formed `open_` key split into the recipe's parts against the catalog's fact kinds, the
 * longest kind the key ends with winning; null when the key is not well-formed or names no kind
 * after a non-empty subject. A trailing `_<n>`, n of 2 or more with no leading zero, is the
 * follow-up number when a kind precedes it.
 */
export function parseOpenQuestionKey(
  key: string,
  facts: readonly string[],
): OpenQuestionKeyParts | null {
  if (!isOpenQuestionKey(key)) return null;
  const body = key.slice(OPEN_QUESTION_KEY_PREFIX.length);
  const longestFirst = [...facts].sort((a, b) => b.length - a.length);
  const split = (text: string): { subject: string; fact: string } | null => {
    for (const fact of longestFirst) {
      if (text.length > fact.length + 1 && text.endsWith(`_${fact}`)) {
        return { subject: text.slice(0, text.length - fact.length - 1), fact };
      }
    }
    return null;
  };
  const numbered = /^(.+)_([2-9]|[1-9][0-9]+)$/.exec(body);
  if (numbered !== null) {
    const parts = split(numbered[1] ?? '');
    if (parts !== null) return { ...parts, followUp: Number(numbered[2]) };
  }
  const parts = split(body);
  return parts === null ? null : { ...parts, followUp: null };
}

/** Whether a key is an `open_` placement question's (issue #1384): the questions whose
 *  `personal`, `not_mine` and `per_document` answers take their cited lines off their place,
 *  which check_outputs arms and Review words. Never a catalog key. */
export function isOpenPlacementKey(key: string): boolean {
  return parseOpenQuestionKey(key, ['placement'])?.fact === 'placement';
}

/** A line the key recipe reads: the document it was booked from and its vendor. */
export interface KeyLine {
  readonly sourceFile: string | null;
  readonly vendor: string | null;
}

/** The parts of an option's effect the key recipe reads. */
export interface KeyEffect {
  readonly kind: string;
  readonly entityKey?: string;
  readonly entityName?: string;
}

/** A question as the key recipe reads it: its fact kind, the profile key it is about (an
 *  entity, a vehicle or a place's use of a vehicle, where its options name none), its cites and
 *  its options' effects. */
export interface KeyQuestion {
  readonly fact: string;
  readonly about: string | null;
  readonly cites: readonly unknown[];
  readonly effects: readonly KeyEffect[];
}

/** What the run knows that a key is spelled from. */
export interface KeyContext {
  /** The catalog's fact kinds, each with what its subject names. */
  readonly facts: ReadonlyMap<string, OpenQuestionSubject>;
  /** The keys `answers.json` carries. */
  readonly answered: ReadonlySet<string>;
  /** Every line by ledger id: this run's additions and the confirmed digest's items and held rows. */
  readonly lines: ReadonlyMap<string, KeyLine>;
  /** Every document the run knows: the inventory's files and the lines' source files. */
  readonly documents: readonly string[];
  readonly entityKeys: ReadonlySet<string>;
  readonly vehicleKeys: ReadonlySet<string>;
  /** The keys of the profile vehicles' uses (`use_<id>`): a miles fact is about one. */
  readonly useKeys: ReadonlySet<string>;
  readonly flagged: KeyFlag;
}

export type SpelledKey =
  { readonly ok: true; readonly key: string } | { readonly ok: false; readonly reason: string };

/** A cite's document: the source file of the line it names, an inbox path, or a staged reading's
 *  `doc_<id>` (the inbox file of that name when the run knows one); null for any other cite. */
export function citedDocument(cite: unknown, context: KeyContext): string | null {
  if (typeof cite !== 'string') return null;
  const line = context.lines.get(cite);
  if (line !== undefined) return line.sourceFile;
  if (cite.startsWith('inbox/')) return cite;
  if (/^doc_\d+$/.test(cite)) {
    return context.documents.find((path) => documentName(path) === cite) ?? cite;
  }
  return null;
}

/**
 * A document's own subject words: its name's words, the hash when it spells none, and when
 * another document the run knows spells the same, its position among them in sorted path order
 * (the first takes none, the next `2`, then `3`).
 */
function documentBase(path: string, context: KeyContext): string[] {
  const own = documentWords(path);
  if (own.length === 0) return [hashSubject(documentName(path))];
  const spelled = own.join('_');
  const colliding = [...new Set([...context.documents, path])]
    .filter((other) => documentWords(other).join('_') === spelled)
    .sort();
  const position = colliding.indexOf(path);
  return position > 0 ? [...own, String(position + 1)] : own;
}

/** The vendor a placement question's subject carries: when the document's lines name more than
 *  one vendor and the lines the question cites from it name one, that vendor's words. */
function vendorWords(path: string, cites: readonly unknown[], context: KeyContext): string[] {
  const vendorOf = (line: KeyLine): string => keyWords(line.vendor ?? '').join('_');
  const vendors = new Set<string>();
  for (const line of context.lines.values()) {
    if (line.sourceFile === path) vendors.add(vendorOf(line));
  }
  if (vendors.size < 2) return [];
  const cited = new Set<string>();
  for (const cite of cites) {
    const line = typeof cite === 'string' ? context.lines.get(cite) : undefined;
    if (line !== undefined && line.sourceFile === path) cited.add(vendorOf(line));
  }
  const [only] = [...cited];
  return cited.size === 1 && only !== undefined && only !== ''
    ? fitWords(only.split('_'), VENDOR_MAX)
    : [];
}

/**
 * The key `pipeline.js build` writes for a question of the agent's own, or why it spells none.
 * The subject by the fact's kind: a document fact the first, in sorted order, of the cited
 * documents' subjects (a `placement` fact adds the vendor when that document carries several);
 * a found place its `entity_register` options' one place; an entity, a vehicle or a use the profile
 * key `about` names (a `purchase` fact may name it by its `asset_register` options instead). Then the
 * follow-up number: the key as spelled while unanswered, else the first `_<n>` from 2 that is.
 * Reasons name the rule, never a value.
 */
export function spellOpenQuestionKey(question: KeyQuestion, context: KeyContext): SpelledKey {
  const refuse = (reason: string): SpelledKey => ({ ok: false, reason });
  const { fact, effects, cites } = question;
  const kind = context.facts.get(fact);
  if (kind === undefined) return refuse('names no fact kind of the catalog (open.facts)');
  if (kind !== 'place' && effects.some((effect) => effect.kind === 'entity_register')) {
    return refuse('offers an entity_register option but its fact is no register fact');
  }
  const flagged = context.flagged;
  let subject: string;
  switch (kind) {
    case 'document': {
      const documents = [
        ...new Set(cites.map((cite) => citedDocument(cite, context)).filter((d) => d !== null)),
      ];
      if (documents.length === 0)
        return refuse('names a document fact but cites no line or document');
      const based = documents
        .map((path) => ({ path, words: documentBase(path, context) }))
        .sort((a, b) => (a.words.join('_') < b.words.join('_') ? -1 : 1));
      const first = based[0];
      if (first === undefined) return refuse('names a document fact but cites no line or document');
      const words =
        fact === 'placement'
          ? [...first.words, ...vendorWords(first.path, cites, context)]
          : first.words;
      subject = safeSubject(words, fact, documentName(first.path), flagged);
      break;
    }
    case 'place': {
      const places = new Set(
        effects
          .filter((effect) => effect.kind === 'entity_register')
          .map((effect) => placeSubject(effect.entityName ?? '', flagged)),
      );
      const [only] = [...places];
      if (only === undefined)
        return refuse('names a found place but offers no entity_register option');
      if (places.size > 1) return refuse('offers entity_register options for more than one place');
      subject = only;
      break;
    }
    case 'entity':
    case 'vehicle':
    case 'use': {
      const keys =
        kind === 'entity'
          ? context.entityKeys
          : kind === 'vehicle'
            ? context.vehicleKeys
            : context.useKeys;
      const assets = new Set(
        effects
          .filter((effect) => effect.kind === 'asset_register')
          .map((effect) => effect.entityKey ?? ''),
      );
      const about = question.about ?? (assets.size === 1 ? ([...assets][0] ?? null) : null);
      const named =
        about === null
          ? undefined
          : [...keys].find(
              (key) => key === about || profileKeySubject(key, fact, flagged) === about,
            );
      if (named === undefined) {
        return refuse(`names no ${kind} the profile carries: write its key in about`);
      }
      if (kind === 'entity' && [...assets].some((key) => key !== named)) {
        return refuse(
          'offers an asset_register option for another entity than the one it is about',
        );
      }
      subject = profileKeySubject(named, fact, flagged);
      break;
    }
  }
  let key = openQuestionKey(subject, fact);
  for (let followUp = 2; context.answered.has(key); followUp += 1) {
    key = openQuestionKey(subject, fact, followUp);
  }
  return isOpenQuestionKey(key) ? { ok: true, key } : refuse('spells a key longer than the limit');
}

/** The most questions one run asks (gate G7); a stable key the run could not ask is asked next run. */
export const MAX_QUESTIONS_PER_RUN = 15;

/**
 * The option a stored placement booked its lines by (issue #1384, decision record 0150): a
 * question's first option when it carries `"placed": true`, which only a `sort_then_show` run
 * writes and check_outputs refuses anywhere else. The importer stores such a question `PLACED`
 * rather than asking it, check_outputs leaves it out of the cap and scopes the un-place arm to it,
 * and the report and the hand-off workbook name its place by this option's label. Null for every
 * other question.
 */
export function placedOptionOf(options: unknown): Readonly<Record<string, unknown>> | null {
  if (!Array.isArray(options)) return null;
  const first: unknown = options[0];
  if (typeof first !== 'object' || first === null || Array.isArray(first)) return null;
  return (first as Record<string, unknown>)['placed'] === true
    ? (first as Record<string, unknown>)
    : null;
}

/** The answers that take a stored placement's lines off their place (issue #1384, decision record
 *  0150 item 6): `personal`, `not_mine` and `per_document`, each a `none` option. check_outputs
 *  arms the un-place on these alone, and the Review card of a placement sent back words them as
 *  taking the lines off the placed place. */
export const UNPLACING_OPTION_IDS: ReadonlySet<string> = new Set([
  'personal',
  'not_mine',
  PER_DOCUMENT_OPTION_ID,
]);

/** The title of the stored placements' group, the same on the report and in the hand-off
 *  workbook (issue #1384's founder ruling), so the accountant reads one set under one name. */
export const PLACED_GROUP_TITLE = 'Placed by Bookette without asking';

/** The declared row a stored placement's placed option books its lines on: the id of the
 *  `ent_<id>` key the run bundle staged and the option's `to` names; null for any other question
 *  or key. */
export function placedEntityIdOf(options: unknown): number | null {
  const effect = placedOptionOf(options)?.['effect'];
  if (typeof effect !== 'object' || effect === null || Array.isArray(effect)) return null;
  const to = (effect as Record<string, unknown>)['to'];
  if (typeof to !== 'object' || to === null || Array.isArray(to)) return null;
  const key = (to as Record<string, unknown>)['entityKey'];
  const id = typeof key === 'string' ? /^ent_(\d+)$/.exec(key)?.[1] : undefined;
  return id === undefined ? null : Number(id);
}

/** The declared row a stored placement still sits on: its placed option's row while at least one
 *  line it cites remains and every one books there - the test Send back uses - else null. Each
 *  reader passes the entity id of every line the question cites, as it reads them. */
export function stillPlacedOn(
  options: unknown,
  citedLineEntities: readonly (number | null | undefined)[],
): number | null {
  const placed = placedEntityIdOf(options);
  return placed !== null &&
    citedLineEntities.length > 0 &&
    citedLineEntities.every((entity) => entity === placed)
    ? placed
    : null;
}

/** What a stored placement's row reads in the report and the hand-off workbook alike: "Placed on
 *  <place>" while every line it cites still books there — the test Send back uses — else the fixed
 *  line, since a move on Documents or a fold may have taken its lines elsewhere first. */
export const PLACED_SINCE_MOVED = 'Placed, since moved';
export function placedLine(place: string | null): string {
  return place === null ? PLACED_SINCE_MOVED : `Placed on ${place}`;
}

/** How many of a run's questions it asks the person: every one but a stored placement
 *  (`placedOptionOf`), which the person is shown, never asked, so the cap does not count it. */
export function askedQuestionCount(questions: readonly unknown[]): number {
  return questions.filter(
    (question) =>
      typeof question !== 'object' ||
      question === null ||
      placedOptionOf((question as Record<string, unknown>)['options']) === null,
  ).length;
}

/** The longest typed answer, in characters (0104 item 4); pinned equal to the database's constant. */
export const TEXT_ANSWER_MAX_LENGTH = 500;

/** The longest question prompt, in characters; pinned equal to the database's constant. */
export const QUESTION_PROMPT_MAX_LENGTH = 300;

/** The longest help line under a question (issue #1638); pinned equal to the database's constant. */
export const QUESTION_HELP_MAX_LENGTH = 200;

// One line of text: no newline, tab or other C0/DEL control character.
// eslint-disable-next-line no-control-regex
const CONTROL_CHARACTER = /[\u0000-\u001f\u007f]/;

/** One line of model text a person reads, trimmed, when it is a non-empty string of at most `max`
 *  characters with no control character; else null. */
export function oneLineText(raw: unknown, max: number): string | null {
  if (typeof raw !== 'string' || CONTROL_CHARACTER.test(raw)) return null;
  const text = raw.trim();
  return text === '' || text.length > max ? null : text;
}

/** A question's help line (issue #1638), trimmed, when its `help` value is a non-empty string of
 *  at most QUESTION_HELP_MAX_LENGTH characters with no control character; else null.
 *  check_outputs and both importers read it here. */
export function questionHelpOf(value: unknown): string | null {
  return oneLineText(value, QUESTION_HELP_MAX_LENGTH);
}

// The free strings of an effect payload a person reads: an asset's description, an entity's or a
// trip's name, a trip's purpose, a segment's location, the address a found place's match records
// on a declared place (issue #1070), the alias a found business's match records (issue #1159) and
// the listing a found rental's match records (issue #1387).
const EFFECT_STRING_KEYS: ReadonlySet<string> = new Set([
  'description',
  'entityName',
  'name',
  'purpose',
  'location',
  'address',
  'alias',
  'listing',
]);

/**
 * The entity names the person wrote: every entity of the staged profile with a string key and a
 * string name. The money gate leaves exactly these out of an effect's `entityName`; check_outputs
 * and the eval's gate helper both build their exempt set here.
 */
export function stagedEntityNames(profile: unknown): ReadonlySet<string> {
  const names = new Set<string>();
  if (profile === null || typeof profile !== 'object' || Array.isArray(profile)) return names;
  const entities = (profile as Record<string, unknown>)['entities'];
  if (!Array.isArray(entities)) return names;
  for (const raw of entities as unknown[]) {
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) continue;
    const entity = raw as Record<string, unknown>;
    if (typeof entity['key'] === 'string' && typeof entity['name'] === 'string') {
      names.add(entity['name']);
    }
  }
  return names;
}

function collectEffectStrings(
  value: unknown,
  out: string[],
  profileNames: ReadonlySet<string>,
): void {
  if (Array.isArray(value)) {
    for (const item of value) collectEffectStrings(item, out, profileNames);
  } else if (value !== null && typeof value === 'object') {
    for (const [key, inner] of Object.entries(value)) {
      if (typeof inner === 'string' && EFFECT_STRING_KEYS.has(key)) {
        // An entity name the person wrote in the staged profile.json is theirs, not the run's: a
        // question that must copy it verbatim cannot be reworded around a name such as "99 Cents
        // Studio". Any other name, including one only the run's resolved profile carries, is
        // listed.
        if (key === 'entityName' && profileNames.has(inner)) continue;
        out.push(inner);
      } else if (
        key === 'value' &&
        typeof inner === 'string' &&
        (value as Record<string, unknown>)['field'] === 'services_note'
      ) {
        // A recorded profile fact's services note is the person's text, read like a name.
        out.push(inner);
      } else collectEffectStrings(inner, out, profileNames);
    }
  }
}

/**
 * The strings of a question a person reads: the prompt, its help line, each option label and every string under
 * an option's effect at the keys description, entityName, name, purpose, location, address, alias
 * and listing. The money gate (G6), the eval's gate helper and the display gate read the same
 * list. An `entityName` in `profileNames` (`stagedEntityNames` of the staged profile.json) is left
 * out: the person wrote it, not the run.
 */
export function questionDisplayStrings(
  question: unknown,
  profileNames: ReadonlySet<string> = new Set(),
): string[] {
  const strings: string[] = [];
  if (question === null || typeof question !== 'object' || Array.isArray(question)) return strings;
  const record = question as Record<string, unknown>;
  if (typeof record['prompt'] === 'string') strings.push(record['prompt']);
  if (typeof record['help'] === 'string') strings.push(record['help']);
  const options = record['options'];
  for (const option of Array.isArray(options) ? (options as unknown[]) : []) {
    if (option === null || typeof option !== 'object' || Array.isArray(option)) continue;
    const entry = option as Record<string, unknown>;
    if (typeof entry['label'] === 'string') strings.push(entry['label']);
    collectEffectStrings(entry['effect'], strings, profileNames);
  }
  return strings;
}

/**
 * The alternatives invariant 5 leaves to the accountant that one cost can be recorded under
 * (decision record 0011 item 3 and its #1080 amendment), each as the words that name its two
 * methods. Schedule E or C is not here: its options are register effects, which check_outputs
 * already refuses on two schedules. Improvement or repair is not here either: what work a job
 * involved is a fact a `work` question asks, and its tag computes both readings either way
 * (decision record 0105's #691 amendment).
 */
export const TREATMENT_ALTERNATIVES: readonly {
  readonly name: string;
  readonly sides: readonly [RegExp, RegExp];
}[] = [
  {
    name: 'home-office methods',
    sides: [
      /\bsimplified\b/i,
      /\bregular\b|\bactual (?:home )?(?:costs?|expenses?)\b|\bform 8829\b|^\s*actual\s*$/i,
    ],
  },
  {
    name: 'vehicle methods',
    sides: [
      /\bstandard (?:mileage|rate)\b|\b(?:mileage|irs) rate\b|\brate per mile\b/i,
      /\bactual (?:car |vehicle |operating )?(?:costs?|expenses?)\b|^\s*actual\s*$/i,
    ],
  },
  {
    name: 'meal methods',
    sides: [
      /\bper[ -]diem\b/i,
      /\bactual (?:meals?|meal (?:costs?|receipts?)|receipts?|costs?|expenses?)\b|^\s*actual\s*$/i,
    ],
  },
];

/**
 * The treatment choice a question offers, or null (issue #1080): the name of the first
 * alternative whose one side an option names and whose other side another option names, read
 * from each option's label or its id (an id's underscores and case changes read as spaces, so
 * `simplified_method` and `simplifiedMethod` both name the method; a bare "Actual" names
 * the actual-cost side). Such a question asks the
 * person which treatment they want, which invariant 5 leaves to the accountant: both readings go
 * on the report and an open item names the choice. The prompt is not read, so a question asking
 * a fact a method needs may name both methods while it asks.
 */
export function treatmentChoiceOf(question: unknown): string | null {
  if (question === null || typeof question !== 'object' || Array.isArray(question)) return null;
  const options = (question as Record<string, unknown>)['options'];
  const texts = (Array.isArray(options) ? (options as unknown[]) : []).map((option) => {
    if (option === null || typeof option !== 'object' || Array.isArray(option)) return [];
    const entry = option as Record<string, unknown>;
    return [entry['label'], entry['id']]
      .filter((value): value is string => typeof value === 'string')
      .map((value) => value.replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2'));
  });
  const names = (pattern: RegExp, option: readonly string[]): boolean =>
    option.some((text) => pattern.test(text));
  for (const { name, sides } of TREATMENT_ALTERNATIVES) {
    const [left, right] = sides;
    const offered = texts.some(
      (option, index) =>
        names(left, option) && texts.some((other, at) => at !== index && names(right, other)),
    );
    if (offered) return name;
  }
  return null;
}

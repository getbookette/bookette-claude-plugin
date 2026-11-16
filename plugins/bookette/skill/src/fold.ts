// A place folded into another (issue #1388, decision record 0151): the person's word that two of
// their places are one ("Airbnb is Cedar Cabin"). The confirm stores one born-answered answer under
// `fold_place:ent_<s>`; staging applies every live fold to the run's inputs, and the import that
// consumes one moves the folded place's rows to its target and sets `entities.folded_into`. A place
// is folded, never merged or deleted: its row stays, so the register answer, the audit trail and
// the deletion job keep their references.
//
// One judge serves the three: the fold core at the confirm (apps/web/lib/setup/fold-place.ts),
// staging (apps/worker/src/run-bundle.ts) and the import. It reads the stored folds and the live
// fold answers into one flat map, the answers replayed in confirm order, each judged against what
// stood before it, so the confirm and the run agree on which folds hold. An answer that no longer
// passes (a kind changed, a purchase was declared since) is inert, never rejected, so no workspace
// can deadlock on one. Places already folded into a source follow it to its target.
//
// Pure and filesystem-free, so a client bundle may import it.

import {
  DECLARED_PURCHASE_DESCRIPTION,
  entityNameKey,
  listingIdLongEnough,
  listingKey,
} from './declared-entity';
import { FOLD_PLACE_KEY_PREFIX, parseEffect } from './effects';
import { normalizeParcel } from './parcels';

export { FOLD_PLACE_KEY_PREFIX } from './effects';
export type { EntityFoldEffect } from './effects';

type Json = Record<string, unknown>;

/** The fold question's one option: its id and the confirm button's word. */
export const FOLD_OPTION_ID = 'fold';
export const FOLD_OPTION_LABEL = 'Fold it';

/** Why a fold is refused, at the confirm, and why a live one is inert at a run. */
export type FoldRefusal =
  /** A place folded into itself. */
  | 'same'
  /** A place the workspace does not hold (another workspace's), or a source already folded. */
  | 'unknown'
  /** A property and a business: a fold stays on one schedule. */
  | 'schedule'
  /** A K-1 interest, on either side: Bookette books no K-1 (decision record 0135). */
  | 'kind'
  /** A target that is folded, or the source of a live fold. */
  | 'target_folded'
  /** Both places carry a declared purchase: one place has one price paid. */
  | 'both_purchased'
  /** Both places carry a home office area: a workspace holds one. */
  | 'two_offices'
  /** Two businesses with different EINs: two EINs are two filers (the founder's ruling). */
  | 'ein_differs';

/** One place as the judge reads it. */
export interface FoldPlace {
  readonly id: number;
  /** The `entity_kind` label: RENTAL, STR_RENTAL, BUSINESS, PARTNERSHIP or S_CORP. */
  readonly kind: string;
  /** C, E or K1. */
  readonly schedule: string;
  /** The place a consumed fold moved this one into, or null. */
  readonly foldedInto: number | null;
  readonly ein: string | null;
  /** Whether it carries a declared purchase (the declare core's one `assets` row). */
  readonly purchased: boolean;
  /** Whether it carries a home office area, stored or recorded in a live answer. */
  readonly office: boolean;
}

/** A live fold answer: its source and target ids. */
export interface FoldAnswer {
  readonly from: number;
  readonly to: number;
}

/** One live answer as the readers carry it: its key, its options and the stored value. */
export interface LiveAnswer {
  readonly key: string;
  readonly options: unknown;
  readonly answer: unknown;
}

/** The rows the judge's places are read from: the entity columns, the assets and the live answers
 *  (for a recorded home office). Every reader passes what it already reads. */
export interface FoldEntityRow {
  readonly id: number;
  readonly kind: string;
  readonly schedule: string;
  readonly foldedInto: number | null;
  readonly ein: string | null;
  readonly homeOfficeSqFt: string | null;
}

export interface FoldAssetRow {
  readonly entityId: number;
  readonly kind: string;
  readonly description: string;
}

const K1_KINDS: ReadonlySet<string> = new Set(['PARTNERSHIP', 'S_CORP']);
const RENTAL_KINDS: ReadonlySet<string> = new Set(['RENTAL', 'STR_RENTAL']);
const ENTITY_KEY = /^ent_([1-9]\d*)$/;

/** The fold answer's key for a place: one live key per folded place. */
export function foldKey(placeId: number): string {
  return `${FOLD_PLACE_KEY_PREFIX}ent_${String(placeId)}`;
}

/** The id an `ent_<id>` key names, or null. */
export function entityIdOfKey(key: unknown): number | null {
  if (typeof key !== 'string') return null;
  const match = ENTITY_KEY.exec(key);
  return match === null ? null : Number(match[1]);
}

/** The chosen option's effect of a stored answer, or null. */
function chosenEffect(answer: LiveAnswer): ReturnType<typeof parseEffect> {
  const value = answer.answer;
  const optionId =
    value !== null && typeof value === 'object' && !Array.isArray(value)
      ? (value as Json)['optionId']
      : undefined;
  if (typeof optionId !== 'string' || !Array.isArray(answer.options)) return null;
  const option = (answer.options as unknown[]).find(
    (candidate): candidate is Json =>
      candidate !== null &&
      typeof candidate === 'object' &&
      !Array.isArray(candidate) &&
      (candidate as Json)['id'] === optionId,
  );
  return option === undefined ? null : parseEffect(option['effect']);
}

/** Whether a live answer is a fold answer: its key is exactly `fold_place:ent_<s>`, and its
 *  chosen option an `entity_fold` from that place. */
export function isFoldAnswerKey(key: string): boolean {
  return key.startsWith(FOLD_PLACE_KEY_PREFIX);
}

/** The live fold answers among a workspace's live answers, in the order given (confirm order). A
 *  key outside the exact shape, or an effect that does not agree with it, is no fold. */
export function foldAnswersOf(answers: Iterable<LiveAnswer>): FoldAnswer[] {
  const folds: FoldAnswer[] = [];
  for (const answer of answers) {
    if (!isFoldAnswerKey(answer.key)) continue;
    const effect = chosenEffect(answer);
    if (effect === null || effect.kind !== 'entity_fold') continue;
    if (answer.key !== `${FOLD_PLACE_KEY_PREFIX}${effect.from}`) continue;
    const from = entityIdOfKey(effect.from);
    const to = entityIdOfKey(effect.to);
    if (from === null || to === null) continue;
    folds.push({ from, to });
  }
  return folds;
}

/** The places the judge reads, from the rows every reader already holds: a purchase is the declare
 *  core's fixed `REAL_PROPERTY` row or a live answer whose chosen option registers a `REAL_PROPERTY`
 *  asset on the place, which the next run re-establishes; a home office is the stored area or a
 *  live `profile_fact:ent_<id>:home_office` answer, which the next run overlays. */
export function foldPlacesOf(
  entities: readonly FoldEntityRow[],
  assets: readonly FoldAssetRow[],
  answers: Iterable<LiveAnswer>,
): FoldPlace[] {
  const purchased = new Set(
    assets
      .filter(
        (asset) =>
          asset.kind === 'REAL_PROPERTY' && asset.description === DECLARED_PURCHASE_DESCRIPTION,
      )
      .map((asset) => asset.entityId),
  );
  const recordedOffice = new Set<number>();
  for (const answer of answers) {
    const effect = chosenEffect(answer);
    if (effect?.kind === 'asset_register' && effect.assetKind === 'REAL_PROPERTY') {
      const id = entityIdOfKey(effect.entityKey);
      if (id !== null) purchased.add(id);
      continue;
    }
    const match = /^profile_fact:ent_([1-9]\d*):home_office$/.exec(answer.key);
    if (match === null) continue;
    if (effect?.kind === 'profile_fact' && effect.fact.field === 'home_office') {
      recordedOffice.add(Number(match[1]));
    }
  }
  return entities.map((row) => ({
    id: row.id,
    kind: row.kind,
    schedule: row.schedule,
    foldedInto: row.foldedInto,
    ein: row.ein,
    purchased: purchased.has(row.id),
    office: row.homeOfficeSqFt !== null || recordedOffice.has(row.id),
  }));
}

/** The folds that hold: every folded place's final target, and the steps that put each there. */
export interface FoldResolution {
  /** Each folded place's final target, flat: a place folded into a place that is itself folded
   *  follows it. In replay order: the stored folds by source id, then the live answers. */
  readonly targetOf: ReadonlyMap<number, number>;
  /** The folds as replayed, each into the target it named at its confirm: staging merges each
   *  source's staged facts into that target in this order, so a later fold of the target carries
   *  what the earlier one gave it. */
  readonly steps: readonly FoldAnswer[];
  /** The live answers that no longer pass, with why: inert, never rejected. */
  readonly inert: readonly (FoldAnswer & { readonly refusal: FoldRefusal })[];
}

/** The places folded into `id`, with `id` itself: the group a fold of `id` moves. */
export function foldGroupOf(targetOf: ReadonlyMap<number, number>, id: number): number[] {
  return [id, ...[...targetOf].filter(([, target]) => target === id).map(([source]) => source)];
}

/**
 * The judge: whether `from` may fold into `to` given the folds that already hold. The checks run
 * in a fixed order, the first refusal answering. A group's facts are judged whole: a place folded
 * into `from` moves with it, and one folded into `to` is already there.
 */
export function judgeFold(
  places: readonly FoldPlace[],
  targetOf: ReadonlyMap<number, number>,
  from: number,
  to: number,
): FoldRefusal | null {
  if (from === to) return 'same';
  const byId = new Map(places.map((place) => [place.id, place]));
  const source = byId.get(from);
  const target = byId.get(to);
  if (source === undefined || target === undefined || targetOf.has(from)) return 'unknown';
  if (targetOf.has(to)) return 'target_folded';
  if (K1_KINDS.has(source.kind) || K1_KINDS.has(target.kind)) return 'kind';
  if (source.schedule === 'K1' || target.schedule === 'K1') return 'kind';
  if (source.schedule !== target.schedule) return 'schedule';
  const group = (id: number): FoldPlace[] =>
    foldGroupOf(targetOf, id)
      .map((member) => byId.get(member))
      .filter((member): member is FoldPlace => member !== undefined);
  const fromGroup = group(from);
  const toGroup = group(to);
  if (fromGroup.some((p) => p.purchased) && toGroup.some((p) => p.purchased)) {
    return 'both_purchased';
  }
  if (fromGroup.some((p) => p.office) && toGroup.some((p) => p.office)) return 'two_offices';
  const eins = new Set(
    [...fromGroup, ...toGroup]
      .map((place) => place.ein?.trim() ?? '')
      .filter((ein) => ein !== '')
      .map((ein) => ein.replace(/\D/g, '')),
  );
  if (eins.size > 1) return 'ein_differs';
  return null;
}

/**
 * The folds that hold, in one flat map. The stored folds come first, by source id: a consumed fold
 * stays, whatever its answer says now. Then each live answer, in confirm order, judged against the
 * map as it stands before it, the state its confirm judged; an answer whose source already carries
 * a stored fold is the answer that fold consumed, and is skipped. A passing answer folds its source
 * and every place folded into the source into its target.
 */
export function resolveFolds(
  places: readonly FoldPlace[],
  answers: readonly FoldAnswer[],
): FoldResolution {
  const targetOf = new Map<number, number>();
  const steps: FoldAnswer[] = [];
  const known = new Set(places.map((place) => place.id));
  const stored = places
    .filter((place) => place.foldedInto !== null && known.has(place.foldedInto))
    .sort((left, right) => left.id - right.id);
  // A stored target is never folded (the import re-points every follower), so the stored map is
  // flat already; following a target that is itself folded keeps a stored chain flat too.
  const finalOf = (id: number): number => {
    let current = id;
    const seen = new Set<number>([id]);
    for (;;) {
      const next = places.find((place) => place.id === current)?.foldedInto ?? null;
      if (next === null || seen.has(next) || !known.has(next)) return current;
      seen.add(next);
      current = next;
    }
  };
  for (const place of stored) {
    const target = finalOf(place.id);
    if (target === place.id) continue;
    targetOf.set(place.id, target);
    steps.push({ from: place.id, to: target });
  }
  const inert: (FoldAnswer & { refusal: FoldRefusal })[] = [];
  for (const answer of answers) {
    if (places.some((place) => place.id === answer.from && place.foldedInto !== null)) continue;
    const refusal = judgeFold(places, targetOf, answer.from, answer.to);
    if (refusal !== null) {
      inert.push({ ...answer, refusal });
      continue;
    }
    for (const [source, target] of targetOf) {
      if (target === answer.from) targetOf.set(source, answer.to);
    }
    targetOf.set(answer.from, answer.to);
    steps.push(answer);
  }
  return { targetOf, steps, inert };
}

// --- the staged profile ----------------------------------------------------------------------

const isJson = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const stringsOf = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

/** Whether a staged profile kind is a rental's. */
const isRentalProfileKind = (kind: unknown): boolean =>
  kind === 'residential_rental' || kind === 'short_term_rental';

/** Whether a rental's folded name carries a listing id ("Vrbo 4820193"), so it joins the target's
 *  staged listings; a bare channel name ("Airbnb") carries none and is reserved: staged in the
 *  target's `reserved_names`, never a name a document books by and never registered again, so a
 *  statement printing only it is asked about (the founder's ruling). */
export function foldedNameIsListing(name: string): boolean {
  return listingIdLongEnough(name);
}

/** The list with every entry whose comparison form an earlier entry (or `exclude`) has, left out. */
function distinctBy(
  values: readonly string[],
  keyOf: (value: string) => string,
  exclude: readonly string[] = [],
): string[] {
  const seen = new Set(exclude.map(keyOf));
  const kept: string[] = [];
  for (const value of values) {
    const key = keyOf(value);
    if (key === '' || seen.has(key)) continue;
    seen.add(key);
    kept.push(value);
  }
  return kept;
}

/**
 * The staged profile with the folds applied, a copy: each folded place leaves the entity list, and
 * its target's entry takes, in the steps' order, what the folded place carried that books by:
 * a business's aliases, payers and its own name as one more alias; a rental's listings, its own
 * name as one more listing when it carries a listing id and as a reserved name (`reserved_names`)
 * when it carries none, and the names already reserved on it; its address when the target has
 * none (dropped when it has one); its parcels; its home office when the target has none; and its
 * assets. The folded place's recorded days, stays and services note stay behind with its entry.
 * Every trip, and every use of a vehicle, placed with a folded place names the target. Nothing here
 * is a stored write: the person's rows keep what they hold.
 */
export function applyFoldsToProfile(profile: Json, resolution: FoldResolution): Json {
  if (resolution.steps.length === 0) return profile;
  const result: Json = { ...profile };
  const list = Array.isArray(profile['entities']) ? (profile['entities'] as unknown[]) : [];
  const entries = list.map((entry) => (isJson(entry) ? { ...entry } : entry));
  const byKey = new Map<string, Json>();
  for (const entry of entries) {
    if (isJson(entry) && typeof entry['key'] === 'string') byKey.set(entry['key'], entry);
  }
  for (const step of resolution.steps) {
    const source = byKey.get(`ent_${String(step.from)}`);
    const target = byKey.get(`ent_${String(step.to)}`);
    if (source === undefined || target === undefined) continue;
    const sourceName = typeof source['name'] === 'string' ? source['name'] : '';
    const targetName = typeof target['name'] === 'string' ? target['name'] : '';
    if (target['kind'] === 'business') {
      const aliases = distinctBy(
        [...stringsOf(target['aliases']), ...stringsOf(source['aliases']), sourceName],
        entityNameKey,
        [targetName],
      );
      if (aliases.length > 0) target['aliases'] = aliases;
      const payers = distinctBy(
        [...stringsOf(target['payers']), ...stringsOf(source['payers'])],
        entityNameKey,
      );
      if (payers.length > 0) target['payers'] = payers;
    }
    if (isRentalProfileKind(target['kind'])) {
      const listings = distinctBy(
        [
          ...stringsOf(target['listings']),
          ...stringsOf(source['listings']),
          ...(foldedNameIsListing(sourceName) ? [sourceName] : []),
        ],
        listingKey,
      );
      if (listings.length > 0) target['listings'] = listings;
      const reserved = distinctBy(
        [
          ...stringsOf(target['reserved_names']),
          ...stringsOf(source['reserved_names']),
          ...(foldedNameIsListing(sourceName) ? [] : [sourceName]),
        ],
        entityNameKey,
      );
      if (reserved.length > 0) target['reserved_names'] = reserved;
    }
    if (target['address'] === undefined && typeof source['address'] === 'string') {
      target['address'] = source['address'];
    }
    const parcels = distinctBy(
      [...stringsOf(target['parcels']), ...stringsOf(source['parcels'])],
      normalizeParcel,
    );
    if (parcels.length > 0) target['parcels'] = parcels;
    if (!hasOffice(target['home_office']) && hasOffice(source['home_office'])) {
      target['home_office'] = source['home_office'];
    }
    const assets = [
      ...(Array.isArray(target['assets']) ? (target['assets'] as unknown[]) : []),
      ...(Array.isArray(source['assets']) ? (source['assets'] as unknown[]) : []),
    ];
    if (assets.length > 0) target['assets'] = assets;
  }
  result['entities'] = entries.filter(
    (entry) => !(isJson(entry) && resolution.targetOf.has(entityIdOfKey(entry['key']) ?? -1)),
  );
  const retargeted = (item: unknown): unknown => {
    if (!isJson(item)) return item;
    const id = entityIdOfKey(item['entity']);
    const target = id === null ? undefined : resolution.targetOf.get(id);
    return target === undefined ? item : { ...item, entity: `ent_${String(target)}` };
  };
  if (Array.isArray(profile['trips'])) result['trips'] = profile['trips'].map(retargeted);
  // A vehicle names its places on its uses (decision record 0189).
  if (Array.isArray(profile['vehicles'])) {
    result['vehicles'] = profile['vehicles'].map((vehicle: unknown) =>
      isJson(vehicle) && Array.isArray(vehicle['uses'])
        ? { ...vehicle, uses: vehicle['uses'].map(retargeted) }
        : vehicle,
    );
  }
  return result;
}

/**
 * The notes as staging stages them once the folds apply: a folded place's note joins its target's
 * as one more paragraph, in the replay order, so a later fold of the target carries it on, and a
 * folded place keeps none of its own. The run reads the person's words about a place where the
 * place now books.
 */
export function foldedNotes(
  notes: ReadonlyMap<number, string>,
  resolution: Pick<FoldResolution, 'targetOf' | 'steps'>,
): Map<number, string> {
  const staged = new Map(notes);
  for (const step of resolution.steps) {
    const folded = staged.get(step.from);
    if (folded === undefined) continue;
    const own = staged.get(step.to);
    staged.set(step.to, own === undefined ? folded : `${own}\n\n${folded}`);
    staged.delete(step.from);
  }
  for (const source of resolution.targetOf.keys()) staged.delete(source);
  return staged;
}

/** Whether a staged `home_office` pair carries an office area. */
function hasOffice(value: unknown): boolean {
  return isJson(value) && value['office_sq_ft'] !== null && value['office_sq_ft'] !== undefined;
}

// --- the sentence ----------------------------------------------------------------------------

/** The folded place's recorded facts a fold does not keep, in the order the sentence names them:
 *  no identity column of the target is written, so each stays on the folded row, unread. */
export const NOT_KEPT_FACTS = [
  'ein',
  'activity',
  'activity_code',
  'accounting_method',
  'ownership_pct',
  'placed_in_service',
  'ended_on',
  'fair_rental_days',
  'personal_use_days',
  'stay_count',
  'services_note',
] as const;
export type NotKeptFact = (typeof NOT_KEPT_FACTS)[number];

/** What a fold's sentence says, read by the fold core from the rows the fold moves. */
export interface FoldSentenceFacts {
  readonly fromName: string;
  readonly toName: string;
  /** The rows of the folded place, and of every place folded into it, that move. */
  readonly lines: number;
  readonly trips: number;
  readonly vehicles: number;
  /** A rental whose folded name carries no listing id: statements printing only it are asked. */
  readonly reservedName: boolean;
  /** The folded place's address, when it has one, and whether the target keeps its own. */
  readonly address: { readonly text: string; readonly kept: 'staged' | 'dropped' } | null;
  /** The folded place's recorded facts that are not kept, in `NOT_KEPT_FACTS`' order. */
  readonly notKept: readonly NotKeptFact[];
  /** The target's kind in words when it differs from the folded place's ("a residential rental"):
   *  the folded lines are kept as the target's kind; null when the two are of one kind. */
  readonly kindChange: string | null;
}

const NOT_KEPT_WORDING: Record<NotKeptFact, string> = {
  ein: 'EIN',
  activity: 'activity',
  activity_code: 'activity code',
  accounting_method: 'accounting method',
  ownership_pct: 'ownership share',
  placed_in_service: 'start date',
  ended_on: 'end month',
  fair_rental_days: 'fair rental days',
  personal_use_days: 'personal-use days',
  stay_count: 'stays',
  services_note: 'services note',
};

const PLURAL_FACTS: ReadonlySet<NotKeptFact> = new Set([
  'fair_rental_days',
  'personal_use_days',
  'stay_count',
]);

/** A place's kind in words, as the sentence names a kind the folded lines are kept as. */
export const FOLD_KIND_WORDING: Readonly<Record<string, string>> = {
  RENTAL: 'a residential rental',
  STR_RENTAL: 'a short-term rental',
  BUSINESS: 'a business',
};

function countPhrase(count: number, one: string, many: string): string | null {
  if (count <= 0) return null;
  return `${String(count)} ${count === 1 ? one : many}`;
}

function joinAnd(parts: readonly string[]): string {
  if (parts.length <= 1) return parts.join('');
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1] ?? ''}`;
}

/**
 * The fold's sentence, rendered by code at the offer and again at the confirm, which stores the
 * answer only when the posted sentence is this one: "Fold Airbnb into Cedar Cabin? On your next
 * update its 12 lines and 1 trip move to Cedar Cabin, which then also goes by Airbnb, and Airbnb
 * leaves your places." Counts, never money: mixed lines have no meaningful total, and on the free
 * plan a total would show a masked place's figure. Then, each its own sentence: the kind the lines
 * are kept as when the two places' kinds differ; a rental's bare channel name ("Statements that
 * name only Airbnb will still be asked about."); the folded address staged under a target with
 * none; and one clause naming every recorded fact of the folded place that is not kept — its EIN,
 * activity, codes, share, dates, days, stays, services note and an address the target's own
 * replaces — telling the person to add it on Account if it applies to the target, since nothing of
 * it is written (the founder's ruling: say it, keep nothing). The names and the address are the
 * person's own stored text, which the caller gates for display.
 */
export function foldSentence(facts: FoldSentenceFacts): string {
  const { fromName, toName } = facts;
  const parts = [
    countPhrase(facts.lines, 'line', 'lines'),
    countPhrase(facts.trips, 'trip', 'trips'),
    countPhrase(facts.vehicles, 'vehicle', 'vehicles'),
  ].filter((part): part is string => part !== null);
  const single = parts.length === 1 && [facts.lines, facts.trips, facts.vehicles].includes(1);
  const moves =
    parts.length === 0
      ? `On your next update ${toName} also goes by ${fromName}, and ${fromName} leaves your places.`
      : `On your next update its ${joinAnd(parts)} ${single ? 'moves' : 'move'} to ${toName}, which then also goes by ${fromName}, and ${fromName} leaves your places.`;
  const clauses: string[] = [`Fold ${fromName} into ${toName}? ${moves}`];
  if (facts.kindChange !== null) {
    clauses.push(`Its lines are kept as ${toName}'s, ${facts.kindChange}.`);
  }
  if (facts.reservedName) {
    clauses.push(`Statements that name only ${fromName} will still be asked about.`);
  }
  if (facts.address?.kept === 'staged') {
    clauses.push(
      `${toName} has no address, so documents that print ${facts.address.text} will go to it too.`,
    );
  }
  const named = [
    ...facts.notKept.map((fact) => NOT_KEPT_WORDING[fact]),
    ...(facts.address?.kept === 'dropped' ? [`address (${facts.address.text})`] : []),
  ];
  if (named.length === 1) {
    const plural = facts.notKept.length === 1 && PLURAL_FACTS.has(facts.notKept[0] ?? 'ein');
    clauses.push(
      plural
        ? `Its recorded ${named[0] ?? ''} are not kept: add them on Account if they apply to ${toName}.`
        : `Its recorded ${named[0] ?? ''} is not kept: add it on Account if it applies to ${toName}.`,
    );
  } else if (named.length > 1) {
    clauses.push(
      `Its recorded ${joinAnd(named)} are not kept: add any that applies to ${toName} on Account.`,
    );
  }
  return clauses.join(' ');
}

/** Whether a fold's source is a rental whose name carries no listing id. */
export function foldReservesName(kind: string, name: string): boolean {
  return RENTAL_KINDS.has(kind) && !foldedNameIsListing(name);
}

/** The address a fold's sentence names: the folded place's own, else the first a place already
 *  folded into it carries; and whether the target keeps it (`staged`, the target has none of its
 *  own or from its folds) or its own (`dropped`). Equal addresses, compared as case-folded names
 *  are, say nothing. */
export function foldAddressOf(
  addressOf: ReadonlyMap<number, string | null>,
  resolution: Pick<FoldResolution, 'steps'>,
  from: number,
  to: number,
): FoldSentenceFacts['address'] {
  const effective = (id: number): string | null => {
    const own = addressOf.get(id) ?? null;
    if (own !== null) return own;
    for (const step of resolution.steps) {
      if (step.to !== id) continue;
      const folded = effective(step.from);
      if (folded !== null) return folded;
    }
    return null;
  };
  const source = effective(from);
  if (source === null) return null;
  const target = effective(to);
  if (target === null) return { text: source, kept: 'staged' };
  if (entityNameKey(target) === entityNameKey(source)) return null;
  return { text: source, kept: 'dropped' };
}

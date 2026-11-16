// The profile every Abacus reader computes from (plan row 15.13): the run's resolved profile (or
// the staged one before a run wrote it) with the person's live `profile_fact:` answers overlaid.
// build_books and the home-office readings both come through here, so the sandbox's books, the
// checker's recompute and the importer's rebuild read one profile.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { PROFILE_FACT_KEY_PREFIX } from '../effects';
import { applyProfileFacts, mileageBandsOf } from '../profile-facts';
import { rulesYearOf } from '../rules-year';

type Json = Record<string, unknown>;

// Tolerant like the checker's own loader: a file that is missing or not JSON reads as absent, so a
// malformed answers.json is reported by the gates that own it, never thrown from here.
function readJson(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as unknown;
  } catch {
    return null;
  }
}

const isObject = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * The mileage bands the overlay prices a miles fact against: the staged year's rules file's bands
 * within that year (`rules/ty<year>/mileage.json`, the year the staged `profile.json` names, which
 * code wrote from the workspace row, never the resolved profile's). None when the staged profile
 * names no year the skill carries — the checker's year gate reports that, so this never throws.
 */
export function stagedMileageBands(
  workspace: string,
  skillDir: string,
): { from: string; to: string; cents: string }[] {
  const rules = rulesYearOf(workspace, skillDir);
  if (!rules.ok) return [];
  return mileageBandsOf(readJson(join(rules.dir, 'mileage.json')), rules.year);
}

/**
 * A profile with the recorded facts of `answers.json` applied: the one overlay every reader
 * shares (Abacus through `loadProfile`, and the checker's gates through `resolvedProfileOf`). It
 * returns the profile itself when no `profile_fact:` answer is staged, and never throws.
 */
export function withRecordedFacts(profile: Json, workspace: string, skillDir: string): Json {
  const loaded = readJson(join(workspace, 'answers.json'));
  const answers = new Map<string, { options: unknown; answer: unknown }>();
  if (isObject(loaded)) {
    for (const [key, raw] of Object.entries(loaded)) {
      if (!key.startsWith(PROFILE_FACT_KEY_PREFIX) || !isObject(raw)) continue;
      answers.set(key, { options: raw['options'], answer: raw['answer'] });
    }
  }
  if (answers.size === 0) return profile;
  return applyProfileFacts(profile, answers, stagedMileageBands(workspace, skillDir));
}

/**
 * The resolved profile with the staged `home_office` pair laid onto each entity entry that omits
 * the key (issue #910): silence keeps the stored areas, as the importer leaves the columns an
 * absent pair names, so Abacus computes from the pair the columns hold. An entry resolves to a
 * staged entity exactly as the importer resolves a row and the checker's profile gate resolves
 * an entry: its `ent_<id>` key names a staged entity, whose pair (or none) is the one kept, and
 * the name is consulted only when the key names no staged entity. A present pair, nulls
 * included, is the entry's own. The recorded facts are laid on after this, so a fact newer than
 * the staged snapshot still wins. apps/tui's importer writes its state's resolved profile through
 * it, so the state keeps the pair the union stood on.
 */
export function withStagedHomeOffice(resolved: Json, staged: unknown): Json {
  const stagedEntities: unknown[] =
    isObject(staged) && Array.isArray(staged['entities']) ? (staged['entities'] as unknown[]) : [];
  const byKey = new Map<string, Json>();
  const byName = new Map<string, Json>();
  for (const raw of stagedEntities) {
    if (!isObject(raw)) continue;
    if (typeof raw['key'] === 'string' && /^ent_\d+$/.test(raw['key']) && !byKey.has(raw['key'])) {
      byKey.set(raw['key'], raw);
    }
    if (typeof raw['name'] === 'string' && !byName.has(raw['name'])) byName.set(raw['name'], raw);
  }
  if (byKey.size === 0 && byName.size === 0) return resolved;
  const entities: unknown[] = Array.isArray(resolved['entities'])
    ? (resolved['entities'] as unknown[])
    : [];
  return {
    ...resolved,
    entities: entities.map((raw) => {
      if (!isObject(raw) || raw['home_office'] !== undefined) return raw;
      const keyed = typeof raw['key'] === 'string' ? byKey.get(raw['key']) : undefined;
      const source =
        keyed ?? (typeof raw['name'] === 'string' ? byName.get(raw['name']) : undefined);
      return source === undefined || !isObject(source['home_office'])
        ? raw
        : { ...raw, home_office: source['home_office'] };
    }),
  };
}

/**
 * The resolved profile with each staged asset's register `kind` laid onto the resolved asset that
 * carries it forward under the same description and states no kind of its own (issue #691):
 * silence keeps the register's word, as with the home-office pair, so a run that drops the key
 * still computes the expensing comparison from the kind the register holds. The entry resolves
 * to a staged entity as `withStagedHomeOffice` resolves it; each staged asset lends its kind
 * once, in order. A resolved asset's own word stays its own (check_outputs refuses a different
 * one).
 */
function withStagedAssetKinds(resolved: Json, staged: unknown): Json {
  const stagedEntities: unknown[] =
    isObject(staged) && Array.isArray(staged['entities']) ? (staged['entities'] as unknown[]) : [];
  const byKey = new Map<string, Json>();
  const byName = new Map<string, Json>();
  for (const raw of stagedEntities) {
    if (!isObject(raw)) continue;
    if (typeof raw['key'] === 'string' && !byKey.has(raw['key'])) byKey.set(raw['key'], raw);
    if (typeof raw['name'] === 'string' && !byName.has(raw['name'])) byName.set(raw['name'], raw);
  }
  if (byKey.size === 0 && byName.size === 0) return resolved;
  const entities: unknown[] = Array.isArray(resolved['entities'])
    ? (resolved['entities'] as unknown[])
    : [];
  return {
    ...resolved,
    entities: entities.map((raw) => {
      if (!isObject(raw) || !Array.isArray(raw['assets'])) return raw;
      const keyed = typeof raw['key'] === 'string' ? byKey.get(raw['key']) : undefined;
      const source =
        keyed ?? (typeof raw['name'] === 'string' ? byName.get(raw['name']) : undefined);
      const lenders = (
        source !== undefined && Array.isArray(source['assets'])
          ? (source['assets'] as unknown[])
          : []
      ).filter(
        (asset): asset is Json =>
          isObject(asset) &&
          typeof asset['kind'] === 'string' &&
          typeof asset['description'] === 'string',
      );
      if (lenders.length === 0) return raw;
      const used = new Set<number>();
      return {
        ...raw,
        assets: (raw['assets'] as unknown[]).map((asset) => {
          if (!isObject(asset) || (asset['kind'] !== undefined && asset['kind'] !== null)) {
            return asset;
          }
          const index = lenders.findIndex(
            (lender, at) => !used.has(at) && lender['description'] === asset['description'],
          );
          if (index < 0) return asset;
          used.add(index);
          return { ...asset, kind: lenders[index]?.['kind'] };
        }),
      };
    }),
  };
}

/**
 * The workspace's profile (the resolved one, else the staged one) with the staged home-office
 * pair kept where the resolved profile is silent and the recorded facts of `answers.json`
 * applied, or null when the profile is missing, not JSON or not an object: the caller owns the
 * failure, and no byte of the file is quoted. The overlays never throw.
 */
export function loadProfile(workspace: string, skillDir: string): Json | null {
  const resolvedPath = join(workspace, 'out', 'profile.resolved.json');
  const stagedPath = join(workspace, 'profile.json');
  if (!existsSync(resolvedPath)) {
    const staged = readJson(stagedPath);
    return isObject(staged) ? withRecordedFacts(staged, workspace, skillDir) : null;
  }
  const resolved = readJson(resolvedPath);
  if (!isObject(resolved)) return null;
  const staged = readJson(stagedPath);
  return withRecordedFacts(
    withStagedAssetKinds(withStagedHomeOffice(resolved, staged), staged),
    workspace,
    skillDir,
  );
}

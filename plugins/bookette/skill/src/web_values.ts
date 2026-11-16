/**
 * Recorded web values and their keys, shared by Abacus and the output gates.
 *
 * A key addresses a rate the way the rules data itself carries it:
 * "<rules basename without .json>.<path segments>", so
 * per_diem.oconus_mie.locations.Taipei.mie names rules/ty<tax_year>/per_diem.json and
 * the path oconus_mie.locations.Taipei.mie inside it. There is no parallel
 * vocabulary: "the rules data already covers that key" is a mechanical lookup
 * against the file the key names.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { isValidDay } from './dates';

type Json = Record<string, unknown>;

export type ValueKey = { file: string; segments: string[] };

/**
 * A web value's key as every comparison sees it. Abacus resolves a key
 * case-insensitively, so the output gate's stickiness and duplicate checks
 * fold with this same function: one rule, never two that can drift.
 */
export function foldValueKey(key: string): string {
  return key.toLowerCase();
}

/**
 * The rules file and JSON path a key addresses, or null when it is not an address. A segment is a
 * plain name: a bracket or quote (`locations["Taipei, Taiwan"]`) is a path syntax Abacus never
 * resolves, so a value recorded under one would be imported and never priced (#1601).
 */
export function parseValueKey(key: string): ValueKey | null {
  const parts = key.split('.');
  const file = parts[0];
  if (file === undefined || file.length === 0) return null;
  const segments = parts.slice(1);
  if (segments.length === 0 || segments.some((segment) => segment.length === 0)) return null;
  if (parts.some((part) => /[[\]"']/.test(part))) return null;
  return { file: `${file}.json`, segments };
}

/**
 * Whether the segments resolve inside a parsed rules value. An array is
 * transparent - a group that became a list of effective windows resolves a
 * key through any element carrying the rest of the path.
 */
function pathResolves(current: unknown, segments: string[]): boolean {
  const [head, ...rest] = segments;
  if (head === undefined) return current !== undefined;
  if (Array.isArray(current)) return current.some((element) => pathResolves(element, segments));
  if (typeof current !== 'object' || current === null) return false;
  // Segments match folded, the way Abacus resolves a key, so a recorded key in
  // another case is covered exactly as the rules' own spelling is.
  const name = Object.keys(current).find((own) => foldValueKey(own) === foldValueKey(head));
  if (name === undefined) return false;
  return pathResolves((current as Json)[name], rest);
}

/**
 * Whether a key's path resolves to a value the named rules file already carries.
 * File contents are read once per file and cached, so a run with many entries
 * reads each rules file a single time.
 */
export function rulesIndex(rulesDir: string): (key: string) => boolean {
  const cache = new Map<string, unknown>();
  return (key: string): boolean => {
    const parsed = parseValueKey(key);
    if (parsed === null) return false;
    if (!cache.has(parsed.file)) {
      const path = join(rulesDir, parsed.file);
      let parsedFile: unknown;
      if (existsSync(path)) {
        try {
          parsedFile = JSON.parse(readFileSync(path, 'utf8'));
        } catch {
          parsedFile = undefined;
        }
      }
      cache.set(parsed.file, parsedFile);
    }
    return pathResolves(cache.get(parsed.file), parsed.segments);
  };
}

/** A source-stated effective period: {from, to?} as ISO days; to absent means open-ended. */
export type Period = { from: string; to?: string | null };

export function parsePeriod(value: unknown): Period | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const from = (value as Json).from;
  const to = (value as Json).to;
  if (typeof from !== 'string' || !isValidDay(from)) return null;
  if (to !== undefined && to !== null && (typeof to !== 'string' || !isValidDay(to))) return null;
  return { from, to: to === undefined ? null : to };
}

export function periodCovers(period: Period, day: string): boolean {
  return day >= period.from && (period.to === null || period.to === undefined || day <= period.to);
}

/**
 * The out/ or confirmed/ web-value list as objects; an absent, unparseable or
 * non-list file is empty here. check_outputs reports it; build_books runs on
 * whatever well-formed entries exist.
 */
export function readWebValues(path: string): Json[] {
  if (!existsSync(path)) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(
    (entry): entry is Json => typeof entry === 'object' && entry !== null && !Array.isArray(entry),
  );
}

export function periodsOverlap(a: Period, b: Period): boolean {
  const aEnd = a.to ?? null;
  const bEnd = b.to ?? null;
  return (aEnd === null || aEnd >= b.from) && (bEnd === null || bEnd >= a.from);
}

// Field-wise, not JSON-equality: key order inside an object must not decide
// whether a re-emission matches the confirmed record.
export function samePeriod(a: unknown, b: unknown): boolean {
  const left = parsePeriod(a);
  const right = parsePeriod(b);
  return left !== null && right !== null && left.from === right.from && left.to === right.to;
}

export function sameAppliesTo(a: unknown, b: unknown): boolean {
  return (
    Array.isArray(a) &&
    Array.isArray(b) &&
    a.length === b.length &&
    a.every((ref, index) => ref === b[index])
  );
}

export function sameCitation(confirmed: Json, entry: Json): boolean {
  return (
    confirmed.url === entry.url &&
    confirmed.quoted_text === entry.quoted_text &&
    confirmed.value === entry.value &&
    samePeriod(confirmed.effective_period, entry.effective_period) &&
    sameAppliesTo(confirmed.applies_to, entry.applies_to)
  );
}

/** The outcome of folding a run's web values into the confirmed record. A conflict or malformed
 *  entry names its index in the incoming list, never a key or a value. */
export type WebValueMerge =
  | { kind: 'merged'; values: Json[] }
  | { kind: 'conflict'; index: number }
  | { kind: 'malformed'; index: number };

/**
 * Fold a run's web values into the confirmed record. The verdict is exactly that of check_outputs'
 * two web-value rules: every incoming entry is judged first, against the fixed confirmed list (the
 * stickiness check: the first overlapping confirmed entry, same citation passes, another citation
 * needs an armed answer key) and against the earlier incoming entries (the in-run rule: one folded
 * key with overlapping periods and different citations conflicts, armed or not), so the verdict
 * never depends on list order. Only when every entry passes is the result built: a restatement is
 * a no-op (the recorded entry keeps its fetched_at and answer_keys), an armed entry replaces every
 * overlapping confirmed entry, and anything else appends, so the record never holds an overlapping
 * pair of one key. A conflict or malformed entry names its index only. The inputs are not mutated.
 */
export function mergeWebValues(
  confirmed: readonly Json[],
  incoming: readonly Json[],
  armedKeys: ReadonlySet<string>,
): WebValueMerge {
  const overlapsEntry = (recorded: Json, folded: string, period: Period): boolean => {
    if (typeof recorded.key !== 'string' || foldValueKey(recorded.key) !== folded) return false;
    const recordedPeriod = parsePeriod(recorded.effective_period);
    return recordedPeriod !== null && periodsOverlap(recordedPeriod, period);
  };
  const parsed: { entry: Json; folded: string; period: Period }[] = [];
  for (const [index, entry] of incoming.entries()) {
    const key = typeof entry.key === 'string' ? entry.key : null;
    const period = parsePeriod(entry.effective_period);
    if (key === null || parseValueKey(key) === null || period === null) {
      return { kind: 'malformed', index };
    }
    const folded = foldValueKey(key);
    for (const earlier of parsed) {
      if (overlapsEntry(earlier.entry, folded, period) && !sameCitation(earlier.entry, entry)) {
        return { kind: 'conflict', index };
      }
    }
    parsed.push({ entry, folded, period });
  }
  const replacing = new Set<number>();
  for (const [index, { entry, folded, period }] of parsed.entries()) {
    const first = confirmed.find((recorded) => overlapsEntry(recorded, folded, period));
    if (first === undefined || sameCitation(first, entry)) continue;
    const armed =
      Array.isArray(entry.answer_keys) &&
      entry.answer_keys.some((ref) => typeof ref === 'string' && armedKeys.has(ref));
    if (!armed) return { kind: 'conflict', index };
    replacing.add(index);
  }
  let values = [...confirmed];
  for (const [index, { entry, folded, period }] of parsed.entries()) {
    const overlapping = values.filter((recorded) => overlapsEntry(recorded, folded, period));
    const first = overlapping[0];
    if (first !== undefined && sameCitation(first, entry)) continue;
    if (replacing.has(index)) values = values.filter((recorded) => !overlapping.includes(recorded));
    values.push(entry);
  }
  return { kind: 'merged', values };
}

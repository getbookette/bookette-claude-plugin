import { lstatSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { TREATMENT_TIE_NAMES } from './categories';
import { isValidDay } from './dates';

/**
 * Checks the layout of the `rules/` tree: allowed entries at the root
 * (`policy.md`, `question_catalog.json`, `tyNNNN` directories), and each year
 * directory carrying a `manifest.json` whose `files` map names every rules
 * file under that directory together with its sources. Makes no network call
 * and reads only the tree under `rulesRoot`.
 */

export function checkRulesLayout(rulesRoot: string): string[] {
  if (!isDirectory(rulesRoot)) {
    return [`${rulesRoot} is not an existing directory`];
  }
  const problems: string[] = [];
  const yearDirs: string[] = [];
  for (const entry of readdirSync(rulesRoot, { withFileTypes: true })) {
    if (entry.isDirectory() && /^ty\d{4}$/.test(entry.name)) {
      yearDirs.push(entry.name);
    } else if (
      entry.isFile() &&
      (entry.name === 'policy.md' || entry.name === 'question_catalog.json')
    ) {
      // Allowed.
    } else {
      problems.push(
        `${entry.name} is not allowed at the rules root: expected the files policy.md and question_catalog.json and tyNNNN year directories`,
      );
    }
  }
  for (const name of yearDirs) {
    checkYearDir(rulesRoot, name, problems);
  }
  return problems.sort();
}

/** 0 when the layout is clean, 1 when checkRulesLayout reported problems. */
export function runRulesLayoutCheck(rulesRoot: string): number {
  return checkRulesLayout(rulesRoot).length === 0 ? 0 : 1;
}

function checkYearDir(rulesRoot: string, name: string, problems: string[]): void {
  const yearDir = join(rulesRoot, name);
  const manifestPath = join(yearDir, 'manifest.json');
  if (!isRegularFile(manifestPath)) {
    problems.push(`${name}/manifest.json is missing or is not a regular file`);
    return;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(manifestPath, 'utf8')) as unknown;
  } catch {
    problems.push(`${name}/manifest.json does not parse as JSON`);
    return;
  }
  if (
    !isPlainObject(parsed) ||
    Object.keys(parsed).length !== 1 ||
    !('files' in parsed) ||
    !isPlainObject(parsed['files'])
  ) {
    problems.push(
      `${name}/manifest.json must be an object with exactly one key "files" whose value is an object`,
    );
    return;
  }

  // Only plain relative keys count as having a source; a non-plain key is
  // reported on its own and never resolved against the filesystem.
  const listed = new Set<string>();
  for (const [key, value] of Object.entries(parsed['files'])) {
    if (!isPlainRelative(key)) {
      problems.push(`${name}/manifest.json: files key "${key}" is not a plain relative path`);
      continue;
    }
    listed.add(key);
    if (!isRegularFile(join(yearDir, key))) {
      problems.push(`${name}/${key} is listed in manifest.json but is not a regular file`);
      continue;
    }
    if (!Array.isArray(value) || value.length === 0) {
      problems.push(
        `${name}/${key} lacks a source: manifest.json gives it ${Array.isArray(value) ? 'an empty entry array' : 'no entry array'}`,
      );
      continue;
    }
    for (const [index, entry] of (value as unknown[]).entries()) {
      checkEntry(`${name}/${key}`, index, entry, problems);
    }
  }

  for (const relative of regularFilesUnder(name, yearDir, problems)) {
    if (relative === 'manifest.json' || listed.has(relative)) continue;
    problems.push(`${name}/${relative} lacks a source: it is not listed in manifest.json`);
  }
  checkTreatmentTies(name, yearDir, problems);
}

/**
 * A year's `treatment_ties` (decision record 0011 item 3's 2026-10-29 amendment) marks, per
 * schedule, lines of that schedule's own table with one of the tie names the code knows. A tie on
 * a line the table lacks would never be judged a tie, so a person's pick onto it would be taken.
 */
function checkTreatmentTies(name: string, yearDir: string, problems: string[]): void {
  const path = join(yearDir, 'schedule_lines.json');
  if (!isRegularFile(path)) return;
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8')) as unknown;
  } catch {
    problems.push(`${name}/schedule_lines.json does not parse as JSON`);
    return;
  }
  if (!isPlainObject(parsed) || !('treatment_ties' in parsed)) return;
  const ties = parsed['treatment_ties'];
  if (!isPlainObject(ties)) {
    problems.push(`${name}/schedule_lines.json: treatment_ties is not an object`);
    return;
  }
  for (const [schedule, marked] of Object.entries(ties)) {
    const table = parsed[schedule];
    if ((schedule !== 'C' && schedule !== 'E') || !isPlainObject(table)) {
      problems.push(
        `${name}/schedule_lines.json: treatment_ties names ${schedule}, which is not a schedule the file tables`,
      );
      continue;
    }
    if (!isPlainObject(marked)) {
      problems.push(`${name}/schedule_lines.json: treatment_ties ${schedule} is not an object`);
      continue;
    }
    for (const [line, tie] of Object.entries(marked)) {
      if (!Object.hasOwn(table, line)) {
        problems.push(
          `${name}/schedule_lines.json: treatment_ties marks ${schedule} line ${line}, which its table lacks`,
        );
      }
      if (!(TREATMENT_TIE_NAMES as readonly unknown[]).includes(tie)) {
        problems.push(
          `${name}/schedule_lines.json: treatment_ties ${schedule} line ${line} names a tie outside ${TREATMENT_TIE_NAMES.join(', ')}`,
        );
      }
    }
  }
}

/**
 * An entry is exactly `{ source_url, fetched }`, both strings. `fetched` is the
 * date the source page was last retrieved for the file; for depreciation.json
 * that is the date the publication pages were confirmed, and assumption C7 in
 * docs/assumptions.md still owns the not-re-read status.
 */
function checkEntry(fileLabel: string, index: number, entry: unknown, problems: string[]): void {
  const where = `${fileLabel} entry ${String(index)}`;
  if (!isPlainObject(entry)) {
    problems.push(`${where} is not a source object`);
    return;
  }
  const keys = Object.keys(entry).sort();
  if (keys.length !== 2 || keys[0] !== 'fetched' || keys[1] !== 'source_url') {
    problems.push(`${where} must have exactly the keys "source_url" and "fetched"`);
    return;
  }
  const sourceUrl = entry['source_url'];
  const fetched = entry['fetched'];
  if (typeof sourceUrl !== 'string' || typeof fetched !== 'string') {
    problems.push(`${where} must have string "source_url" and "fetched" values`);
    return;
  }
  if (!sourceUrl.startsWith('https://')) {
    problems.push(`${where} has a "source_url" that does not start with https://`);
  }
  if (!isValidDay(fetched)) {
    problems.push(`${where} has a "fetched" that is not a real calendar date`);
  }
}

function isPlainRelative(key: string): boolean {
  return (
    key !== '' &&
    !key.startsWith('/') &&
    key.split('/').every((s) => s !== '' && s !== '.' && s !== '..')
  );
}

function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

/** lstat, not stat: a symlink is not a regular file, so nothing resolves outside rulesRoot. */
function isRegularFile(path: string): boolean {
  try {
    return lstatSync(path).isFile();
  } catch {
    return false;
  }
}

function regularFilesUnder(name: string, dir: string, problems: string[], prefix = ''): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const relative = prefix === '' ? entry.name : `${prefix}/${entry.name}`;
    if (entry.isDirectory()) {
      found.push(...regularFilesUnder(name, join(dir, entry.name), problems, relative));
    } else if (entry.isFile()) {
      found.push(relative);
    } else {
      problems.push(`${name}/${relative} is not a regular file: rules data cannot be a symlink`);
    }
  }
  return found;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// The skill's rules data is per tax year, `rules/ty<year>/` (issue #989). Every reader of a rate
// or a table takes the directory of one year: in a workspace, the year its staged `profile.json`
// names — the file code wrote from the workspace row or the personal tool's folder, never the
// run's resolved profile. A year with no directory, or no year at all, is a typed refusal that
// names the years the skill carries. There is no default year, and `rulesDirOfYear` is the one
// way from a year to its directory (the runner's `rules_lookup` keeps its own copy, since the
// runner does not depend on this package).
import { lstatSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** A rules directory as the skill text and every message name it: `rules/ty2025/`. */
export function rulesDirLabel(year: number): string {
  return `rules/ty${String(year)}/`;
}

/** The tax years the skill carries rules data for: its `rules/ty<year>/` directories, ascending. */
export function carriedTaxYears(skillDir: string): number[] {
  try {
    return readdirSync(join(skillDir, 'rules'), { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && /^ty\d{4}$/.test(entry.name))
      .map((entry) => Number(entry.name.slice(2)))
      .sort((a, b) => a - b);
  } catch {
    return [];
  }
}

/**
 * The tax year the workspace's staged `profile.json` names, or null when the file is missing, is
 * not a JSON object or names no four-digit integer year.
 */
export function stagedTaxYear(workspace: string): number | null {
  let profile: unknown;
  try {
    profile = JSON.parse(readFileSync(join(workspace, 'profile.json'), 'utf8')) as unknown;
  } catch {
    return null;
  }
  if (typeof profile !== 'object' || profile === null || Array.isArray(profile)) return null;
  const year = (profile as Record<string, unknown>)['tax_year'];
  return typeof year === 'number' && Number.isInteger(year) && year >= 1000 && year <= 9999
    ? year
    : null;
}

export type RulesYearCode = 'rules_year_missing' | 'rules_year_not_carried';

/** One year's rules directory, or the refusal for a year the skill carries none for. */
export type RulesDir =
  | { readonly ok: true; readonly year: number; readonly dir: string; readonly label: string }
  | { readonly ok: false; readonly code: 'rules_year_not_carried'; readonly message: string };

/** A workspace's rules directory: also refused when its staged profile names no year. */
export type RulesYear =
  RulesDir | { readonly ok: false; readonly code: 'rules_year_missing'; readonly message: string };

function carriedNote(skillDir: string): string {
  const years = carriedTaxYears(skillDir);
  if (years.length === 0) return 'the skill carries no rules data';
  const named =
    years.length === 1
      ? String(years[0])
      : `${years.slice(0, -1).join(', ')} and ${String(years[years.length - 1])}`;
  return `the skill carries rules data for ${named} (${years.map(rulesDirLabel).join(', ')})`;
}

/** `year`'s rules directory, or the typed refusal naming the years the skill carries. */
export function rulesDirOfYear(year: number, skillDir: string): RulesDir {
  const dir = join(skillDir, 'rules', `ty${String(year)}`);
  let carried = false;
  try {
    carried = /^\d{4}$/.test(String(year)) && lstatSync(dir).isDirectory();
  } catch {
    carried = false;
  }
  if (!carried) {
    return {
      ok: false,
      code: 'rules_year_not_carried',
      message: `tax year ${String(year)} has no ${rulesDirLabel(year)}; ${carriedNote(skillDir)}`,
    };
  }
  return { ok: true, year, dir, label: rulesDirLabel(year) };
}

/** The staged year's rules directory, or the typed refusal naming the years the skill carries. */
export function rulesYearOf(workspace: string, skillDir: string): RulesYear {
  const year = stagedTaxYear(workspace);
  if (year === null) {
    return {
      ok: false,
      code: 'rules_year_missing',
      message: `profile.json names no tax_year, so no rules directory applies; ${carriedNote(skillDir)}`,
    };
  }
  return rulesDirOfYear(year, skillDir);
}

/** `rulesYearOf` for a caller that stops on a refusal: throws an Error carrying its code. */
export function requireRulesYear(
  workspace: string,
  skillDir: string,
): { readonly year: number; readonly dir: string; readonly label: string } {
  const rules = rulesYearOf(workspace, skillDir);
  if (!rules.ok) throw new Error(`[${rules.code}] ${rules.message}`);
  return rules;
}

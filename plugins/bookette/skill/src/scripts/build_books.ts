/**
 * Build books from the ledger. All arithmetic happens in Abacus (src/abacus/), never in the agent.
 *
 * Usage: node dist/scripts/build_books.js <workspace>
 * Reads out/profile.resolved.json (or profile.json), out/ledger.json and the skill's rules data
 * for the staged year, rules/ty<tax_year>/ (rules/ty2025/ for a 2025 folder). Writes
 * out/books.json and out/books.md. Exits 1 on validation errors.
 *
 * This file is the script layer: it reads the workspace and the rules into Abacus's inputs and
 * writes what Abacus computes. The computation reads files only through the currency
 * conversion and rules lookup this layer hands it.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { computeBooks, type AbacusInputs, type BooksResult } from '../abacus/compose';
import { renderMarkdown } from '../abacus/render';
import type { Json } from '../abacus/values';
import type { Dec } from '../money';
import { requireRulesYear } from '../rules-year';
import { readWebValues, rulesIndex } from '../web_values';
import { loadCapitalCostRules } from './capital_costs';
import { readFxSnapshotBeside, toUsd } from './fx';
import { homeOfficeReadings, readHomeCosts } from './home_office';
import { loadProfile } from './profile';
import { readTaxPayments } from './tax_payments';

export { actionRows, renderMarkdown, type ActionRow } from '../abacus/render';
export type { BooksResult } from '../abacus/compose';

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8')) as unknown;
}

/** A list file the workspace may not carry: read as written when present, else empty. */
function readOptionalList(path: string): unknown[] {
  return existsSync(path) ? (readJson(path) as unknown[]) : [];
}

/** Everything one build of `workspace` reads, read from its files and the staged rules. */
export function readAbacusInputs(workspace: string, skillDir: string): AbacusInputs {
  // The staged profile.json's year picks the rules directory and is the books' tax year: code
  // wrote it, so a resolved profile naming another year moves neither.
  const { dir: rules, year: taxYear } = requireRulesYear(workspace, skillDir);
  const out = join(workspace, 'out');

  // The rate snapshot staging froze beside these inputs (`null` when staging froze none, so the
  // vendored rules files stay the lookup source). It is read from the workspace root — the fixed
  // path the input archive unpacks to in the sandbox and the importer's union dir reproduces —
  // so this build converts against the exact bytes the recorded hash pins, never a live table.
  const fxSnapshot = readFxSnapshotBeside(workspace);

  // The resolved profile (else the staged one) with the person's recorded `profile_fact:` answers
  // overlaid, so the books follow the person's figure whatever the run wrote (plan row 15.13).
  const profile = loadProfile(workspace, skillDir);
  if (profile === null) throw new Error('the profile is missing, not JSON or not an object');
  const ledger = readJson(join(out, 'ledger.json')) as Json[];
  // Donations are a listing for the accountant, never ledger rows. Property-tax payments (issue
  // #110) are staged verbatim from the bill and split by Abacus: the run's out/tax_payments.json,
  // else the confirmed payments its silence keeps (issue #980). Each is absent when the
  // workspace has none.
  const donations = readOptionalList(join(out, 'donations.json'));
  const taxPayments = readTaxPayments(workspace);
  const scheduleLines = readJson(join(rules, 'schedule_lines.json')) as Json;
  const perDiem = readJson(join(rules, 'per_diem.json')) as Json;
  const depreciationRules = readJson(join(rules, 'depreciation.json')) as Json;
  const mileageRules = readJson(join(rules, 'mileage.json')) as Json;
  const rentalUseRules = readJson(join(rules, 'rental_use.json')) as Json;
  const capitalCostRules = loadCapitalCostRules(rules);

  // The web-value arm of per-diem resolution reads the run's own records first, then the
  // confirmed citations; a key the rules file already carries is ignored.
  const rulesCovered = rulesIndex(rules);
  const outValues = readWebValues(join(out, 'web_values.json'));
  const confirmedValues = readWebValues(join(workspace, 'confirmed', 'web_values.json'));

  // The home office (issue #661): both readings, computed by the one function check_outputs also
  // calls; no answer is read, because no answer chooses a method (issue #1080).
  const homeOffice = homeOfficeReadings(
    profile,
    readHomeCosts(workspace),
    rules,
    fxSnapshot,
    taxYear,
  );

  return {
    taxYear,
    profile,
    ledger,
    donations,
    taxPayments,
    scheduleLines,
    perDiem,
    depreciationRules,
    mileageRules,
    rentalUseRules,
    capitalCostRules,
    outValues,
    confirmedValues,
    rulesCovered,
    homeOffice,
    convert: (currency: string, day: string, amount: Dec) =>
      toUsd(rules, currency, day, amount, fxSnapshot),
  };
}

export function buildBooks(
  workspace: string,
  skillDir: string,
): { result: BooksResult; errors: string[] } {
  return computeBooks(readAbacusInputs(workspace, skillDir));
}

/** The books, built and written to out/books.json and out/books.md — the CLI's work, shared with
 *  `pipeline build`. The importer builds without writing (`buildBooks`). */
export function writeBooks(
  workspace: string,
  skillDir: string,
): { result: BooksResult; errors: string[] } {
  const { result, errors } = buildBooks(workspace, skillDir);
  writeFileSync(join(workspace, 'out', 'books.json'), JSON.stringify(result, null, 2));
  writeFileSync(join(workspace, 'out', 'books.md'), renderMarkdown(result));
  return { result, errors };
}

/** What `build_books.js <workspace>` prints on stdout - the checks - and the status it exits with. */
export function runBuildBooks(
  workspace: string,
  skillDir: string,
): { stdout: string; exitCode: number } {
  const { result, errors } = writeBooks(workspace, skillDir);
  return {
    stdout: `${JSON.stringify(result.checks, null, 2)}\n`,
    exitCode: errors.length > 0 ? 1 : 0,
  };
}

function main(argv: string[]): void {
  const workspace = argv[0];
  if (workspace === undefined) throw new Error('usage: build_books.js <workspace>');
  const { stdout, exitCode } = runBuildBooks(workspace, join(__dirname, '..', '..'));
  process.stdout.write(stdout);
  process.exitCode = exitCode;
}

if (require.main === module) {
  main(process.argv.slice(2));
}

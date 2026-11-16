// The version stamps every books run carries (plan task 11.1): content hashes of the skill
// package's own files, so a stored run is explainable by the exact rules and program that
// produced it, and the importer's version gate fires on any skill-file change with no human
// bump to forget (ADR 0071; ADR 0019 items 3 and 6). Pure filesystem reads: no git — the runner
// image carries no `.git` — and no package.json version, whose forgotten bump is the silent
// green import the gate exists to catch.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// Bumped by hand only when the out/ files' keys change (plan task 11.8): 3 is the per-item line
// detail and the depreciation register's accumulation figures (task 11.3). 4 is task 11.6 (issue
// #110): books.json gains the vehicles comparison and the rental_use day analysis, the ledger
// gains a line's vehicle citation, and out/tax_payments.json joins the optional staging. 5 is
// issue #661: books.json gains home_office, a line entry gains the home_office member, and
// out/home_costs.json joins the optional staging. 6 is issue #691: books.json gains
// improvement_repair and expense_macrs, and a profile asset gains its register `kind`. 7 is
// issue #1112: books.json gains the workspace year expense total (`expense_total_cents`) and
// the Schedule E combined totals (`schedule_e_totals`). 8 is issue #1080: a home_office row
// loses chosen_method and chosen_not_computed, and a line entry loses the home_office member,
// since no answer chooses a method and line 30 books neither reading. 9 is issue #1364
// (decision record 0148): books.json gains `outside_year`, the lines, staged property-tax
// payments and home costs dated outside the tax year (`kind` line, tax_payment or home_cost),
// listed and counted in no total, and an improvement_repair row's `missing` loses
// `outside_tax_year`, since such a line reaches no comparison. 10 is task 37.8 (issue #1375): a
// trip's `missing_receipt` finding gains its closed `gap` word, and a purpose suggestion its
// `event` flag. 11 is task 37.8's Abacus (issue #1375): a books.json trip row gains
// `per_diem_applies`, false with null per-diem figures for a trip on one calendar day, and a
// vehicle row gains `miles_source`, `trip_miles` and `trip_count`. 12 is issue #485 (decision
// record 0159): books.json gains `unpriced`, the in-year lines the run's rates cannot price,
// listed with their printed amount and currency and counted in no total. 13 is issue
// #1638/#1639 (task 42.2/42.3): a question carries `help`, and a run writes `out/summary.json`.
// 14 is decision record 0189: a profile vehicle and a books.json vehicle row lose `entity` and
// gain `uses`, one entry per place that uses the car, which carries the year's miles.
export const OUTPUT_SCHEMA_VERSION = '14';

export interface BooksVersions {
  skillVersion: string;
  rulesVersion: string;
  outputSchemaVersion: string;
  /**
   * The reader software the run's staged readings came from (task 8.7), stamped per run — never a
   * property of the skill tree, so the file-hash readers here always carry null and the run paths
   * (the worker's bundle stamp) overwrite it with the run's own value.
   */
  readerVersion: string | null;
}

// The package-root entries that are not the skill's content: the manifests and configs the
// tooling rewrites (the runner image carries the skill's staged pnpm deploy tree, whose
// node_modules/ and per-tree pnpm-lock.yaml/pnpm-workspace.yaml pnpm writes at the root, and
// the stamp must survive that bake — the stager runs versionsOf on the baked tree at every
// run's start), the tests, the compiled output, the staged deploy tree itself (ADR 0102 — a
// copy of this package, stamped at its source), and the task cache. Every other file must be
// skill content — SKILL.md, reference/, the rules root's two files, src/, or a rules/ty*/
// file — and versionsOf throws on anything else, so a new top-level file cannot silently fall
// outside the stamp.
const EXCLUDED_ROOT_ENTRIES = new Set([
  'package.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  'tsconfig.json',
  'tsconfig.build.json',
  'eslint.config.mjs',
]);
const EXCLUDED_ROOT_DIRECTORIES = new Set(['test', 'dist', 'deploy', 'node_modules', '.turbo']);

// The rules year directories stamp rulesVersion — manifest.json included, because a file's
// source URL and fetch date are part of the rules — and everything else that is the skill's
// content stamps skillVersion: the program text, the reader instructions, the policy's voice and
// the question catalog each change what a run did.
function stampOf(relativePath: string): 'rules' | 'skill' {
  if (/^rules\/ty\d{4}\//.test(relativePath)) return 'rules';
  if (
    relativePath === 'SKILL.md' ||
    relativePath.startsWith('reference/') ||
    relativePath === 'rules/policy.md' ||
    relativePath === 'rules/question_catalog.json' ||
    relativePath.startsWith('src/')
  ) {
    return 'skill';
  }
  throw new Error(`${relativePath} is outside the version stamp's classification`);
}

function collectStampedFiles(root: string): { rules: string[]; skill: string[] } {
  const files: { rules: string[]; skill: string[] } = { rules: [], skill: [] };
  const walk = (prefix: string): void => {
    for (const entry of readdirSync(prefix === '' ? root : join(root, prefix), {
      withFileTypes: true,
    })) {
      const relativePath = prefix === '' ? entry.name : `${prefix}/${entry.name}`;
      if (entry.isDirectory()) {
        if (prefix === '' && EXCLUDED_ROOT_DIRECTORIES.has(entry.name)) continue;
        walk(relativePath);
        continue;
      }
      if (prefix === '' && EXCLUDED_ROOT_ENTRIES.has(entry.name)) continue;
      if (!entry.isFile()) {
        throw new Error(`${relativePath} is not a regular file`);
      }
      files[stampOf(relativePath)].push(relativePath);
    }
  };
  walk('');
  return files;
}

// Lowercase hex sha256 over the sorted `relpath NUL sha256(bytes) LF` entries — the hash family
// of the output_hash column. The sort makes the value independent of readdir order.
function stampHash(root: string, relativePaths: string[]): string {
  const digest = createHash('sha256');
  for (const relativePath of [...relativePaths].sort()) {
    digest.update(relativePath);
    digest.update('\0');
    digest.update(
      createHash('sha256')
        .update(readFileSync(join(root, relativePath)))
        .digest('hex'),
    );
    digest.update('\n');
  }
  return digest.digest('hex');
}

/** The stamps of one skill tree, read from its files alone. */
export function versionsOf(skillDir: string): BooksVersions {
  const files = collectStampedFiles(skillDir);
  return {
    skillVersion: stampHash(skillDir, files.skill),
    rulesVersion: stampHash(skillDir, files.rules),
    outputSchemaVersion: OUTPUT_SCHEMA_VERSION,
    // The reader version rides the run's own staging (task 8.7), never the skill tree's hashes.
    readerVersion: null,
  };
}

// This package's own stamps, resolved from the compiled module's location: dist/ sits at the
// package root, so the parent directory is the tree the hashes walk. The worker reads the stamps
// through this entry, so its run rows and envelopes name the skill the worker actually shipped.
export function versions(): BooksVersions {
  return versionsOf(join(__dirname, '..'));
}

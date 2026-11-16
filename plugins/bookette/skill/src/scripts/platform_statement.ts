/**
 * Print the figures of one staged platform payout-statement reading.
 *
 * Usage: node dist/scripts/platform_statement.js <workspace> <doc-id>
 *
 * The reading at <workspace>/extractions/<doc-id>.json carries a
 * `fields.platform_statement` block on its code-read page (the read job wrote
 * the parsed grid and the matched rules identity; issue #1106). This script
 * loads the same rules document from the workspace's staged tax year, re-derives
 * the row classes and figures with `computeStatementFigures` — the one function
 * the output gate re-runs at import — and prints one figure per line, the amount
 * exactly as the books carry it. It computes: the grid is the input, the rules
 * data the grammar, and no model call or model-written number passes through.
 *
 * Every failure is a typed exit-1 line naming files, names and addresses, never
 * a grid value: a reading or block that is not the stored shape, a year the
 * skill carries no rules for, a rules document the block does not name, a grid
 * whose header no longer matches its document (a rules correction — book the
 * page as an ordinary export per reference/steps/3-propose.md), a row the
 * grammar does not class, a summed cell that is not a plain decimal.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  computeStatementFigures,
  statementBlockOf,
  statementDocumentOf,
} from '../platform-statements';
import { rulesDirOfYear, stagedTaxYear } from '../rules-year';

function main(argv: string[]): void {
  const [workspace, docId] = argv;
  if (workspace === undefined || docId === undefined) {
    throw new Error('usage: platform_statement.js <workspace> <doc-id>');
  }
  if (!/^doc_\d+$/.test(docId)) {
    throw new Error(`the reading's doc-id is doc_ and its internal id, such as doc_118: ${docId}`);
  }
  const path = join(workspace, 'extractions', `${docId}.json`);
  if (!existsSync(path)) throw new Error(`no staged reading at ${path}`);
  let reading: unknown;
  try {
    reading = JSON.parse(readFileSync(path, 'utf8')) as unknown;
  } catch {
    throw new Error(`${path} does not parse as JSON`);
  }
  const pages =
    reading !== null && typeof reading === 'object' && !Array.isArray(reading)
      ? (reading as Record<string, unknown>)['pages']
      : null;
  if (!Array.isArray(pages)) throw new Error(`${path} carries no pages list`);
  const blocks: { page: number; block: ReturnType<typeof statementBlockOf> }[] = [];
  for (const [index, page] of pages.entries()) {
    if (page === null || typeof page !== 'object' || Array.isArray(page)) continue;
    const fields = (page as Record<string, unknown>)['fields'];
    if (fields === null || typeof fields !== 'object' || Array.isArray(fields)) continue;
    const block = statementBlockOf((fields as Record<string, unknown>)['platform_statement']);
    if (block !== null) blocks.push({ page: index + 1, block });
  }
  if (blocks.length === 0) {
    throw new Error(`${path} carries no platform_statement block; the page was read by the model`);
  }
  const year = stagedTaxYear(workspace);
  if (year === null) {
    throw new Error(`${workspace}'s profile.json names no tax year, so no rules directory applies`);
  }
  const rules = rulesDirOfYear(year, join(__dirname, '..', '..'));
  if (!rules.ok) {
    process.stdout.write(`${rules.message}\n`);
    process.exitCode = 1;
    return;
  }
  for (const { page, block } of blocks) {
    if (block === null) {
      throw new Error(
        `${path} page ${String(page)} carries a platform_statement that is not the stored shape`,
      );
    }
    console.log(`${docId} page ${String(page)}: ${block.platform} "${block.document}"`);
    const document = statementDocumentOf(rules.dir, block.platform, block.document);
    if (document === null) {
      throw new Error(
        `${path} page ${String(page)} names no document "${block.document}" of ${block.platform} in the staged year's rules data`,
      );
    }
    const result = computeStatementFigures(block.grid, document);
    if (!result.ok) {
      process.stdout.write(`${result.problem.code}: ${result.problem.message}\n`);
      process.exitCode = 1;
      return;
    }
    for (const figure of result.figures) {
      console.log(`${figure.key} ${figure.amount}${figure.unverified ? ' UNVERIFIED' : ''}`);
    }
  }
}

if (require.main === module) {
  try {
    main(process.argv.slice(2));
  } catch (thrown) {
    process.stdout.write(`${thrown instanceof Error ? thrown.message : String(thrown)}\n`);
    process.exitCode = 1;
  }
}

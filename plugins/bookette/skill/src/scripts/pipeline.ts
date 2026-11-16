/**
 * The fixed pipeline steps as one scripted call each (issue #912), so the agent spends a turn on
 * judgment and never on driving a script and then reading the file it wrote.
 *
 * Usage: node dist/scripts/pipeline.js start <workspace>
 *        node dist/scripts/pipeline.js build <workspace>
 *        node dist/scripts/pipeline.js digest <workspace> --id <id> | --amount <amount> | --doc <document> | --vendor <word>
 *
 * `start` is SKILL.md step 1: it writes out/inventory.json the way inventory.js does and prints
 * the batch summary — every document with its page count, its staged reading's hint and not-READ
 * pages, the duplicates, the open question keys and an incremental run's cross-batch duplicate
 * candidates (issue #910) — so the agent reads nothing else before step 2. `digest` is the one
 * lookup into confirmed/summaries.json a rule may need: the rows with an id, an amount, a
 * document or a vendor word, printed bounded, so the agent never reads the digest whole.
 * `build` is steps 6 and 8: assign_ids (which also writes the open questions' keys the key recipe
 * spells and a `pass_through` question's tie-out recommendation, src/scripts/question_keys.ts),
 * then build_books, then check_outputs, in that order,
 * stopping at the first stage that fails, and prints one verdict: the stage reached, the build's
 * checks, the rows the agent must act on (issue #910, one line each) and the typed problems.
 * out/books.json is still written, as a required output check_outputs looks for and the eval scorer
 * reads (the importer rebuilds the books itself); the agent never reads it. The exit code
 * is 0 only when every stage passed. Both stages are stateless: a `build` after an edit is the
 * same call again.
 *
 * The three scripts keep their own CLIs for the eval harness's importer stand-in; the importer
 * itself imports `buildBooks` and `checkOutputs` as functions and never runs a CLI.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { assignWorkspaceLedger } from '../ledger-ids';
import { reviewModeOf, type ReviewMode } from '../review-mode';
import { WAITING_LINES_FILE, waitingLineIds } from '../waiting-lines';
import { actionRows, writeBooks, type ActionRow } from './build_books';
import { checkOutputs, type Problem } from './check_outputs';
import { markPassThroughTies, spellWorkspaceQuestionKeys } from './question_keys';
import {
  absoluteCents,
  digestRows,
  readingNameOf,
  sameDocument,
  writeInventory,
  type DigestRow,
  type PossibleDuplicate,
} from './inventory';

type Json = Record<string, unknown>;

/**
 * One document of the batch: an inventory row (an inbox original, with its staged reading when
 * one exists) or a reading staged under extractions/ for which the workspace carries no original,
 * named by its stem (`doc_118`), the way a ledger line or a cite names it. A reading contributes
 * only what step 2's findings need: its page count, its upload hint, the pages whose page_status
 * is not READ grouped by that status — a SKIPPED page instead under `skipped`, grouped by why it
 * was left out as boilerplate (decision record 0129) — and the pages whose reading says
 * unreadable — never a field a page read. Absent and empty members are left out, so the summary
 * stays under the CLI's tool-result spill at a paid tier's 2000 pages (pinned by pipeline.spec.ts).
 */
export type StartDocument = {
  doc: string;
  pages?: number;
  duplicate_of?: string;
  staged?: true;
  hint?: string;
  not_read?: Record<string, number[]>;
  /** A staged reading's SKIPPED pages, by their skip reason. */
  skipped?: Record<string, number[]>;
  unreadable?: number[];
};

/**
 * What `start` prints. `possible_duplicates` is the inventory's cross-batch pass (a digest row
 * that names a staged document, or one a staged figure matches by amount and date, with both
 * vendors shown), so the agent judges each candidate without opening `confirmed/summaries.json`.
 * The print is bounded — the first PRINTED_PER_DOCUMENT per document and PRINTED_CANDIDATES in
 * all, `possible_duplicates_total` the full count, the whole list in out/inventory.json — and
 * comes last, after `open_questions`, so a long list can only cut itself off at the CLI's
 * tool-result spill. Empty on a first run.
 */
export type StartSummary = {
  stage: 'start';
  incremental: boolean;
  inputs: StartInputs;
  totals: Record<string, number>;
  documents: StartDocument[];
  open_questions: string[];
  waiting_lines: WaitingLines;
  /** The staged review mode (issue #1384, decision record 0150): `sort_then_show` when
   *  `review_mode.json` says so, else `ask` (`reviewModeOf`, the reader check_outputs' placed gate
   *  shares). A resumed agent reads this verdict, so the mode is printed where it cannot miss it. */
  review_mode: ReviewMode;
  possible_duplicates_total: number;
  possible_duplicates: PossibleDuplicate[];
};

/**
 * Which staged inputs the run has (issue #1257, the R1 bisect): a run that decided "no answers.json,
 * first run" without opening it applied none of the person's answers, and nothing in this summary
 * said the file was there. `answers` and `open_questions` count the keys of their files (0 when a
 * file is absent, unparseable or not an object), `notes` says whether `notes.json` holds a note
 * (the year's, or one place's), `confirmed` whether `confirmed/` holds a file, and `extractions`
 * how many readings `extractions/` stages. The runner's start message names the same files by
 * the same rules (packages/runner/src/agent.ts `stagedInputs`).
 */
export type StartInputs = {
  answers: number;
  notes: boolean;
  open_questions: number;
  confirmed: boolean;
  extractions: number;
};

/** The number of keys of a JSON object file; 0 when it is absent, unparseable or no object. */
function keyCount(path: string): number {
  const parsed = record(loadJson(path));
  return parsed === null ? 0 : Object.keys(parsed).length;
}

/** Whether `notes.json` holds a note: a string `year`, or an `entities` object with a key. */
function holdsNote(path: string): boolean {
  const parsed = record(loadJson(path));
  if (parsed === null) return false;
  const entities = record(parsed['entities']);
  return (
    (typeof parsed['year'] === 'string' && parsed['year'] !== '') ||
    (entities !== null && Object.keys(entities).length > 0)
  );
}

/** The staged inputs, by the rules `StartInputs` names. */
export function startInputs(workspace: string): StartInputs {
  // A folder's entries, or none when it is absent or not a folder (a file named `confirmed`, say),
  // as the runner reads them.
  const entries = (dir: string): string[] => {
    try {
      return readdirSync(join(workspace, dir));
    } catch {
      return [];
    }
  };
  return {
    answers: keyCount(join(workspace, 'answers.json')),
    notes: holdsNote(join(workspace, 'notes.json')),
    open_questions: keyCount(join(workspace, 'open_questions.json')),
    confirmed: entries('confirmed').length > 0,
    extractions: entries('extractions').filter((name) => name.endsWith('.json')).length,
  };
}

/**
 * The person's "Sort these out" (issue #1249): how many lines a staged `waiting_lines.json`
 * holds (`waitingLineIds`, the count check_outputs' gate reads) and its workspace path, or 0 and
 * null when none is staged. The lines themselves stay in the file.
 */
export type WaitingLines = { count: number; path: string | null };

/** The staged sort request's count and path; a missing file or one holding no line is none. */
export function waitingLines(workspace: string): WaitingLines {
  const count = waitingLineIds(workspace).length;
  return count > 0 ? { count, path: WAITING_LINES_FILE } : { count: 0, path: null };
}

export const PRINTED_PER_DOCUMENT = 3;
export const PRINTED_CANDIDATES = 20;

/** The first PRINTED_PER_DOCUMENT candidates of each document, PRINTED_CANDIDATES in all. */
export function printedCandidates(all: PossibleDuplicate[]): PossibleDuplicate[] {
  const perDocument = new Map<string, number>();
  const printed: PossibleDuplicate[] = [];
  for (const candidate of all) {
    if (printed.length >= PRINTED_CANDIDATES) break;
    const count = perDocument.get(candidate.doc) ?? 0;
    if (count >= PRINTED_PER_DOCUMENT) continue;
    perDocument.set(candidate.doc, count + 1);
    printed.push(candidate);
  }
  return printed;
}

export type DigestQuery =
  { id: string } | { amount: string } | { doc: string } | { vendor: string };

/**
 * What `digest` prints: whether a digest is staged, the query, how many rows matched and the
 * first PRINTED_DIGEST_ROWS of them in digest order (items before held). An amount matches in
 * absolute cents whatever its print; a document matches a `source_file` by stem (`inbox/doc_1`,
 * `doc_1`, `doc_1.json` and a paired original's name are one document); a vendor word matches a
 * row whose `vendor` contains it, case folded, so a corrected 1099 finds its original by the
 * payer's name whatever the original's file was called. A blank word matches nothing.
 */
export type DigestVerdict = {
  stage: 'digest';
  staged: boolean;
  query: DigestQuery;
  total: number;
  rows: DigestRow[];
};

export const PRINTED_DIGEST_ROWS = 20;

export type BuildStage = 'assign_ids' | 'build_books' | 'check_outputs';

/**
 * What `build` prints: the stage reached, whether it passed, and the output of each stage that
 * ran — the count the assignment numbered, the build's checks as build_books.js prints them, the
 * typed problems as check_outputs.js lists them, and the message of a stage that threw — and,
 * once the build has run, the action rows of its result (`actionRows`, issue #910), last.
 */
export type BuildVerdict = {
  stage: BuildStage;
  passed: boolean;
  assigned: number | null;
  checks: unknown;
  /** How many entries the build listed in books.json's `outside_year` (decision record 0148):
   *  lines, staged tax payments and home costs dated outside the tax year, in no total. Null
   *  until the build has run. */
  outside_year: number | null;
  problems: Problem[];
  error: string | null;
  actions: ActionRow[];
};

function record(value: unknown): Json | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Json)
    : null;
}

function loadJson(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

function strOrNull(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

type Reading = {
  pages: number;
  hint: string | null;
  notRead: Record<string, number[]>;
  skipped: Record<string, number[]>;
  unreadable: number[];
};

/** A staged reading's hint and page statuses, or null when the file is not a reading. */
function readingOf(path: string): Reading | null {
  const reading = record(loadJson(path));
  if (reading === null || !Array.isArray(reading['pages'])) return null;
  const notRead: Record<string, number[]> = {};
  const skipped: Record<string, number[]> = {};
  const unreadable: number[] = [];
  for (const [index, raw] of reading['pages'].entries()) {
    const page = record(raw) ?? {};
    const number = typeof page['page'] === 'number' ? page['page'] : index + 1;
    const status = strOrNull(page['page_status']) ?? 'none';
    if (status === 'SKIPPED') {
      (skipped[strOrNull(page['skip_reason']) ?? 'none'] ??= []).push(number);
    } else if (status !== 'READ') {
      (notRead[status] ??= []).push(number);
    }
    if (page['status'] === 'unreadable') unreadable.push(number);
  }
  return {
    pages: reading['pages'].length,
    hint: strOrNull(reading['hint_entity']),
    notRead,
    skipped,
    unreadable,
  };
}

/** The reading's members on a document row, each only when it says something. */
function withReading(row: StartDocument, reading: Reading): StartDocument {
  const out: StartDocument = { ...row, staged: true };
  if (reading.hint !== null) out.hint = reading.hint;
  if (Object.keys(reading.notRead).length > 0) out.not_read = reading.notRead;
  if (Object.keys(reading.skipped).length > 0) out.skipped = reading.skipped;
  if (reading.unreadable.length > 0) out.unreadable = reading.unreadable;
  return out;
}

/** The batch summary, after the inventory is written. */
export async function start(workspace: string): Promise<StartSummary> {
  const { rows, totals, possible_duplicates } = await writeInventory(workspace);
  const extractions = join(workspace, 'extractions');
  const staged = new Set(
    existsSync(extractions)
      ? readdirSync(extractions).filter((name) => name.endsWith('.json'))
      : [],
  );
  const documents: StartDocument[] = [];
  const paired = new Set<string>();
  for (const row of rows) {
    const name = readingNameOf(row.file);
    const reading = staged.has(name) ? readingOf(join(extractions, name)) : null;
    if (reading !== null) paired.add(name);
    const base: StartDocument = { doc: row.file };
    if (row.pages !== null) base.pages = row.pages;
    if (row.duplicate_of !== null) base.duplicate_of = row.duplicate_of;
    documents.push(reading === null ? base : withReading(base, reading));
  }
  for (const name of [...staged].filter((entry) => !paired.has(entry)).sort()) {
    const reading = readingOf(join(extractions, name));
    if (reading === null) continue;
    const stem = name.slice(0, -'.json'.length);
    documents.push(withReading({ doc: stem, pages: reading.pages }, reading));
  }
  const open = record(loadJson(join(workspace, 'open_questions.json')));
  return {
    stage: 'start',
    incremental: existsSync(join(workspace, 'confirmed')),
    inputs: startInputs(workspace),
    totals,
    documents,
    open_questions: open === null ? [] : Object.keys(open),
    waiting_lines: waitingLines(workspace),
    review_mode: reviewModeOf(workspace),
    possible_duplicates_total: possible_duplicates.length,
    possible_duplicates: printedCandidates(possible_duplicates),
  };
}

/** The digest rows one query names; a query an unparseable amount names nothing. */
export function digest(workspace: string, query: DigestQuery): DigestVerdict {
  const rows = digestRows(workspace);
  const matches =
    rows === null
      ? []
      : rows.filter((row) => {
          if ('id' in query) return row.id === query.id;
          if ('doc' in query)
            return row.source_file !== null && sameDocument(row.source_file, query.doc);
          if ('vendor' in query) {
            const word = query.vendor.trim().toLowerCase();
            return word !== '' && row.vendor !== null && row.vendor.toLowerCase().includes(word);
          }
          const cents = absoluteCents(query.amount);
          return cents !== null && absoluteCents(row.amount) === cents;
        });
  return {
    stage: 'digest',
    staged: rows !== null,
    query,
    total: matches.length,
    rows: matches.slice(0, PRINTED_DIGEST_ROWS),
  };
}

function digestQueryOf(argv: string[]): DigestQuery | null {
  const [flag, value, ...rest] = argv;
  if (value === undefined || rest.length > 0) return null;
  if (flag === '--id') return { id: value };
  if (flag === '--amount') return { amount: value };
  if (flag === '--doc') return { doc: value };
  if (flag === '--vendor') return { vendor: value };
  return null;
}

function messageOf(thrown: unknown): string {
  return thrown instanceof Error ? thrown.message : String(thrown);
}

/** assign_ids, build_books and check_outputs in order, stopping at the first stage that fails. */
export function build(workspace: string, skillDir: string): BuildVerdict {
  const verdict: BuildVerdict = {
    stage: 'assign_ids',
    passed: false,
    assigned: null,
    checks: null,
    outside_year: null,
    problems: [],
    error: null,
    actions: [],
  };
  try {
    verdict.assigned = assignWorkspaceLedger(workspace);
    // With the ledger ids fixed, the open questions' keys can be spelled from what they cite.
    spellWorkspaceQuestionKeys(workspace, skillDir);
    markPassThroughTies(workspace, skillDir);
  } catch (thrown) {
    verdict.error = messageOf(thrown);
    return verdict;
  }
  verdict.stage = 'build_books';
  try {
    const { result, errors } = writeBooks(workspace, skillDir);
    verdict.checks = result['checks'];
    verdict.outside_year = Array.isArray(result['outside_year'])
      ? result['outside_year'].length
      : 0;
    verdict.actions = actionRows(result);
    if (errors.length > 0) return verdict;
  } catch (thrown) {
    verdict.error = messageOf(thrown);
    return verdict;
  }
  verdict.stage = 'check_outputs';
  try {
    const checked = checkOutputs(workspace, skillDir);
    verdict.problems = checked.problems;
    // A notice is the check's non-fatal word to the agent (a staged platform statement whose grid
    // no longer matches its rules document): one action row each, after the build's rows.
    for (const notice of checked.notices ?? []) {
      verdict.actions.push({ kind: notice.kind, stem: notice.stem });
    }
  } catch (thrown) {
    verdict.error = messageOf(thrown);
    return verdict;
  }
  verdict.passed = verdict.problems.length === 0;
  return verdict;
}

const USAGE =
  'usage: pipeline.js start|build <workspace> | digest <workspace> --id <id>|--amount <amount>|--doc <document>|--vendor <word>';

/**
 * The verdict as printed: indented JSON, except that each action row is one line, so the agent
 * reads a row as one fact. JSON.parse of the text is the verdict.
 */
export function printVerdict(verdict: BuildVerdict): string {
  const { actions, ...rest } = verdict;
  const head = JSON.stringify(rest, null, 2);
  const rows = actions.map((row) => `    ${JSON.stringify(row)}`);
  const list = rows.length === 0 ? '[]' : `[\n${rows.join(',\n')}\n  ]`;
  return `${head.slice(0, -'\n}'.length)},\n  "actions": ${list}\n}`;
}

/** The CLI: prints one JSON document and returns the exit code. */
export async function pipeline(
  argv: string[],
  print: (line: string) => void = console.log,
  skillDir: string = join(__dirname, '..', '..'),
): Promise<number> {
  const [stage, workspace, ...rest] = argv;
  if (workspace === undefined) throw new Error(USAGE);
  if (stage === 'digest') {
    const query = digestQueryOf(rest);
    if (query === null) throw new Error(USAGE);
    print(JSON.stringify(digest(workspace, query)));
    return 0;
  }
  if (stage === 'start') {
    // Compact: the summary is read by the model, and a pretty-printed one would cross the CLI's
    // tool-result spill at a few hundred pages.
    print(JSON.stringify(await start(workspace)));
    return 0;
  }
  if (stage === 'build') {
    const verdict = build(workspace, skillDir);
    print(printVerdict(verdict));
    return verdict.passed ? 0 : 1;
  }
  throw new Error(USAGE);
}

if (require.main === module) {
  void pipeline(process.argv.slice(2)).then((code) => {
    process.exitCode = code;
  });
}

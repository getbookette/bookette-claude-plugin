/**
 * The key recipe over a workspace: what the run knows that a question's key is spelled from, and
 * the build stage that writes the keys. The agent writes a question of its own with its `fact`
 * (one of the catalog's `open.facts`), the profile key it is `about` where its options name none,
 * and its cites and options; `pipeline.js build` writes each such question's `key` and each
 * `entity_register` option's `entityKey` as `spellOpenQuestionKey` and `placeSubject` spell them
 * (src/question-keys.ts), drops the two hint fields, and keeps a key `open_questions.json` stages
 * or a catalog key as it is. check_outputs reads the same context and refuses a key the recipe
 * does not spell.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { hasUrlShape, scanForIdentifiers } from '@bookette/identifier-scan';

import { parseEffect, type Effect } from '../effects';
import { passThroughTieOf } from '../pass-through-tie';
import {
  OPEN_QUESTION_SUBJECTS,
  PASS_THROUGH_FACT,
  parseOpenQuestionKey,
  placeSubject,
  spellOpenQuestionKey,
  type KeyContext,
  type KeyFlag,
  type KeyLine,
  type OpenQuestionSubject,
} from '../question-keys';
import { policyFilePhrases } from '../policy-file';

type Json = Record<string, unknown>;

function loadJson(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

function record(value: unknown): Json | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Json)
    : null;
}

function records(value: unknown): Json[] {
  return Array.isArray(value)
    ? value.map(record).filter((entry): entry is Json => entry !== null)
    : [];
}

function str(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

/** The catalog's `open.facts`: each well-formed `{fact, subject}` entry, the fact snake_case. */
export function parseOpenFacts(raw: unknown): Map<string, OpenQuestionSubject> {
  const facts = new Map<string, OpenQuestionSubject>();
  for (const entry of records(raw)) {
    const fact = str(entry.fact);
    const subject = str(entry.subject);
    if (fact === null || !/^[a-z]+(?:_[a-z]+)*$/.test(fact)) continue;
    if (subject === null || !(OPEN_QUESTION_SUBJECTS as readonly string[]).includes(subject)) {
      continue;
    }
    facts.set(fact, subject as OpenQuestionSubject);
  }
  return facts;
}

/** The catalog the skill ships, as the key recipe reads it: its fact kinds and its own keys. */
export function loadKeyCatalog(skillDir: string): {
  facts: Map<string, OpenQuestionSubject>;
  catalogKeys: Set<string>;
} {
  const catalog = record(loadJson(join(skillDir, 'rules', 'question_catalog.json')));
  const catalogKeys = new Set(
    records(catalog?.entries)
      .map((entry) => str(entry.key))
      .filter((key): key is string => key !== null),
  );
  return { facts: parseOpenFacts(record(catalog?.open)?.facts), catalogKeys };
}

/** True when a text would fail the scan the run's question strings pass in check_outputs:
 *  an identifier or URL shape, or a word the policy list forbids. */
export function keyFlagOf(skillDir: string): KeyFlag {
  const banned = policyFilePhrases(skillDir);
  return (text) =>
    scanForIdentifiers(text) !== null ||
    hasUrlShape(text) ||
    banned.some((phrase) => phrase.test(text));
}

/** What a workspace's run knows that a key is spelled from, each file read once, and the keys
 *  `open_questions.json` stages. */
export interface WorkspaceKeyContext extends KeyContext {
  readonly stagedOpenKeys: ReadonlySet<string>;
}

export function keyContextOf(
  workspace: string,
  skillDir: string,
  facts: ReadonlyMap<string, OpenQuestionSubject>,
): WorkspaceKeyContext {
  const staged = record(loadJson(join(workspace, 'profile.json')));
  const resolved = record(loadJson(join(workspace, 'out', 'profile.resolved.json')));
  const summaries = record(loadJson(join(workspace, 'confirmed', 'summaries.json')));
  const lines = new Map<string, KeyLine>();
  for (const row of [
    ...records(summaries?.items),
    ...records(summaries?.held),
    ...records(loadJson(join(workspace, 'out', 'ledger.json'))),
  ]) {
    const id = str(row.id);
    if (id !== null) lines.set(id, { sourceFile: str(row.source_file), vendor: str(row.vendor) });
  }
  const documents = new Set<string>();
  for (const file of records(record(loadJson(join(workspace, 'out', 'inventory.json')))?.files)) {
    const path = str(file.file);
    if (path !== null) documents.add(path);
  }
  for (const line of lines.values()) if (line.sourceFile !== null) documents.add(line.sourceFile);
  const keysOf = (list: 'entities' | 'vehicles'): Set<string> =>
    new Set(
      [...records(staged?.[list]), ...records(resolved?.[list])]
        .map((entry) => str(entry.key))
        .filter((key): key is string => key !== null),
    );
  return {
    facts,
    answered: new Set(Object.keys(record(loadJson(join(workspace, 'answers.json'))) ?? {})),
    lines,
    documents: [...documents].sort(),
    entityKeys: keysOf('entities'),
    vehicleKeys: keysOf('vehicles'),
    useKeys: new Set(
      [...records(staged?.vehicles), ...records(resolved?.vehicles)]
        .flatMap((vehicle) => records(vehicle.uses))
        .map((use) => str(use.key))
        .filter((key): key is string => key !== null),
    ),
    flagged: keyFlagOf(skillDir),
    stagedOpenKeys: new Set(
      Object.keys(record(loadJson(join(workspace, 'open_questions.json'))) ?? {}),
    ),
  };
}

/** The fact kind a question names and the profile key it is about: its `fact` and `about` hint
 *  fields, else what its key parses to; null when it names no fact kind of the catalog. */
export function questionFactOf(
  question: Json,
  facts: ReadonlyMap<string, OpenQuestionSubject>,
): { fact: string; about: string | null } | null {
  const key = str(question.key);
  const parts = key === null ? null : parseOpenQuestionKey(key, [...facts.keys()]);
  const hinted = str(question.fact);
  const fact = hinted ?? parts?.fact ?? null;
  if (fact === null || !facts.has(fact)) return null;
  const about =
    str(question.about) ?? (parts !== null && parts.fact === fact ? parts.subject : null);
  return { fact, about };
}

/** The parsed effects of a question's options, the untypeable ones left out. */
export function questionEffects(question: Json): Effect[] {
  return records(question.options)
    .map((option) => parseEffect(option.effect))
    .filter((effect): effect is Effect => effect !== null);
}

/**
 * The build stage: rewrite out/questions.json with every `entity_register` option's `entityKey`
 * spelled from its `entityName`, and every question of the agent's own keyed as the recipe spells
 * it, its `fact` and `about` hints dropped; a staged or catalog key is kept as it is, and a
 * question the recipe cannot key keeps its hints so check_outputs names the reason. Returns how
 * many keys it spelled.
 */
export function spellWorkspaceQuestionKeys(workspace: string, skillDir: string): number {
  const path = join(workspace, 'out', 'questions.json');
  if (!existsSync(path)) return 0;
  const questions = loadJson(path);
  if (!Array.isArray(questions)) return 0;
  const { facts, catalogKeys } = loadKeyCatalog(skillDir);
  const context = keyContextOf(workspace, skillDir, facts);
  let spelled = 0;
  const written = questions.map((raw: unknown) => {
    const question = record(raw);
    if (question === null) return raw;
    const options = Array.isArray(question.options)
      ? question.options.map((rawOption: unknown) => {
          const option = record(rawOption);
          const effect = record(option?.effect);
          const name = str(effect?.entityName);
          if (option === null || effect?.kind !== 'entity_register' || name === null) {
            return rawOption;
          }
          return {
            ...option,
            effect: { ...effect, entityKey: placeSubject(name, context.flagged) },
          };
        })
      : question.options;
    const rest: Json = { ...question, options };
    delete rest.fact;
    delete rest.about;
    const key = str(question.key);
    if (key !== null && (context.stagedOpenKeys.has(key) || catalogKeys.has(key))) return rest;
    const target = questionFactOf(question, facts);
    if (target === null) return { ...question, options };
    const result = spellOpenQuestionKey(
      {
        ...target,
        cites: Array.isArray(question.cites) ? question.cites : [],
        effects: questionEffects({ ...question, options }),
      },
      context,
    );
    if (!result.ok) return { ...question, options };
    spelled += 1;
    return { ...rest, key: result.key };
  });
  writeFileSync(path, `${JSON.stringify(written, null, 2)}\n`);
  return spelled;
}

/**
 * The build stage after the keys (issue #1530): every `pass_through` question's options carry
 * `recommended` exactly where the 1099-K tie-out (`passThroughTieOf`) puts it, over this run's
 * out/ledger.json and out/documents.json, and nowhere when it ties nothing; a flag the agent wrote
 * is replaced. Returns how many questions it marked.
 */
export function markPassThroughTies(workspace: string, skillDir: string): number {
  const path = join(workspace, 'out', 'questions.json');
  if (!existsSync(path)) return 0;
  const questions = loadJson(path);
  if (!Array.isArray(questions)) return 0;
  const { facts } = loadKeyCatalog(skillDir);
  const ledger = records(loadJson(join(workspace, 'out', 'ledger.json')));
  const documents = records(loadJson(join(workspace, 'out', 'documents.json')));
  let marked = 0;
  const written = questions.map((raw: unknown) => {
    const question = record(raw);
    if (question === null || questionFactOf(question, facts)?.fact !== PASS_THROUGH_FACT) {
      return raw;
    }
    if (!Array.isArray(question.options)) return raw;
    const tie = passThroughTieOf(
      Array.isArray(question.cites) ? question.cites : [],
      ledger,
      documents,
    );
    if (tie !== null) marked += 1;
    const options = question.options.map((rawOption: unknown) => {
      const option = record(rawOption);
      if (option === null) return rawOption;
      const rest: Json = { ...option };
      delete rest.recommended;
      return tie !== null && option.id === tie ? { ...rest, recommended: true } : rest;
    });
    return { ...question, options };
  });
  writeFileSync(path, `${JSON.stringify(written, null, 2)}\n`);
  return marked;
}

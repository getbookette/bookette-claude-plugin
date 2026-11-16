// The person's "Sort these out" (issues #1208 and #1249): the worker stages `waiting_lines.json`,
// the confirmed lines no place holds in the digest's item shape, only for the run that carries
// the request and only when a line waits (apps/worker/src/run-bundle.ts). The start stage's count
// and check_outputs' `waiting_lines_unasked` gate read the file through this one reader, so both
// count the same lines.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const WAITING_LINES_FILE = 'waiting_lines.json';

/** The ledger ids of the staged waiting lines: each entry that is an object with a string `id`,
 *  in file order. A missing or unparseable file, or one that is not a list, stages none. */
export function waitingLineIds(workspace: string): string[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(join(workspace, WAITING_LINES_FILE), 'utf8'));
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed
    .map((entry: unknown) =>
      typeof entry === 'object' && entry !== null && !Array.isArray(entry)
        ? (entry as Record<string, unknown>).id
        : undefined,
    )
    .filter((id): id is string => typeof id === 'string');
}

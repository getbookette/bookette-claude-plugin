// The run's closing summary (issue #1639): `out/summary.json`, `{"summary": "<text>"}`, the
// paragraph Review opens the round with. check_outputs and both importers read its shape here.

import { oneLineText } from './question-keys';

/** The file a run writes its summary to, under `out/`. */
export const RUN_SUMMARY_FILE = 'summary.json';

/** The longest summary, in characters; pinned equal to the database's constant. */
export const RUN_SUMMARY_MAX_LENGTH = 600;

/** The summary text, trimmed, when the file's value is an object whose `summary` is a non-empty
 *  string of at most RUN_SUMMARY_MAX_LENGTH characters with no control character; else null. */
export function runSummaryOf(value: unknown): string | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
  return oneLineText((value as Record<string, unknown>)['summary'], RUN_SUMMARY_MAX_LENGTH);
}

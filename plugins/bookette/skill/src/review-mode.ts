// The review mode (issue #1384, decision record 0150): in `sort_then_show` a run books a line it
// would ask a placement question about on the place its documents or earlier answers point to, and
// keeps the question as a stored placement the person may send back; in `ask` every placement is
// asked. The worker stages the workspace's mode into every run as `review_mode.json`,
// `{"mode": "sort_then_show"}` (the column's default) or `{"mode": "ask"}`, and the import rebuilds
// it (apps/worker/src/run-bundle.ts). The start stage's `review_mode` and check_outputs'
// placed-question gate read the file through this one reader, so both see the same mode. Only a
// file that says `sort_then_show` reads `sort_then_show`: an absent, unparseable or other file
// reads `ask`, so a missed mode fails safe to asking, and the personal tool, which stages none,
// asks as it always has. The name is not `review.json`, which is the personal tool's completeness
// review input (decision record 0127, reference/review.md): a run directory staged with that file
// is a review run.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const REVIEW_MODE_FILE = 'review_mode.json';

/** The two modes, the words of packages/db's `workspaces.review_mode` CHECK. The skill depends on
 *  no package, so it keeps its own list; packages/config/test/review-modes.spec.ts holds it to the
 *  database package's `REVIEW_MODES`, the one pinned to the CHECK, as text. The worker passes the
 *  column's value, which TypeScript holds to this type. */
export const REVIEW_MODES = ['ask', 'sort_then_show'] as const;
export type ReviewMode = (typeof REVIEW_MODES)[number];

/** The staged mode: `sort_then_show` when `review_mode.json` is an object whose `mode` is that
 *  word, `ask` for anything else, an absent or unparseable file included. */
export function reviewModeOf(workspace: string): ReviewMode {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(join(workspace, REVIEW_MODE_FILE), 'utf8'));
  } catch {
    return 'ask';
  }
  return typeof parsed === 'object' &&
    parsed !== null &&
    !Array.isArray(parsed) &&
    (parsed as Record<string, unknown>)['mode'] === 'sort_then_show'
    ? 'sort_then_show'
    : 'ask';
}

/** The `review_mode.json` body the worker stages for a mode: `{"mode": <mode>}`. */
export function reviewFileBody(mode: ReviewMode): string {
  return JSON.stringify({ mode });
}

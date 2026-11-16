/**
 * The stored findings an accountant-facing list shows once each. On the SaaS every run is staged
 * with `confirmed/`, and such a run writes what is newly open while earlier runs' findings stand
 * (`reference/incremental.md`), so the readers list every run's findings; and a run writes again
 * the findings the verdict names for its carried state, so one finding can be stored more than
 * once. A finding repeats another only when its kind, trip, gap word, cited lines and message as
 * the reader renders it, whitespace collapsed, are all the same: nothing here judges what two
 * messages mean, so a reworded copy still lists.
 */

/** A stored finding as a reader shows it: `message` is the reader's rendering of it. */
export interface StoredFinding {
  readonly id: number;
  readonly kind: string;
  readonly message: string;
  readonly tripId: number | null;
  readonly gap: string | null;
}

/** One cited line of a stored finding, as the reader renders its cites. */
export interface StoredFindingCite {
  readonly findingId: number;
  readonly lineItemId: number;
}

/** The ids of the findings to show: the first of each set of exact repeats, in the order given. */
export function distinctFindingIds(
  findings: readonly StoredFinding[],
  cites: readonly StoredFindingCite[],
): ReadonlySet<number> {
  const linesByFinding = new Map<number, Set<number>>();
  for (const cite of cites) {
    const lines = linesByFinding.get(cite.findingId) ?? new Set<number>();
    lines.add(cite.lineItemId);
    linesByFinding.set(cite.findingId, lines);
  }
  const seen = new Set<string>();
  const kept = new Set<number>();
  for (const finding of findings) {
    const lines = [...(linesByFinding.get(finding.id) ?? [])].sort((a, b) => a - b);
    const key = JSON.stringify([
      finding.kind,
      finding.tripId,
      finding.gap,
      lines,
      finding.message.trim().replace(/\s+/g, ' '),
    ]);
    if (seen.has(key)) continue;
    seen.add(key);
    kept.add(finding.id);
  }
  return kept;
}

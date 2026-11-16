// The categories a person can pick for one booked line (issue #1376): the lines of the line's own
// schedule in the tax year's `rules/ty<year>/schedule_lines.json`, of the line's own kind (an
// expense line picks among the expense lines, an income line among `income_lines`), and the
// treatment tie a pick would cross. The tie marker is rules data (`treatment_ties`, decision
// record 0011 item 3 and its 2026-10-29 amendment). The founder's tie set names the lines,
// Depreciation (E 18, C 13) and Meals (C 24b, and any line carrying the `meal` flag); a pick
// crossing one in either direction, onto it or off it, is the same choice between two
// treatments the accountant decides (the direction is agent-decided), so it is never taken as
// the person's fact. Every other pick is the person's fact, and a pick never changes the line's
// tag (the improvement-or-repair fact stays the skill's `work` question's).
//
// Pure over a parsed table: the web passes its imported year tables, the importer the staged
// year's file, so no reader here touches the filesystem.

/** The two schedules a line table carries. */
export type CategorySchedule = 'C' | 'E';

/** A line's kind, derived from its line: `line_items` carries no kind column. */
export type CategoryKind = 'expense' | 'income';

/** The tie names the rules data may mark, those of decision record 0011 item 3. */
export const TREATMENT_TIE_NAMES = ['improvement or repair', 'meal methods'] as const;
export type TreatmentTieName = (typeof TREATMENT_TIE_NAMES)[number];

/** One year's `schedule_lines.json`, as this module reads it. */
export interface ScheduleLinesTable {
  readonly lines: Readonly<Record<CategorySchedule, ReadonlyMap<string, string>>>;
  readonly incomeLines: Readonly<Record<CategorySchedule, ReadonlySet<string>>>;
  readonly ties: Readonly<Record<CategorySchedule, ReadonlyMap<string, TreatmentTieName>>>;
}

/** One line a person may pick, in the table's order, with the tie it would cross or null. */
export interface PickableLine {
  readonly line: string;
  readonly label: string;
  readonly tie: TreatmentTieName | null;
}

const SCHEDULES: readonly CategorySchedule[] = ['C', 'E'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isTieName(value: unknown): value is TreatmentTieName {
  return (TREATMENT_TIE_NAMES as readonly unknown[]).includes(value);
}

/**
 * Parses a year's `schedule_lines.json`, or null when its `C` or `E` table is missing or carries a
 * non-string label, `income_lines` names a line its table lacks, or `treatment_ties` marks a line
 * its table lacks or names a tie outside `TREATMENT_TIE_NAMES`. An absent `treatment_ties` marks
 * no tie. Keys beyond these four are ignored.
 */
export function scheduleLinesTableOf(value: unknown): ScheduleLinesTable | null {
  if (!isRecord(value)) return null;
  const income = value['income_lines'];
  const ties = value['treatment_ties'] ?? {};
  if (!isRecord(income) || !isRecord(ties)) return null;
  const lines = {} as Record<CategorySchedule, Map<string, string>>;
  const incomeLines = {} as Record<CategorySchedule, Set<string>>;
  const tieLines = {} as Record<CategorySchedule, Map<string, TreatmentTieName>>;
  for (const schedule of SCHEDULES) {
    const table = value[schedule];
    if (!isRecord(table)) return null;
    const labels = new Map<string, string>();
    for (const [line, label] of Object.entries(table)) {
      if (typeof label !== 'string') return null;
      labels.set(line, label);
    }
    const listed = income[schedule] ?? [];
    if (!Array.isArray(listed)) return null;
    const incomeSet = new Set<string>();
    for (const line of listed as unknown[]) {
      if (typeof line !== 'string' || !labels.has(line)) return null;
      incomeSet.add(line);
    }
    const marked = ties[schedule] ?? {};
    if (!isRecord(marked)) return null;
    const tieMap = new Map<string, TreatmentTieName>();
    for (const [line, name] of Object.entries(marked)) {
      if (!labels.has(line) || !isTieName(name)) return null;
      tieMap.set(line, name);
    }
    lines[schedule] = labels;
    incomeLines[schedule] = incomeSet;
    tieLines[schedule] = tieMap;
  }
  return { lines, incomeLines, ties: tieLines };
}

/** The kind of a line on its schedule, or null when the schedule's table does not hold it. */
export function lineKindOf(
  table: ScheduleLinesTable,
  schedule: CategorySchedule,
  line: string,
): CategoryKind | null {
  if (!table.lines[schedule].has(line)) return null;
  return table.incomeLines[schedule].has(line) ? 'income' : 'expense';
}

/** A line number's place on its form: by its number, then its letter ('13a' after '13', before
 *  '14'). A parsed JSON object lists integer keys before the others, so its own order is not the
 *  form's. */
function compareLines(a: string, b: string): number {
  const number = (line: string): number => Number.parseInt(line, 10);
  return number(a) - number(b) || (a < b ? -1 : a > b ? 1 : 0);
}

/** The lines a person may pick on a schedule for a line of the given kind, in the form's order,
 *  each with the tie a pick onto it would cross. */
export function pickableLines(
  table: ScheduleLinesTable,
  schedule: CategorySchedule,
  kind: CategoryKind,
): PickableLine[] {
  return [...table.lines[schedule].entries()]
    .filter(([line]) => lineKindOf(table, schedule, line) === kind)
    .sort(([a], [b]) => compareLines(a, b))
    .map(([line, label]) => ({ line, label, tie: table.ties[schedule].get(line) ?? null }));
}

/**
 * The tie a pick from `from` to `to` on one schedule crosses, or null: the target or the source
 * is a line the rules data marks, or the source line carries the `meal` flag (step 3 sets it, and
 * a line change cannot keep it coherent), which is the meal-methods tie.
 */
export function categoryTieOf(
  table: ScheduleLinesTable,
  schedule: CategorySchedule,
  pick: { readonly from: string; readonly to: string; readonly meal: boolean },
): TreatmentTieName | null {
  const ties = table.ties[schedule];
  return ties.get(pick.to) ?? ties.get(pick.from) ?? (pick.meal ? 'meal methods' : null);
}

/** Why a pick is not taken as the person's fact, or null when it is one. */
export type CategoryPickRefusal =
  /** The line's current line is not in the schedule's table, so it has no kind to keep. */
  | 'unknown_line'
  /** The target is not a line of the schedule's table, or is of the other kind. */
  | 'not_pickable'
  /** The pick crosses a treatment tie: the accountant's open item, never an answer. */
  | 'tie'
  /** The line is already booked there. */
  | 'already';

/**
 * Judges a pick against one year's table: the source line must be in the schedule's table, the
 * target must be a line of the same table and kind, it must move the line, and it must cross no
 * tie. "Already so" comes before the tie, so picking the tie line a line already sits on says so.
 * One verdict the web core and the importer's guard share.
 */
export function judgeCategoryPick(
  table: ScheduleLinesTable,
  schedule: CategorySchedule,
  pick: { readonly from: string; readonly to: string; readonly meal: boolean },
): CategoryPickRefusal | null {
  const kind = lineKindOf(table, schedule, pick.from);
  if (kind === null) return 'unknown_line';
  if (lineKindOf(table, schedule, pick.to) !== kind) return 'not_pickable';
  if (pick.from === pick.to) return 'already';
  if (categoryTieOf(table, schedule, pick) !== null) return 'tie';
  return null;
}

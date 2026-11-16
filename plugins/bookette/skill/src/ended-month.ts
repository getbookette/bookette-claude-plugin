// The end month the person declared for a property or business (issue #899). The report's
// ended line and the workbook's Ended row both word it from here, so they cannot drift. It names
// the month and nothing about what the month does: how a sale or an end of renting is reported
// is the accountant's call (invariant 5).

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

/** `YYYY-MM-01`, the column's first-of-month date, or the posted `YYYY-MM`, as "August 2026". */
export function endedMonthWords(endedOn: string): string {
  const match = /^(\d{4})-(\d{2})(?:-01)?$/.exec(endedOn);
  const month = match === null ? undefined : MONTHS[Number(match[2]) - 1];
  if (match === null || month === undefined) {
    throw new Error('an end month is a YYYY-MM month or its first day');
  }
  return `${month} ${match[1] ?? ''}`;
}

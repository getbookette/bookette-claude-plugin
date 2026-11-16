/**
 * One ledger line's amount as a screen or a prompt prints it (issue #329).
 *
 * A line in USD prints in dollars. A line in any other currency prints its own amount beside its
 * code, exactly as the Review screen's line rows print it — never a `$` sign in front of a figure
 * the row does not hold (decision record 0018).
 *
 * The conversion a foreign line may carry is not rendered here and no USD figure is derived from
 * it: nothing writes `line_items.fx_rate` yet (the importer keeps the rate facts in the run's
 * calculation steps), so the prompt shows the line's own currency only, and the USD figure behind
 * a conversion comes from Abacus at its one rounding point (decision record 0033 item 2).
 */
import { fmtCents } from './money';

const USD = 'USD';

/** The code as the rows carry it, upper-cased; an empty one is USD (the column's own default). */
function codeOf(currency: string): string {
  const code = currency.trim().toUpperCase();
  return code === '' ? USD : code;
}

/** `$59.99` for a USD line, `1280.00 TWD` for one in another currency. */
export function lineAmountText(amountCents: bigint, currency: string): string {
  const code = codeOf(currency);
  return code === USD ? `$${fmtCents(amountCents)}` : `${fmtCents(amountCents)} ${code}`;
}

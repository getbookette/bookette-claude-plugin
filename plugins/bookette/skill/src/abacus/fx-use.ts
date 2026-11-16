/**
 * The currency conversion every placed figure goes through, as Abacus's modules see it: a
 * function the script layer binds to the staged rules directory and the run's rate snapshot
 * (fx.ts `toUsd`), so no module reads a rate file itself. A conversion that cannot be priced
 * throws an `FxError`; the build carries a line whose currency has no rate at all on its date
 * (`no_rate`, `no_source`) unpriced (decision record 0159) and turns every other code into the
 * item's build error.
 */
import { fmtCents, type Dec } from '../money';
import { text, type Json } from './values';

/** One amount converted: its USD cents and, when it was not USD, the rate facts behind them. */
export interface Converted {
  readonly cents: bigint;
  readonly info: Json | null;
}

export type Convert = (currency: string, day: string, amount: Dec) => Converted;

/** The conversion facts behind a USD figure, carried when the amount was not USD. */
export type FxFacts = {
  amount: string;
  currency: string;
  rate: string;
  rate_date: string;
  source: string;
};

/** The facts a placed entry carries beside its cents: null for a USD amount. */
export function fxFactsOf(amount: string, info: Json | null): FxFacts | null {
  return info === null
    ? null
    : {
        amount,
        currency: text(info.currency),
        rate: text(info.rate),
        rate_date: text(info.rate_date),
        source: text(info.source),
      };
}

/** The books' fx_used row for one converted ledger item: its id, amount, USD and the rate facts. */
export function fxUsedRow(id: string, amount: string, cents: bigint, info: Json): Json {
  return { id, amount, usd: fmtCents(cents), ...info };
}

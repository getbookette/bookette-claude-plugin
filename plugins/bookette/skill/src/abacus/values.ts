/**
 * The plain readers every Abacus module reads its inputs through: a profile, ledger or rules
 * value is `unknown` until one of these says what it is, and none of them throws.
 */
import { parseDec, SCALE, type Dec } from '../money';

export type Json = Record<string, unknown>;

export function asObject(value: unknown): Json {
  return (value ?? {}) as Json;
}

export function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/** A value as text: a scalar as written, absent as the empty string, anything else as JSON. */
export function text(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'bigint' || typeof value === 'boolean') {
    return String(value);
  }
  if (value === null || value === undefined) return '';
  return JSON.stringify(value);
}

/** A value as a build message names it: as `text` reads it, and an absent one as `None`. */
export function named(value: unknown): string {
  return value === null || value === undefined ? 'None' : text(value);
}

export function strOrNull(value: unknown): string | null {
  return value === null || value === undefined ? null : text(value);
}

/** The integer a profile field carries, or null when absent or not an integer. An empty string,
 *  a boolean or other junk is not a recorded count - it coerces to no count, never to zero or
 *  one - while a string that parses to an integer records that integer. */
export function intOrNull(value: unknown): number | null {
  if (typeof value === 'number') return Number.isInteger(value) ? value : null;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isInteger(parsed) ? parsed : null;
  }
  return null;
}

/** A decimal value a profile or payment field carries, or null when absent or unparseable. */
export function decOrNull(value: unknown): Dec | null {
  if (value === null || value === undefined) return null;
  try {
    return parseDec(text(value));
  } catch {
    return null;
  }
}

/** A scaled value as its plain decimal text: 2000 → "2000", 1234.5 → "1234.5". */
export function fmtDec(value: Dec): string {
  const negative = value.v < 0n;
  const abs = negative ? -value.v : value.v;
  const whole = abs / SCALE;
  const fraction = (abs % SCALE).toString().padStart(12, '0').replace(/0+$/, '');
  return `${negative ? '-' : ''}${whole.toString()}${fraction === '' ? '' : `.${fraction}`}`;
}

/** Ids the way a warning lists them: `['L0001', 'L0002']`. */
export function idList(ids: readonly string[]): string {
  return `[${ids.map((id) => `'${id}'`).join(', ')}]`;
}

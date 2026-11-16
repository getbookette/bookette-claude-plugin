/** The JSON readers the placement pointer and out/places.json share. */
import { readFileSync } from 'node:fs';

export type Json = Record<string, unknown>;

/** A file's parsed JSON, or null when it is missing or unreadable. */
export function loadJson(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

export function record(value: unknown): Json | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Json)
    : null;
}

/** A non-empty string, else null. */
export function str(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null;
}

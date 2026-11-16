/**
 * Loads the rules' currency map (rules/ty&lt;year&gt;/fx/currencies.json) for the reference
 * loader job (plan task 10.7, ADR 0111 item 4): the loader pairs each mapped currency with its
 * H.10 series id and applies the Treasury drop rule — a row whose map entry carries an
 * h10_series is never loaded from Treasury (issue #102's founder ruling: the snapshot lookup
 * ranks an H.10 series above Treasury rows of the same currency and a gap stays a gap, so a
 * Treasury row for an H.10-covered currency can only turn an otherwise-fine run into a books
 * failure). The rules tree resolves relative to this package the way versions.ts resolves it,
 * so the deployed tree and a checkout read the same files. Pure filesystem read: no network.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { FxCurrencyMap, FxCurrencyMapEntry } from './parse_treasury';

export function loadFxCurrencyMap(taxYear: number): FxCurrencyMap {
  const path = join(
    __dirname,
    '..',
    '..',
    'rules',
    `ty${String(taxYear)}`,
    'fx',
    'currencies.json',
  );
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    throw new Error(
      `could not read the fx currency map at rules/ty${String(taxYear)}/fx/currencies.json`,
    );
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('the fx currency map is not an object');
  }
  const map: FxCurrencyMap = {};
  for (const [iso, entry] of Object.entries(parsed as Record<string, unknown>)) {
    if (!/^[A-Z]{3}$/.test(iso)) {
      throw new Error(`the fx currency map carries a non-ISO key: ${iso}`);
    }
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
      throw new Error(`the fx currency map entry for ${iso} is not an object`);
    }
    const record = entry as Record<string, unknown>;
    const h10Series = record['h10_series'];
    const treasuryName = record['treasury_name'];
    if (typeof h10Series !== 'string' || h10Series === '') {
      throw new Error(`the fx currency map entry for ${iso} carries no h10_series`);
    }
    if (typeof treasuryName !== 'string' || treasuryName === '') {
      throw new Error(`the fx currency map entry for ${iso} carries no treasury_name`);
    }
    const shaped: FxCurrencyMapEntry = { h10_series: h10Series, treasury_name: treasuryName };
    map[iso] = shaped;
  }
  return map;
}

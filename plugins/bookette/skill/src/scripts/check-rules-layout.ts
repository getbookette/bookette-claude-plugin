import { join } from 'node:path';

import { checkRulesLayout, runRulesLayoutCheck } from '../rules-layout';

// Checks the rules/ tree's per-tax-year layout: each tyNNNN directory carries a manifest.json
// naming every rules file under it with its sources, and nothing in the tree is unlisted.
// Runs as the second half of the package build (see package.json). Makes no network call and
// reads only the rules tree.

const rulesPath = join(__dirname, '..', '..', 'rules');

for (const problem of checkRulesLayout(rulesPath)) {
  process.stderr.write(`${problem}\n`);
}
process.exit(runRulesLayoutCheck(rulesPath));

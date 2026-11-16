// Assign the code-owned ledger ids (task 11.8) to <workspace>/out/ledger.json, in place. Run
// after the ledger is proposed and before anything cites a ledger id; `check_outputs` recomputes
// the same assignment and rejects a file whose ids differ, so a skipped run fails the gate.
import { assignWorkspaceLedger } from '../ledger-ids';

function main(argv: string[]): void {
  const workspace = argv[0];
  if (workspace === undefined) throw new Error('usage: assign_ids.js <workspace>');
  const count = assignWorkspaceLedger(workspace);
  console.log(`assign_ids: assigned ${String(count)} code-owned ledger id(s)`);
}

if (require.main === module) {
  main(process.argv.slice(2));
}

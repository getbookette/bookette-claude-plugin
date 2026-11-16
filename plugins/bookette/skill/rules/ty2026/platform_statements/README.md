# platform_statements/ — payout statement layouts per platform

Rules data describing what each gig and short-term-rental platform's payout
statements look like: the documents the platform issues, the columns (or
sections) each carries, which figure is gross, which is net, the fee and tax
vocabulary, and how rows are classed. One JSON file per platform. The reader
(epic #1017 step 2, issue #1106) matches these names against real exports, so
spelling drift between this data and the synthetic fixtures in
`packages/test-fixtures/documents/platform-statements/` is a defect; the spec
pins the fixture-header equality.

Each file carries `provenance[]` whose URL set equals its `manifest.json`
`source_url` set — the checker cross-checks the two so they cannot drift.
Column confidence is per column: `documented` names a column the platform's own
help pages state, and `recalled` marks the step-1 recall — Uber's trip-level
headers in particular are wholly recalled. UNVERIFIED: `recalled` is meant to
render as UNVERIFIED in consumer output; no consumer exists until issue #1106
builds the reader. Every document here is described from official help pages
and from synthetic fixtures: airbnb.json, vrbo.json, uber.json and doordash.json
from pages read on 2026-10-14, lyft.json from pages read on 2026-10-15. No real
person's statement was read (invariant 3).

- **airbnb.json** — the Earnings dashboard CSV (the export Airbnb's tax
  article documents column by column) and the annual earnings summary. Gross is
  the sum of `Amount` and `Host Fee` on Reservation rows; net is `Amount` on
  `Payout` rows; `Resolution Adjustment` rows are refunds outside gross. The
  gross carries the `Host Fee`, which also prints as the fee figure, and the
  `Cleaning Fee` and `Management Fee` inside `Amount`, which print nothing of
  their own (issue #1150): the payouts are the `Amount`s, the gross less the
  fee plus the adjustments.
  Occupancy taxes split between host-collected (inside gross) and
  Airbnb-collected (outside) by jurisdiction, so the column is recorded as
  seller-remitted per the sampled configuration and the split stays a per-
  statement question.
- **vrbo.json** — four documents: the payout summary report (gross is the
  stated `Gross Booking Amount`; its `Deductions` column is the commissions and
  fees taken out; platform-remitted stay taxes appear in no column by design),
  the payment history export (rows classed on `Payment Type`; the traveler-side
  `Service Fee` never enters owner gross; its declared gross — the revenue
  columns plus owner-set `Tax` on earning rows, whose money on every earning
  row is the two stay-tax columns' sum — excludes retained damage
  deposits, which the documented rule places in the payout summary's stated
  `Gross Booking Amount`; the gross carries the platform-remitted `Stay Tax We
Remit`, which prints in the fee figure (issue #1155), while the
  seller-remitted `Stay Tax You Remit` is money the payout pays the owner to
  remit and keeps its own expense figure; a cross-document claim-row anchor is
  deferred to issue #1106's design), the
  stay tax report (the "Taxes Vrbo paid" and "Taxes you pay" sections), and the
  bank deposit report (the net reconciliation target, "Total Payout").
- **uber.json** — the annual tax summary (the documented "Fare Breakdown"
  section carries gross; promotions live in the recalled "Other Income
  Breakdown" as the 1099-NEC stream) and the weekly earnings statement (rows
  classed on `Type`; gross is the stated `Trip or Order Fare` on earning rows;
  the week nets through the negative `Payout` row's `Total`; segments mark the
  Uber Eats delivery rows beside the rides). The fare carries its
  `Service Fee`, `Booking Fee` and platform-remitted `Taxes`, all printed in
  the fee figure the way the annual summary's "Expense, Fees & Tax" section
  takes them out, and the rider's `Tolls` and `Tip`, which print nothing of
  their own (issue #1151): each earning row's `Total` is its fare less that
  fee.
- **doordash.json** — the weekly payouts CSV (its headers recalled: DoorDash
  documents no earnings CSV). Gross is the sum of `Base Pay` and `Promotions`,
  `Tips` stand outside gross as their own pass-through figure, and
  `Cash on Delivery Collected` is metadata — cash the dasher already holds,
  which the reconcile subtracts and no figure prints.
- **lyft.json** — the ride export CSV (the recalled legacy Driving History
  layout: no official page documents the headers, and `Gross Fare`, `Lyft Fee`,
  `Tolls` and `Bonus` are research additions). Gross is the stated `Gross Fare`,
  which carries the `Lyft Fee`, printed as the fee figure, and the rider's
  `Tolls`, which print nothing of their own (each ride's `Gross Fare` is its
  `Total Fare` plus both). `Tip` and `Bonus` are paid on top of it, so the tip
  prints as its own pass-through figure and `Gross Fare` less `Lyft Fee` plus
  `Tip` plus `Bonus` equals `Total Payout`.

Layouts were collected in epic #1017 step 1: the [step-1
comment](https://github.com/getbookette/bookette/issues/1017#issuecomment-6175822255)
links the per-platform research, and the full notes live on the
`issue-1017-sample-documents` branch. A platform that changes its export format
gets a year-scoped correction to its file here.

Both tax years the skill carries hold identical copies of this directory, the
way `fx/` does, so each year is a complete rules year — the rules.spec.ts
byte-parity pin holds the copies identical. A mid-year format divergence
therefore breaks that pin on purpose: amend the pin deliberately and edit only
the current year's copy, forward — ty2025 keeps the column names its own reader
matched, and a correction is never copied backward into it.

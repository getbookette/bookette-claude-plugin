# Staged readings

The detail of SKILL.md's reading rule for a document whose reading the workspace stages (`extractions/<document filename with its extension replaced by .json>`): how each page's state is recorded, and a page left out as boilerplate.

## Each page's state

SKILL.md's reading rule records an `unreadable` finding for every staged page whose `page_status` is not `READ` or `SKIPPED`, or whose reading's `"status"` is `"unreadable"`. Word it `not read` for `HELD` (held past the plan's page cap), `BUDGET_HELD` and `COUNTED` (still being read), and `unreadable` for `COULD_NOT_READ`, `TOO_LARGE` or a reading whose status is `unreadable`. A page that is not `READ` but still carries a reading (a re-read in flight) gets the finding and its reading's facts are still used as the page's last reading; a `not_read` stub contributes no facts. The document is `unreadable` in `out/documents.json` only when no page carries a reading that is not `unreadable` (a not-`READ` page's last reading counts, a stub does not); otherwise it is not `unreadable`, and the pages with usable readings still book beside the per-page findings. When pages disagree on `doc_type`, the document's is the lowest-index `READ` page's (the first of `pages` whose `page_status` is `READ` and whose reading is not `unreadable`), or the lowest-index page carrying a usable reading when none is `READ`.

## A page left out as boilerplate (`SKIPPED`)

A staged reading's page whose `page_status` is `SKIPPED` was left out as boilerplate by the reader: `skip_reason` says why (`agreement_text`, a customer agreement or other legal text with no figures; `blank`; `continuation_no_figures`, a later page with none). It carries no reading, and like every staged page it is no reason to open the original. It earns no finding while the document's other pages give its total and figures. When they leave the total or a figure open, the document is `needs_review` and its `unreadable` finding, worded `not read`, names each skipped page (`page <n>`) so the person can have it read.

## A page the person typed (`typed_by_person`)

A staged page carrying `"typed_by_person": true` is the person's own reading of a page the reader could not make out; its `notes` start `Typed by the person: `. Record its total as typed: `check_outputs.js` refuses a run whose ledger lines, donations, home costs and the tax payments it is the payment evidence of, taken from it together, do not add up to that total (`typed_total_unmatched`). A vendor or date left null was not given: never guess it, and write a `note` finding citing the document so the accountant sees what is missing, or the run is refused (`typed_reading_unstated`).

## A page code read (`fields.platform_statement`)

A staged spreadsheet page with `transactions` and no `fields.table` is a statement, such as a manager's owner statement, whose rows the reader wrote from the cells: money in positive and money out negative, as a statement's rows read from a PDF are.

A staged spreadsheet page whose reading carries `fields.table` is a card or bank export whose `transactions` code read from the cells under the column roles the reader declared: every row the sheet prints, each amount money in positive and money out negative (decision record 0177).

A staged page whose reading carries `fields.platform_statement` was read by code, not by the reader: the upload matched one platform payout-statement layout in the year's rules data (`rules/ty<tax_year>/platform_statements/`), and the block carries the platform's name, that layout's name, and the cell grid as parsed — its header row in the layout's own column names, and any column the layout does not declare left out — nothing computed. Its `doc_type` is `card_or_bank_export`. Get the page's figures with the `platform_statement` tool (`node <skill>/dist/scripts/platform_statement.js <workspace> <doc-id>`): one line per figure — gross, a kind, or net — each amount exactly as printed, `UNVERIFIED` on the figures that sum columns the rules data marks recalled or partial. Book the printed figures (step 3), never a figure of your own arithmetic and never the grid's row cells beside them. When the script answers `statement_grid_mismatch` or `statement_row_unclassed` — the stored grid predates a rules correction — book the page as any card export instead (the rows it prints, one line each) and add a `note` finding naming the document, so the person can have it read again under the corrected rules.

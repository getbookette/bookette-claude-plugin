# Review: the completeness check

Read this page when an event's message says `Review:`. A review is a second look over books that are already built: it writes findings and its own `out/summary.json`, and nothing else. It never books a line, changes a confirmed item, asks a new question or records a payment, a cost, a donation or a web value, and the import refuses a review whose `out/` does.

## What the workspace holds

`inbox/` is empty: there is no document to read. `confirmed/` is the digest of everything imported so far, and the incremental rule holds in a review too: never read `confirmed/summaries.json` whole. Query it with `node <skill>/dist/scripts/pipeline.js digest <workspace>` (the `pipeline_digest` tool in a run with no shell): `--id <id>` for each ledger id the `checks` and `recorded` entries below cite, and `--doc <document>` for each document they, `notes.json` or `open_questions.json` name, which prints that document's rows, the months and vendors a gap below is judged on. `profile.json`, `answers.json`, `open_questions.json` and `notes.json` are as staged. `review.json` holds two lists:

- `checks`: what Bookette's own code found on this review, each with its `key`, `kind`, `message` and `cites`. The person already sees every one of them.
- `recorded`: every finding already on record, with its `kind`, `message` and `cites`.

## What to look for

Look for what the documents, the digest, the profile and the notes say should be there and is not, which code cannot tell by matching fields:

- A recurring cost or income whose months stop or skip: a monthly statement, rent, a subscription or a payout that is on record for some months of the year and not others. Write a `missing_receipt` finding naming the vendor or payer and the months on record.
- A place whose usual documents are absent: a rental with rent on record and no insurance, mortgage or property-tax document, or a business with sales on record and no statement for the account they were paid into. Write a `missing_receipt` finding naming the place and the kind of document that is not on record.
- A trip whose lines leave a gap: travel to a place with no stay on record for the nights between, or a stay with no travel to reach it. Write a `missing_receipt` finding naming the trip and the dates.
- A fact the person wrote in `notes.json` that no line, document or answer carries, such as a payment they say they made. Write a `missing_receipt` finding naming the note's fact in its own words.
- A fact for the accountant that no other kind names and the digest shows, such as two documents from one payer covering the same months. Write a `note` as step 7 says.

Judge each gap from the rows the digest prints, the profile and the notes, and nothing else: fetch nothing from the web, because no value a review finds there can land.

Nothing found is a valid result: `out/findings.json` is then `[]`.

## How to write it

1. Run `pipeline.js start` over the workspace (step 1).
2. Write `out/documents.json` as `[]` and `out/ledger.json` as `[]`.
3. Write `out/profile.resolved.json` as step 5 writes it, from `profile.json` and `answers.json`; a review settles no new fact.
4. Leave `out/tax_payments.json` absent, or write it as an unchanged copy of `confirmed/tax_payments.json`. Leave `out/home_costs.json` absent, or write it as an unchanged copy of `confirmed/home_costs.json`. Write no `out/ledger_changes.json`, `out/donations.json` or `out/web_values.json`.
5. Write no new question. Write `out/questions.json` only when the build requires a question that `open_questions.json` already carries, and then that question unchanged under its key.
6. Write `out/findings.json` with only the findings this pass adds. Each finding takes a `kind` from step 7's list (`reference/steps/7-findings.md`), never a coined one; a `message` that names the documents, lines, dates, months and vendors it is about and states no amount, in neutral wording per `rules/policy.md`; and `cites` copied from the digest's ids and `source_file` spellings or the profile's keys. Never write a finding that a `checks` entry or a `recorded` entry already carries, in any wording. When the build requires a finding that `recorded` already carries, copy that recorded finding's `kind`, `message` and `cites` exactly.
7. A finding is an open item, never a fix: it proposes no line, no change, no category and no method, and it names no treatment.
8. Write `out/summary.json` as step 7's last section says, naming what this pass found missing or nothing missing, then run `pipeline.js build` until its verdict passes (steps 6 and 8).

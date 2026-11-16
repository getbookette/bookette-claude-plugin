# Situations

Some documents come in shapes that recur. Read the section that fits before recording the documents it describes. Each section uses only the statuses, fields and finding kinds SKILL.md already defines, and none chooses a tax treatment (hard rule 4). Finding messages keep step 7's rules: they name documents, dates and vendors, never an amount.

## Property-tax installments across years

How it looks: one bill states a year's tax and two or more installments with their due dates. A payment confirmation or a payment history shows each installment paid on its own date. The bill's own year ("2025 tax, payable in 2026") is often not the year the installments are paid.

- The payment date decides, never the bill's year or a due date. Stage one `out/tax_payments.json` entry per installment paid inside the workspace's tax year: its `date` is the payment date and its `bill_source` the bill.
- One document stages at most one payment: `payment_source` is a payment's identity, and `check_outputs.js` refuses two entries naming the same one. When one document is the only evidence for two installments, such as a history listing both halves with no confirmation for either, stage the earlier installment from it and write a `missing_receipt` finding naming the document and the other installment's payment date, so the person can upload that installment's own confirmation. Never stage the second installment under a made-up `payment_source`.
- The staged payment books the tax, so no ledger line cites its payment evidence or its bill, and `check_outputs.js` refuses one that does. When a line you wrote cites a staged payment's bill, remove the line, never the payment: a confirmed payment stays as it is even then. When the citing line is a confirmed one, stage no new payment from that payment evidence or bill: the confirmed digest cannot be edited, so its line keeps the tax.
- An installment paid outside the tax year, such as the second half paid the next January, is not staged. Write an `outside_tax_year` finding naming the payment document, its payment date and the bill. `check_outputs.js` refuses a new staged payment dated outside the tax year; one `confirmed/tax_payments.json` already carries stays staged. The build lists a staged one in `outside_year` and books nothing from it.
- A bill with no payment evidence books nothing. It still maps parcels to the property (step 5).

Never book a tax from a bill's total or a due date, and never split an installment yourself.

## A corrected 1099 superseding the original

How it looks: a 1099 marked "CORRECTED" from the same payer, with the same payer EIN as an earlier form and different box amounts.

- Both forms in this batch: book from the corrected form only. The original's status is `near_duplicate_of: <the corrected form's file>`, and it books nothing. Write a `note` finding naming both documents and saying the corrected form supersedes the original.
- The original already confirmed, with its line in `confirmed/summaries.json`: find that line by the payer, never by file name — the original was booked under its own file, which is not the corrected form's — with the digest query `--vendor <word>` (`reference/incremental.md`) for a word of the payer's name, which prints the rows whose vendor contains the word; when several rows match, choose the original by each row's `source_file` and `amount` (a digest row carries no EIN), and when they cannot be told apart, write no change and a `note` finding citing the rows. Book no second line. Write a `ledger_changes` entry on the confirmed line for the amount that changed, `from` the confirmed value and `to` the corrected one, armed by a `source_file` naming the corrected form. Write a `note` finding naming the corrected form and citing the confirmed line. This is the superseding-document case of the incremental rule, not a disagreement: the corrected form is another document than the one the line cites, while a re-read of the original's own file with another amount is a finding and arms no change (`reference/incremental.md`).
- The corrected form's status is `booked` in both cases, or `listed_only` when its kind is listed only (step 3). A listed-only original is still `near_duplicate_of` the corrected form.

Only when no row matches the payer is the corrected form booked as a new line, with a `note` finding saying no earlier form from the payer is on record.

The corrected form prints no date of its own, like its original: its line is dated the tax year's last day (step 3), and a change for it changes the `amount` and never the `date` (`check_outputs.js` refuses a `date` change a tax-year form arms).

Never book both forms, net one against the other, or keep the original's amount once the corrected form states another.

## One payment covering several parcels

How it looks: a county portal lets one payment cover several parcels. The payment confirmation lists the parcel numbers and amounts but no property addresses. The bill states each parcel's property location (its situs).

- Stage the payment once. List in `parcels` every parcel the bill states, each with its stated amount. Put in `covered_parcels` the parcels the payment covers, or leave it empty when it covers the whole bill. The build splits the payment across the covered parcels, using the stated amounts as weights.
- Which property a parcel belongs to comes from the bill's situs, matched as step 5 says, never from the payment confirmation, an owner or mailing address, or a comparison of amounts. A covered parcel no entity claims is an `entity_unestablished` finding citing the payment and the bill.
- A payment whose bill is not in the workspace cannot be staged, because `bill_source` names the bill. Write a `missing_receipt` finding naming the payment document and saying the bill, which states each parcel's property location, is not on record.

Never divide an amount yourself.

## Near-duplicate payment confirmations

How it looks: the same payment appears in two files with different bytes. One is a confirmation saved when the payment was made, another a payment history printed later. A card or bank export row can carry it too. `inventory.js` marks only byte-identical copies, so these reach you as separate documents.

- A payment is the same payment when its payee, date and amount match. Stage or book it once, from the confirmation when there is one, rather than from a history or an export row.
- A document whose every payment another document already carries is `near_duplicate_of: <that document>`, and it books nothing.
- A document can restate one payment and also carry another that nothing else shows, such as a history listing the first installment the confirmation shows and a second installment. It stays the evidence for the other payment: stage that one from it (its `payment_source` is the history), keep its status `booked`, and say in its `notes` which payment it restates.
- Write a `near_duplicate` finding naming both documents and the restated payment's date.
- In an incremental run, compare against the confirmed payments (`tax_payments.json` under `confirmed/`) and the confirmed digest too. A payment they already carry stays as it is, never staged or booked a second time from the new document.

## A hotel folio

How it looks: a folio prints a stay's room charge for each night, the room tax, any dining or minibar charge, and one total across them, sometimes with a room-and-tax subtotal.

- Book printed figures only. When the folio charges nothing but room and tax, the lodging line takes its total. When it also charges dining or anything else, the lodging line takes its printed room-and-tax subtotal, and when it prints none, each printed room and tax charge is a line of its own. A dining charge is a `meal` line of its own, at its printed amount.
- Never book the total less the dining, or any other difference you compute: that is arithmetic, which the scripts own (hard rule 3), and `check_outputs.js` refuses a line whose amount the staged reading prints nowhere.
- Every line is dated the day the folio settles (step 3), and all of them carry the trip's key. The arrival and departure date the trip's stay (step 3's trip bullet): write them into the folio's `fields` as `other.arrival` and `other.departure`.

Example: a folio printing four nights at 189.00, a room tax of 105.84 and one dinner of 62.40, total 924.24, with no subtotal, books five lodging lines (four nights, the tax) and one `meal` line — never one lodging line of 861.84.

## A handwritten note or cash receipt naming no place

How it looks: a photographed note, a cash receipt or a scribbled invoice states work and an amount but no property or business, in a workspace with several places and a trip or two in the air.

- A document that names no place books unassigned and is asked for (step 4) — never placed with the place its date sits nearest: a yard-work note dated a day after a trip's return is not thereby that place's, and a fare or ride whose city no document names keeps `trip` null (step 3's rule). Timing alone never places a line, a document or a trip segment; a note, a document or an answer that names the place does.

## ROC calendar dates

How it looks: a Taiwan e-invoice prints its year in the Republic of China calendar, in which year 115 is 2026, and its amount in New Taiwan dollars.

- A staged reading normally carries the converted date. Use its `document_date`, whose `date_notes` names the conversion, and never add 1911 to a date a reading already converted.
- A staged reading whose `document_date` still carries the ROC year, such as 115/04/20: never open the original (hard rule 7). Add 1911 to the year the reading states, write the date as `YYYY-MM-DD`, and write a `note` finding naming the document and saying its date was converted from the ROC year, so the accountant can check the conversion.
- When you read an original yourself, add 1911 to the ROC year and write the date as `YYYY-MM-DD`.
- Judge the tax year only after converting. Year 115 is 2026 and is not outside a 2026 workspace's tax year; a date that converts outside the tax year, such as year 114 (2025), books on that date like any other: the build lists the line in `outside_year` and counts it in no total (step 3).
- Record the amount as printed, with `currency` `TWD`. `build_books.js` converts it through `dist/scripts/fx.js`; never convert it yourself.

## A `<persisted-output>` preview

How it looks: a tool result that reads a document you open yourself, `pdftotext -layout <file> -` or `read_sheet.js` on a long file, comes back as `<persisted-output>`: the start of what was printed and the path of a file it was saved to.

- The preview is not the document: record nothing from it. The saved file is the session's own, not the workspace's, so never read it (hard rule 1).
- Read the document in parts instead: a PDF with Read's `pages` set to one range at a time, a CSV with Read's `offset` and `limit`.
- An `.xlsx` workbook `read_sheet.js` printed as a preview cannot be read in parts: it books no line, is `needs_review`, and its `unreadable` finding, worded `not read`, names it.

# Bookkeeping policy

From docs/decisions/0011-bookkeeping-positioning.md.

## Bookette produces books, not returns

- Books per property and per business, organized by Schedule C and Schedule E line categories.
- Label: "Prepared from your records for review by your accountant. Not a tax return and not tax advice."

## Never choose a tax treatment

Record the facts and both results, then add a finding for the accountant:

| Choice                                    | What to record                                                                                                                                                                  |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Per diem M&IE vs actual meal receipts     | Both totals per trip (the totals are in books.json; the finding names the trip), each with the 50% meal limit shown                                                             |
| Standard mileage vs actual vehicle cost   | Both, plus first-year election facts                                                                                                                                            |
| Capital improvement vs repair             | The facts; tag `capital` or `repair` only when the document says so, otherwise ask; the build shows a tagged line both ways (expensed as a repair, capitalized and depreciated) |
| Expensing vs MACRS                        | The asset's kind, class, basis and placed-in-service date; the build shows both readings and lists the de minimis ceilings, never applied; the accountant decides the class     |
| Schedule E vs C for short-term rentals    | Rental days, personal-use days, services provided                                                                                                                               |
| Personal-use allocation                   | Days of personal use                                                                                                                                                            |
| Home office: simplified vs regular method | Both readings side by side, line 30 carries neither and no question asks the method; depreciation of the home, the income limit and carryover listed, never applied             |

Lodging for self-employed travel is recorded at actual cost only. Per diem for self-employed individuals covers meals and incidental expenses only (Rev. Proc. 2019-48, section 4.03).

## Words to avoid in prompts, findings and summaries

deductible, deductibles, deduction, deductions, deduct, deducts, deducted, deducting, deductibility, write-off, write-offs, write off, write offs, writeoff, writeoffs, maximize, maximizes, maximized, maximizing, maximizer, maximizers, maximization, maximise, maximises, maximised, maximising, maximiser, maximisers, maximisation, optimize, optimizes, optimized, optimizing, optimizer, optimizers, optimization, optimise, optimises, optimised, optimising, optimiser, optimisers, optimisation, save on taxes, saves on taxes, saving on taxes, saved on taxes, save on tax, recovered, before you file, you should claim, recommended method.

Use instead: expense, recorded, for your accountant, open item, shown side by side.

# fx/ — the exchange-rate sources' currency map

`currencies.json` names, for every ISO code the pipeline converts (the currencies ADR 0018
names), its Federal Reserve H.10 series id and its Treasury Fiscal Data
`country_currency_desc`. The parsers in `src/scripts/parse_h10.ts` and
`src/scripts/parse_treasury.ts` read a download plus an entry of this map; neither source is
fetched at build or test time.

The vendored `h10_<ccy>.csv` files and the `sources.json` entries come from the keyless
H.10 Data Download CSV through `src/scripts/vendor_h10.ts`, run by hand once for each tax
year's rules directory the skill carries, from the one download:

```sh
node dist/scripts/vendor_h10.js rules/ty2025 <download.csv> <retrieval_date>
node dist/scripts/vendor_h10.js rules/ty2026 <download.csv> <retrieval_date>
```

Every year's `fx/` is the same vendored download (`rules.spec.ts` compares them), so a
re-vendor of the beta (issue #104) runs the command for every year; each run rewrites the csvs, the
citations, the manifest's `fetched` dates and the currency map's series ids from the one
download. A series the new download omits keeps its stale csv on disk unlisted — delete
`fx/h10_<ccy>.csv` by hand, and `check-rules-layout` names it until the file is gone.

## Quotes

H.10 quotes the four `RXI$US_*` series (AUD, EUR, NZD, GBP) as U.S. dollars per currency
unit and every other series as currency units per U.S. dollar. `sources.json` carries the
direction in `quote`, and `fx.ts` converts both. `parseH10` stores the printed cell as it
stands. `lookupSnapshot` always converts as units per dollar, so the loader job (plan task
10.7, issue #102) inverts an `RXI$US_` rate before insert and never copies a vendored
`usd_per_unit` cell into `fx_rates`.

## Layering during the beta (issue #104)

`fx_rates` stays empty in every environment during the beta: the vendored files own every
conversion. The first load into `fx_rates` is plan task 10.7's, at Launch, which replaces
the vendored files for the currencies it carries; a currency the snapshot carries is owned
by the snapshot, gaps included (`src/scripts/fx.ts`).

## Series ids and Treasury names

The H.10 series ids are verified against the download of 2026-10-12 that produced the
committed files, which cover 2024-12-24 onward (`VENDOR_FROM`: 2025-01-01 is an ND holiday, so
the window opens a week earlier and every day of 2025 converts); `RXI$US_` marks the dollar-per-unit series, and the country codes are
explicit in `src/scripts/vendor_h10.ts` (`SF` is the rand, `SZ` the franc).

UNVERIFIED: the Treasury `country_currency_desc` names are still written from the dataset's
published `<Country>-<Currency>` spelling, including its comma forms (`Canada-Dollar`,
`China-Mainland, Peoples Republic of-Yuan Renminbi`, `Euro Zone-Euro`,
`United Kingdom-Pound`, `Japan-Yen`, `Korea, South-Won`, `Mexico-Peso`), and only
`Taiwan-Dollar` is verified (issue #99). Plan task 10.7's first real fetch verifies every
name against the live dataset and corrects this note; until then a mismatch surfaces as a
load that maps nothing or a parse that fails, never as a wrong rate.

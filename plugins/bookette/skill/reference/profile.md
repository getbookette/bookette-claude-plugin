# profile.resolved.json

Start from `profile.json` and add what documents and answers establish. `dist/scripts/build_books.js` reads this shape.

```json
{
  "tax_year": 2026,
  "home": "Seattle, WA",
  "vehicles_used_together": null,
  "entities": [
    {
      "key": "ashwood",
      "name": "1180 Ashwood Ln",
      "kind": "residential_rental | commercial_rental | short_term_rental | sole_proprietor | partnership | s_corp",
      "schedule": "E | C | K1",
      "address": "1180 Ashwood Ln, Denver, CO 80220",
      "ownership_pct": "100",
      "ein": null,
      "fair_rental_days": null,
      "personal_use_days": null,
      "stay_count": null,
      "services_note": null,
      "parcels": [],
      "assets": [
        {
          "description": "Rental building",
          "kind": "real_property | equipment | improvement",
          "class": "residential_rental | commercial_rental | 5_year_property | 7_year_property",
          "placed_in_service": "2019-06-15",
          "cost_basis": "334000.00",
          "land_value": "60000.00",
          "disposed_on": null,
          "prior_accumulated": null,
          "answer_keys": ["rental_basis_ashwood"]
        }
      ]
    }
  ],
  "vehicles": [
    {
      "key": "honda_ody",
      "description": "2019 Odyssey",
      "first_business_use_date": "2026-03-02",
      "first_year_method": "standard_mileage | actual_cost | null",
      "depreciation_taken": null,
      "uses": [
        {
          "key": "honda_ody_ashwood",
          "entity": "ashwood",
          "business_miles": "4250",
          "miles": [
            { "from": "2026-01-01", "to": "2026-06-30", "miles": "2000" },
            { "from": "2026-07-01", "to": "2026-12-31", "miles": "2250" }
          ]
        }
      ]
    }
  ],
  "trips": [
    {
      "key": "denver_apr",
      "name": "Denver, Apr",
      "entity": "ashwood",
      "purpose": null,
      "segments": [{ "location": "Denver, CO", "start": "2026-04-10", "end": "2026-04-12" }],
      "documents": ["inbox/chase_card_2026.csv", "inbox/denver_plumber_invoice.pdf"],
      "placed_by": "city",
      "purpose_suggestions": [
        {
          "text": "Meeting the plumber at the house",
          "document": "inbox/denver_plumber_invoice.pdf"
        }
      ]
    }
  ]
}
```

- `home` is the travel home, "City, ST" or "City, Country": staged from the person's account, or, when none is staged, written by the run from documents that agree on it (step 5), never otherwise changed. A home an earlier run read from the documents is staged with `"home_origin": "documents"`; on a run with no `confirmed/`, carry it and write its `note` finding again (step 7).
- `schedule` is `E` for rentals, `C` for a sole proprietor business, `K1` for a partnership or S-corp interest the person declared, which nothing books to: a K-1 is listed for the accountant (step 3).
- Money values are decimal strings.
- On an entity, `placed_in_service` is the day the person says the property was first rented or the business started, `activity` is a business's one-line description in the person's own words, `payers` lists the names the person says pay the business, `aliases` lists the other names the business goes by on its documents (a name the person confirmed on a found business's match, or gave on Account), and `listings` lists the platforms and listing ids a rental is let through, as its payout statements print them (`Vrbo 4820193`; a listing the person confirmed on a found rental's match, or gave on Account). Carry them forward as staged.
- A place the person folded into another (they said two of their places are one) is not staged: its lines, trips, vehicle uses and assets are staged under the place it folded into, whose `aliases` and `listings` include the folded place's own — a business's name among its aliases, a rental's name among its listings when the name carries a listing id (`Vrbo 4820193`) — so carry them forward as staged like the rest. A rental's folded name that carries no listing id, a bare platform name such as `Airbnb`, is staged in that rental's `reserved_names` instead: it names no place (step 3); carry it forward as staged.
- On an entity, `ended_month` (`YYYY-MM`) is the month the person says a property stopped being rented or was sold, or a business stopped. Carry it forward as staged. Lines dated after it are booked as usual, and it needs no finding.
- A staged asset is a row of the workspace's fixed-asset register, such as the purchase the person declared for a property: that one is staged with its `cost_basis` (the price paid) and `placed_in_service` (the day first rented) and no `class` or `land_value`. Carry every staged asset forward under its staged `description`, add its `class` and `land_value` when documents or answers establish them, and never add a second asset for a purchase the profile already stages. A property's `land_value` is the land allocation its closing statement prints, else the land value its tax bill prints, copied as printed (step 4's purchase paragraph); when no document prints one, leave it out and write the `note` finding that paragraph names. An `asset_register` answer's `costBasisCents`, `landValueCents` and `placedInService` are the asset's `cost_basis`, `land_value` and `placed_in_service`, the cents written as dollars. An asset left without a class is listed with its inputs, and nothing is booked for it.
- On an asset, `kind` is the register's kind: `real_property` (land and a building), `equipment`, or `improvement` (work on a property the register already carries). A staged asset's `kind` is carried forward unchanged (left out, the build keeps the staged word; another word is refused); an asset you add carries the `assetKind` its `asset_register` answer names, lowercased, or no `kind` when nothing establishes one. `class` is `residential_rental` or `commercial_rental` for a building and an improvement to one, which the register books; for equipment it is a personal-property class of `rules/ty<tax_year>/capital_costs.json` (`5_year_property`, `7_year_property`, each with its examples), which the register lists and books nothing for. The register stores no equipment class, so re-establish it from those examples every run, when a document or an answer says what the asset is; the class you write is shown to the accountant, who decides it. An asset with a personal-property class and no `kind` is equipment. An equipment or improvement asset placed in service in the tax year whose class is personal property or not yet established is shown expensed and depreciated side by side in `expense_macrs`.
- On an asset, `disposed_on` is the disposal date (`YYYY-MM-DD`) when the property was sold or otherwise disposed during or before the tax year; absent or null means still held. `prior_accumulated` is the accumulated depreciation carried forward from earlier years (decimal string); absent or null means Abacus reconstructs the earlier years itself. Both are optional.
- On an entity, `fair_rental_days`, `personal_use_days` and `stay_count` are the short-term rental's day counts (integers, or null when the documents establish none), `services_note` records in the guest's or host's own terms what services the stay carried (the report shows it verbatim; the code never classifies it), and `parcels` lists the property's parcel numbers exactly as the tax bill states them - the field is `parcels`, never `parcel_numbers`, and a bill's parcel goes on the entity whose `address`, or `name` when it carries no address, is the bill's property location, matched by street number and street name. Carrying a staged field forward is the rule: a field you do not settle stays as staged, and an explicit `null` clears it.
- On a Schedule C entity, `home_office` records the home office's areas: an object always carrying both keys, `office_sq_ft` (the area used regularly and exclusively for the business) and `home_sq_ft` (the whole home), each a decimal string of at most two decimals greater than zero, or `null`, with the office no larger than the home. Take them from a floor plan, a lease, a listing or an appraisal. The workspace holds one home office: a second entity carrying an `office_sq_ft` is an error, and so is one on a schedule other than `C`. The entry is carried forward like every staged field; to clear it write both keys as `null`.
- On a vehicle, `first_year_method` is the established first-year method (`standard_mileage` or `actual_cost`) or null when no document establishes one; `depreciation_taken` is the depreciation previously taken on the vehicle (decimal string, or null); and `uses` names the place that uses the vehicle, one entry with its own `key` and the `entity` it is. The person says which place uses a vehicle: carry a staged vehicle's `uses` forward with the `key` (`use_<id>`) and `entity` as staged, never adding, dropping or re-pointing one, and give a vehicle you add from the documents exactly one use, under a `key` of your own. On a use, `business_miles` is the year's total that place drove, and `miles` is the year's band breakdown whose `from`/`to` dates match the mileage rules file's bands date-for-date — a breakdown that covers every band of the year prices the standard figure band by band, a partial one prices nothing, a use with no `miles` prices `business_miles` at the year's single band, and a use whose year states no miles (no `miles`, and `business_miles` absent or 0) prices instead the sum of the `miles` stated on the own-car trips citing the vehicle, each at the band of the trip's first day; a trip whose miles are not stated adds nothing, and no mile is ever estimated. `vehicles_used_together` is the workspace's count of vehicles used together, or null.
- Trip `location` uses "City, ST" for US locations and "City, Country" abroad, matching `rules/ty<tax_year>/per_diem.json`. Every trip carries a `name` — a staged trip keeps the name it was staged with (its `key` when it was staged with none), a trip an answer adds carries the name that answer describes, and a `trip_register` answer may rename the trip its `tripKey` names. The name is the person's word for the trip, which the trip register stores; the `key` is what everything you write names it by: a ledger item's `trip`, a web value's `applies_to` `trip:<key>` and a finding's `trip:<key>` cite. A trip the profile adds carries a fresh `key` of your own choosing, never a `trip_<id>` key a staged trip already uses: reusing one would turn your add into a rewrite of that row. A trip the run records from the documents (step 5) also carries `documents`, the batch documents its days were read from, and `placed_by`, why it sits under its place: `city` (the person's only place in the trip's city: a stop's city holds exactly one staged place's `address`, the trip's, by the city `out/places.json` gives it), `named` (a document of the trip names the place) or `card` (the card that paid is the one the place's income lines use); its `purpose` is `null` unless the person's note states it, in the note's words, or its suggestions all name one event, in that event's name (step 3). Such a trip may also carry `purpose_suggestions`: at most two `{text, document}` entries, each a few words naming what one document of the trip says the trip was for, citing that document among its `documents` (step 3), an event's marked `"event": true`; none while the trip carries a purpose but that event's own, and none on a staged trip or one an answer adds. The person picks one, or another purpose, on the Trips screen; only an event's sets `purpose`, when the trip's suggestions all name that one event (step 3). A staged trip keeps what it was staged with unless the person's `trip_register` answer for its key changes it; one an answer adds keeps what it carries. A trip the person logged may also carry their Trip log facts: `travel` (`own_car`, `flew`, `train_or_bus`, `rental_car` or `rideshare`), `vehicle` (a staged `veh_<id>` key, only with `own_car`), `miles` (a whole number from their own log, 1 to 99999, only with `own_car`), `personal_days` (days of its segments, distinct, in order; `[]` is none) and `no_cost` (the gaps they said have no cost: `lodging`, `fare`, `ride`, `baggage`, `meal`; miles are not a cost). Only `profile.json` or the person's `trip_register` answer states them (step 5), but the `travel` `flew` a trip the run records carries from its airline receipt (step 3).
- Every fact that came from an answer lists the answer keys it relied on — the key of an option the person chose; a typed answer is never listed, because it establishes nothing by itself, but on the property's purchase a typed `purchase` answer states in full (step 5).

## out/tax_payments.json

A property-tax payment is staged beside the profile, one object per payment, copied from the documents:

```json
{
  "payment_source": "inbox/county_april.pdf",
  "date": "2026-04-10",
  "amount": "10.01",
  "currency": "USD",
  "bill_source": "inbox/county_bill.pdf",
  "parcels": [
    { "number": "41-822", "amount": "600.00" },
    { "number": "52-118", "amount": "400.00" }
  ],
  "covered_parcels": []
}
```

Copy the bill's stated figures; never divide — the build splits the payment across the covered parcels, the stated amounts as weights, and books each piece into the receiving entity's taxes line from the payment date. `parcels[].number` is the parcel exactly as the bill states it (the build folds spacing; never retype or reformat one), `amount` the bill's stated amount for the parcel or null when it states none, and `covered_parcels` the numbers this payment covers — empty means all of them. A document a staged payment names, its `payment_source` or its `bill_source`, feeds no ledger line. The confirmed payments (`confirmed/tax_payments.json`, the same shape) stay while this file is absent; a written file is the complete set, and a confirmed payment it drops is refused unless a ledger line now cites its payment evidence (`payment_source`). The file is absent when the workspace has no property-tax payments.

## out/home_costs.json

A cost of the home the home-office regular reading is computed from is staged beside the profile, one object per stated figure, copied from the documents and never booked to the ledger:

```json
{
  "source_file": "inbox/home_electric_2026.pdf",
  "date": "2026-12-31",
  "amount": "1560.00",
  "currency": "USD",
  "kind": "utilities",
  "use": "home"
}
```

`kind` is one of `mortgage_interest`, `real_estate_taxes`, `insurance`, `rent`, `utilities`, `repairs`, `other`. `use` is `home` for a cost of the whole home (the build shares it with the office by area) or `office` for a cost of the office alone (counted whole). Copy the stated figure: never sum, never split a loan payment, never record principal. `amount` is a decimal string greater than zero. A bill that combines kinds is copied once, at its stated total, under one kind. One document, kind and date appears once. A document that feeds the ledger never feeds this file, and the reverse. The confirmed costs (`confirmed/home_costs.json`, the same shape) stay while this file is absent; a written file is the complete set, and a confirmed cost it drops is refused unless a ledger line now cites its document. The file is absent when the workspace has no home costs.

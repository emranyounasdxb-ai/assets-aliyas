# Brand and parking workflows

## Design reference

The application follows the [Aliyas Real Estate website](https://aliyasrealestate.ae/), inspected on 21 November 2026. Its live CSS uses charcoal `#181818`, white, muted gold `#b89b58` and a darker gold `#80632e` for readable accent text. The official public gold logo is stored locally in `public/brand/aliyas-gold.webp`. Uploaded property photographs remain private. Properties without photographs show their code and an explicit missing-photo state.

The application keeps its locally bundled Geist typeface. The redesign adds stronger headings and figures, a dark navigation panel, compact data tables, readable chart labels, an action list, property grid/list views, floor selection, tenant tabs and mobile cheque cards. Dashboard actions open the corresponding filtered view.

## Entered property data

User-confirmed buildings and their floor registers are stored in the local database in a separate company workspace. Synthetic demonstration records remain in their demo workspace. Customer inventory is not a repository seed. No apartment quantities, categories, rents, tenant profiles, parking lot numbers, parking capacities or parking prices were inferred for the company inventory.

Owners and managers can edit buildings, declared level totals, floor names, display order, floor use and floor notes. Parking and service floors reject apartment creation at the database level. Display order controls vertical sorting independently of the displayed floor name.

## Parking inventory

Use **Parking → Add parking lot** to enter the actual lot number, building, parking level and optional reference rate. Rates can be monthly or yearly; enter both the amount and period together. Unpriced spaces cannot be reserved. Blocked spaces cannot be allocated. A parking level can contain any number of individually registered lots; floor count never implies parking capacity.

Each tenant may rent several lots, but every selected lot must belong to the apartment's building. Reservations cover the annual tenancy agreement's dates. An exclusion constraint rejects overlapping active reservations for the same physical lot, including concurrent requests. A lot becomes available for another non-overlapping agreement after its term ends. Cancellation retains the reservation's history.

## Contract and payments

Select parking lots while creating an annual agreement. A monthly parking rate contributes twelve monthly payments to the agreement's annual parking charge; a yearly rate contributes its stated amount. No prorated or partial-term pricing rule is assumed.

The server snapshots each selected lot's building, floor/number, rate and annual charge. Later tariff changes do not change an existing agreement's price. The printable internal agreement summary lists all reserved spaces and separates flat rent, parking charges and the combined contract total. The actual signed contract remains an uploaded document.

Parking charges create separate ledger debits. The same agreement's 1, 2, 3, 4, 6 or 12 rental cheques cover flat rent plus parking. Amounts use integer fils, with any remainder in the final cheque. Four and six cheques remain the main business cases.

Parking can also be added or removed from an existing agreement while all its rental cheques are still scheduled. These actions atomically reserve/release spaces, post charges or reversing entries and recalculate the complete scheduled cheque total. Retrying an allocation does not duplicate its charge. Once a cheque is received or processed, parking amendments are locked so an already issued cheque's amount cannot silently change. New or renewed agreements support the normal parking selection flow; partial-term amendments, settlement and replacement of issued cheques need a separately agreed workflow.

Tenant profiles include a Parking tab. The Parking module lists current availability and allocation history; agreement pages expose their reservations. Owners and managers may mutate inventory and reservations. Database row-level security isolates each workspace.

## Verification

Tests cover annual price conversion, inclusive reservation boundaries, cancelled/blocked availability, property and floor editing, restricted service levels, multi-lot agreement creation, exact combined cheque totals, fixed price snapshots, retry idempotency, draft cancellation, issued-cheque locks, simultaneous double-allocation rejection, same-building enforcement, viewer restrictions, profile tabs, filters and mobile layouts.

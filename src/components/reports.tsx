"use client";
import { useState } from "react";
import Link from "next/link";
import {
  Buildings,
  ChartBar,
  Car,
  DownloadSimple,
  Printer,
  Wallet,
} from "@phosphor-icons/react";
import {
  accountBalance,
  dateLabel,
  exportCsv,
  todayDubai,
  unitStatus,
  unitLabel,
} from "@/lib/domain";
import { parkingReport, parkingReservationStatus } from "@/lib/parking-report";
import { useApp } from "./provider";
import {
  Badge,
  Button,
  Empty,
  Money,
  PageHeader,
  Pagination,
  SectionHeader,
  Tabs,
  useList,
} from "./ui";
export function Reports() {
  const { data } = useApp();
  const today = todayDubai();
  const [building, setBuilding] = useState("all");
  const [rentalType, setRentalType] = useState("all");
  const [parkingView, setParkingView] = useState("summary");
  const [parkingStatus, setParkingStatus] = useState("current");
  const [from, setFrom] = useState(`${todayDubai().slice(0, 4)}-01-01`);
  const [to, setTo] = useState(todayDubai());
  const properties = data.buildings.filter(
    (b) => building === "all" || b.id === building,
  );
  const ids = new Set(properties.map((b) => b.id));
  const parking = parkingReport(data, ids, today);
  const reservations = useList(parking.reservations, (allocation) => {
    const status = parkingReservationStatus(allocation, today);
    return (
      parkingStatus === "all" ||
      (parkingStatus === "current"
        ? ["Allocated", "Upcoming"].includes(status)
        : status === parkingStatus)
    );
  });
  const units = data.units.filter(
    (u) =>
      ids.has(u.building_id) &&
      (rentalType === "all" || unitLabel(u) === rentalType),
  );
  const unitIds = new Set(units.map((u) => u.id));
  const leases = data.leases.filter((l) => unitIds.has(l.unit_id));
  const leaseIds = new Set(leases.map((l) => l.id));
  const payments = data.ledger.filter(
    (e) =>
      e.kind === "payment" &&
      e.entry_date >= from &&
      e.entry_date <= to &&
      ((building === "all" && rentalType === "all") ||
        (!!e.lease_id && leaseIds.has(e.lease_id))),
  );
  const rows = properties.map((b) => {
    const bu = units.filter((u) => u.building_id === b.id);
    const occ = bu.filter((u) => unitStatus(data, u) === "Occupied").length;
    const vacant = bu.filter((u) => unitStatus(data, u) === "Vacant").length;
    const bl = new Set(
      leases.filter((l) => bu.some((u) => u.id === l.unit_id)).map((l) => l.id),
    );
    const collected = -payments
      .filter((e) => e.lease_id && bl.has(e.lease_id))
      .reduce((s, e) => s + e.amount, 0);
    return {
      building: b,
      units: bu.length,
      flats: bu.filter((u) => u.category !== "Shop").length,
      shops: bu.filter((u) => u.category === "Shop").length,
      occupied: occ,
      vacant,
      reserved: bu.filter((u) => unitStatus(data, u) === "Reserved").length,
      maintenance: bu.filter(
        (u) => u.status === "maintenance" && unitStatus(data, u) !== "Occupied",
      ).length,
      occupancy: bu.length ? (occ / bu.length) * 100 : 0,
      collected,
      parking: parking.forBuilding(b.id),
      parkingLevels: data.floors.filter(
        (f) => f.building_id === b.id && f.purpose === "parking",
      ).length,
    };
  });
  function occupancyExport() {
    exportCsv("aliyas-occupancy-report.csv", [
      [
        "Property",
        "Area",
        "Flats",
        "Shops",
        "Total rental units",
        "Occupied",
        "Vacant",
        "Reserved",
        "Maintenance",
        "Occupancy %",
        "Parking levels",
        "Registered parking lots",
        "Allocated parking today",
        "Available parking today",
        "Blocked parking",
        "Parking spaces with upcoming reservations",
      ],
      ...rows.map((r) => [
        r.building.name,
        r.building.area,
        r.flats,
        r.shops,
        r.units,
        r.occupied,
        r.vacant,
        r.reserved,
        r.maintenance,
        r.occupancy.toFixed(1),
        r.parkingLevels,
        r.parking.total,
        r.parking.allocated,
        r.parking.available,
        r.parking.blocked,
        r.parking.upcoming,
      ]),
    ]);
  }
  function parkingExport() {
    exportCsv("aliyas-parking-report.csv", [
      [
        "Property",
        "Level",
        "Parking number",
        "Status today",
        "Current tenant",
        "Current agreement",
        "Starts",
        "Ends",
        "Annual current contract charge AED",
        "Next tenant",
        "Next agreement",
        "Next start",
        "As of",
      ],
      ...parking.lots.map(({ lot, booking, upcoming, status }) => [
        data.buildings.find((b) => b.id === lot.building_id)?.name ?? "",
        data.floors.find((f) => f.id === lot.floor_id)?.name ?? "",
        lot.number,
        status,
        data.tenants.find((t) => t.id === booking?.tenant_id)?.name ?? "",
        data.leases.find((l) => l.id === booking?.lease_id)?.reference ?? "",
        booking?.start_date ?? "",
        booking?.end_date ?? "",
        (booking?.annual_charge ?? 0) / 100,
        data.tenants.find((t) => t.id === upcoming?.tenant_id)?.name ?? "",
        data.leases.find((l) => l.id === upcoming?.lease_id)?.reference ?? "",
        upcoming?.start_date ?? "",
        todayDubai(),
      ]),
    ]);
  }
  function reservationsExport() {
    exportCsv("aliyas-parking-reservations.csv", [
      [
        "Property",
        "Parking lot",
        "Tenant",
        "Agreement",
        "Starts",
        "Ends",
        "Status",
        "Rate AED",
        "Rate period",
        "Annual contract charge AED",
      ],
      ...reservations.filtered.map((allocation) => [
        allocation.property_label,
        allocation.lot_label,
        data.tenants.find((t) => t.id === allocation.tenant_id)?.name ?? "",
        data.leases.find((l) => l.id === allocation.lease_id)?.reference ?? "",
        allocation.start_date,
        allocation.end_date,
        parkingReservationStatus(allocation),
        allocation.rate_amount / 100,
        allocation.rate_period,
        allocation.annual_charge / 100,
      ]),
    ]);
  }
  function paymentsExport() {
    exportCsv("aliyas-collection-report.csv", [
      ["Date", "Tenant", "Description", "Collected AED", "Agreement"],
      ...payments.map((e) => [
        e.entry_date,
        data.tenants.find((t) => t.id === e.tenant_id)?.name ?? "",
        e.description,
        -e.amount / 100,
        data.leases.find((l) => l.id === e.lease_id)?.reference ??
          "Account payment",
      ]),
    ]);
  }
  function balancesExport() {
    exportCsv("aliyas-tenant-balances.csv", [
      ["Tenant", "Email", "Phone", "Balance AED", "Balance type", "As of"],
      ...data.tenants.map((t) => {
        const bal = accountBalance(data.ledger, t.id, to);
        return [
          t.name,
          t.email,
          t.phone,
          Math.abs(bal) / 100,
          bal < 0 ? "Credit" : bal > 0 ? "Owed" : "Settled",
          to,
        ];
      }),
    ]);
  }
  const receipts = -payments.reduce((s, e) => s + e.amount, 0);
  const unallocated = -payments
    .filter((e) => !e.lease_id)
    .reduce((s, e) => s + e.amount, 0);
  return (
    <div className="reports-page">
      <PageHeader title="Reports">
        <Button onClick={() => window.print()}>
          <Printer size={17} />
          Print report
        </Button>
      </PageHeader>
      <div className="toolbar">
        <label className="filter-label" htmlFor="report-property">
          Property
        </label>
        <select
          id="report-property"
          className="filter-select"
          value={building}
          onChange={(e) => setBuilding(e.target.value)}
        >
          <option value="all">All properties</option>
          {data.buildings.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <label className="filter-label" htmlFor="report-rental-type">
          Rental type
        </label>
        <select
          id="report-rental-type"
          className="filter-select"
          value={rentalType}
          onChange={(e) => setRentalType(e.target.value)}
        >
          <option value="all">Flats & shops</option>
          <option value="Flat">Flats only</option>
          <option value="Shop">Shops only</option>
        </select>
        <label className="filter-label" htmlFor="report-from">
          Collections from
        </label>
        <input
          id="report-from"
          className="filter-select"
          type="date"
          value={from}
          max={to}
          onChange={(e) => setFrom(e.target.value)}
        />
        <label className="filter-label" htmlFor="report-to">
          to
        </label>
        <input
          id="report-to"
          className="filter-select"
          type="date"
          min={from}
          max={todayDubai()}
          value={to}
          onChange={(e) => setTo(e.target.value)}
        />
      </div>
      <div className="summary-strip">
        <div>
          <small>Rental units in this view</small>
          <strong>{units.length}</strong>
        </div>
        <div>
          <small>Occupied today</small>
          <strong>
            {units.filter((u) => unitStatus(data, u) === "Occupied").length}
          </strong>
        </div>
        <div>
          <small>Vacant today</small>
          <strong>
            {units.filter((u) => unitStatus(data, u) === "Vacant").length}
          </strong>
        </div>
        <div>
          <small>Rent collected in period</small>
          <strong>
            <Money value={receipts} />
          </strong>
        </div>
      </div>
      <div className="report-grid reports-export-grid no-print">
        <section className="panel report-card">
          <Buildings size={25} />
          <h3>Property occupancy</h3>
          <p>
            Flats, shops, occupied, vacant and unavailable units for every
            building.
          </p>
          <Button onClick={occupancyExport}>
            <DownloadSimple size={16} />
            Export occupancy
          </Button>
        </section>
        <section className="panel report-card">
          <Car size={25} />
          <h3>Parking records</h3>
          <p>Numbered spaces, availability, tenants and agreement charges.</p>
          <Button onClick={parkingExport}>
            <DownloadSimple size={16} />
            Export parking
          </Button>
        </section>
        <section className="panel report-card">
          <ChartBar size={25} />
          <h3>Rental collections</h3>
          <p>Cleared cheques and recorded payments within your chosen dates.</p>
          <Button onClick={paymentsExport}>
            <DownloadSimple size={16} />
            Export collections
          </Button>
        </section>
        <section className="panel report-card">
          <Wallet size={25} />
          <h3>Tenant balances</h3>
          <p>
            All tenant balances as of the end date, including credits and
            opening amounts.
          </p>
          <Button onClick={balancesExport}>
            <DownloadSimple size={16} />
            Export tenant balances
          </Button>
        </section>
      </div>
      <section className="panel">
        <div className="panel-header">
          <SectionHeader
            title="Property performance"
            description={`Occupancy as of ${dateLabel(todayDubai())} · Collections ${dateLabel(from)} to ${dateLabel(to)}`}
          >
            <Badge tone="mint">{properties.length} properties</Badge>
          </SectionHeader>
        </div>
        <div className="table-wrap">
          <table aria-label="Property performance">
            <thead>
              <tr>
                <th>Property</th>
                <th>Flats</th>
                <th>Shops</th>
                <th>Total units</th>
                <th>Occupied</th>
                <th>Vacant</th>
                <th>Other</th>
                <th>Occupancy</th>
                <th>Parking</th>
                <th className="align-right">Collected</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.building.id}>
                  <td>
                    <Link
                      href={`/properties/${r.building.id}`}
                      className="text-link"
                    >
                      {r.building.name}
                    </Link>
                    <small>{r.building.area}</small>
                  </td>
                  <td>{r.flats}</td>
                  <td>{r.shops}</td>
                  <td>{r.units}</td>
                  <td>{r.occupied}</td>
                  <td>{r.vacant}</td>
                  <td>{r.reserved + r.maintenance}</td>
                  <td>
                    <strong>{r.occupancy.toFixed(1)}%</strong>
                    <div className="mini-progress">
                      <span style={{ width: `${r.occupancy}%` }} />
                    </div>
                  </td>
                  <td className="property-parking-cell">
                    <strong>{r.parking.total} lots</strong>
                    <small>{r.parkingLevels} parking levels</small>
                    <small>
                      {r.parking.allocated} allocated · {r.parking.available}{" "}
                      available
                    </small>
                  </td>
                  <td className="align-right">
                    <strong>
                      <Money value={r.collected} />
                    </strong>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="report-note">
          Occupancy uses current agreement dates. Other includes reserved and
          maintenance units. Unit occupancy covers flats and shops; parking is
          shown separately. Collections include parking paid through the same
          agreement cheques. Security is excluded.
          {building === "all" && rentalType === "all" && unallocated > 0 && (
            <>
              {" "}
              Account payments not linked to one agreement:{" "}
              <Money value={unallocated} />; included in the overall collection
              total.
            </>
          )}
          {(building !== "all" || rentalType !== "all") && (
            <>
              {" "}
              Account payments without an agreement are excluded from property
              totals.
            </>
          )}
        </div>
      </section>
      <section className="panel parking-report-section">
        <div className="panel-header">
          <SectionHeader
            title="Parking report"
            description={`Availability as of ${dateLabel(todayDubai())}`}
          >
            <Link className="text-link no-print" href="/parking">
              Open parking control
            </Link>
          </SectionHeader>
        </div>
        <div className="parking-report-summary">
          <div>
            <small>Registered lots</small>
            <strong>{parking.totals.total}</strong>
          </div>
          <div>
            <small>Allocated today</small>
            <strong>{parking.totals.allocated}</strong>
          </div>
          <div>
            <small>Available today</small>
            <strong>{parking.totals.available}</strong>
          </div>
          <div>
            <small>Blocked</small>
            <strong>{parking.totals.blocked}</strong>
          </div>
          <div>
            <small>Reserved ahead</small>
            <strong>{parking.totals.upcoming}</strong>
          </div>
        </div>
        <div className="parking-report-tabs no-print">
          <Tabs
            id="parking-report"
            label="Parking report views"
            value={parkingView}
            onChange={setParkingView}
            items={[
              { value: "summary", label: "By property" },
              { value: "reservations", label: "Reservations" },
            ]}
          />
        </div>
        <div
          role="tabpanel"
          id="parking-report-panel-summary"
          aria-labelledby="parking-report-tab-summary"
          hidden={parkingView !== "summary"}
        >
          <div className="table-wrap">
            <table aria-label="Parking by property">
              <thead>
                <tr>
                  <th>Property</th>
                  <th>Parking levels</th>
                  <th>Registered lots</th>
                  <th>Allocated</th>
                  <th>Available</th>
                  <th>Blocked</th>
                  <th>Upcoming lots</th>
                  <th className="align-right">Annual contract charges</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.building.id}>
                    <td>
                      <Link
                        className="text-link"
                        href={`/properties/${r.building.id}`}
                      >
                        {r.building.name}
                      </Link>
                      <small>{r.building.area}</small>
                    </td>
                    <td>{r.parkingLevels}</td>
                    <td>{r.parking.total}</td>
                    <td>{r.parking.allocated}</td>
                    <td>{r.parking.available}</td>
                    <td>{r.parking.blocked}</td>
                    <td>{r.parking.upcoming}</td>
                    <td className="align-right">
                      <Money value={r.parking.annualCharges} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div
          role="tabpanel"
          id="parking-report-panel-reservations"
          aria-labelledby="parking-report-tab-reservations"
          hidden={parkingView !== "reservations"}
        >
          <div className="parking-reservation-toolbar no-print">
            <select
              className="filter-select"
              aria-label="Parking reservation status"
              value={parkingStatus}
              onChange={(e) => {
                setParkingStatus(e.target.value);
                reservations.setPage(1);
              }}
            >
              <option value="current">Current & upcoming</option>
              <option value="all">All history</option>
              {["Allocated", "Upcoming", "Expired", "Cancelled"].map(
                (status) => (
                  <option key={status}>{status}</option>
                ),
              )}
            </select>
            <Button onClick={reservationsExport}>
              <DownloadSimple size={16} />
              Export reservations
            </Button>
          </div>
          {reservations.total ? (
            <>
              <div className="table-wrap">
                <table aria-label="Parking reservations">
                  <thead>
                    <tr>
                      <th>Property / Parking</th>
                      <th>Tenant</th>
                      <th>Agreement</th>
                      <th>Term</th>
                      <th>Status</th>
                      <th className="align-right">Annual charge</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reservations.visible.map((a) => (
                      <tr key={a.id}>
                        <td>
                          <strong>{a.property_label}</strong>
                          <small>{a.lot_label}</small>
                        </td>
                        <td>
                          <Link
                            className="text-link"
                            href={`/tenants/${a.tenant_id}`}
                          >
                            {
                              data.tenants.find((t) => t.id === a.tenant_id)
                                ?.name
                            }
                          </Link>
                        </td>
                        <td>
                          <Link
                            className="text-link"
                            href={`/agreements/${a.lease_id}`}
                          >
                            {
                              data.leases.find((l) => l.id === a.lease_id)
                                ?.reference
                            }
                          </Link>
                        </td>
                        <td>
                          {dateLabel(a.start_date)}
                          <small>to {dateLabel(a.end_date)}</small>
                        </td>
                        <td>
                          <Badge
                            tone={
                              parkingReservationStatus(a) === "Allocated"
                                ? "success"
                                : "neutral"
                            }
                          >
                            {parkingReservationStatus(a)}
                          </Badge>
                        </td>
                        <td className="align-right">
                          <Money value={a.annual_charge} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination {...reservations} />
            </>
          ) : (
            <Empty
              title="No parking reservations"
              description="Reservations appear when numbered lots are attached to agreements."
            />
          )}
        </div>
        <div className="report-note">
          Parking uses the property filter and today's availability. Collection
          dates and flat/shop filters apply to rental collections. Upcoming
          spaces can also be available today. Annual charges are the full
          contract values for current allocations, not separate cash receipts.
          {!parking.totals.total && (
            <>
              {" "}
              Add numbered lots in Parking control to record capacity and
              reservations.
            </>
          )}
        </div>
      </section>
    </div>
  );
}

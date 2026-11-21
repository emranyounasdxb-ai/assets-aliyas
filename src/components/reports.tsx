"use client";
import { useState } from "react";
import Link from "next/link";
import {
  Buildings,
  ChartBar,
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
import { useApp } from "./provider";
import { Badge, Button, Money, PageHeader, SectionHeader } from "./ui";
export function Reports() {
  const { data } = useApp();
  const [building, setBuilding] = useState("all");
  const [rentalType, setRentalType] = useState("all");
  const [from, setFrom] = useState(`${todayDubai().slice(0, 4)}-01-01`);
  const [to, setTo] = useState(todayDubai());
  const properties = data.buildings.filter(
    (b) => building === "all" || b.id === building,
  );
  const ids = new Set(properties.map((b) => b.id));
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
    <>
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
      <div className="report-grid no-print">
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
          <table>
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
          maintenance units. Security is excluded from rental collections.
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
    </>
  );
}

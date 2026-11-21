"use client";
import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Buildings,
  CalendarBlank,
  CheckCircle,
  FileText,
  Key,
  Plus,
  Wallet,
} from "@phosphor-icons/react";
import {
  currentLease,
  dateLabel,
  daysUntil,
  money,
  pendingCheque,
  todayDubai,
  unitStatus,
} from "@/lib/domain";
import { useApp } from "./provider";
import { Badge, Button, Empty, Money, PageHeader, SectionHeader } from "./ui";
import { BuildingArt } from "./building-art";
export function Dashboard() {
  const { data, openForm } = useApp();
  const today = todayDubai();
  const [period, setPeriod] = useState(6);
  const occupied = data.units.filter(
    (u) => unitStatus(data, u) === "Occupied",
  ).length;
  const vacant = data.units.filter(
    (u) => unitStatus(data, u) === "Vacant",
  ).length;
  const other = data.units.length - occupied - vacant;
  const occupancy = data.units.length
    ? (occupied / data.units.length) * 100
    : 0;
  const due = data.cheques
    .filter(
      (c) =>
        pendingCheque(c) &&
        daysUntil(c.due_date) <= 7 &&
        daysUntil(c.due_date) >= 0,
    )
    .sort((a, b) => a.due_date.localeCompare(b.due_date));
  const upcoming = data.cheques
    .filter(pendingCheque)
    .sort((a, b) => a.due_date.localeCompare(b.due_date));
  const monthStart = new Date(`${today.slice(0, 7)}-01T12:00:00Z`);
  const series = Array.from({ length: period }, (_, i) => {
    const d = new Date(monthStart);
    d.setUTCMonth(d.getUTCMonth() - period + 1 + i);
    const month = d.toISOString().slice(0, 7);
    return {
      month,
      label: new Intl.DateTimeFormat("en-GB", { month: "short" }).format(d),
      collected: -data.ledger
        .filter((e) => e.kind === "payment" && e.entry_date.startsWith(month))
        .reduce((s, e) => s + e.amount, 0),
      expected: data.cheques
        .filter(
          (c) =>
            c.purpose === "rent" &&
            c.status !== "cancelled" &&
            c.due_date.startsWith(month),
        )
        .reduce((s, c) => s + c.amount, 0),
    };
  });
  const total = series.reduce((s, m) => s + m.collected, 0);
  const max = Math.max(
    10000,
    ...series.flatMap((m) => [m.collected, m.expected]),
  );
  const stats = [
    {
      title: "Total properties",
      value: String(data.buildings.length),
      icon: Buildings,
      foot: `${data.units.length} flats across your portfolio`,
      detail: "",
    },
    {
      title: "Portfolio occupancy",
      value: `${occupancy.toFixed(1)}%`,
      icon: Key,
      foot: `${occupied} occupied · ${vacant} vacant`,
      detail: "",
    },
    {
      title: "Rent collected",
      value: money(total),
      icon: Wallet,
      foot: `Over the last ${period} months`,
      detail: "AED",
    },
    {
      title: "Upcoming cheques",
      value: String(due.length),
      icon: CalendarBlank,
      foot: `AED ${money(due.reduce((s, c) => s + c.amount, 0))} due in 7 days`,
      detail: "",
    },
  ];
  return (
    <>
      <PageHeader
        eyebrow={`WELCOME BACK, ${data.membership.display_name.split(" ")[0].toUpperCase()}`}
        title="Your portfolio, at a glance."
        description="A little clarity for everything you manage."
      >
        <div className="date-chip">
          <CalendarBlank size={16} />
          {dateLabel(today, {
            weekday: "short",
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </div>
        {["owner", "manager"].includes(data.membership.role) && (
          <Button variant="primary" onClick={() => openForm("building")}>
            <Plus size={18} />
            Add property
          </Button>
        )}
      </PageHeader>
      <div className="stats-grid">
        {stats.map((s) => (
          <div className="stat-card" key={s.title}>
            <div className="stat-top">
              <span>{s.title}</span>
              <span className="stat-icon">
                <s.icon size={18} />
              </span>
            </div>
            <div className="stat-value">
              {s.detail && <span className="currency">{s.detail}</span>}
              {s.value}
            </div>
            <div className="stat-foot">
              {s.title === "Portfolio occupancy" ? (
                <span className="positive">
                  <ArrowUpRight size={14} />
                </span>
              ) : (
                <span className="status-dot" />
              )}
              {s.foot}
            </div>
          </div>
        ))}
      </div>
      <div className="dashboard-chart-grid">
        <section className="panel padded">
          <SectionHeader
            title="Rental collections"
            description="A clear picture of rent received."
          >
            <select
              className="filter-select"
              aria-label="Collection period"
              value={period}
              onChange={(e) => setPeriod(Number(e.target.value))}
            >
              <option value={6}>Last 6 months</option>
              <option value={12}>Last 12 months</option>
            </select>
          </SectionHeader>
          <div className="chart-heading">
            <strong className="chart-total">
              <Money value={total} />
            </strong>
            <div className="chart-legend">
              <span>
                <i className="legend-dot dark" />
                Collected
              </span>
              <span>
                <i className="legend-dot" />
                Scheduled
              </span>
            </div>
          </div>
          <svg
            className="collections-chart"
            viewBox="0 0 640 200"
            role="img"
            aria-label={`Rent collected over ${period} months: AED ${money(total)}`}
          >
            {[0, 1, 2, 3].map((i) => (
              <g key={i}>
                <line
                  x1="48"
                  y1={16 + i * 48}
                  x2="630"
                  y2={16 + i * 48}
                  className="gridline"
                />
                <text x="0" y={20 + i * 48}>
                  {Math.round((max * (3 - i)) / 3 / 100000)}k
                </text>
              </g>
            ))}
            {series.map((m, i) => {
              const space = 570 / period;
              const x = 56 + i * space;
              const width = Math.min(24, space / 3);
              return (
                <g key={m.month}>
                  <title>{`${m.label}: Collected AED ${money(m.collected)}, scheduled AED ${money(m.expected)}`}</title>
                  <rect
                    x={x}
                    y={160 - (m.collected / max) * 144}
                    width={width}
                    height={Math.max(1, (m.collected / max) * 144)}
                    rx="3"
                    fill="#698c54"
                  />
                  <rect
                    x={x + width + 4}
                    y={160 - (m.expected / max) * 144}
                    width={width}
                    height={Math.max(1, (m.expected / max) * 144)}
                    rx="3"
                    fill="#d9e6c8"
                  />
                  <text x={x + width} y="192" textAnchor="middle">
                    {m.label}
                  </text>
                </g>
              );
            })}
          </svg>
        </section>
        <section className="panel padded occupancy-panel">
          <SectionHeader
            title="Portfolio occupancy"
            description="Every flat, accounted for."
          >
            <Badge tone="outline">Live</Badge>
          </SectionHeader>
          <div className="donut-wrap">
            <svg viewBox="0 0 180 180" aria-hidden="true">
              <circle
                cx="90"
                cy="90"
                r="70"
                fill="none"
                stroke="#f0f3eb"
                strokeWidth="16"
              />
              <circle
                cx="90"
                cy="90"
                r="70"
                fill="none"
                stroke="#a5bf87"
                strokeWidth="16"
                strokeDasharray={`${(occupancy / 100) * 439.82} 439.82`}
                strokeLinecap="round"
              />
            </svg>
            <div className="donut-center">
              <strong>
                {occupancy.toFixed(1)}
                <span className="muted">%</span>
              </strong>
              <small>Occupancy rate</small>
            </div>
          </div>
          <div className="occupancy-legend">
            <span>
              <i className="legend-dot" />
              Occupied <b>{occupied}</b>
            </span>
            <span>
              <i className="legend-dot" style={{ background: "#e9eee2" }} />
              Vacant <b>{vacant}</b>
            </span>
          </div>
          {other > 0 && (
            <p
              className="muted"
              style={{ textAlign: "center", fontSize: 12, marginTop: 12 }}
            >
              {other} reserved or under maintenance
            </p>
          )}
        </section>
      </div>
      <section className="panel" style={{ marginBottom: 32 }}>
        <div className="panel-header">
          <SectionHeader
            title="Cheques to keep an eye on"
            description="Upcoming payments and items that need attention."
          >
            <Link className="text-link" href="/cheques">
              View all cheques
              <ArrowRight size={14} />
            </Link>
          </SectionHeader>
        </div>
        {upcoming.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Tenant</th>
                  <th>Property / Flat</th>
                  <th>Cheque number</th>
                  <th>Due date</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th aria-label="View cheque" />
                </tr>
              </thead>
              <tbody>
                {upcoming.slice(0, 5).map((c) => {
                  const t = data.tenants.find((t) => t.id === c.tenant_id),
                    l = data.leases.find((l) => l.id === c.lease_id),
                    u = data.units.find((u) => u.id === l?.unit_id),
                    b = data.buildings.find((b) => b.id === u?.building_id);
                  const days = daysUntil(c.due_date);
                  return (
                    <tr key={c.id}>
                      <td className="cell-main">
                        <Link
                          className="cell-link"
                          href={`/tenants/${c.tenant_id}`}
                        >
                          <span className="avatar small">
                            {t?.name
                              .split(" ")
                              .map((n) => n[0])
                              .slice(0, 2)
                              .join("")}
                          </span>
                          <div>
                            <strong>{t?.name}</strong>
                            <small>{t?.email}</small>
                          </div>
                        </Link>
                      </td>
                      <td>
                        <strong>{b?.name ?? "—"}</strong>
                        <small>Flat {u?.code ?? "—"}</small>
                      </td>
                      <td>{c.number}</td>
                      <td>
                        <strong>
                          {dateLabel(c.due_date, {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </strong>
                        <small>
                          {days < 0
                            ? `${-days} days overdue`
                            : days === 0
                              ? "Due today"
                              : `In ${days} days`}
                        </small>
                      </td>
                      <td>
                        <strong>
                          <Money value={c.amount} />
                        </strong>
                      </td>
                      <td>
                        <Badge tone={days < 0 ? "danger" : "warning"}>
                          {days < 0
                            ? "Overdue"
                            : c.status === "deposited"
                              ? "Deposited"
                              : "Upcoming"}
                        </Badge>
                      </td>
                      <td>
                        <Link
                          className="text-link"
                          href="/cheques"
                          aria-label={`View cheque ${c.number}`}
                        >
                          <ArrowRight size={16} />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="No cheques to follow up"
            description="Your rental payment schedule will appear here when you create an agreement."
          />
        )}
      </section>
      <div className="dashboard-bottom-grid">
        <section className="panel">
          <div className="panel-header">
            <SectionHeader
              title="Your properties"
              description="Small details. A complete portfolio."
            >
              <Link className="text-link" href="/properties">
                View portfolio
                <ArrowRight size={14} />
              </Link>
            </SectionHeader>
          </div>
          <div className="property-mini-list">
            {data.buildings.slice(0, 4).map((b) => {
              const units = data.units.filter((u) => u.building_id === b.id);
              const occ = units.filter((u) => currentLease(data, u.id)).length;
              const percent = units.length
                ? Math.round((occ / units.length) * 100)
                : 0;
              return (
                <Link
                  className="property-mini"
                  key={b.id}
                  href={`/properties/${b.id}`}
                >
                  <span className="mini-building">
                    <BuildingArt compact variant={b.color} />
                  </span>
                  <div className="property-mini-text">
                    <strong>{b.name}</strong>
                    <small>
                      {b.area} · {units.length} flats
                    </small>
                  </div>
                  <div className="property-mini-stat">
                    <strong>{percent}% occupied</strong>
                    <div className="mini-progress">
                      <span style={{ width: `${percent}%` }} />
                    </div>
                  </div>
                  <ArrowRight size={14} className="muted" />
                </Link>
              );
            })}
            {!data.buildings.length && (
              <Empty
                title="Your portfolio starts here"
                description="Add your first building, then organise its floors and flats."
              />
            )}
          </div>
        </section>
        <section className="panel">
          <div className="panel-header">
            <SectionHeader
              title="Recent activity"
              description="The latest in your workspace."
            />
          </div>
          <div className="activity-list">
            {data.activities.slice(0, 5).map((a) => {
              const record =
                a.resource_type === "buildings"
                  ? data.buildings.find((r) => r.id === a.resource_id)?.name
                  : a.resource_type === "tenants"
                    ? data.tenants.find((r) => r.id === a.resource_id)?.name
                    : a.resource_type === "leases"
                      ? data.leases.find((r) => r.id === a.resource_id)
                          ?.reference
                      : a.resource_type === "cheques"
                        ? data.cheques.find((r) => r.id === a.resource_id)
                            ?.number
                        : undefined;
              const label =
                {
                  buildings: "Property",
                  tenants: "Tenant",
                  leases: "Agreement",
                  cheques: "Cheque",
                  ledger: "Account entry",
                  deposits: "Security deposit",
                  documents: "Document",
                  units: "Flat",
                }[a.resource_type] ?? "Record";
              return (
                <div className="activity-row" key={a.id}>
                  <span className="activity-symbol">
                    {a.resource_type === "cheques" ? (
                      <Wallet size={17} />
                    ) : a.resource_type === "leases" ? (
                      <FileText size={17} />
                    ) : (
                      <CheckCircle size={17} />
                    )}
                  </span>
                  <div>
                    <p>
                      <strong>
                        {label} {a.action === "insert" ? "added" : "updated"}
                      </strong>
                      {record && <> · {record}</>}
                    </p>
                    <small>{dateLabel(a.created_at)}</small>
                  </div>
                </div>
              );
            })}
            {!data.activities.length && (
              <Empty
                title="A fresh start"
                description="Changes to your portfolio will be recorded here."
              />
            )}
          </div>
        </section>
      </div>
    </>
  );
}

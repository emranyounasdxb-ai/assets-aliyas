"use client";
import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CalendarBlank,
  CheckCircle,
  Clock,
  FileText,
  Key,
  Plus,
  Receipt,
  WarningCircle,
  Wallet,
} from "@phosphor-icons/react";
import {
  accountBalance,
  dateLabel,
  daysUntil,
  money,
  pendingCheque,
  todayDubai,
  unitStatus,
} from "@/lib/domain";
import { useApp } from "./provider";
import { Button, Empty, Money, PageHeader, SectionHeader } from "./ui";
import { ChequeTable } from "./accounts";
export function Dashboard() {
  const { data, openForm } = useApp();
  const today = todayDubai();
  const [period, setPeriod] = useState(6);
  const [chequeView, setChequeView] = useState("upcoming");
  const occupied = data.units.filter(
    (u) => unitStatus(data, u) === "Occupied",
  ).length;
  const vacant = data.units.filter(
    (u) => unitStatus(data, u) === "Vacant",
  ).length;
  const occupancy = data.units.length
    ? (occupied / data.units.length) * 100
    : 0;
  const pending = data.cheques
    .filter(pendingCheque)
    .sort((a, b) => a.due_date.localeCompare(b.due_date));
  const due = pending.filter(
    (c) => daysUntil(c.due_date) >= 0 && daysUntil(c.due_date) <= 7,
  );
  const overdue = pending.filter((c) => daysUntil(c.due_date) < 0);
  const renewals = data.leases.filter(
    (l) =>
      l.status === "active" &&
      l.start_date <= today &&
      daysUntil(l.end_date) >= 0 &&
      daysUntil(l.end_date) <= 30,
  );
  const monthlyCollected = -data.ledger
    .filter(
      (e) =>
        e.kind === "payment" &&
        e.entry_date.startsWith(today.slice(0, 7)) &&
        e.entry_date <= today,
    )
    .reduce((s, e) => s + e.amount, 0);
  const outstanding = data.tenants.reduce(
    (s, t) => s + Math.max(0, accountBalance(data.ledger, t.id)),
    0,
  );
  const monthStart = new Date(`${today.slice(0, 7)}-01T12:00:00Z`);
  const series = Array.from({ length: period }, (_, i) => {
    const date = new Date(monthStart);
    date.setUTCMonth(date.getUTCMonth() - period + 1 + i);
    const month = date.toISOString().slice(0, 7);
    return {
      month,
      label: new Intl.DateTimeFormat("en-GB", { month: "short" }).format(date),
      collected: -data.ledger
        .filter(
          (e) =>
            e.kind === "payment" &&
            e.entry_date.startsWith(month) &&
            e.entry_date <= today,
        )
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
  const max = Math.max(
    10000,
    ...series.flatMap((m) => [m.collected, m.expected]),
  );
  const total = series.reduce((s, m) => s + m.collected, 0);
  const finance = ["owner", "manager", "accountant"].includes(
    data.membership.role,
  );
  const stats = [
    {
      title: "Collected this month",
      value: monthlyCollected,
      icon: Wallet,
      foot: dateLabel(today, { month: "long", year: "numeric" }),
      type: "money",
      className: "featured",
    },
    {
      title: "Outstanding balance",
      value: outstanding,
      icon: Receipt,
      foot: "Includes annual rent and opening balances",
      type: "money",
      className: "",
    },
    {
      title: "Portfolio occupancy",
      value: occupancy,
      icon: Key,
      foot: `${occupied} occupied · ${vacant} vacant flats`,
      type: "percent",
      className: "",
    },
    {
      title: "Due within 7 days",
      value: due.reduce((s, c) => s + c.amount, 0),
      icon: CalendarBlank,
      foot: `${due.length} rental cheques to follow up`,
      type: "money",
      className: "",
    },
  ];
  const attention = [
    {
      label: "Overdue rent cheques",
      detail: "Follow up on uncleared payments",
      count: overdue.length,
      icon: WarningCircle,
      tone: "danger",
      href: "/cheques?view=overdue",
    },
    {
      label: "Cheques due this week",
      detail: "Prepare the next bank deposits",
      count: due.length,
      icon: Clock,
      tone: "warning",
      href: "/cheques?view=upcoming",
    },
    {
      label: "Agreements ending soon",
      detail: "Within the next 30 days",
      count: renewals.length,
      icon: FileText,
      tone: "neutral",
      href: "/agreements?view=expiring",
    },
    {
      label: "Flats ready to rent",
      detail: "Available across your properties",
      count: vacant,
      icon: Key,
      tone: "success",
      href: "/units?status=Vacant",
    },
  ];
  const shownCheques = chequeView === "overdue" ? overdue : due;
  return (
    <>
      <PageHeader
        eyebrow="Your property workspace"
        title="Portfolio overview"
        description={`${data.buildings.length} properties · ${data.units.length} flats · ${data.tenants.length} tenants across your portfolio`}
      >
        <span className="date-chip">
          <CalendarBlank size={16} />
          {dateLabel(today, {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </span>
        {finance && (
          <Button variant="primary" onClick={() => openForm("account")}>
            <Plus size={18} />
            Record payment
          </Button>
        )}
      </PageHeader>
      <div className="stats-grid">
        {stats.map((s) => (
          <section
            className={`stat-card ${s.className}`}
            key={s.title}
            aria-label={s.title}
          >
            <div className="stat-top">
              <span>{s.title}</span>
              <span className="stat-icon">
                <s.icon size={20} />
              </span>
            </div>
            <div className="stat-value">
              {s.type === "money" ? (
                <Money value={s.value} />
              ) : data.units.length ? (
                `${s.value.toFixed(1)}%`
              ) : (
                "—"
              )}
            </div>
            <p className="stat-foot">{s.foot}</p>
          </section>
        ))}
      </div>
      <div className="dashboard-chart-grid">
        <section className="panel padded">
          <SectionHeader
            title="Rental collections"
            description="Cleared payments against scheduled rental cheques"
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
            <span className="muted">received in this period</span>
          </div>
          <div className="chart-scroll">
            <div
              className={`collection-plot ${period === 12 ? "annual-plot" : ""}`}
              role="img"
              aria-label={`Rent collected over ${period} months: AED ${money(total)}`}
            >
              <div className="chart-axis">
                {[1, 2 / 3, 1 / 3, 0].map((v) => (
                  <span key={v}>
                    {new Intl.NumberFormat("en", {
                      notation: "compact",
                      maximumFractionDigits: 0,
                    }).format((max * v) / 100)}
                  </span>
                ))}
              </div>
              <div className="chart-months">
                {series.map((m) => (
                  <div className="chart-month" key={m.month}>
                    <div
                      className="chart-columns"
                      title={`${m.label}: collected AED ${money(m.collected)}, scheduled AED ${money(m.expected)}`}
                    >
                      <span
                        className="collection-bar"
                        style={{
                          height: `${Math.max(0, (m.collected / max) * 100)}%`,
                        }}
                      />
                      <span
                        className="schedule-bar"
                        style={{
                          height: `${Math.max(0, (m.expected / max) * 100)}%`,
                        }}
                      />
                    </div>
                    <span>{m.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="chart-legend">
            <span>
              <i className="legend-dot dark" />
              Collected
            </span>
            <span>
              <i className="legend-dot" />
              Scheduled
            </span>
            <span className="chart-currency">Amounts in AED</span>
          </div>
        </section>
        <section className="panel attention-panel">
          <div className="panel-header">
            <SectionHeader
              title="Needs attention"
              description="Your next actions, in one place"
            >
              <span className="attention-marker" aria-hidden="true" />
            </SectionHeader>
          </div>
          <div className="attention-list">
            {attention.map((item) => (
              <Link href={item.href} className="attention-row" key={item.label}>
                <span className={`attention-icon ${item.tone}`}>
                  <item.icon size={20} />
                </span>
                <span className="attention-copy">
                  <strong>{item.label}</strong>
                  <small>{item.detail}</small>
                </span>
                <strong className="attention-count">{item.count}</strong>
                <ArrowRight size={16} />
              </Link>
            ))}
          </div>
        </section>
      </div>
      <section className="panel dashboard-cheques">
        <div className="panel-header">
          <SectionHeader
            title="Cheque follow-up"
            description="Review due dates and update payment status"
          >
            <Link className="text-link" href={`/cheques?view=${chequeView}`}>
              All cheques
              <ArrowRight size={16} />
            </Link>
          </SectionHeader>
          <fieldset
            className="segmented-control"
            aria-label="Cheques to display"
          >
            <button
              type="button"
              aria-pressed={chequeView === "upcoming"}
              onClick={() => setChequeView("upcoming")}
            >
              Due this week <span>{due.length}</span>
            </button>
            <button
              type="button"
              aria-pressed={chequeView === "overdue"}
              onClick={() => setChequeView("overdue")}
            >
              Overdue <span>{overdue.length}</span>
            </button>
          </fieldset>
        </div>
        {shownCheques.length ? (
          <ChequeTable cheques={shownCheques.slice(0, 5)} />
        ) : (
          <Empty
            title={
              chequeView === "overdue"
                ? "No overdue rent cheques"
                : "No cheques due this week"
            }
            description="Your payment schedule is up to date. Switch views to review other cheques."
          />
        )}
      </section>
      <div className="dashboard-bottom-grid">
        <section className="panel">
          <div className="panel-header">
            <SectionHeader
              title="Property performance"
              description={`${occupied} of ${data.units.length} flats currently occupied`}
            >
              <Link href="/properties" className="text-link">
                All properties
                <ArrowRight size={16} />
              </Link>
            </SectionHeader>
          </div>
          <div className="property-mini-list">
            {data.buildings.slice(0, 4).map((b) => {
              const units = data.units.filter((u) => u.building_id === b.id);
              const count = units.filter(
                (u) => unitStatus(data, u) === "Occupied",
              ).length;
              const percent = units.length
                ? Math.round((count / units.length) * 100)
                : 0;
              return (
                <Link
                  className="property-mini"
                  href={`/properties/${b.id}`}
                  key={b.id}
                >
                  <span className="property-code-mini">
                    {b.code.slice(0, 3)}
                  </span>
                  <span className="property-mini-text">
                    <strong>{b.name}</strong>
                    <small>
                      {b.area} · {units.length} flats
                    </small>
                  </span>
                  <span className="property-mini-stat">
                    <strong>{percent}% occupied</strong>
                    <span className="mini-progress">
                      <span style={{ width: `${percent}%` }} />
                    </span>
                  </span>
                  <ArrowRight size={16} />
                </Link>
              );
            })}
            {!data.buildings.length && (
              <Empty
                title="Your portfolio starts here"
                description="Add your first building, then its floors and flats."
              />
            )}
          </div>
        </section>
        <section className="panel">
          <div className="panel-header">
            <SectionHeader
              title="Recent activity"
              description="Latest changes in your workspace"
            />
          </div>
          <div className="activity-list">
            {data.activities.slice(0, 4).map((a) => {
              const label =
                (
                  {
                    buildings: "Property",
                    tenants: "Tenant",
                    leases: "Agreement",
                    cheques: "Cheque",
                    ledger: "Account entry",
                    deposits: "Security deposit",
                    documents: "Document",
                    units: "Flat",
                  } as Record<string, string>
                )[a.resource_type] ?? "Record";
              return (
                <div className="activity-row" key={a.id}>
                  <span className="activity-symbol">
                    <CheckCircle size={18} />
                  </span>
                  <div>
                    <p>
                      <strong>
                        {label} {a.action === "insert" ? "added" : "updated"}
                      </strong>
                    </p>
                    <small>{dateLabel(a.created_at)}</small>
                  </div>
                </div>
              );
            })}
            {!data.activities.length && (
              <Empty
                title="No activity yet"
                description="Changes to your portfolio will appear here."
              />
            )}
          </div>
        </section>
      </div>
    </>
  );
}

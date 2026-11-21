"use client";
import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  FileText,
  PencilSimple,
  Plus,
  ShieldCheck,
} from "@phosphor-icons/react";
import { accountBalance, dateLabel, todayDubai } from "@/lib/domain";
import { useApp } from "./provider";
import {
  Avatar,
  BackLink,
  Badge,
  Button,
  Empty,
  Money,
  PageHeader,
  Pagination,
  SearchInput,
  SectionHeader,
  Tabs,
  useList,
} from "./ui";
import { DocumentPanel } from "./documents";
import { LedgerTable, SecurityPanel } from "./accounts";
import { ParkingAssignments } from "./parking-allocations";
export function Tenants() {
  const { data, openForm } = useApp();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const today = todayDubai();
  const active = (id: string) =>
    data.leases.some(
      (l) =>
        l.tenant_id === id &&
        l.status === "active" &&
        l.start_date <= today &&
        l.end_date >= today,
    );
  const list = useList(
    data.tenants,
    (t) =>
      `${t.name} ${t.email} ${t.phone}`
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (filter === "all" ||
        (filter === "active" ? active(t.id) : !active(t.id))),
  );
  return (
    <>
      <PageHeader
        eyebrow="Tenant management"
        title="Tenants"
        description="Keep tenant details, documents and rental history together."
      >
        {["owner", "manager"].includes(data.membership.role) && (
          <Button variant="primary" onClick={() => openForm("tenant")}>
            <Plus size={18} />
            Add tenant
          </Button>
        )}
      </PageHeader>
      <div className="toolbar">
        <SearchInput
          value={query}
          onChange={(v) => {
            setQuery(v);
            list.setPage(1);
          }}
          placeholder="Search tenants, email or phone…"
        />
        <select
          className="filter-select"
          aria-label="Filter tenants"
          value={filter}
          onChange={(e) => {
            setFilter(e.target.value);
            list.setPage(1);
          }}
        >
          <option value="all">All tenants</option>
          <option value="active">Current tenants</option>
          <option value="inactive">No current tenancy</option>
        </select>
        <span className="toolbar-spacer" />
        <span className="filter-label">{list.total} tenants</span>
      </div>
      <div className="panel">
        {list.total ? (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Tenant</th>
                    <th>Contact</th>
                    <th>Property / Flat</th>
                    <th>Account balance</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {list.visible.map((t) => {
                    const l = data.leases.find(
                      (l) =>
                        l.tenant_id === t.id &&
                        l.status === "active" &&
                        l.start_date <= today &&
                        l.end_date >= today,
                    );
                    const u = data.units.find((u) => u.id === l?.unit_id);
                    return (
                      <tr key={t.id}>
                        <td className="cell-main">
                          <Link className="cell-link" href={`/tenants/${t.id}`}>
                            <Avatar name={t.name} />
                            <div>
                              <strong>{t.name}</strong>
                              <small>
                                {t.nationality || "Nationality not entered"}
                              </small>
                            </div>
                          </Link>
                        </td>
                        <td>
                          {t.email || "Email not entered"}
                          <small>{t.phone}</small>
                        </td>
                        <td>
                          {u ? (
                            <>
                              <strong>
                                {
                                  data.buildings.find(
                                    (b) => b.id === u.building_id,
                                  )?.name
                                }
                              </strong>
                              <small>
                                Flat {u.code} · {u.category}
                              </small>
                            </>
                          ) : (
                            "No current tenancy"
                          )}
                        </td>
                        <td>
                          <strong>
                            <Money value={accountBalance(data.ledger, t.id)} />
                          </strong>
                          <small>
                            {accountBalance(data.ledger, t.id) < 0
                              ? "Account credit"
                              : "Outstanding balance"}
                          </small>
                        </td>
                        <td>
                          <Badge tone={active(t.id) ? "success" : "neutral"}>
                            {active(t.id)
                              ? "Current tenant"
                              : "No active lease"}
                          </Badge>
                        </td>
                        <td>
                          <Link
                            className="text-link"
                            aria-label={`View ${t.name}`}
                            href={`/tenants/${t.id}`}
                          >
                            <ArrowRight size={17} />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination {...list} />
          </>
        ) : (
          <Empty
            title="No tenants found"
            description={
              data.tenants.length
                ? "Try a different name or filter."
                : "Create a tenant profile, then link it to a flat with an agreement."
            }
          />
        )}
      </div>
    </>
  );
}
export function TenantDetail({ id }: { id: string }) {
  const { data, openForm } = useApp();
  const [tab, setTab] = useState("overview");
  const tenant = data.tenants.find((t) => t.id === id);
  if (!tenant)
    return (
      <>
        <BackLink href="/tenants">All tenants</BackLink>
        <Empty
          title="Tenant not found"
          description="This tenant is not in your current workspace."
        />
      </>
    );
  const leases = data.leases.filter((l) => l.tenant_id === id);
  const balance = accountBalance(data.ledger, id);
  const paid = -data.ledger
    .filter((e) => e.tenant_id === id && e.kind === "payment")
    .reduce((s, e) => s + e.amount, 0);
  const manage = ["owner", "manager"].includes(data.membership.role);
  const finance = ["owner", "manager", "accountant"].includes(
    data.membership.role,
  );
  return (
    <>
      <BackLink href="/tenants">All tenants</BackLink>
      <PageHeader
        title={tenant.name}
        eyebrow="TENANT PROFILE"
        description="Contact details, rental history and everything on the account."
      >
        {manage && (
          <Button onClick={() => openForm("tenant", { ...tenant })}>
            <PencilSimple size={16} />
            Edit profile
          </Button>
        )}
        {manage && (
          <Button
            variant="primary"
            onClick={() => openForm("lease", { tenant_id: id })}
          >
            <Plus size={18} />
            New agreement
          </Button>
        )}
      </PageHeader>
      <Tabs
        id={`tenant-${id}`}
        label="Tenant profile sections"
        value={tab}
        onChange={setTab}
        items={[
          { value: "overview", label: "Overview" },
          {
            value: "documents",
            label: "Documents",
            count: data.documents.filter(
              (d) =>
                d.target_type === "tenant" &&
                d.target_id === id &&
                d.status === "current",
            ).length,
          },
          { value: "agreements", label: "Agreements", count: leases.length },
          { value: "account", label: "Account" },
          {
            value: "parking",
            label: "Parking",
            count: data.parkingAllocations.filter(
              (a) =>
                a.tenant_id === id &&
                a.status === "active" &&
                a.end_date >= todayDubai(),
            ).length,
          },
        ]}
      />
      <div className="details-two-col tenant-layout">
        <div className="detail-stack">
          <div
            role="tabpanel"
            id={`tenant-${id}-panel-parking`}
            aria-labelledby={`tenant-${id}-tab-parking`}
            hidden={tab !== "parking"}
          >
            <ParkingAssignments tenantId={id} />
          </div>
          <div
            role="tabpanel"
            id={`tenant-${id}-panel-overview`}
            aria-labelledby={`tenant-${id}-tab-overview`}
            hidden={tab !== "overview"}
          >
            <section className="panel padded">
              <div className="profile-header">
                <Avatar name={tenant.name} size="large" />
                <div>
                  <h2>{tenant.name}</h2>
                  <p>{tenant.nationality || "Nationality not entered"}</p>
                  <Badge tone="mint">
                    Tenant since{" "}
                    {dateLabel(tenant.created_at, {
                      month: "short",
                      year: "numeric",
                    })}
                  </Badge>
                </div>
              </div>
              <div className="profile-contact">
                <div>
                  <small>Email address</small>
                  <strong>{tenant.email || "Not entered"}</strong>
                </div>
                <div>
                  <small>Phone number</small>
                  <strong>{tenant.phone}</strong>
                </div>
                {tenant.notes && (
                  <div className="span-2">
                    <small>Notes</small>
                    <strong>{tenant.notes}</strong>
                  </div>
                )}
              </div>
            </section>
            <div className="tenant-quick-summary">
              <section>
                <FileText size={20} />
                <strong>{leases.length}</strong>
                <span>Rental agreements</span>
                <button
                  type="button"
                  className="text-link"
                  onClick={() => setTab("agreements")}
                >
                  View agreements <ArrowRight size={14} />
                </button>
              </section>
              <section>
                <ShieldCheck size={20} />
                <strong>
                  {
                    data.documents.filter(
                      (d) =>
                        d.target_type === "tenant" &&
                        d.target_id === id &&
                        d.status === "current",
                    ).length
                  }
                </strong>
                <span>Current documents</span>
                <button
                  type="button"
                  className="text-link"
                  onClick={() => setTab("documents")}
                >
                  View documents <ArrowRight size={14} />
                </button>
              </section>
            </div>
          </div>
          <div
            role="tabpanel"
            id={`tenant-${id}-panel-agreements`}
            aria-labelledby={`tenant-${id}-tab-agreements`}
            hidden={tab !== "agreements"}
          >
            <section className="panel">
              <div className="panel-header">
                <SectionHeader
                  title="Rental agreements"
                  description="A complete history of this tenant's flats."
                />
              </div>
              {leases.length ? (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Agreement</th>
                        <th>Property / Flat</th>
                        <th>Annual rent</th>
                        <th>Dates</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {leases.map((l) => {
                        const u = data.units.find((u) => u.id === l.unit_id);
                        return (
                          <tr key={l.id}>
                            <td>
                              <strong>{l.reference}</strong>
                              <small>{l.status}</small>
                            </td>
                            <td>
                              {
                                data.buildings.find(
                                  (b) => b.id === u?.building_id,
                                )?.name
                              }
                              <small>Flat {u?.code}</small>
                            </td>
                            <td>
                              <Money value={l.annual_rent} />
                            </td>
                            <td>
                              {dateLabel(l.start_date)}
                              <small>to {dateLabel(l.end_date)}</small>
                            </td>
                            <td>
                              <Link
                                href={`/agreements/${l.id}`}
                                className="text-link"
                                aria-label={`View ${l.reference}`}
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
                  title="Ready for a new chapter"
                  description="Create an agreement to link this tenant to a flat."
                />
              )}
            </section>
          </div>
          <div
            role="tabpanel"
            id={`tenant-${id}-panel-documents`}
            aria-labelledby={`tenant-${id}-tab-documents`}
            hidden={tab !== "documents"}
          >
            <DocumentPanel
              targetType="tenant"
              targetId={id}
              title="Tenant documents"
            />
          </div>
          <div
            role="tabpanel"
            id={`tenant-${id}-panel-account`}
            aria-labelledby={`tenant-${id}-tab-account`}
            hidden={tab !== "account"}
          >
            <section className="panel">
              <div className="panel-header">
                <SectionHeader
                  title="Account activity"
                  description="Charges and payments, with the full history."
                />
              </div>
              <LedgerTable tenantId={id} />
            </section>
          </div>
        </div>
        <div className="detail-stack tenant-account-sidebar">
          <section className="balance-card">
            <small>
              {balance < 0 ? "ACCOUNT CREDIT" : "OUTSTANDING BALANCE"}
            </small>
            <strong>
              <Money value={Math.abs(balance)} />
            </strong>
            <Badge tone="outline">
              AED {new Intl.NumberFormat("en-AE").format(paid / 100)} received
            </Badge>
            <p>
              {balance < 0
                ? "This tenant has a credit on their account."
                : "Includes annual rent charged and any opening balance. Security is held separately."}
            </p>
            {finance && (
              <div className="balance-actions">
                <Button
                  variant="primary"
                  onClick={() => openForm("account", { tenant_id: id })}
                >
                  <Plus size={16} />
                  Record payment
                </Button>
              </div>
            )}
          </section>
          <SecurityPanel tenantId={id} />
          <div className="panel padded">
            <ShieldCheck size={22} style={{ color: "#859d6b" }} />
            <h3 style={{ fontSize: 14, fontWeight: 500, marginTop: 12 }}>
              A private place for details.
            </h3>
            <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 8 }}>
              Identity documents and bank statements are available only to
              permitted team members.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

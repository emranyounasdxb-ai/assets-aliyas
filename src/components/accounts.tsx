"use client";
import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle,
  DownloadSimple,
  PencilSimple,
  Plus,
  ShieldCheck,
  Wallet,
} from "@phosphor-icons/react";
import {
  accountBalance,
  dateLabel,
  daysUntil,
  exportCsv,
  pendingCheque,
  todayDubai,
  type Cheque,
} from "@/lib/domain";
import { useApp } from "./provider";
import {
  StableRegion,
  StableTable,
  Avatar,
  Badge,
  Button,
  Empty,
  ErrorText,
  Modal,
  Money,
  PageHeader,
  Pagination,
  SearchInput,
  SectionHeader,
  statusTone,
  useList,
} from "./ui";
export function Cheques({ initialFilter = "all" }: { initialFilter?: string }) {
  const { data } = useApp();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState(initialFilter);
  const [purpose, setPurpose] = useState("rent");
  const [property, setProperty] = useState("all");
  const list = useList(
    [...data.cheques].sort((a, b) => a.due_date.localeCompare(b.due_date)),
    (c) => {
      const l = data.leases.find((l) => l.id === c.lease_id);
      const u = data.units.find((u) => u.id === l?.unit_id);
      return (
        `${c.number} ${c.bank} ${data.tenants.find((t) => t.id === c.tenant_id)?.name}`
          .toLowerCase()
          .includes(query.toLowerCase()) &&
        (purpose === "all" || c.purpose === purpose) &&
        (property === "all" || u?.building_id === property) &&
        (filter === "all" || filter === "overdue"
          ? filter !== "overdue" ||
            (pendingCheque(c) && daysUntil(c.due_date) < 0)
          : filter === "upcoming"
            ? pendingCheque(c) &&
              daysUntil(c.due_date) >= 0 &&
              daysUntil(c.due_date) <= 7
            : c.status === filter)
      );
    },
  );
  const pending = data.cheques.filter(pendingCheque);
  const week = pending.filter(
    (c) => daysUntil(c.due_date) >= 0 && daysUntil(c.due_date) <= 7,
  );
  const overdue = pending.filter((c) => daysUntil(c.due_date) < 0);
  function download() {
    exportCsv("aliyas-cheques.csv", [
      [
        "Cheque number",
        "Tenant",
        "Bank",
        "Due date",
        "Amount AED",
        "Purpose",
        "Status",
      ],
      ...list.filtered.map((c) => [
        c.number,
        data.tenants.find((t) => t.id === c.tenant_id)?.name ?? "",
        c.bank,
        c.due_date,
        c.amount / 100,
        c.purpose,
        c.status,
      ]),
    ]);
  }
  return (
    <>
      <PageHeader title="Cheques">
        <Button onClick={download}>
          <DownloadSimple size={17} />
          Export cheques
        </Button>
      </PageHeader>
      <div className="summary-strip">
        <div>
          <small>Due in the next 7 days</small>
          <strong>
            <Money value={week.reduce((s, c) => s + c.amount, 0)} />
          </strong>
        </div>
        <div>
          <small>Overdue cheques</small>
          <strong>{overdue.length}</strong>
        </div>
        <div>
          <small>Awaiting clearance</small>
          <strong>
            {
              data.cheques.filter(
                (c) => c.purpose === "rent" && c.status === "deposited",
              ).length
            }
          </strong>
        </div>
        <div>
          <small>Security cheques held</small>
          <strong>
            {
              data.cheques.filter(
                (c) => c.purpose === "security" && c.status === "received",
              ).length
            }
          </strong>
        </div>
      </div>
      <div className="toolbar">
        <SearchInput
          value={query}
          onChange={(v) => {
            setQuery(v);
            list.setPage(1);
          }}
          placeholder="Search cheques, tenants or banks…"
        />
        <select
          className="filter-select"
          aria-label="Cheque purpose"
          value={purpose}
          onChange={(e) => {
            setPurpose(e.target.value);
            list.setPage(1);
          }}
        >
          <option value="rent">Rent cheques</option>
          <option value="security">Security cheques</option>
          <option value="all">All purposes</option>
        </select>
        <select
          className="filter-select"
          aria-label="Cheque status"
          value={filter}
          onChange={(e) => {
            setFilter(e.target.value);
            list.setPage(1);
          }}
        >
          {[
            ["all", "All statuses"],
            ["upcoming", "Due within 7 days"],
            ["overdue", "Overdue"],
            ["received", "Received"],
            ["deposited", "Deposited"],
            ["cleared", "Cleared"],
            ["bounced", "Bounced"],
            ["cancelled", "Cancelled"],
            ["returned", "Returned"],
          ].map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select
          className="filter-select"
          aria-label="Cheque property"
          value={property}
          onChange={(e) => {
            setProperty(e.target.value);
            list.setPage(1);
          }}
        >
          <option value="all">All properties</option>
          {data.buildings.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </div>
      <StableRegion className="panel">
        {list.total ? (
          <>
            <ChequeTable cheques={list.visible} />
            <Pagination {...list} />
          </>
        ) : (
          <Empty
            title="No cheques in this view"
            description="Try another filter. Rent cheques are created with each annual agreement."
          />
        )}
      </StableRegion>
    </>
  );
}
export function ChequeTable({ cheques }: { cheques: Cheque[] }) {
  const { data, openForm } = useApp();
  const finance = ["owner", "manager", "accountant"].includes(
    data.membership.role,
  );
  return (
    <div className="table-wrap cheque-table-wrap">
      <StableTable className="cheque-table">
        <thead>
          <tr>
            <th>Cheque / Bank</th>
            <th>Tenant</th>
            <th>Due date</th>
            <th className="align-right">Amount</th>
            <th>Purpose</th>
            <th>Status</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {cheques.map((c) => {
            const late = pendingCheque(c) && daysUntil(c.due_date) < 0;
            const final = ["cleared", "cancelled", "returned"].includes(
              c.status,
            );
            return (
              <tr key={c.id}>
                <td className="cheque-reference" data-label="Cheque / Bank">
                  <strong>{c.number}</strong>
                  <small>{c.bank || "Bank not entered"}</small>
                </td>
                <td className="cheque-tenant" data-label="Tenant">
                  <Link className="text-link" href={`/tenants/${c.tenant_id}`}>
                    {data.tenants.find((t) => t.id === c.tenant_id)?.name}
                  </Link>
                </td>
                <td className="cheque-date" data-label="Due date">
                  {dateLabel(c.due_date)}
                  {late && (
                    <small style={{ color: "var(--red)" }}>
                      {-daysUntil(c.due_date)} days overdue
                    </small>
                  )}
                  {c.cleared_on && (
                    <small>Cleared {dateLabel(c.cleared_on)}</small>
                  )}
                </td>
                <td className="cheque-amount align-right" data-label="Amount">
                  <strong>
                    <Money value={c.amount} />
                  </strong>
                </td>
                <td className="cheque-purpose" data-label="Purpose">
                  <Badge
                    tone={c.purpose === "security" ? "outline" : "neutral"}
                  >
                    {c.purpose}
                  </Badge>
                </td>
                <td className="cheque-status" data-label="Status">
                  <Badge tone={statusTone(c.status)}>{c.status}</Badge>
                </td>
                <td className="cheque-action">
                  {finance && !final ? (
                    <Button
                      variant="ghost"
                      className="cheque-update"
                      aria-label={`Update cheque ${c.number}`}
                      onClick={() => openForm("cheque", { ...c })}
                    >
                      <PencilSimple size={16} />
                      Update
                    </Button>
                  ) : final ? (
                    <CheckCircle size={17} className="muted" />
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </StableTable>
    </div>
  );
}
export function LedgerTable({ tenantId }: { tenantId?: string }) {
  const { data } = useApp();
  const list = useList(
    [...data.ledger].sort(
      (a, b) =>
        b.entry_date.localeCompare(a.entry_date) ||
        b.created_at.localeCompare(a.created_at),
    ),
    (e) => !tenantId || e.tenant_id === tenantId,
  );
  return list.total ? (
    <>
      <div className="table-wrap">
        <StableTable>
          <thead>
            <tr>
              <th>Date</th>
              {!tenantId && <th>Tenant</th>}
              <th>Description</th>
              <th>Type</th>
              <th className="align-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {list.visible.map((e) => (
              <tr key={e.id}>
                <td>{dateLabel(e.entry_date)}</td>
                {!tenantId && (
                  <td>
                    <Link
                      className="text-link"
                      href={`/tenants/${e.tenant_id}`}
                    >
                      {data.tenants.find((t) => t.id === e.tenant_id)?.name}
                    </Link>
                  </td>
                )}
                <td>
                  <strong>{e.description}</strong>
                  {e.entry_date > todayDubai() && <small>Future dated</small>}
                </td>
                <td>
                  <Badge tone={e.amount < 0 ? "mint" : "neutral"}>
                    {e.kind}
                  </Badge>
                </td>
                <td
                  className={`align-right ${e.amount < 0 ? "ledger-credit" : "ledger-debit"}`}
                >
                  <strong>
                    {e.amount < 0 ? "−" : "+"}
                    <Money value={Math.abs(e.amount)} />
                  </strong>
                </td>
              </tr>
            ))}
          </tbody>
        </StableTable>
      </div>
      <Pagination {...list} />
    </>
  ) : (
    <Empty
      title="A clear account"
      description="Opening balances, rent charges and received payments will appear here."
    />
  );
}
export function Wallets() {
  const { data, openForm } = useApp();
  const [query, setQuery] = useState("");
  const [view, setView] = useState("balances");
  const [filter, setFilter] = useState("all");
  const list = useList(
    data.tenants,
    (t) =>
      t.name.toLowerCase().includes(query.toLowerCase()) &&
      (filter === "all" ||
        (filter === "owing" && accountBalance(data.ledger, t.id) > 0) ||
        (filter === "credit" && accountBalance(data.ledger, t.id) < 0) ||
        (filter === "settled" && accountBalance(data.ledger, t.id) === 0)),
  );
  const owing = data.tenants.reduce(
    (s, t) => s + Math.max(0, accountBalance(data.ledger, t.id)),
    0,
  );
  const credits = data.tenants.reduce(
    (s, t) => s + Math.max(0, -accountBalance(data.ledger, t.id)),
    0,
  );
  const security = data.deposits
    .filter((d) => d.status === "held")
    .reduce((s, d) => s + d.amount, 0);
  return (
    <>
      <PageHeader title="Tenant accounts">
        {["owner", "manager", "accountant"].includes(data.membership.role) && (
          <Button variant="primary" onClick={() => openForm("account")}>
            <Plus size={18} />
            Record payment
          </Button>
        )}
      </PageHeader>
      <div className="summary-strip">
        <div>
          <small>Outstanding balances</small>
          <strong>
            <Money value={owing} />
          </strong>
        </div>
        <div>
          <small>Tenant credits</small>
          <strong>
            <Money value={credits} />
          </strong>
        </div>
        <div>
          <small>Cash security held</small>
          <strong>
            <Money value={security} />
          </strong>
        </div>
        <div>
          <small>Tenants with a balance</small>
          <strong>
            {
              data.tenants.filter((t) => accountBalance(data.ledger, t.id) > 0)
                .length
            }
          </strong>
        </div>
      </div>
      <div className="toolbar">
        <div className="tabs">
          <button
            type="button"
            className={view === "balances" ? "active" : ""}
            onClick={() => setView("balances")}
          >
            Tenant balances
          </button>
          <button
            type="button"
            className={view === "ledger" ? "active" : ""}
            onClick={() => setView("ledger")}
          >
            Account activity
          </button>
        </div>
        {view === "balances" && (
          <>
            <SearchInput
              value={query}
              onChange={(v) => {
                setQuery(v);
                list.setPage(1);
              }}
              placeholder="Search tenant accounts…"
            />
            <select
              className="filter-select"
              aria-label="Balance filter"
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value);
                list.setPage(1);
              }}
            >
              <option value="all">All balances</option>
              <option value="owing">Amount owed</option>
              <option value="credit">Account credit</option>
              <option value="settled">Settled</option>
            </select>
          </>
        )}
      </div>
      <StableRegion className="panel">
        {view === "ledger" ? (
          <LedgerTable />
        ) : list.total ? (
          <>
            <div className="table-wrap">
              <StableTable>
                <thead>
                  <tr>
                    <th>Tenant</th>
                    <th>Rent charged</th>
                    <th>Payments received</th>
                    <th>Current balance</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {list.visible.map((t) => {
                    const entries = data.ledger.filter(
                      (e) =>
                        e.tenant_id === t.id && e.entry_date <= todayDubai(),
                    );
                    const bal = accountBalance(entries);
                    return (
                      <tr key={t.id}>
                        <td className="cell-main">
                          <Link href={`/tenants/${t.id}`} className="cell-link">
                            <Avatar name={t.name} />
                            <div>
                              <strong>{t.name}</strong>
                              <small>{t.email || t.phone}</small>
                            </div>
                          </Link>
                        </td>
                        <td>
                          <Money
                            value={entries
                              .filter((e) => e.kind === "rent")
                              .reduce((s, e) => s + e.amount, 0)}
                          />
                        </td>
                        <td>
                          <Money
                            value={
                              -entries
                                .filter((e) => e.kind === "payment")
                                .reduce((s, e) => s + e.amount, 0)
                            }
                          />
                        </td>
                        <td>
                          <strong>
                            <Money value={Math.abs(bal)} />
                          </strong>
                          <small>
                            {bal < 0
                              ? "Credit"
                              : bal === 0
                                ? "Settled"
                                : "Amount owed"}
                          </small>
                        </td>
                        <td>
                          <Link
                            href={`/tenants/${t.id}`}
                            className="text-link"
                            aria-label={`View account for ${t.name}`}
                          >
                            <ArrowRight size={16} />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </StableTable>
            </div>
            <Pagination {...list} />
          </>
        ) : (
          <Empty
            title="No matching accounts"
            description="Try another search or add a tenant to open their account."
          />
        )}
      </StableRegion>
    </>
  );
}
export function SecurityPanel({ tenantId }: { tenantId: string }) {
  const { data, openForm, mutate, notify } = useApp();
  const [returnId, setReturnId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const deposits = data.deposits.filter((d) => d.tenant_id === tenantId);
  const cheques = data.cheques.filter(
    (c) => c.tenant_id === tenantId && c.purpose === "security",
  );
  const finance = ["owner", "manager", "accountant"].includes(
    data.membership.role,
  );
  async function returnDeposit() {
    setPending(true);
    try {
      await mutate("return_deposit", { id: returnId });
      notify("Security deposit marked returned.");
      setReturnId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setPending(false);
    }
  }
  return (
    <>
      <section className="panel padded">
        <SectionHeader title="Security held separately">
          {finance && (
            <Button
              variant="ghost"
              className="icon-button"
              aria-label="Add security"
              onClick={() => openForm("security", { tenant_id: tenantId })}
            >
              <Plus size={17} />
            </Button>
          )}
        </SectionHeader>
        {!deposits.length && !cheques.length ? (
          <p className="muted" style={{ fontSize: 12 }}>
            No security deposit or cheque recorded.
          </p>
        ) : (
          <div>
            {deposits.map((d) => (
              <div className="document-row" key={d.id}>
                <ShieldCheck size={22} />
                <div>
                  <strong>
                    <Money value={d.amount} />
                  </strong>
                  <small>Cash deposit · {d.reference}</small>
                  <Badge tone={d.status === "held" ? "mint" : "neutral"}>
                    {d.status}
                  </Badge>
                </div>
                {finance && d.status === "held" && (
                  <Button
                    variant="ghost"
                    style={{ fontSize: 12 }}
                    onClick={() => {
                      setError("");
                      setReturnId(d.id);
                    }}
                  >
                    Return
                  </Button>
                )}
              </div>
            ))}
            {cheques.map((c) => (
              <div className="document-row" key={c.id}>
                <Wallet size={22} />
                <div>
                  <strong>
                    <Money value={c.amount} />
                  </strong>
                  <small>Security cheque · {c.number}</small>
                  <Badge tone={c.status === "received" ? "mint" : "neutral"}>
                    {c.status === "received" ? "Held" : c.status}
                  </Badge>
                </div>
                {finance && c.status === "received" && (
                  <Button
                    variant="ghost"
                    className="icon-button"
                    aria-label={`Update security cheque ${c.number}`}
                    onClick={() => openForm("cheque", { ...c })}
                  >
                    <PencilSimple size={16} />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
      {returnId && (
        <Modal
          title="Return security deposit?"
          description="Confirm that this cash deposit has been returned to the tenant. It will stay in the history."
          onClose={() => setReturnId(null)}
        >
          <ErrorText message={error} />
          <div className="modal-footer">
            <Button disabled={pending} onClick={() => setReturnId(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={pending}
              onClick={returnDeposit}
            >
              {pending ? "Saving…" : "Confirm returned"}
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}

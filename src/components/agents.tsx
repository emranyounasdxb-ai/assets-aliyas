"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowCounterClockwise,
  DownloadSimple,
  PencilSimple,
  Plus,
  UploadSimple,
} from "@phosphor-icons/react";
import {
  commissionBalance,
  dateLabel,
  exportCsv,
  todayDubai,
  unitLabel,
  type Agent,
  type AgentCommission,
  type AgentReceipt,
  type AppData,
} from "@/lib/domain";
import { useApp } from "./provider";
import { UploadModal } from "./documents";
import {
  BackLink,
  Badge,
  Button,
  Empty,
  ErrorText,
  Field,
  Modal,
  Money,
  PageHeader,
  Pagination,
  SaveFooter,
  SearchInput,
  SectionHeader,
  StableRegion,
  StableTable,
  useList,
} from "./ui";

const canManage = (data: AppData) =>
  ["owner", "manager", "accountant"].includes(data.membership.role);
function labels(data: AppData, commission: AgentCommission) {
  const lease = data.leases.find((l) => l.id === commission.lease_id);
  const unit = data.units.find((u) => u.id === lease?.unit_id);
  return {
    lease,
    unit,
    property: data.buildings.find((b) => b.id === unit?.building_id),
    tenant: data.tenants.find((t) => t.id === lease?.tenant_id),
    agent: data.agents.find((a) => a.id === commission.agent_id),
  };
}
function status(data: AppData, c: AgentCommission) {
  const balance = commissionBalance(c, data.agentReceipts);
  return c.amount === null
    ? "Amount not entered"
    : c.amount === 0
      ? "No commission"
      : balance.pending === 0
        ? "Paid"
        : balance.received > 0
          ? "Part paid"
          : "Pending";
}
function Value({ amount }: { amount: number | null }) {
  return amount === null ? (
    <span className="muted">Not entered</span>
  ) : (
    <Money value={amount} />
  );
}

export function Agents() {
  const { data } = useApp();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("active");
  const [edit, setEdit] = useState<Agent | "new" | null>(null);
  const list = useList(
    data.agents,
    (a) =>
      `${a.name} ${a.phone} ${a.company}`
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (filter === "all" || a.status === filter),
  );
  if (!canManage(data))
    return (
      <Empty
        title="Agent records are restricted"
        description="An owner, manager or accountant can manage agent commissions."
      />
    );
  return (
    <>
      <PageHeader title="Agents">
        <Button variant="primary" onClick={() => setEdit("new")}>
          <Plus size={18} />
          Add agent
        </Button>
      </PageHeader>
      <div className="toolbar">
        <SearchInput
          value={query}
          onChange={(v) => {
            setQuery(v);
            list.setPage(1);
          }}
          placeholder="Search agents…"
        />
        <select
          className="filter-select"
          aria-label="Agent status"
          value={filter}
          onChange={(e) => {
            setFilter(e.target.value);
            list.setPage(1);
          }}
        >
          <option value="active">Active agents</option>
          <option value="inactive">Inactive agents</option>
          <option value="all">All agents</option>
        </select>
        <span className="toolbar-spacer" />
        <span className="filter-label">{list.total} agents</span>
      </div>
      <StableRegion className="panel">
        {list.total ? (
          <>
            <div className="table-wrap">
              <StableTable>
                <thead>
                  <tr>
                    <th>Agent</th>
                    <th>Contact</th>
                    <th>Agreements</th>
                    <th>Agreed commission</th>
                    <th>Received directly</th>
                    <th>Pending</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {list.visible.map((a) => {
                    const deals = data.agentCommissions.filter(
                      (c) => c.agent_id === a.id,
                    );
                    const total = deals.reduce(
                      (s, c) => s + (c.amount ?? 0),
                      0,
                    );
                    const received = deals.reduce(
                      (s, c) =>
                        s + commissionBalance(c, data.agentReceipts).received,
                      0,
                    );
                    return (
                      <tr key={a.id}>
                        <td>
                          <Link className="text-link" href={`/agents/${a.id}`}>
                            {a.name}
                          </Link>
                          <small>
                            {a.company ||
                              (a.status === "active" ? "Active" : "Inactive")}
                          </small>
                        </td>
                        <td>
                          {a.phone || "Not entered"}
                          <small>{a.email}</small>
                        </td>
                        <td>{deals.length}</td>
                        <td>
                          <Money value={total} />
                          {deals.some((c) => c.amount === null) && (
                            <small>Some amounts not entered</small>
                          )}
                        </td>
                        <td>
                          <Money value={received} />
                        </td>
                        <td>
                          <Money value={total - received} />
                        </td>
                        <td>
                          <Link
                            className="text-link"
                            href={`/agents/${a.id}`}
                            aria-label={`View ${a.name}`}
                          >
                            <ArrowRight size={17} />
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
            title={
              data.agents.length ? "No matching agents" : "No agents added"
            }
            description="Add your agents, then link them to rental agreements."
          />
        )}
      </StableRegion>
      <div className="agent-section">
        <CommissionPanel />
      </div>
      {edit && (
        <AgentForm
          agent={edit === "new" ? undefined : edit}
          onClose={() => setEdit(null)}
        />
      )}
    </>
  );
}

export function AgentDetail({ id }: { id: string }) {
  const { data } = useApp();
  const [edit, setEdit] = useState(false);
  const [reverse, setReverse] = useState<AgentReceipt | null>(null);
  const agent = data.agents.find((a) => a.id === id);
  const deals = data.agentCommissions.filter((c) => c.agent_id === id);
  const receipts = data.agentReceipts
    .filter((r) => deals.some((c) => c.id === r.commission_id))
    .sort(
      (a, b) =>
        b.entry_date.localeCompare(a.entry_date) ||
        b.created_at.localeCompare(a.created_at),
    );
  const total = deals.reduce((s, c) => s + (c.amount ?? 0), 0);
  const received = deals.reduce(
    (s, c) => s + commissionBalance(c, data.agentReceipts).received,
    0,
  );
  const wallet = useList(receipts, () => true, 12);
  if (!agent || !canManage(data))
    return (
      <>
        <BackLink href="/agents">All agents</BackLink>
        <Empty
          title="Agent not found"
          description="This agent is not available in your workspace."
        />
      </>
    );
  function statement() {
    exportCsv(`agent-statement-${todayDubai()}.csv`, [
      [
        "Date",
        "Agent",
        "Agreement",
        "Property",
        "Customer",
        "Entry",
        "Amount AED",
        "Method",
        "Reference",
        "Notes",
      ],
      ...receipts.map((r) => {
        const c = deals.find((c) => c.id === r.commission_id);
        const d = c ? labels(data, c) : null;
        return [
          r.entry_date,
          agent?.name || "",
          d?.lease?.reference || "",
          d?.property?.name || "",
          d?.tenant?.name || "",
          r.kind,
          (r.kind === "received" ? r.amount : -r.amount) / 100,
          r.method,
          r.reference,
          r.notes,
        ];
      }),
    ]);
  }
  return (
    <>
      <BackLink href="/agents">All agents</BackLink>
      <PageHeader
        title={agent.name}
        description={[agent.company, agent.phone, agent.email]
          .filter(Boolean)
          .join(" · ")}
      >
        <Badge tone={agent.status === "active" ? "success" : "neutral"}>
          {agent.status}
        </Badge>
        <Button onClick={() => setEdit(true)}>
          <PencilSimple size={17} />
          Edit agent
        </Button>
        <Button onClick={statement}>
          <DownloadSimple size={17} />
          Export statement
        </Button>
      </PageHeader>
      <div className="summary-strip">
        <div>
          <small>Linked agreements</small>
          <strong>{deals.length}</strong>
        </div>
        <div>
          <small>Agreed commission</small>
          <strong>
            <Money value={total} />
          </strong>
        </div>
        <div>
          <small>Received from customers</small>
          <strong>
            <Money value={received} />
          </strong>
        </div>
        <div>
          <small>Pending from customers</small>
          <strong>
            <Money value={total - received} />
          </strong>
        </div>
      </div>
      {deals.some((c) => c.amount === null) && (
        <p className="form-note">
          {deals.filter((c) => c.amount === null).length} agreement amount(s)
          not entered. These are excluded from totals.
        </p>
      )}
      {agent.notes && <p className="form-note">{agent.notes}</p>}
      <CommissionPanel agentId={id} />
      <section className="panel padded agent-section">
        <SectionHeader
          title="Agent wallet"
          description="Customer payments received directly by the agent. Reversals remain in the history."
        />
        <StableRegion>
          {receipts.length ? (
            <div className="table-wrap">
              <StableTable>
                <thead>
                  <tr>
                    <th>Date / Agreement</th>
                    <th>Entry</th>
                    <th>Amount</th>
                    <th>Method / Reference</th>
                    <th>Supporting file</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {wallet.visible.map((r) => {
                    const c = deals.find((c) => c.id === r.commission_id);
                    const reversed = data.agentReceipts.some(
                      (v) => v.reverses === r.id,
                    );
                    return (
                      <tr key={r.id}>
                        <td>
                          {dateLabel(r.entry_date)}
                          <small>
                            <Link
                              className="text-link"
                              href={`/agreements/${c?.lease_id}`}
                            >
                              {
                                data.leases.find((l) => l.id === c?.lease_id)
                                  ?.reference
                              }
                            </Link>
                          </small>
                        </td>
                        <td>
                          {r.kind === "reversal"
                            ? "Reversal"
                            : reversed
                              ? "Received · Reversed"
                              : "Received"}
                          <small>{r.notes}</small>
                        </td>
                        <td>
                          <Money
                            value={r.kind === "received" ? r.amount : -r.amount}
                          />
                        </td>
                        <td>
                          {r.method}
                          <small>{r.reference}</small>
                        </td>
                        <td>
                          {r.receipt_document_id ? (
                            <a
                              className="text-link"
                              href={`/api/documents/${r.receipt_document_id}/file?download=1`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Download receipt
                            </a>
                          ) : (
                            "Not attached"
                          )}
                        </td>
                        <td>
                          {r.kind === "received" && !reversed && (
                            <Button
                              variant="ghost"
                              onClick={() => setReverse(r)}
                              aria-label={`Reverse ${r.reference}`}
                            >
                              <ArrowCounterClockwise size={16} />
                              Reverse
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </StableTable>
            </div>
          ) : (
            <Empty
              title="No customer payments recorded"
              description="Open an agreement commission to record a confirmed payment to the agent."
            />
          )}
        </StableRegion>
        {receipts.length > 0 && <Pagination {...wallet} pageSize={12} />}
      </section>
      {edit && <AgentForm agent={agent} onClose={() => setEdit(false)} />}
      {reverse && (
        <ReverseReceipt receipt={reverse} onClose={() => setReverse(null)} />
      )}
    </>
  );
}

export function CommissionPanel({
  leaseId,
  buildingId,
  tenantId,
  agentId,
}: {
  leaseId?: string;
  buildingId?: string;
  tenantId?: string;
  agentId?: string;
}) {
  const { data } = useApp();
  const [query, setQuery] = useState("");
  const [property, setProperty] = useState("all");
  const [editing, setEditing] = useState<AgentCommission | "new" | null>(null);
  const [payment, setPayment] = useState<AgentCommission | null>(null);
  const scope = (c: AgentCommission) => {
    const d = labels(data, c);
    return (
      (!leaseId || c.lease_id === leaseId) &&
      (!agentId || c.agent_id === agentId) &&
      (!buildingId || d.unit?.building_id === buildingId) &&
      (!tenantId || d.lease?.tenant_id === tenantId)
    );
  };
  const scoped = data.agentCommissions.filter(scope);
  const list = useList(scoped, (c) => {
    const d = labels(data, c);
    return (
      `${d.agent?.name} ${d.tenant?.name} ${d.property?.name} ${d.lease?.reference} ${d.unit?.code}`
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (property === "all" || d.property?.id === property)
    );
  });
  if (!canManage(data)) return null;
  const existing = leaseId ? scoped[0] : null;
  function csv() {
    exportCsv(`agent-commissions-${todayDubai()}.csv`, [
      [
        "Agent",
        "Property",
        "Unit",
        "Agreement",
        "Customer",
        "Agreed AED",
        "Received directly AED",
        "Pending AED",
        "Status",
      ],
      ...scoped
        .filter((c) => {
          const d = labels(data, c);
          return (
            (property === "all" || d.property?.id === property) &&
            `${d.agent?.name} ${d.tenant?.name} ${d.property?.name} ${d.lease?.reference} ${d.unit?.code}`
              .toLowerCase()
              .includes(query.toLowerCase())
          );
        })
        .map((c) => {
          const d = labels(data, c),
            b = commissionBalance(c, data.agentReceipts);
          return [
            d.agent?.name || "",
            d.property?.name || "",
            d.unit?.code || "",
            d.lease?.reference || "",
            d.tenant?.name || "",
            c.amount === null ? "Not entered" : c.amount / 100,
            b.received / 100,
            b.pending === null ? "Not entered" : b.pending / 100,
            status(data, c),
          ];
        }),
    ]);
  }
  return (
    <section
      className="panel padded commission-panel"
      aria-label="Agent commission records"
    >
      <SectionHeader
        title={leaseId ? "Agent commission" : "Agent commissions"}
        description="One commission per annual agreement. Customer pays the agent directly; amounts are entered manually."
      >
        {!leaseId && (
          <Button onClick={csv}>
            <DownloadSimple size={16} />
            Export commissions
          </Button>
        )}
        <Button onClick={() => setEditing(existing || "new")}>
          <Plus size={16} />
          {existing ? "Edit commission" : "Record commission"}
        </Button>
      </SectionHeader>
      {!leaseId && (
        <div className="toolbar">
          <SearchInput
            value={query}
            onChange={(v) => {
              setQuery(v);
              list.setPage(1);
            }}
            placeholder="Search agent commissions…"
          />
          {!buildingId && (
            <select
              className="filter-select"
              aria-label="Commission property"
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
          )}
        </div>
      )}
      <StableRegion>
        {list.total ? (
          <>
            <div className="table-wrap">
              <StableTable>
                <thead>
                  <tr>
                    <th>Agent / Agreement</th>
                    <th>Property / Customer</th>
                    <th>Agreed commission</th>
                    <th>Received directly</th>
                    <th>Pending</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {list.visible.map((c) => {
                    const d = labels(data, c),
                      b = commissionBalance(c, data.agentReceipts);
                    return (
                      <tr key={c.id}>
                        <td>
                          <Link
                            className="text-link"
                            href={`/agents/${c.agent_id}`}
                          >
                            {d.agent?.name}
                          </Link>
                          <small>
                            <Link
                              href={`/agreements/${c.lease_id}`}
                              className="text-link"
                            >
                              {d.lease?.reference}
                            </Link>
                          </small>
                        </td>
                        <td>
                          <Link
                            className="text-link"
                            href={`/properties/${d.property?.id}`}
                          >
                            {d.property?.name} · {unitLabel(d.unit)}{" "}
                            {d.unit?.code}
                          </Link>
                          <small>{d.tenant?.name}</small>
                        </td>
                        <td>
                          <Value amount={c.amount} />
                        </td>
                        <td>
                          <Money value={b.received} />
                        </td>
                        <td>
                          <Value amount={b.pending} />
                        </td>
                        <td>
                          <Badge tone={b.pending === 0 ? "success" : "warning"}>
                            {status(data, c)}
                          </Badge>
                        </td>
                        <td>
                          <div className="commission-actions">
                            {!leaseId && (
                              <Button
                                variant="ghost"
                                onClick={() => setEditing(c)}
                                aria-label={`Edit commission ${d.lease?.reference}`}
                              >
                                <PencilSimple size={16} />
                              </Button>
                            )}
                            <Button
                              disabled={b.pending === null || b.pending === 0}
                              onClick={() => setPayment(c)}
                              aria-label={`Record customer payment ${d.lease?.reference}`}
                            >
                              Record payment
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </StableTable>
            </div>
            {!leaseId && <Pagination {...list} />}
          </>
        ) : (
          <Empty
            title="No agent commission recorded"
            description="Choose an agent and enter the agreed amount when it is known."
          />
        )}
      </StableRegion>
      {leaseId && existing && (
        <details className="commission-history">
          <summary>Commission change history</summary>
          {data.agentCommissionEvents
            .filter((e) => e.commission_id === existing.id)
            .map((e) => (
              <div key={e.id}>
                <strong>
                  {dateLabel(e.created_at)} ·{" "}
                  {data.agents.find((a) => a.id === e.new_agent_id)?.name}
                </strong>
                <p>
                  {e.old_agent_id ? (
                    <>
                      <Value amount={e.old_amount} /> →{" "}
                    </>
                  ) : null}
                  <Value amount={e.new_amount} /> · {e.reason}
                </p>
              </div>
            ))}
        </details>
      )}
      {editing && (
        <CommissionForm
          commission={editing === "new" ? undefined : editing}
          leaseId={leaseId}
          buildingId={buildingId}
          tenantId={tenantId}
          agentId={agentId}
          onClose={() => setEditing(null)}
        />
      )}
      {payment && (
        <ReceiptForm commission={payment} onClose={() => setPayment(null)} />
      )}
    </section>
  );
}

function AgentForm({ agent, onClose }: { agent?: Agent; onClose: () => void }) {
  const { mutate, notify } = useApp();
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError("");
    try {
      await mutate("agent", {
        ...Object.fromEntries(new FormData(e.currentTarget)),
        ...(agent ? { id: agent.id } : {}),
      });
      notify("Agent saved.");
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save agent");
      setPending(false);
    }
  }
  return (
    <Modal
      title={agent ? "Edit agent" : "Add agent"}
      onClose={pending ? () => {} : onClose}
    >
      <form onSubmit={submit}>
        <div className="form-grid">
          <Field label="Agent name">
            <input
              name="name"
              required
              maxLength={160}
              defaultValue={agent?.name || ""}
            />
          </Field>
          <Field label="Phone">
            <input
              name="phone"
              type="tel"
              maxLength={40}
              defaultValue={agent?.phone || ""}
            />
          </Field>
          <Field label="Email">
            <input
              name="email"
              type="email"
              maxLength={180}
              defaultValue={agent?.email || ""}
            />
          </Field>
          <Field label="Company">
            <input
              name="company"
              maxLength={160}
              defaultValue={agent?.company || ""}
            />
          </Field>
          <Field label="Status">
            <select name="status" defaultValue={agent?.status || "active"}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </Field>
          <Field wide label="Notes">
            <textarea
              name="notes"
              maxLength={2000}
              defaultValue={agent?.notes || ""}
            />
          </Field>
        </div>
        <ErrorText message={error} />
        <SaveFooter pending={pending} onClose={onClose} label="Save agent" />
      </form>
    </Modal>
  );
}

function CommissionForm({
  commission,
  leaseId,
  buildingId,
  tenantId,
  agentId,
  onClose,
}: {
  commission?: AgentCommission;
  leaseId?: string;
  buildingId?: string;
  tenantId?: string;
  agentId?: string;
  onClose: () => void;
}) {
  const { data, mutate, notify } = useApp();
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError("");
    const fields = Object.fromEntries(new FormData(e.currentTarget));
    try {
      await mutate("agent_commission", {
        ...fields,
        ...(commission
          ? {
              id: commission.id,
              lease_id: commission.lease_id,
              expected_revision: commission.revision,
            }
          : {}),
      });
      notify("Commission record saved.");
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save commission");
      setPending(false);
    }
  }
  return (
    <Modal
      title={commission ? "Edit commission" : "Record agent commission"}
      description="Customer pays the agent directly. Enter the agreed amount; leave it blank if not agreed yet."
      onClose={pending ? () => {} : onClose}
    >
      <form onSubmit={submit}>
        <div className="form-grid">
          <Field wide label="Agreement">
            <select
              name="lease_id"
              required
              defaultValue={commission?.lease_id || leaseId || ""}
              disabled={!!commission}
            >
              <option value="">Choose an agreement</option>
              {data.leases
                .filter((l) => {
                  const u = data.units.find((u) => u.id === l.unit_id);
                  return (
                    (!buildingId || u?.building_id === buildingId) &&
                    (!tenantId || l.tenant_id === tenantId) &&
                    (!leaseId || l.id === leaseId)
                  );
                })
                .map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.reference} ·{" "}
                    {data.tenants.find((t) => t.id === l.tenant_id)?.name}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Agent">
            <select
              name="agent_id"
              required
              defaultValue={commission?.agent_id || agentId || ""}
            >
              <option value="">Choose an agent</option>
              {data.agents
                .filter(
                  (a) => a.status === "active" || a.id === commission?.agent_id,
                )
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                    {a.status === "inactive" ? " · Inactive" : ""}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Commission amount (AED)">
            <input
              name="amount"
              type="number"
              min="0"
              step="0.01"
              max="99999999"
              defaultValue={
                commission?.amount == null ? "" : commission.amount / 100
              }
            />
          </Field>
          <Field wide label="Notes">
            <textarea
              name="notes"
              maxLength={1000}
              defaultValue={commission?.notes || ""}
            />
          </Field>
          {commission && (
            <Field wide label="Reason for change">
              <textarea name="reason" required maxLength={1000} />
            </Field>
          )}
        </div>
        <ErrorText message={error} />
        <SaveFooter
          pending={pending}
          onClose={onClose}
          label="Save commission"
        />
      </form>
    </Modal>
  );
}

function ReceiptForm({
  commission,
  onClose,
}: {
  commission: AgentCommission;
  onClose: () => void;
}) {
  const { data, mutate, notify } = useApp();
  const [pending, setPending] = useState(false),
    [error, setError] = useState(""),
    [method, setMethod] = useState("bank"),
    [upload, setUpload] = useState(false);
  const [requestKey] = useState(() => crypto.randomUUID());
  const current =
    data.agentCommissions.find((c) => c.id === commission.id) || commission;
  const balance = commissionBalance(current, data.agentReceipts);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError("");
    const form = new FormData(e.currentTarget);
    try {
      await mutate("agent_receipt", {
        ...Object.fromEntries(form),
        commission_id: commission.id,
        request_key: requestKey,
        confirmed: form.get("confirmed") === "on",
      });
      notify("Direct customer payment recorded.");
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not record payment");
      setPending(false);
    }
  }
  return (
    <Modal
      title="Record customer payment"
      description="Record money the customer paid directly to the agent."
      onClose={pending ? () => {} : onClose}
    >
      <form onSubmit={submit}>
        <div className="form-grid">
          <p className="form-note span-2">
            Pending from customer: <Value amount={balance.pending} />
          </p>
          <Field label="Amount received (AED)">
            <input
              name="amount"
              type="number"
              required
              min="0.01"
              max={balance.pending == null ? undefined : balance.pending / 100}
              step="0.01"
            />
          </Field>
          <Field label="Payment date">
            <input
              name="entry_date"
              type="date"
              required
              max={todayDubai()}
              defaultValue={todayDubai()}
            />
          </Field>
          <Field label="Payment method">
            <select
              name="method"
              value={method}
              onChange={(e) => setMethod(e.target.value)}
            >
              <option value="bank">Bank transfer</option>
              <option value="cash">Cash</option>
              <option value="cheque">Cleared cheque</option>
            </select>
          </Field>
          <Field label="Payment reference">
            <input name="reference" required maxLength={120} />
          </Field>
          <Field wide label="Receipt document">
            <select name="receipt_document_id" defaultValue="">
              <option value="">No file attached</option>
              {data.documents
                .filter(
                  (d) =>
                    d.target_type === "lease" &&
                    d.target_id === commission.lease_id &&
                    d.status === "current",
                )
                .map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
            </select>
          </Field>
          <div className="span-2">
            <Button type="button" onClick={() => setUpload(true)}>
              <UploadSimple size={16} />
              Upload receipt
            </Button>
            <p className="form-note">
              After upload, choose the supporting file above.
            </p>
          </div>
          <Field wide label="Notes">
            <textarea name="notes" maxLength={1000} />
          </Field>
          <label className="commission-confirm span-2">
            <input type="checkbox" name="confirmed" required />
            {method === "cheque"
              ? "I confirm the cheque cleared and the agent received the payment."
              : "I confirm the customer paid the agent directly."}
          </label>
        </div>
        <ErrorText message={error} />
        <SaveFooter
          pending={pending}
          onClose={onClose}
          label="Record direct payment"
        />
      </form>
      {upload && (
        <UploadModal
          targetType="lease"
          targetId={commission.lease_id}
          defaultCategory="Other"
          onClose={() => setUpload(false)}
        />
      )}
    </Modal>
  );
}

function ReverseReceipt({
  receipt,
  onClose,
}: {
  receipt: AgentReceipt;
  onClose: () => void;
}) {
  const { mutate, notify } = useApp();
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const [requestKey] = useState(() => crypto.randomUUID());
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError("");
    const form = new FormData(e.currentTarget);
    try {
      await mutate("agent_receipt_reverse", {
        id: receipt.id,
        request_key: requestKey,
        reason: form.get("reason"),
      });
      notify("Payment reversed. The original remains in history.");
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not reverse payment");
      setPending(false);
    }
  }
  return (
    <Modal
      title="Reverse payment record"
      description="Use this to correct an incorrect payment record. This does not transfer or refund money."
      onClose={pending ? () => {} : onClose}
    >
      <form onSubmit={submit}>
        <div className="form-grid">
          <p className="span-2">
            {receipt.reference} · <Money value={receipt.amount} />
          </p>
          <Field wide label="Reversal reason">
            <textarea name="reason" required maxLength={1000} />
          </Field>
        </div>
        <ErrorText message={error} />
        <SaveFooter
          pending={pending}
          onClose={onClose}
          label="Reverse payment"
        />
      </form>
    </Modal>
  );
}

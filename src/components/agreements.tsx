"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle, Plus, Printer } from "@phosphor-icons/react";
import { dateLabel, daysUntil, todayDubai } from "@/lib/domain";
import { useApp } from "./provider";
import {
  BackLink,
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
  useList,
} from "./ui";
import { DocumentPanel } from "./documents";
import { ChequeTable } from "./accounts";
import { ParkingAssignments } from "./parking-allocations";
export function Agreements({
  initialStatus = "all",
}: {
  initialStatus?: string;
}) {
  const { data, openForm } = useApp();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState(initialStatus);
  const today = todayDubai();
  const label = (l: (typeof data.leases)[number]) =>
    l.status === "ended"
      ? "Ended"
      : l.end_date < today
        ? "Expired"
        : l.start_date > today
          ? "Upcoming"
          : "Active";
  const list = useList(
    data.leases,
    (l) =>
      `${l.reference} ${data.tenants.find((t) => t.id === l.tenant_id)?.name} ${data.units.find((u) => u.id === l.unit_id)?.code}`
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (status === "all" ||
        (status === "expiring"
          ? l.status === "active" &&
            l.start_date <= today &&
            daysUntil(l.end_date) >= 0 &&
            daysUntil(l.end_date) <= 30
          : label(l).toLowerCase() === status)),
  );
  return (
    <>
      <PageHeader title="Agreements">
        {["owner", "manager"].includes(data.membership.role) && (
          <Button variant="primary" onClick={() => openForm("lease")}>
            <Plus size={18} />
            Create agreement
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
          placeholder="Search agreements, tenants or flats…"
        />
        <select
          className="filter-select"
          aria-label="Agreement status"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            list.setPage(1);
          }}
        >
          <option value="all">All agreements</option>
          <option value="expiring">Ending within 30 days</option>
          {["Active", "Upcoming", "Expired", "Ended"].map((s) => (
            <option key={s} value={s.toLowerCase()}>
              {s}
            </option>
          ))}
        </select>
        <span className="toolbar-spacer" />
        <span className="filter-label">{list.total} agreements</span>
      </div>
      <div className="panel">
        {list.total ? (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Agreement</th>
                    <th>Tenant</th>
                    <th>Property / Flat</th>
                    <th>Annual rent</th>
                    <th>Term</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {list.visible.map((l) => {
                    const u = data.units.find((u) => u.id === l.unit_id);
                    const b = data.buildings.find(
                      (b) => b.id === u?.building_id,
                    );
                    const s = label(l);
                    return (
                      <tr key={l.id}>
                        <td>
                          <Link
                            href={`/agreements/${l.id}`}
                            className="text-link"
                          >
                            {l.reference}
                          </Link>
                          <small>{l.installments} rent cheques</small>
                        </td>
                        <td>
                          <Link
                            href={`/tenants/${l.tenant_id}`}
                            className="text-link"
                          >
                            {
                              data.tenants.find((t) => t.id === l.tenant_id)
                                ?.name
                            }
                          </Link>
                        </td>
                        <td>
                          <strong>{b?.name}</strong>
                          <small>
                            Flat {u?.code} · {u?.category}
                          </small>
                        </td>
                        <td>
                          <strong>
                            <Money value={l.annual_rent} />
                          </strong>
                        </td>
                        <td>
                          {dateLabel(l.start_date)}
                          <small>to {dateLabel(l.end_date)}</small>
                        </td>
                        <td>
                          <Badge
                            tone={
                              s === "Active"
                                ? "success"
                                : s === "Upcoming"
                                  ? "warning"
                                  : "neutral"
                            }
                          >
                            {s}
                          </Badge>
                        </td>
                        <td>
                          <Link
                            className="text-link"
                            href={`/agreements/${l.id}`}
                            aria-label={`View agreement ${l.reference}`}
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
            <Pagination {...list} />
          </>
        ) : (
          <Empty
            title="No agreements in this view"
            description={
              data.leases.length
                ? "Try another search or status."
                : "Choose a tenant and flat to create your first annual agreement."
            }
          />
        )}
      </div>
    </>
  );
}
export function AgreementDetail({ id }: { id: string }) {
  const { data, mutate, openForm, notify } = useApp();
  const lease = data.leases.find((l) => l.id === id);
  const [close, setClose] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  if (!lease)
    return (
      <>
        <BackLink href="/agreements">All agreements</BackLink>
        <Empty
          title="Agreement not found"
          description="This agreement is not in your current workspace."
        />
      </>
    );
  const tenant = data.tenants.find((t) => t.id === lease.tenant_id);
  const unit = data.units.find((u) => u.id === lease.unit_id);
  const building = data.buildings.find((b) => b.id === unit?.building_id);
  const cheques = data.cheques
    .filter((c) => c.lease_id === id)
    .sort((a, b) => a.due_date.localeCompare(b.due_date));
  const paid = -data.ledger
    .filter((e) => e.lease_id === id && e.kind === "payment")
    .reduce((s, e) => s + e.amount, 0);
  const parking = data.parkingAllocations.filter(
    (a) => a.lease_id === id && a.status === "active",
  );
  const parkingTotal = parking.reduce((s, a) => s + a.annual_charge, 0);
  const manage = ["owner", "manager"].includes(data.membership.role);
  async function end() {
    setPending(true);
    try {
      await mutate("end_lease", { id, on_date: todayDubai() });
      notify("Agreement closed. The full history is preserved.");
      setClose(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not close agreement",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <>
      <BackLink href="/agreements">All agreements</BackLink>
      <PageHeader
        title={lease.reference}
        description={`${tenant?.name} · ${building?.name} · Flat ${unit?.code}`}
      >
        <Button onClick={() => window.print()}>
          <Printer size={17} />
          Print draft summary
        </Button>
        {manage && lease.end_date <= todayDubai() && (
          <Button
            onClick={() =>
              openForm("lease", {
                tenant_id: lease.tenant_id,
                unit_id: lease.unit_id,
              })
            }
          >
            <Plus size={17} />
            Renew agreement
          </Button>
        )}
        {manage &&
          lease.status === "active" &&
          lease.end_date <= todayDubai() && (
            <Button onClick={() => setClose(true)}>
              <CheckCircle size={17} />
              Close agreement
            </Button>
          )}
      </PageHeader>
      <div className="summary-strip no-print">
        <div>
          <small>Total contract</small>
          <strong>
            <Money value={lease.annual_rent + parkingTotal} />
          </strong>
        </div>
        <div>
          <small>Payments received by cheque</small>
          <strong>
            <Money value={paid} />
          </strong>
        </div>
        <div>
          <small>Cheque schedule</small>
          <strong>{lease.installments} cheques</strong>
        </div>
        <div>
          <small>Agreement status</small>
          <strong>
            {lease.status === "ended"
              ? "Ended"
              : lease.end_date < todayDubai()
                ? "Expired"
                : lease.start_date > todayDubai()
                  ? "Upcoming"
                  : "Active"}
          </strong>
        </div>
      </div>
      <section className="panel agreement-preview">
        <div className="document-heading">
          <div>
            <h2>Tenancy agreement summary</h2>
            <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
              {data.workspace.name}
            </p>
          </div>
          <div>
            <Badge tone="warning">Unsigned draft</Badge>
            <p style={{ fontSize: 12, marginTop: 12 }}>{lease.reference}</p>
          </div>
        </div>
        <div className="document-disclaimer">
          This is an internal draft summary for review. Upload the actual signed
          contract below as the authoritative agreement.
        </div>
        <h3>Parties & property</h3>
        <dl className="metadata-grid">
          <div>
            <dt>Property manager</dt>
            <dd>{data.workspace.name}</dd>
          </div>
          <div>
            <dt>Tenant</dt>
            <dd>{tenant?.name}</dd>
          </div>
          <div>
            <dt>Contact</dt>
            <dd>{tenant?.phone}</dd>
          </div>
          <div>
            <dt>Property</dt>
            <dd>{building?.name}</dd>
          </div>
          <div>
            <dt>Flat</dt>
            <dd>
              {unit?.code} · {unit?.category}
            </dd>
          </div>
          <div>
            <dt>Address</dt>
            <dd>{building?.address || building?.area}</dd>
          </div>
        </dl>
        <h3>Term & rent</h3>
        <dl className="metadata-grid">
          <div>
            <dt>Start date</dt>
            <dd>{dateLabel(lease.start_date)}</dd>
          </div>
          <div>
            <dt>End date</dt>
            <dd>{dateLabel(lease.end_date)}</dd>
          </div>
          <div>
            <dt>Annual agreed rent</dt>
            <dd>
              <Money value={lease.annual_rent} />
            </dd>
          </div>
          <div>
            <dt>Payment plan</dt>
            <dd>{lease.installments} cheques</dd>
          </div>
          <div>
            <dt>Flat amenities</dt>
            <dd>
              {unit?.amenities.join(", ") || "None additionally recorded"}
            </dd>
          </div>
          <div>
            <dt>Security</dt>
            <dd>Recorded separately in the tenant account</dd>
          </div>
        </dl>
        <h3>Reserved parking spaces</h3>
        {parking.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Property</th>
                  <th>Parking space</th>
                  <th>Annual charge</th>
                </tr>
              </thead>
              <tbody>
                {parking.map((a) => (
                  <tr key={a.id}>
                    <td>{a.property_label}</td>
                    <td>{a.lot_label}</td>
                    <td>
                      <Money value={a.annual_charge} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted">No paid parking included in this agreement.</p>
        )}
        <div className="contract-parking-total">
          <span>
            Flat rent <Money value={lease.annual_rent} />
          </span>
          <span>
            Parking <Money value={parkingTotal} />
          </span>
          <strong>
            Total contract <Money value={lease.annual_rent + parkingTotal} />
          </strong>
        </div>
        {lease.notes && (
          <>
            <h3>Additional notes</h3>
            <p style={{ fontSize: 12, color: "var(--muted)" }}>{lease.notes}</p>
          </>
        )}
        <h3>Rent cheque schedule</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Number</th>
                <th>Due date</th>
                <th>Bank</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {cheques.map((c) => (
                <tr key={c.id}>
                  <td>{c.number}</td>
                  <td>{dateLabel(c.due_date)}</td>
                  <td>{c.bank || "Not entered"}</td>
                  <td>
                    <Money value={c.amount} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="signature-grid">
          <div>Property manager signature / date</div>
          <div>Tenant signature / date</div>
        </div>
      </section>
      <div className="parking-section no-print">
        <ParkingAssignments leaseId={id} />
      </div>
      <div style={{ marginTop: 24 }} className="no-print">
        <DocumentPanel
          targetType="lease"
          targetId={id}
          title="Signed contract & supporting files"
        />
      </div>
      <section className="panel no-print" style={{ marginTop: 24 }}>
        <div className="panel-header">
          <SectionHeader title="Cheque tracking" />
        </div>
        <ChequeTable cheques={cheques} />
      </section>
      {close && (
        <Modal
          title="Close this agreement?"
          description="Use this when the tenancy term has finished. Charges, cheque records and documents remain available."
          onClose={() => setClose(false)}
        >
          <ErrorText message={error} />
          <div className="modal-footer">
            <Button disabled={pending} onClick={() => setClose(false)}>
              Cancel
            </Button>
            <Button variant="primary" disabled={pending} onClick={end}>
              {pending ? "Closing…" : "Close agreement"}
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}

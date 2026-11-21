"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Car, Plus, X } from "@phosphor-icons/react";
import {
  annualParkingCharge,
  dateLabel,
  parkingAvailable,
  todayDubai,
  unitLabel,
  type AppData,
  type Lease,
} from "@/lib/domain";
import { useApp } from "./provider";
import {
  StableTable,
  Badge,
  Button,
  ErrorText,
  Field,
  Modal,
  Money,
  SaveFooter,
  SectionHeader,
} from "./ui";

export function canAmendParking(data: AppData, lease: Lease) {
  const cheques = data.cheques.filter(
    (c) => c.lease_id === lease.id && c.purpose === "rent",
  );
  return (
    lease.status === "active" &&
    lease.end_date >= todayDubai() &&
    cheques.length === lease.installments &&
    cheques.every((c) => c.status === "scheduled")
  );
}

export function ParkingAssignmentForm({
  leaseId,
  onClose,
}: {
  leaseId?: string;
  onClose: () => void;
}) {
  const { data, mutate, notify } = useApp();
  const eligible = data.leases.filter((l) => canAmendParking(data, l));
  const [selectedLease, setSelectedLease] = useState(
    leaseId ?? eligible[0]?.id ?? "",
  );
  const [selected, setSelected] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const lease = data.leases.find((l) => l.id === selectedLease);
  const unit = data.units.find((u) => u.id === lease?.unit_id);
  const lots = data.parkingLots
    .filter((l) => l.building_id === unit?.building_id)
    .sort((a, b) =>
      a.number.localeCompare(b.number, undefined, { numeric: true }),
    );
  const total = lots
    .filter((l) => selected.includes(l.id))
    .reduce((s, l) => s + annualParkingCharge(l), 0);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!selected.length) {
      setError("Select at least one available parking lot.");
      return;
    }
    setPending(true);
    try {
      await mutate("parking_allocate", {
        lease_id: selectedLease,
        lot_ids: selected,
      });
      notify("Parking reserved and the agreement cheque schedule updated.");
      onClose();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Could not reserve parking",
      );
      setPending(false);
    }
  }
  return (
    <Modal
      title="Allocate parking"
      description="Choose spaces in the same building for the full agreement term."
      onClose={pending ? () => {} : onClose}
      wide
    >
      <form onSubmit={submit}>
        <div className="form-grid">
          <Field wide label="Tenant agreement">
            <select
              required
              value={selectedLease}
              onChange={(e) => {
                setSelectedLease(e.target.value);
                setSelected([]);
              }}
            >
              <option value="">Choose an agreement</option>
              {eligible.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.reference} ·{" "}
                  {data.tenants.find((t) => t.id === l.tenant_id)?.name} ·{" "}
                  {unitLabel(data.units.find((u) => u.id === l.unit_id))}{" "}
                  {data.units.find((u) => u.id === l.unit_id)?.code}
                </option>
              ))}
            </select>
          </Field>
          {lease && (
            <div className="parking-contract-term span-2">
              <strong>
                {data.buildings.find((b) => b.id === unit?.building_id)?.name}
              </strong>
              <span>
                {dateLabel(lease.start_date)} to {dateLabel(lease.end_date)}
              </span>
            </div>
          )}
          <fieldset className="parking-picker span-2">
            <legend>Available parking lots</legend>
            {lots.length ? (
              lots.map((lot) => {
                const available = Boolean(
                  lease &&
                  lot.rate_amount &&
                  parkingAvailable(
                    data.parkingAllocations,
                    lot,
                    lease.start_date,
                    lease.end_date,
                  ),
                );
                return (
                  <label
                    key={lot.id}
                    className={available ? "" : "unavailable"}
                  >
                    <input
                      type="checkbox"
                      checked={selected.includes(lot.id)}
                      disabled={!available || pending}
                      onChange={(e) =>
                        setSelected((ids) =>
                          e.target.checked
                            ? [...ids, lot.id]
                            : ids.filter((id) => id !== lot.id),
                        )
                      }
                    />
                    <span>
                      <strong>Lot {lot.number}</strong>
                      <small>
                        {data.floors.find((f) => f.id === lot.floor_id)?.name ??
                          "No level recorded"}
                        {!available
                          ? lot.rate_amount
                            ? " · Unavailable for these dates"
                            : " · Set a rate first"
                          : ""}
                      </small>
                    </span>
                    <span className="parking-picker-price">
                      {lot.rate_amount ? (
                        <>
                          <Money value={annualParkingCharge(lot)} />
                          <small>per agreement year</small>
                        </>
                      ) : (
                        "Rate not entered"
                      )}
                    </span>
                  </label>
                );
              })
            ) : (
              <p className="muted">
                Add numbered parking lots and their rates for this building
                first.
              </p>
            )}
          </fieldset>
          <div className="schedule-preview span-2">
            <div>
              <strong>Parking added to the agreement</strong>
              <Money value={total} />
            </div>
            <p>
              {lease
                ? `${lease.installments} rent cheques will include the combined rent and parking charges.`
                : "Choose an agreement with scheduled cheques. Parking changes are locked after cheques are received or processed."}
            </p>
          </div>
        </div>
        <ErrorText message={error} />
        <SaveFooter
          pending={pending}
          onClose={onClose}
          label="Reserve parking"
        />
      </form>
    </Modal>
  );
}

export function ParkingAssignments({
  leaseId,
  tenantId,
}: {
  leaseId?: string;
  tenantId?: string;
}) {
  const { data, mutate, notify } = useApp();
  const [assign, setAssign] = useState(false);
  const [cancel, setCancel] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const records = data.parkingAllocations.filter(
    (a) =>
      (!leaseId || a.lease_id === leaseId) &&
      (!tenantId || a.tenant_id === tenantId),
  );
  const lease = data.leases.find((l) => l.id === leaseId);
  const manage = ["owner", "manager"].includes(data.membership.role);
  async function remove() {
    if (!cancel) return;
    setPending(true);
    setError("");
    try {
      await mutate("parking_cancel", { id: cancel });
      notify(
        "Parking removed from the draft agreement. Charges and cheques updated.",
      );
      setCancel(null);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Could not remove this reservation",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <section className="panel parking-assignments">
      <div className="panel-header">
        <SectionHeader title="Parking allocations">
          {manage && lease && canAmendParking(data, lease) && (
            <Button className="no-print" onClick={() => setAssign(true)}>
              <Plus size={16} />
              Add parking
            </Button>
          )}
        </SectionHeader>
      </div>
      {records.length ? (
        <div className="table-wrap">
          <StableTable>
            <thead>
              <tr>
                <th>Parking space</th>
                {!tenantId && <th>Tenant</th>}
                <th>Agreement / Term</th>
                <th className="align-right">Annual parking</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {records.map((record) => {
                const agreement = data.leases.find(
                  (l) => l.id === record.lease_id,
                );
                return (
                  <tr key={record.id}>
                    <td>
                      <strong>{record.lot_label}</strong>
                      <small>{record.property_label}</small>
                    </td>
                    {!tenantId && (
                      <td>
                        <Link
                          className="text-link"
                          href={`/tenants/${record.tenant_id}`}
                        >
                          {
                            data.tenants.find((t) => t.id === record.tenant_id)
                              ?.name
                          }
                        </Link>
                      </td>
                    )}
                    <td>
                      <Link
                        className="text-link"
                        href={`/agreements/${record.lease_id}`}
                      >
                        {agreement?.reference}
                      </Link>
                      <small>
                        {dateLabel(record.start_date)} to{" "}
                        {dateLabel(record.end_date)}
                      </small>
                    </td>
                    <td>
                      <Money value={record.annual_charge} />
                    </td>
                    <td>
                      <Badge
                        tone={
                          record.status === "cancelled"
                            ? "neutral"
                            : record.end_date < todayDubai()
                              ? "neutral"
                              : record.start_date > todayDubai()
                                ? "warning"
                                : "success"
                        }
                      >
                        {record.status === "cancelled"
                          ? "Cancelled"
                          : record.end_date < todayDubai()
                            ? "Term ended"
                            : record.start_date > todayDubai()
                              ? "Reserved"
                              : "Allocated"}
                      </Badge>
                    </td>
                    <td>
                      {manage &&
                        record.status === "active" &&
                        agreement &&
                        canAmendParking(data, agreement) && (
                          <Button
                            variant="ghost"
                            className="icon-button no-print"
                            aria-label={`Remove parking ${record.lot_label}`}
                            onClick={() => {
                              setCancel(record.id);
                              setError("");
                            }}
                          >
                            <X size={16} />
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
        <div className="parking-empty">
          <Car size={24} />
          <div>
            <strong>No parking allocated yet</strong>
            <p>
              Choose numbered spaces when creating an agreement, or add them
              while its cheques are still scheduled.
            </p>
          </div>
        </div>
      )}
      {assign && (
        <ParkingAssignmentForm
          leaseId={leaseId}
          onClose={() => setAssign(false)}
        />
      )}
      {cancel && (
        <Modal
          title="Remove parking from draft agreement?"
          description="The reservation will be cancelled, its charge reversed and the scheduled cheques recalculated. The history will be preserved."
          onClose={pending ? () => {} : () => setCancel(null)}
        >
          <div className="modal-message">
            <ErrorText message={error} />
          </div>
          <div className="modal-footer">
            <Button onClick={() => setCancel(null)} disabled={pending}>
              Keep reservation
            </Button>
            <Button variant="danger" onClick={remove} disabled={pending}>
              {pending ? "Updating…" : "Remove parking"}
            </Button>
          </div>
        </Modal>
      )}
    </section>
  );
}

"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Car, PencilSimple, Plus } from "@phosphor-icons/react";
import { dateLabel, todayDubai, type ParkingLot } from "@/lib/domain";
import { useApp } from "./provider";
import {
  ParkingAssignments,
  ParkingAssignmentForm,
  canAmendParking,
} from "./parking-allocations";
import {
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
  useList,
} from "./ui";

export function Parking() {
  const { data } = useApp();
  const [query, setQuery] = useState("");
  const [property, setProperty] = useState("all");
  const [edit, setEdit] = useState<ParkingLot | null | undefined>(undefined);
  const [assign, setAssign] = useState(false);
  const today = todayDubai();
  const manage = ["owner", "manager"].includes(data.membership.role);
  const current = data.parkingAllocations.filter(
    (a) =>
      a.status === "active" && a.start_date <= today && a.end_date >= today,
  );
  const occupiedIds = new Set(current.map((a) => a.lot_id));
  const list = useList(
    [...data.parkingLots].sort((a, b) =>
      a.number.localeCompare(b.number, undefined, { numeric: true }),
    ),
    (lot) =>
      `${lot.number} ${data.buildings.find((b) => b.id === lot.building_id)?.name}`
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (property === "all" || lot.building_id === property),
  );
  return (
    <>
      <PageHeader title="Parking control">
        {manage && data.leases.some((l) => canAmendParking(data, l)) && (
          <Button onClick={() => setAssign(true)}>
            <Car size={18} />
            Allocate parking
          </Button>
        )}
        {manage && (
          <Button variant="primary" onClick={() => setEdit(null)}>
            <Plus size={18} />
            Add parking lot
          </Button>
        )}
      </PageHeader>
      <div className="summary-strip">
        <div>
          <small>Registered parking lots</small>
          <strong>{data.parkingLots.length}</strong>
        </div>
        <div>
          <small>Available today</small>
          <strong>
            {
              data.parkingLots.filter(
                (l) => l.status === "available" && !occupiedIds.has(l.id),
              ).length
            }
          </strong>
        </div>
        <div>
          <small>Currently allocated</small>
          <strong>{occupiedIds.size}</strong>
        </div>
        <div>
          <small>Blocked spaces</small>
          <strong>
            {data.parkingLots.filter((l) => l.status === "blocked").length}
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
          placeholder="Search parking number or property…"
        />
        <select
          className="filter-select"
          aria-label="Parking property"
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
        <span className="toolbar-spacer" />
        <span className="filter-label">{list.total} parking lots</span>
      </div>
      <section className="panel">
        {list.total ? (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Parking lot</th>
                    <th>Property / Level</th>
                    <th>Reference rate</th>
                    <th>Availability</th>
                    <th>Tenant / Agreement</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {list.visible.map((lot) => {
                    const booking = current.find((a) => a.lot_id === lot.id);
                    const future = data.parkingAllocations.find(
                      (a) =>
                        a.lot_id === lot.id &&
                        a.status === "active" &&
                        a.start_date > today,
                    );
                    return (
                      <tr key={lot.id}>
                        <td>
                          <strong className="parking-number">
                            <Car size={18} />
                            {lot.number}
                          </strong>
                          <small>{lot.notes}</small>
                        </td>
                        <td>
                          <Link
                            href={`/properties/${lot.building_id}`}
                            className="text-link"
                          >
                            {
                              data.buildings.find(
                                (b) => b.id === lot.building_id,
                              )?.name
                            }
                          </Link>
                          <small>
                            {data.floors.find((f) => f.id === lot.floor_id)
                              ?.name ?? "No level recorded"}
                          </small>
                        </td>
                        <td>
                          {lot.rate_amount ? (
                            <>
                              <Money value={lot.rate_amount} />
                              <small>
                                per{" "}
                                {lot.rate_period === "monthly"
                                  ? "month"
                                  : "year"}
                              </small>
                            </>
                          ) : (
                            <span className="muted">Rate not entered</span>
                          )}
                        </td>
                        <td>
                          <Badge
                            tone={
                              lot.status === "blocked"
                                ? "neutral"
                                : booking
                                  ? "warning"
                                  : "success"
                            }
                          >
                            {lot.status === "blocked"
                              ? "Blocked"
                              : booking
                                ? "Allocated"
                                : "Available today"}
                          </Badge>
                          {future && !booking && (
                            <small>
                              Reserved from {dateLabel(future.start_date)}
                            </small>
                          )}
                        </td>
                        <td>
                          {booking ? (
                            <>
                              <Link
                                href={`/tenants/${booking.tenant_id}`}
                                className="text-link"
                              >
                                {
                                  data.tenants.find(
                                    (t) => t.id === booking.tenant_id,
                                  )?.name
                                }
                              </Link>
                              <small>
                                <Link href={`/agreements/${booking.lease_id}`}>
                                  {
                                    data.leases.find(
                                      (l) => l.id === booking.lease_id,
                                    )?.reference
                                  }
                                </Link>
                              </small>
                            </>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td>
                          {manage && (
                            <Button
                              variant="ghost"
                              className="icon-button"
                              aria-label={`Edit parking ${lot.number}`}
                              onClick={() => setEdit(lot)}
                            >
                              <PencilSimple size={17} />
                            </Button>
                          )}
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
            title={
              data.parkingLots.length
                ? "No parking lots match"
                : "Add your numbered parking spaces"
            }
            description={
              data.parkingLots.length
                ? "Try another property or parking number."
                : "Enter the lot numbers in your buildings, then link the required spaces to a tenant agreement."
            }
          >
            {manage && !data.parkingLots.length && (
              <Button onClick={() => setEdit(null)}>
                <Plus size={16} />
                Add first parking lot
              </Button>
            )}
          </Empty>
        )}
      </section>
      {edit !== undefined && (
        <ParkingLotForm lot={edit} onClose={() => setEdit(undefined)} />
      )}
      <div className="parking-section">
        <ParkingAssignments />
      </div>
      {assign && <ParkingAssignmentForm onClose={() => setAssign(false)} />}
    </>
  );
}

function ParkingLotForm({
  lot,
  onClose,
}: {
  lot: ParkingLot | null;
  onClose: () => void;
}) {
  const { data, mutate, notify } = useApp();
  const [building, setBuilding] = useState(
    lot?.building_id ?? data.buildings[0]?.id ?? "",
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPending(true);
    try {
      await mutate("parking_lot", {
        ...Object.fromEntries(new FormData(event.currentTarget)),
        ...(lot ? { id: lot.id } : {}),
      });
      notify(`Parking lot ${lot ? "updated" : "added"}.`);
      onClose();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Could not save this parking lot",
      );
      setPending(false);
    }
  }
  return (
    <Modal
      title={lot ? "Edit parking lot" : "Add parking lot"}
      onClose={pending ? () => {} : onClose}
      wide
    >
      <form onSubmit={submit}>
        <div className="form-grid">
          <Field label="Parking number">
            <input
              name="number"
              required
              maxLength={40}
              defaultValue={lot?.number ?? ""}
              placeholder="Enter the marked lot number"
            />
          </Field>
          <Field label="Property">
            <select
              name="building_id"
              required
              value={building}
              onChange={(e) => setBuilding(e.target.value)}
            >
              <option value="">Choose property</option>
              {data.buildings.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Parking level">
            <select
              key={building}
              name="floor_id"
              defaultValue={
                lot?.building_id === building ? (lot.floor_id ?? "") : ""
              }
            >
              <option value="">No level assigned</option>
              {data.floors
                .filter(
                  (f) =>
                    f.building_id === building &&
                    !["service", "residential"].includes(f.purpose),
                )
                .sort((a, b) => a.ordinal - b.ordinal)
                .map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Availability">
            <select name="status" defaultValue={lot?.status ?? "available"}>
              <option value="available">Available for allocation</option>
              <option value="blocked">Blocked from allocation</option>
            </select>
          </Field>
          <Field
            label="Reference parking rate (AED)"
            hint="Leave both rate and billing period blank until confirmed."
          >
            <input
              name="rate_amount"
              type="number"
              min="0.01"
              max="99999999"
              step="0.01"
              defaultValue={lot?.rate_amount ? lot.rate_amount / 100 : ""}
            />
          </Field>
          <Field label="Rate period">
            <select name="rate_period" defaultValue={lot?.rate_period ?? ""}>
              <option value="">Not entered</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
          </Field>
          <Field wide label="Parking notes">
            <textarea
              name="notes"
              maxLength={1000}
              defaultValue={lot?.notes ?? ""}
            />
          </Field>
        </div>
        <ErrorText message={error} />
        <SaveFooter
          pending={pending}
          onClose={onClose}
          label={lot ? "Save changes" : "Save parking lot"}
        />
      </form>
    </Modal>
  );
}

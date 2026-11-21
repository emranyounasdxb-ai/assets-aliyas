"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import {
  amenityOptions,
  annualEnd,
  annualParkingCharge,
  parkingAvailable,
  categories,
  installmentSchedule,
  money,
  todayDubai,
  unitStatus,
} from "@/lib/domain";
import { useApp } from "./provider";
import { ErrorText, Field, Modal, Money, SaveFooter } from "./ui";
export type FormKind =
  | "building"
  | "floor"
  | "unit"
  | "tenant"
  | "lease"
  | "cheque"
  | "account"
  | "security";
const names: Record<FormKind, string> = {
  building: "property",
  floor: "floor",
  unit: "flat",
  tenant: "tenant",
  lease: "agreement",
  cheque: "cheque",
  account: "account entry",
  security: "security record",
};
export function RecordForm({
  kind,
  initial,
  onClose,
}: {
  kind: FormKind;
  initial: Record<string, unknown>;
  onClose: () => void;
}) {
  const { data, mutate, notify } = useApp();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const firstUnit =
    data.units.find((u) => unitStatus(data, u) === "Vacant") ??
    data.units.find((u) => u.status === "available");
  const val = (key: string, fallback = "") => String(initial[key] ?? fallback);
  const [building, setBuilding] = useState(
    val("building_id", data.buildings[0]?.id ?? ""),
  );
  const [floor, setFloor] = useState(
    val(
      "floor_id",
      data.floors.find((f) => f.building_id === building)?.id ?? "",
    ),
  );
  const [unit, setUnit] = useState(val("unit_id", firstUnit?.id ?? ""));
  const selectedUnit = data.units.find((u) => u.id === unit);
  const [rent, setRent] = useState(
    initial.annual_rent
      ? String(Number(initial.annual_rent) / 100)
      : String(((selectedUnit?.monthly_rent ?? 0) * 12) / 100),
  );
  const [starts, setStarts] = useState(todayDubai());
  const [checks, setChecks] = useState(4);
  const [parkingIds, setParkingIds] = useState<string[]>([]);
  const parkingTotal = data.parkingLots
    .filter((l) => parkingIds.includes(l.id))
    .reduce((s, l) => s + annualParkingCharge(l), 0);
  const [securityType, setSecurityType] = useState("cash");
  const [entryKind, setEntryKind] = useState("payment");
  const [requestKey] = useState(() => crypto.randomUUID());
  const title =
    kind === "cheque"
      ? "Update cheque"
      : kind === "account"
        ? "Record account entry"
        : kind === "security"
          ? "Add security record"
          : `${initial.id ? "Edit" : "Add"} ${names[kind]}`;
  let schedule: { amount: number; date: string }[] = [];
  try {
    schedule = installmentSchedule(
      Math.round(Number(rent) * 100) + parkingTotal,
      checks,
      starts,
    );
  } catch {}
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const fields: Record<string, unknown> = Object.fromEntries(form.entries());
    if (initial.id) fields.id = initial.id;
    if (kind === "lease")
      fields.parking_lot_ids = form.getAll("parking_lot_ids");
    if (["building", "unit"].includes(kind))
      fields.amenities = form.getAll("amenities");
    if (kind === "account") {
      const amount = String(fields.amount);
      fields.amount =
        entryKind === "payment" || fields.direction === "credit"
          ? `-${amount}`
          : amount;
      fields.request_key = requestKey;
    }
    try {
      await mutate(kind, fields);
      notify(
        `${names[kind][0].toUpperCase() + names[kind].slice(1)} ${initial.id ? "updated" : "saved"}.`,
      );
      onClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not save. Please try again.",
      );
      setPending(false);
    }
  }
  const amenitiesField = (
    <Field wide label="Amenities">
      <div className="checkbox-options">
        {amenityOptions.map((option) => (
          <label key={option}>
            <input
              type="checkbox"
              name="amenities"
              value={option}
              defaultChecked={((initial.amenities as string[]) ?? []).includes(
                option,
              )}
            />
            {option}
          </label>
        ))}
      </div>
    </Field>
  );
  return (
    <Modal
      title={title}
      description={
        kind === "lease"
          ? "Create an annual agreement and its rent cheque schedule."
          : kind === "account"
            ? "Keep a clear, dated record of the tenant account."
            : `Save this ${names[kind]} in your current workspace.`
      }
      onClose={pending ? () => {} : onClose}
      wide={!["floor", "security"].includes(kind)}
    >
      <form onSubmit={submit}>
        <div className="form-grid">
          {kind === "building" && (
            <>
              <Field label="Property name">
                <input
                  name="name"
                  required
                  maxLength={160}
                  defaultValue={val("name")}
                  placeholder="e.g. Al Noor Residence"
                />
              </Field>
              <Field label="Property code">
                <input
                  name="code"
                  required
                  maxLength={24}
                  defaultValue={val("code")}
                  placeholder="e.g. ANR"
                />
              </Field>
              <Field label="Area">
                <input
                  name="area"
                  required
                  maxLength={120}
                  defaultValue={val("area")}
                  placeholder="e.g. Al Nuaimiya"
                />
              </Field>
              <Field
                label="Total physical levels"
                hint="Confirmed building total. Leave blank if unconfirmed."
              >
                <input
                  name="declared_levels"
                  type="number"
                  min={1}
                  max={250}
                  defaultValue={val("declared_levels")}
                />
              </Field>
              {!initial.id && (
                <Field
                  label="Upper floors"
                  hint="A ground floor is included automatically."
                >
                  <input
                    name="floor_count"
                    type="number"
                    required
                    min={0}
                    max={100}
                    defaultValue={3}
                  />
                </Field>
              )}
              <Field wide label="Address">
                <input
                  name="address"
                  maxLength={300}
                  defaultValue={val("address")}
                  placeholder="Street, area, Ajman"
                />
              </Field>
              <input type="hidden" name="color" value={val("color", "sage")} />
              {amenitiesField}
              <Field wide label="Notes">
                <textarea
                  name="notes"
                  maxLength={2000}
                  defaultValue={val("notes")}
                  placeholder="Useful details about this property"
                />
              </Field>
            </>
          )}
          {kind === "floor" && (
            <>
              <input type="hidden" name="building_id" value={building} />
              <Field label="Floor name">
                <input
                  required
                  name="name"
                  maxLength={80}
                  placeholder="e.g. Floor 4"
                  defaultValue={val("name")}
                />
              </Field>
              <Field
                label="Display order"
                hint="Sort order from the ground up. The floor name controls its displayed number."
              >
                <input
                  required
                  name="ordinal"
                  type="number"
                  min={-10}
                  max={200}
                  defaultValue={val(
                    "ordinal",
                    String(
                      Math.max(
                        0,
                        ...data.floors
                          .filter((f) => f.building_id === building)
                          .map((f) => f.ordinal),
                      ) + 1,
                    ),
                  )}
                />
              </Field>
              <Field label="Floor use">
                <select
                  name="purpose"
                  defaultValue={val("purpose", "unspecified")}
                >
                  <option value="unspecified">Not specified</option>
                  <option value="residential">Residential</option>
                  <option value="parking">Parking</option>
                  <option value="service">Gym and service area</option>
                </select>
              </Field>
              <Field label="Floor notes">
                <textarea
                  name="notes"
                  maxLength={1000}
                  defaultValue={val("notes")}
                  placeholder="Confirmed facilities or floor details"
                />
              </Field>
            </>
          )}
          {kind === "unit" && (
            <>
              <Field label="Property">
                <select
                  required
                  name="building_id"
                  value={building}
                  onChange={(e) => {
                    setBuilding(e.target.value);
                    setFloor(
                      data.floors.find((f) => f.building_id === e.target.value)
                        ?.id ?? "",
                    );
                  }}
                >
                  <option value="">Choose a property</option>
                  {data.buildings.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Floor">
                <select
                  name="floor_id"
                  required
                  value={floor}
                  onChange={(e) => setFloor(e.target.value)}
                >
                  <option value="">Choose a floor</option>
                  {data.floors
                    .filter(
                      (f) =>
                        f.building_id === building &&
                        !["parking", "service"].includes(f.purpose),
                    )
                    .map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                </select>
              </Field>
              <Field label="Flat number">
                <input
                  name="code"
                  maxLength={30}
                  required
                  defaultValue={val("code")}
                  placeholder="e.g. 101"
                />
              </Field>
              <Field label="Category">
                <select name="category" defaultValue={val("category", "1 BHK")}>
                  {categories.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </Field>
              <Field label="Monthly asking rent (AED)">
                <input
                  name="monthly_rent"
                  type="number"
                  step="0.01"
                  min="0"
                  max="99999999"
                  required
                  defaultValue={Number(initial.monthly_rent ?? 0) / 100}
                />
              </Field>
              <Field label="Area (sq ft)">
                <input
                  name="area_sqft"
                  type="number"
                  min="0"
                  max="1000000"
                  defaultValue={val("area_sqft", "0")}
                />
              </Field>
              <Field label="Availability">
                <select name="status" defaultValue={val("status", "available")}>
                  <option value="available">Available for tenancy</option>
                  <option value="maintenance">Under maintenance</option>
                </select>
              </Field>
              {amenitiesField}
            </>
          )}
          {kind === "tenant" && (
            <>
              <Field label="Full name">
                <input
                  name="name"
                  required
                  maxLength={160}
                  autoComplete="name"
                  defaultValue={val("name")}
                  placeholder="Tenant's full name"
                />
              </Field>
              <Field label="Phone number">
                <input
                  name="phone"
                  type="tel"
                  required
                  maxLength={40}
                  autoComplete="tel"
                  defaultValue={val("phone")}
                  placeholder="+971 50 123 4567"
                />
              </Field>
              <Field label="Email address">
                <input
                  name="email"
                  type="email"
                  maxLength={180}
                  autoComplete="email"
                  defaultValue={val("email")}
                  placeholder="tenant@example.com"
                />
              </Field>
              <Field label="Nationality">
                <input
                  name="nationality"
                  maxLength={80}
                  defaultValue={val("nationality")}
                  placeholder="e.g. Pakistan"
                />
              </Field>
              {!initial.id && (
                <Field
                  wide
                  label="Opening balance (AED)"
                  hint="Existing outstanding only. Use a negative amount for an existing credit. Agreement rent is added separately."
                >
                  <input
                    name="opening"
                    type="number"
                    step="0.01"
                    min="-99999999"
                    max="99999999"
                    defaultValue="0"
                  />
                </Field>
              )}
              <Field wide label="Notes">
                <textarea
                  name="notes"
                  maxLength={2000}
                  defaultValue={val("notes")}
                  placeholder="Additional contact or tenancy details"
                />
              </Field>
            </>
          )}
          {kind === "lease" && (
            <>
              <Field label="Tenant">
                <select
                  name="tenant_id"
                  defaultValue={val("tenant_id", data.tenants[0]?.id ?? "")}
                  required
                >
                  <option value="">Choose a tenant</option>
                  {data.tenants.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Flat">
                <select
                  required
                  name="unit_id"
                  value={unit}
                  onChange={(e) => {
                    setUnit(e.target.value);
                    setParkingIds([]);
                    setRent(
                      String(
                        ((data.units.find((u) => u.id === e.target.value)
                          ?.monthly_rent ?? 0) *
                          12) /
                          100,
                      ),
                    );
                  }}
                >
                  <option value="">Choose a flat</option>
                  {data.units
                    .filter((u) => u.status === "available")
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {
                          data.buildings.find((b) => b.id === u.building_id)
                            ?.code
                        }{" "}
                        · {u.code} · {u.category}
                      </option>
                    ))}
                </select>
              </Field>
              <Field label="Agreement reference">
                <input
                  name="reference"
                  required
                  maxLength={40}
                  defaultValue={`AY-${todayDubai().slice(0, 4)}-${String(data.leases.length + 1).padStart(4, "0")}`}
                />
              </Field>
              <Field label="Start date">
                <input
                  name="start_date"
                  type="date"
                  required
                  value={starts}
                  onChange={(e) => {
                    setStarts(e.target.value);
                    setParkingIds([]);
                  }}
                />
              </Field>
              <Field label="Annual agreed rent (AED)">
                <input
                  required
                  name="annual_rent"
                  type="number"
                  min="0.01"
                  step="0.01"
                  max="99999999"
                  value={rent}
                  onChange={(e) => setRent(e.target.value)}
                />
              </Field>
              <Field label="Rent cheques">
                <select
                  name="installments"
                  value={checks}
                  onChange={(e) => setChecks(Number(e.target.value))}
                >
                  {[1, 2, 3, 4, 6, 12].map((n) => (
                    <option key={n} value={n}>
                      {n} cheque{n !== 1 ? "s" : ""}
                    </option>
                  ))}
                </select>
              </Field>
              <fieldset className="parking-picker span-2">
                <legend>Paid parking (optional)</legend>
                <p className="parking-help">
                  Select one or more numbered spaces in the same building. They
                  will be reserved for the full agreement term.
                </p>
                {data.parkingLots
                  .filter((l) => l.building_id === selectedUnit?.building_id)
                  .map((lot) => {
                    const available = Boolean(
                      starts &&
                      lot.rate_amount &&
                      parkingAvailable(
                        data.parkingAllocations,
                        lot,
                        starts,
                        annualEnd(starts),
                      ),
                    );
                    return (
                      <label
                        key={lot.id}
                        className={available ? "" : "unavailable"}
                      >
                        <input
                          type="checkbox"
                          name="parking_lot_ids"
                          value={lot.id}
                          disabled={!available}
                          checked={parkingIds.includes(lot.id)}
                          onChange={(e) =>
                            setParkingIds((ids) =>
                              e.target.checked
                                ? [...ids, lot.id]
                                : ids.filter((id) => id !== lot.id),
                            )
                          }
                        />
                        <span>
                          <strong>Lot {lot.number}</strong>
                          <small>
                            {data.floors.find((f) => f.id === lot.floor_id)
                              ?.name ?? "No level recorded"}
                            {!available
                              ? lot.rate_amount
                                ? " · Unavailable for these dates"
                                : " · Rate not set"
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
                  })}
                {!data.parkingLots.some(
                  (l) => l.building_id === selectedUnit?.building_id,
                ) && (
                  <p className="muted">
                    No numbered parking lots have been entered for this
                    building.
                  </p>
                )}
              </fieldset>
              <Field wide label="Tenant's bank">
                <input
                  name="bank"
                  maxLength={120}
                  placeholder="e.g. Emirates NBD"
                />
              </Field>
              <Field wide label="Notes">
                <textarea
                  name="notes"
                  maxLength={2000}
                  placeholder="Agreed amenities, parking or other details"
                />
              </Field>
              <div className="schedule-preview span-2">
                <div>
                  <strong>Payment schedule</strong>
                  <span>Ends {starts ? annualEnd(starts) : "—"}</span>
                </div>
                <div>
                  <span>Annual flat rent</span>
                  <strong>AED {money(Math.round(Number(rent) * 100))}</strong>
                </div>
                <div>
                  <span>Annual parking charges</span>
                  <strong>
                    <Money value={parkingTotal} />
                  </strong>
                </div>
                <div>
                  <span>Total agreement</span>
                  <strong>
                    AED {money(Math.round(Number(rent) * 100) + parkingTotal)}
                  </strong>
                </div>
                {schedule.map((item, i) => (
                  <div key={item.date}>
                    <span>
                      Cheque {i + 1} · {item.date}
                    </span>
                    <strong>AED {money(item.amount)}</strong>
                  </div>
                ))}
                <small>
                  Cheque references are generated now. Add actual bank cheque
                  numbers when received.
                </small>
              </div>
              {(!data.units.length || !data.tenants.length) && (
                <p className="form-note span-2">
                  Add a{" "}
                  <Link onClick={onClose} href="/units">
                    flat
                  </Link>{" "}
                  and a{" "}
                  <Link onClick={onClose} href="/tenants">
                    tenant
                  </Link>{" "}
                  before creating an agreement.
                </p>
              )}
            </>
          )}
          {kind === "cheque" && (
            <>
              <div className="schedule-preview span-2">
                <div>
                  <strong>
                    {data.tenants.find((t) => t.id === initial.tenant_id)?.name}
                  </strong>
                  <span>
                    {initial.purpose === "security"
                      ? "Security cheque"
                      : "Rent cheque"}
                  </span>
                </div>
                <div>
                  <span>Amount</span>
                  <strong>AED {money(Number(initial.amount ?? 0))}</strong>
                </div>
                <div>
                  <span>Due date</span>
                  <strong>{String(initial.due_date ?? "")}</strong>
                </div>
              </div>
              <Field label="Cheque number">
                <input
                  name="number"
                  required
                  maxLength={50}
                  defaultValue={val("number")}
                />
              </Field>
              <Field label="Bank">
                <input name="bank" maxLength={120} defaultValue={val("bank")} />
              </Field>
              <Field label="Status">
                <select name="status" defaultValue={val("status", "received")}>
                  {(initial.purpose === "security"
                    ? ["received", "returned", "cancelled"]
                    : [
                        ...(initial.status === "scheduled"
                          ? ["scheduled"]
                          : []),
                        "received",
                        "deposited",
                        "cleared",
                        ...(["deposited", "bounced"].includes(
                          String(initial.status),
                        )
                          ? ["bounced"]
                          : []),
                        "cancelled",
                      ]
                  ).map((s) => (
                    <option key={s} value={s}>
                      {s[0].toUpperCase() + s.slice(1)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Recorded date">
                <input
                  name="on_date"
                  required
                  type="date"
                  defaultValue={todayDubai()}
                  max={todayDubai()}
                />
              </Field>
              <p className="form-note span-2">
                {initial.purpose === "security"
                  ? "This security cheque stays separate from rent and the tenant account balance."
                  : "A payment is added to the account only when this cheque is marked cleared. Finalized cheques remain in the history."}
              </p>
            </>
          )}
          {kind === "account" && (
            <>
              <Field label="Tenant">
                <select
                  name="tenant_id"
                  required
                  defaultValue={val("tenant_id", data.tenants[0]?.id ?? "")}
                >
                  {data.tenants.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Entry type">
                <select
                  name="kind"
                  value={entryKind}
                  onChange={(e) => setEntryKind(e.target.value)}
                >
                  <option value="payment">Cash or bank payment</option>
                  <option value="adjustment">Account adjustment</option>
                </select>
              </Field>
              <Field label="Amount (AED)">
                <input
                  name="amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  max="99999999"
                  required
                />
              </Field>
              <Field label="Date">
                <input
                  name="entry_date"
                  type="date"
                  required
                  max={todayDubai()}
                  defaultValue={todayDubai()}
                />
              </Field>
              {entryKind === "adjustment" && (
                <Field label="Balance effect">
                  <select name="direction">
                    <option value="charge">Add to amount owed</option>
                    <option value="credit">Reduce amount owed</option>
                  </select>
                </Field>
              )}
              <Field wide label="Description / receipt reference">
                <input
                  name="description"
                  required
                  minLength={3}
                  maxLength={300}
                  placeholder="e.g. Bank transfer received, reference 12345"
                />
              </Field>
              <p className="form-note span-2">
                Cash and transfers reduce the account balance. They do not
                automatically clear a bank cheque.
              </p>
            </>
          )}
          {kind === "security" && (
            <>
              <Field wide label="Tenant">
                <select
                  name="tenant_id"
                  required
                  defaultValue={val("tenant_id", data.tenants[0]?.id ?? "")}
                >
                  {data.tenants.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Type">
                <select
                  name="type"
                  value={securityType}
                  onChange={(e) => setSecurityType(e.target.value)}
                >
                  <option value="cash">Cash security deposit</option>
                  <option value="cheque">Security cheque</option>
                </select>
              </Field>
              <Field label="Amount (AED)">
                <input
                  name="amount"
                  type="number"
                  min="0.01"
                  max="99999999"
                  step="0.01"
                  required
                />
              </Field>
              <Field
                wide
                label={
                  securityType === "cheque"
                    ? "Security cheque number"
                    : "Receipt reference"
                }
              >
                <input name="reference" required maxLength={160} />
              </Field>
              {securityType === "cheque" && (
                <Field wide label="Bank">
                  <input name="bank" maxLength={120} />
                </Field>
              )}
              <p className="form-note span-2">
                Security is held separately. It does not change rental charges
                or payments.
              </p>
            </>
          )}
        </div>
        <ErrorText message={error} />
        <SaveFooter
          pending={pending}
          onClose={onClose}
          label={
            kind === "lease"
              ? "Create agreement"
              : initial.id
                ? "Save changes"
                : `Save ${names[kind]}`
          }
        />
      </form>
    </Modal>
  );
}

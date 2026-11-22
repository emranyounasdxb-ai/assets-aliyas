"use client";
import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Buildings,
  Car,
  MapPin,
  ListBullets,
  PencilSimple,
  Plus,
  SquaresFour,
} from "@phosphor-icons/react";
import {
  categories,
  currentLease,
  unitLabel,
  dateLabel,
  pendingCheque,
  todayDubai,
  unitStatus,
  propertyCover,
  type Building,
  type Unit,
} from "@/lib/domain";
import { useApp } from "./provider";
import {
  StableRegion,
  StableTable,
  BackLink,
  Badge,
  Button,
  Empty,
  Modal,
  Money,
  PageHeader,
  Pagination,
  SearchInput,
  SectionHeader,
  statusTone,
  useList,
} from "./ui";
import { DocumentPanel } from "./documents";
import { PropertyMedia } from "./property-media";
import { CommissionPanel } from "./agents";
export function PropertyCover({ building }: { building: Building }) {
  const { data } = useApp();
  const photo = propertyCover(data, building.id);
  const [failed, setFailed] = useState("");
  return photo && failed !== photo.id ? (
    <img
      src={`/api/documents/${photo.id}/file?preview=1`}
      alt={building.name}
      loading="lazy"
      width={720}
      height={480}
      onError={() => setFailed(photo.id)}
    />
  ) : (
    <div className="property-placeholder">
      <span className="property-placeholder-top">
        <Buildings size={20} />
        {building.area}
      </span>
      <strong>{building.code}</strong>
      <span className="property-placeholder-note">
        Property photo not added
      </span>
      <Buildings
        className="property-placeholder-icon"
        size={120}
        weight="thin"
        aria-hidden="true"
      />
    </div>
  );
}
export function PropertyCard({ building }: { building: Building }) {
  const { data, openForm } = useApp();
  const units = data.units.filter((u) => u.building_id === building.id);
  const occupied = units.filter(
    (u) => unitStatus(data, u) === "Occupied",
  ).length;
  const vacant = units.filter((u) => unitStatus(data, u) === "Vacant").length;
  const ratio = units.length ? Math.round((occupied / units.length) * 100) : 0;
  const leaseIds = new Set(
    data.leases
      .filter((l) => units.some((u) => u.id === l.unit_id))
      .map((l) => l.id),
  );
  const dueRent = data.cheques
    .filter(
      (c) =>
        pendingCheque(c) &&
        c.lease_id &&
        leaseIds.has(c.lease_id) &&
        c.due_date <= todayDubai(),
    )
    .reduce((s, c) => s + c.amount, 0);
  return (
    <article className="property-card">
      <Link
        className="property-cover"
        href={`/properties/${building.id}`}
        aria-label={`View ${building.name}`}
      >
        <PropertyCover building={building} />
      </Link>
      <div className="property-card-body">
        <div className="property-card-code">
          {building.code}
          <span>
            {data.floors.filter((f) => f.building_id === building.id).length}{" "}
            floors
          </span>
        </div>
        <div className="property-card-title">
          <div>
            <Link href={`/properties/${building.id}`}>
              <h3>{building.name}</h3>
            </Link>
            <p>
              <MapPin size={13} />
              {building.area}, Ajman
            </p>
          </div>
          {["owner", "manager"].includes(data.membership.role) && (
            <Button
              variant="ghost"
              className="icon-button"
              aria-label={`Edit ${building.name}`}
              onClick={() => openForm("building", { ...building })}
            >
              <PencilSimple size={17} />
            </Button>
          )}
        </div>
        <div className="property-card-stats">
          <div>
            <strong>{units.length}</strong>
            <small>Registered units</small>
          </div>
          <div>
            <strong>{occupied}</strong>
            <small>Occupied</small>
          </div>
          <div>
            <strong>{vacant}</strong>
            <small>Vacant</small>
          </div>
        </div>
        <div
          className="occupancy-line"
          role="img"
          aria-label={`${ratio}% occupied`}
        >
          <span style={{ width: `${ratio}%` }} />
        </div>
        <div className="property-card-footer">
          <span>
            {units.length ? `${ratio}% occupancy` : "Unit inventory pending"}
          </span>
          <Link className="text-link" href={`/properties/${building.id}`}>
            View property
            <ArrowRight size={14} />
          </Link>
        </div>
        <div className="property-finance">
          <span>Due rental cheques</span>
          <strong>
            <Money value={dueRent} />
          </strong>
        </div>
      </div>
    </article>
  );
}
export function Properties() {
  const { data, openForm } = useApp();
  const [query, setQuery] = useState("");
  const [view, setView] = useState("grid");
  const [area, setArea] = useState("all");
  const properties = [...data.buildings]
    .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }))
    .filter(
      (b) =>
        `${b.name} ${b.code} ${b.area}`
          .toLowerCase()
          .includes(query.toLowerCase()) &&
        (area === "all" || b.area === area),
    );
  return (
    <>
      <PageHeader title="Properties">
        {["owner", "manager"].includes(data.membership.role) && (
          <Button variant="primary" onClick={() => openForm("building")}>
            <Plus size={18} />
            Add property
          </Button>
        )}
      </PageHeader>
      <div className="toolbar">
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Search properties…"
        />
        <select
          className="filter-select"
          aria-label="Filter by area"
          value={area}
          onChange={(e) => setArea(e.target.value)}
        >
          <option value="all">All areas</option>
          {[...new Set(data.buildings.map((b) => b.area))].sort().map((a) => (
            <option key={a}>{a}</option>
          ))}
        </select>
        <span className="toolbar-spacer" />
        <span className="filter-label">{properties.length} properties</span>
        <span className="view-tabs">
          <button
            className={view === "grid" ? "active" : ""}
            type="button"
            aria-label="Property grid view"
            aria-pressed={view === "grid"}
            onClick={() => setView("grid")}
            data-active={view === "grid"}
          >
            <SquaresFour size={16} />
          </button>
          <button
            type="button"
            aria-label="Property list view"
            aria-pressed={view === "list"}
            data-active={view === "list"}
            onClick={() => setView("list")}
          >
            <ListBullets size={18} />
          </button>
        </span>
      </div>
      <StableRegion>
        {properties.length ? (
          <div
            className={`property-grid ${view === "list" ? "property-list-view" : ""}`}
          >
            {properties.map((b) => (
              <PropertyCard key={b.id} building={b} />
            ))}
          </div>
        ) : (
          <div className="panel">
            <Empty
              title={
                data.buildings.length ? "No properties found" : "No properties"
              }
              description={
                data.buildings.length
                  ? "Try a different search or area."
                  : "Add your first property and its floors. You can add flats and real photos next."
              }
            >
              {!data.buildings.length &&
                ["owner", "manager"].includes(data.membership.role) && (
                  <Button
                    variant="primary"
                    onClick={() => openForm("building")}
                  >
                    <Plus size={16} />
                    Add your first property
                  </Button>
                )}
            </Empty>
          </div>
        )}
      </StableRegion>
    </>
  );
}
export function PropertyDetail({ id }: { id: string }) {
  const { data, openForm } = useApp();
  const building = data.buildings.find((b) => b.id === id);
  const [floor, setFloor] = useState(
    () =>
      data.floors
        .filter((f) => f.building_id === id)
        .sort((a, b) => a.ordinal - b.ordinal)[0]?.id ?? "all",
  );
  const [selected, setSelected] = useState<Unit | null>(null);
  if (!building)
    return (
      <>
        <BackLink href="/properties">All properties</BackLink>
        <Empty
          title="Property not found"
          description="This property is not in your current workspace."
        />
      </>
    );
  const units = data.units.filter((u) => u.building_id === id);
  const floors = data.floors
    .filter((f) => f.building_id === id)
    .sort((a, b) => a.ordinal - b.ordinal);
  const occupied = units.filter(
    (u) => unitStatus(data, u) === "Occupied",
  ).length;
  const vacant = units.filter((u) => unitStatus(data, u) === "Vacant").length;
  const manage = ["owner", "manager"].includes(data.membership.role);
  return (
    <>
      <BackLink href="/properties">All properties</BackLink>
      <PageHeader
        title={building.name}
        description={building.address || `${building.area}, Ajman`}
      >
        {manage && (
          <>
            <Button onClick={() => openForm("building", { ...building })}>
              <PencilSimple size={16} />
              Edit property
            </Button>
            <Button
              variant="primary"
              onClick={() =>
                openForm("unit", { building_id: id, floor_id: floors[0]?.id })
              }
            >
              <Plus size={18} />
              Add flat
            </Button>
            <Button onClick={() => openForm("shop", { building_id: id })}>
              <Plus size={18} />
              Add shop
            </Button>
          </>
        )}
      </PageHeader>
      <div className="detail-banner">
        <div className="detail-art">
          <PropertyCover building={building} />
        </div>
        <div className="panel property-info">
          <Badge tone="mint">{building.code}</Badge>
          <h2>Property details</h2>
          <p>
            {building.notes ||
              "Building information, amenities and rental availability."}
          </p>
          <div className="amenity-chips">
            {building.amenities.map((a) => (
              <span key={a}>
                {a === "Parking" ? <Car size={13} /> : <CheckAmenity />}
                {a}
              </span>
            ))}
          </div>
          <div className="property-card-stats">
            <div>
              <strong>{floors.length}</strong>
              <small>Floors</small>
            </div>
            <div>
              <strong>
                {units.filter((u) => u.category !== "Shop").length}
              </strong>
              <small>Flats</small>
            </div>
            <div>
              <strong>
                {units.filter((u) => u.category === "Shop").length}
              </strong>
              <small>Shops</small>
            </div>
          </div>
        </div>
      </div>
      <PropertyMedia buildingId={id} />
      <div className="summary-strip">
        <div>
          <small>Total rental units</small>
          <strong>{units.length}</strong>
        </div>
        <div>
          <small>Currently occupied</small>
          <strong>{occupied}</strong>
        </div>
        <div>
          <small>Ready to rent</small>
          <strong>{vacant}</strong>
        </div>
        <div>
          <small>Monthly asking rent</small>
          <strong>
            <Money value={units.reduce((s, u) => s + u.monthly_rent, 0)} />
          </strong>
        </div>
      </div>
      <SectionHeader title="Floor by floor">
        <select
          className="filter-select"
          aria-label="Choose floor"
          value={floor}
          onChange={(e) => setFloor(e.target.value)}
        >
          <option value="all">All floors</option>
          {floors.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
              {f.purpose === "service" ? " · Gym & services" : ""}
            </option>
          ))}
        </select>
        {manage && (
          <Button onClick={() => openForm("floor", { building_id: id })}>
            <Plus size={16} />
            Add floor
          </Button>
        )}
      </SectionHeader>
      <div className="floor-tabs">
        <button
          type="button"
          className={floor === "all" ? "active" : ""}
          aria-pressed={floor === "all"}
          onClick={() => setFloor("all")}
        >
          All floors · {units.length}
        </button>
        {floors.map((f) => (
          <button
            type="button"
            key={f.id}
            className={floor === f.id ? "active" : ""}
            aria-pressed={floor === f.id}
            onClick={() => setFloor(f.id)}
          >
            {f.name} · {units.filter((u) => u.floor_id === f.id).length}
          </button>
        ))}
      </div>
      {floors.length ? (
        <div className="floor-sections">
          {floors
            .filter((f) => floor === "all" || f.id === floor)
            .map((f) => (
              <section className="floor-section" key={f.id}>
                <div className="floor-section-heading">
                  <h3>{f.name}</h3>
                  {f.purpose !== "unspecified" && (
                    <Badge
                      tone={f.purpose === "residential" ? "success" : "neutral"}
                    >
                      {f.purpose === "service" ? "Gym & services" : f.purpose}
                    </Badge>
                  )}
                  <span>
                    {
                      units.filter(
                        (u) => u.floor_id === f.id && u.category !== "Shop",
                      ).length
                    }{" "}
                    flats ·{" "}
                    {
                      units.filter(
                        (u) => u.floor_id === f.id && u.category === "Shop",
                      ).length
                    }{" "}
                    shops
                  </span>
                  {manage && (
                    <Button
                      variant="ghost"
                      className="floor-edit"
                      aria-label={`Edit ${f.name}`}
                      onClick={() => openForm("floor", { ...f })}
                    >
                      <PencilSimple size={16} />
                      Edit floor
                    </Button>
                  )}
                </div>
                <div className="units-grid">
                  {units
                    .filter((u) => u.floor_id === f.id)
                    .sort((a, b) =>
                      a.code.localeCompare(b.code, undefined, {
                        numeric: true,
                      }),
                    )
                    .map((u) => {
                      const status = unitStatus(data, u);
                      const current = currentLease(data, u.id);
                      return (
                        <button
                          type="button"
                          key={u.id}
                          className={`unit-card status-${status.toLowerCase()}`}
                          onClick={() => setSelected(u)}
                        >
                          <div className="unit-card-head">
                            <strong>
                              {unitLabel(u)} {u.code}
                            </strong>
                            <Badge tone={statusTone(status)}>{status}</Badge>
                          </div>
                          <p>
                            {u.category} ·{" "}
                            {u.area_sqft
                              ? `${u.area_sqft.toLocaleString()} sq ft`
                              : "Area not entered"}
                          </p>
                          <p>
                            {data.floors.find((f) => f.id === u.floor_id)?.name}
                          </p>
                          <Money value={u.monthly_rent} />
                          <p>per month</p>
                          <div className="unit-tenant">
                            {current
                              ? data.tenants.find(
                                  (t) => t.id === current.tenant_id,
                                )?.name
                              : status === "Vacant"
                                ? "Available for a new tenancy"
                                : status === "Reserved"
                                  ? "Upcoming tenancy"
                                  : "Unavailable for letting"}
                            <ArrowRight size={14} />
                          </div>
                        </button>
                      );
                    })}
                </div>
                {!units.some((u) => u.floor_id === f.id) && (
                  <p className="floor-empty">
                    {f.purpose === "parking"
                      ? "Parking level. Apartments cannot be added here."
                      : f.purpose === "service"
                        ? "Gym and service area. No apartments on this floor."
                        : f.ordinal === 0
                          ? "No flats or shops have been entered on this floor."
                          : "Apartment details have not been added on this floor yet."}
                  </p>
                )}
                {f.notes && <p className="floor-notes">{f.notes}</p>}
              </section>
            ))}
        </div>
      ) : (
        <div className="panel" style={{ marginBottom: 24 }}>
          <Empty
            title="No flats"
            description="Add your first flat to this building and choose its floor."
          />
        </div>
      )}
      <div className="agent-section">
        <CommissionPanel buildingId={id} />
      </div>
      {selected && (
        <UnitModal id={selected.id} onClose={() => setSelected(null)} />
      )}
    </>
  );
}
function CheckAmenity() {
  return <span className="status-dot" style={{ width: 4, height: 4 }} />;
}
export function UnitModal({
  id,
  onClose,
}: {
  id: string;
  onClose: () => void;
}) {
  const { data, openForm } = useApp();
  const unit = data.units.find((u) => u.id === id);
  if (!unit) return null;
  const building = data.buildings.find((b) => b.id === unit.building_id);
  const lease = currentLease(data, id);
  const status = unitStatus(data, unit);
  const manage = ["owner", "manager"].includes(data.membership.role);
  return (
    <Modal
      title={`${unitLabel(unit)} ${unit.code}`}
      description={`${building?.name} · ${data.floors.find((f) => f.id === unit.floor_id)?.name}`}
      wide
      onClose={onClose}
    >
      <div className="unit-detail-grid">
        <div className="detail-item">
          <span>Category</span>
          <strong>{unit.category}</strong>
        </div>
        <div className="detail-item">
          <span>Status</span>
          <Badge tone={statusTone(status)}>{status}</Badge>
        </div>
        <div className="detail-item">
          <span>Monthly asking rent</span>
          <strong>
            <Money value={unit.monthly_rent} />
          </strong>
        </div>
        <div className="detail-item">
          <span>Area</span>
          <strong>
            {unit.area_sqft
              ? `${unit.area_sqft.toLocaleString()} sq ft`
              : "Not entered"}
          </strong>
        </div>
        <div className="detail-item span-2">
          <span>Amenities</span>
          <div className="amenity-chips">
            {unit.amenities.length ? (
              unit.amenities.map((a) => <span key={a}>{a}</span>)
            ) : (
              <strong>No additional amenities recorded</strong>
            )}
          </div>
        </div>
        {lease && (
          <div className="detail-item span-2">
            <span>Current tenant</span>
            <Link
              href={`/tenants/${lease.tenant_id}`}
              onClick={onClose}
              className="text-link"
            >
              {data.tenants.find((t) => t.id === lease.tenant_id)?.name}
              <ArrowRight size={14} />
            </Link>
          </div>
        )}
      </div>
      <div className="detail-actions">
        {manage && (
          <Button
            onClick={() => {
              onClose();
              openForm(unit.category === "Shop" ? "shop" : "unit", { ...unit });
            }}
          >
            <PencilSimple size={16} />
            Edit {unitLabel(unit).toLowerCase()}
          </Button>
        )}
        {manage && status === "Vacant" && (
          <Button
            variant="primary"
            onClick={() => {
              onClose();
              openForm("lease", { unit_id: unit.id });
            }}
          >
            <Plus size={16} />
            Create agreement
          </Button>
        )}
        {lease && (
          <Link
            href={`/agreements/${lease.id}`}
            className="button secondary"
            onClick={onClose}
          >
            View agreement
            <ArrowRight size={16} />
          </Link>
        )}
      </div>
      {unit.notes && <p className="modal-message">{unit.notes}</p>}
      {data.leases.some((l) => l.unit_id === id) && (
        <section className="unit-rental-history">
          <h3>Rental history</h3>
          <div className="table-wrap">
            <StableTable>
              <thead>
                <tr>
                  <th>Agreement / tenant</th>
                  <th>Term</th>
                  <th>Annual rent</th>
                </tr>
              </thead>
              <tbody>
                {data.leases
                  .filter((l) => l.unit_id === id)
                  .sort((a, b) => b.start_date.localeCompare(a.start_date))
                  .map((l) => (
                    <tr key={l.id}>
                      <td>
                        <Link
                          href={`/agreements/${l.id}`}
                          className="text-link"
                          onClick={onClose}
                        >
                          {l.reference}
                        </Link>
                        <small>
                          {data.tenants.find((t) => t.id === l.tenant_id)?.name}
                        </small>
                      </td>
                      <td>
                        {dateLabel(l.start_date)}
                        <small>
                          to {dateLabel(l.end_date)} · {l.status}
                        </small>
                      </td>
                      <td>
                        <Money value={l.annual_rent} />
                      </td>
                    </tr>
                  ))}
              </tbody>
            </StableTable>
          </div>
        </section>
      )}
      <div style={{ padding: 24, borderTop: "1px solid var(--line)" }}>
        <DocumentPanel
          targetType="unit"
          targetId={id}
          title={`${unitLabel(unit)} photos, plans & documents`}
          compact
        />
      </div>
    </Modal>
  );
}
export function Units({
  initialStatus = "all",
  shops = false,
}: {
  initialStatus?: string;
  shops?: boolean;
}) {
  const { data, openForm } = useApp();
  const label = shops ? "Shop" : "Flat";
  const inventory = data.units.filter((u) => (u.category === "Shop") === shops);
  const [query, setQuery] = useState("");
  const [building, setBuilding] = useState("all");
  const [status, setStatus] = useState(initialStatus);
  const [category, setCategory] = useState("all");
  const [selected, setSelected] = useState<string | null>(null);
  const list = useList(
    inventory,
    (u) =>
      `${u.code} ${data.buildings.find((b) => b.id === u.building_id)?.name}`
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (building === "all" || u.building_id === building) &&
      (category === "all" || u.category === category) &&
      (status === "all" || unitStatus(data, u) === status),
  );
  return (
    <>
      <PageHeader title={shops ? "Shops" : "Flats"}>
        {["owner", "manager"].includes(data.membership.role) && (
          <Button
            variant="primary"
            onClick={() => openForm(shops ? "shop" : "unit")}
          >
            <Plus size={18} />
            Add {label.toLowerCase()}
          </Button>
        )}
      </PageHeader>
      <div className="summary-strip">
        <div>
          <small>Registered {shops ? "shops" : "flats"}</small>
          <strong>{inventory.length}</strong>
        </div>
        <div>
          <small>Occupied</small>
          <strong>
            {inventory.filter((u) => unitStatus(data, u) === "Occupied").length}
          </strong>
        </div>
        <div>
          <small>Vacant</small>
          <strong>
            {inventory.filter((u) => unitStatus(data, u) === "Vacant").length}
          </strong>
        </div>
        <div>
          <small>Monthly asking rent</small>
          <strong>
            <Money
              value={inventory.reduce((sum, u) => sum + u.monthly_rent, 0)}
            />
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
          placeholder={`Search ${shops ? "shops" : "flats"} or properties…`}
        />
        <select
          className="filter-select"
          aria-label="Filter property"
          value={building}
          onChange={(e) => {
            setBuilding(e.target.value);
            list.setPage(1);
          }}
        >
          <option value="all">All properties</option>
          {data.buildings.map((b) => (
            <option value={b.id} key={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        {!shops && (
          <select
            className="filter-select"
            aria-label="Filter category"
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              list.setPage(1);
            }}
          >
            <option value="all">All categories</option>
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        )}
        <select
          className="filter-select"
          aria-label={`Filter ${label.toLowerCase()} status`}
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            list.setPage(1);
          }}
        >
          <option value="all">All statuses</option>
          {["Vacant", "Occupied", "Reserved", "Maintenance"].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </div>
      <StableRegion className="panel">
        {list.total ? (
          <>
            <div className="table-wrap">
              <StableTable>
                <thead>
                  <tr>
                    <th>{label}</th>
                    <th>Property</th>
                    <th>{shops ? "Area" : "Category"}</th>
                    <th>Monthly rent</th>
                    <th>Current tenant</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {list.visible.map((u) => {
                    const lease = currentLease(data, u.id);
                    const s = unitStatus(data, u);
                    return (
                      <tr key={u.id}>
                        <td>
                          <strong>
                            {label} {u.code}
                          </strong>
                          <small>
                            {data.floors.find((f) => f.id === u.floor_id)?.name}
                          </small>
                        </td>
                        <td>
                          <Link
                            href={`/properties/${u.building_id}`}
                            className="text-link"
                          >
                            {
                              data.buildings.find((b) => b.id === u.building_id)
                                ?.name
                            }
                          </Link>
                        </td>
                        <td>
                          {!shops && u.category}
                          <small>{u.area_sqft.toLocaleString()} sq ft</small>
                        </td>
                        <td>
                          <strong>
                            <Money value={u.monthly_rent} />
                          </strong>
                        </td>
                        <td>
                          {lease ? (
                            <Link
                              href={`/tenants/${lease.tenant_id}`}
                              className="text-link"
                            >
                              {
                                data.tenants.find(
                                  (t) => t.id === lease.tenant_id,
                                )?.name
                              }
                            </Link>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td>
                          <Badge tone={statusTone(s)}>{s}</Badge>
                        </td>
                        <td>
                          <Button
                            variant="ghost"
                            className="icon-button"
                            aria-label={`View ${label.toLowerCase()} ${u.code}`}
                            onClick={() => setSelected(u.id)}
                          >
                            <ArrowRight size={16} />
                          </Button>
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
            title={`No ${shops ? "shops" : "flats"} to show`}
            description={
              inventory.length
                ? `Adjust your search or filters to find a ${label.toLowerCase()}.`
                : shops
                  ? "Add shop numbers and rents for each building's ground floor."
                  : "Add a property and its floors, then add your first flat."
            }
          />
        )}
      </StableRegion>
      {selected && (
        <UnitModal id={selected} onClose={() => setSelected(null)} />
      )}
    </>
  );
}

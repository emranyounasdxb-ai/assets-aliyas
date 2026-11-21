"use client";
import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Car,
  MapPin,
  PencilSimple,
  Plus,
  SquaresFour,
} from "@phosphor-icons/react";
import {
  categories,
  currentLease,
  unitStatus,
  type Building,
  type Unit,
} from "@/lib/domain";
import { useApp } from "./provider";
import {
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
import { BuildingArt } from "./building-art";
import { DocumentPanel } from "./documents";
export function PropertyCover({ building }: { building: Building }) {
  const { data } = useApp();
  const photo = data.documents.find(
    (d) =>
      d.target_type === "building" &&
      d.target_id === building.id &&
      d.category === "Photo" &&
      d.status === "current",
  );
  return photo ? (
    <img
      src={`/api/documents/${photo.id}/file?preview=1`}
      alt={building.name}
      loading="lazy"
    />
  ) : (
    <>
      <BuildingArt variant={building.color} />
      <span className="illustration-label">Property illustration</span>
    </>
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
            <small>Total flats</small>
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
          <span>{ratio}% occupancy</span>
          <Link className="text-link" href={`/properties/${building.id}`}>
            View property
            <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </article>
  );
}
export function Properties() {
  const { data, openForm } = useApp();
  const [query, setQuery] = useState("");
  const [area, setArea] = useState("all");
  const properties = data.buildings.filter(
    (b) =>
      `${b.name} ${b.code} ${b.area}`
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (area === "all" || b.area === area),
  );
  return (
    <>
      <PageHeader
        eyebrow="YOUR PROPERTY PORTFOLIO"
        title="A place for every property."
        description="Your buildings, floors and flats, all in one view."
      >
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
            className="active"
            type="button"
            aria-label="Property grid view"
            aria-pressed="true"
          >
            <SquaresFour size={16} />
          </button>
        </span>
      </div>
      {properties.length ? (
        <div className="property-grid">
          {properties.map((b) => (
            <PropertyCard key={b.id} building={b} />
          ))}
        </div>
      ) : (
        <div className="panel">
          <Empty
            title={
              data.buildings.length
                ? "No properties found"
                : "Let's start your portfolio"
            }
            description={
              data.buildings.length
                ? "Try a different search or area."
                : "Add your first property and its floors. You can add flats and real photos next."
            }
          >
            {!data.buildings.length &&
              ["owner", "manager"].includes(data.membership.role) && (
                <Button variant="primary" onClick={() => openForm("building")}>
                  <Plus size={16} />
                  Add your first property
                </Button>
              )}
          </Empty>
        </div>
      )}
    </>
  );
}
export function PropertyDetail({ id }: { id: string }) {
  const { data, openForm } = useApp();
  const building = data.buildings.find((b) => b.id === id);
  const [floor, setFloor] = useState("all");
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
        eyebrow={`${building.code} · ${building.area.toUpperCase()}`}
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
          </>
        )}
      </PageHeader>
      <div className="detail-banner">
        <div className="detail-art">
          <PropertyCover building={building} />
        </div>
        <div className="panel property-info">
          <Badge tone="mint">{building.code}</Badge>
          <h2>Thoughtfully organised.</h2>
          <p>
            {building.notes ||
              "Your property details, amenities and rental availability."}
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
              <strong>{units.length}</strong>
              <small>Flats</small>
            </div>
            <div>
              <strong>
                {units.length ? Math.round((occupied / units.length) * 100) : 0}
                %
              </strong>
              <small>Occupied</small>
            </div>
          </div>
        </div>
      </div>
      <div className="summary-strip">
        <div>
          <small>Total flats</small>
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
      <SectionHeader
        title="Floor by floor"
        description="Choose a floor to explore its flats."
      >
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
          onClick={() => setFloor("all")}
        >
          All floors · {units.length}
        </button>
        {floors.map((f) => (
          <button
            type="button"
            key={f.id}
            className={floor === f.id ? "active" : ""}
            onClick={() => setFloor(f.id)}
          >
            {f.name} · {units.filter((u) => u.floor_id === f.id).length}
          </button>
        ))}
      </div>
      {units.length ? (
        <div className="units-grid">
          {units
            .filter((u) => floor === "all" || u.floor_id === floor)
            .sort((a, b) =>
              a.code.localeCompare(b.code, undefined, { numeric: true }),
            )
            .map((u) => {
              const status = unitStatus(data, u);
              return (
                <button
                  type="button"
                  key={u.id}
                  className="unit-card"
                  onClick={() => setSelected(u)}
                >
                  <div className="unit-card-head">
                    <strong>Flat {u.code}</strong>
                    <Badge tone={statusTone(status)}>{status}</Badge>
                  </div>
                  <p>
                    {u.category} ·{" "}
                    {u.area_sqft
                      ? `${u.area_sqft.toLocaleString()} sq ft`
                      : "Area not entered"}
                  </p>
                  <p>{data.floors.find((f) => f.id === u.floor_id)?.name}</p>
                  <Money value={u.monthly_rent} />
                  <p>per month</p>
                </button>
              );
            })}
        </div>
      ) : (
        <div className="panel" style={{ marginBottom: 24 }}>
          <Empty
            title="Every flat has a place"
            description="Add your first flat to this building and choose its floor."
          />
        </div>
      )}
      <DocumentPanel
        targetType="building"
        targetId={id}
        title="Property photos, maps & documents"
      />
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
      title={`Flat ${unit.code}`}
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
              openForm("unit", { ...unit });
            }}
          >
            <PencilSimple size={16} />
            Edit flat
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
      <div style={{ padding: 24, borderTop: "1px solid var(--line)" }}>
        <DocumentPanel
          targetType="unit"
          targetId={id}
          title="Flat photos & floor plans"
          compact
        />
      </div>
    </Modal>
  );
}
export function Units() {
  const { data, openForm } = useApp();
  const [query, setQuery] = useState("");
  const [building, setBuilding] = useState("all");
  const [status, setStatus] = useState("all");
  const [category, setCategory] = useState("all");
  const [selected, setSelected] = useState<string | null>(null);
  const list = useList(
    data.units,
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
      <PageHeader
        eyebrow="FLOORS, FLATS & POSSIBILITIES"
        title="Every flat, in view."
        description="Find the right space and keep its details up to date."
      >
        {["owner", "manager"].includes(data.membership.role) && (
          <Button variant="primary" onClick={() => openForm("unit")}>
            <Plus size={18} />
            Add flat
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
          placeholder="Search flats or properties…"
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
        <select
          className="filter-select"
          aria-label="Filter flat status"
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
      <div className="panel">
        {list.total ? (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Flat</th>
                    <th>Property</th>
                    <th>Category</th>
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
                          <strong>Flat {u.code}</strong>
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
                          {u.category}
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
                            aria-label={`View flat ${u.code}`}
                            onClick={() => setSelected(u.id)}
                          >
                            <ArrowRight size={16} />
                          </Button>
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
            title="No flats to show"
            description={
              data.units.length
                ? "Adjust your search or filters to find a flat."
                : "Add a property and its floors, then add your first flat."
            }
          />
        )}
      </div>
      {selected && (
        <UnitModal id={selected} onClose={() => setSelected(null)} />
      )}
    </>
  );
}

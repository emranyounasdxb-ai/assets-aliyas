export type Role = "owner" | "manager" | "accountant" | "viewer";
export type Category = "Studio" | "1 BHK" | "2 BHK" | "3 BHK" | "Shop";
export interface Workspace {
  id: string;
  name: string;
  address: string;
  email: string;
  phone: string;
  is_demo: boolean;
}
export interface Membership {
  workspace_id: string;
  user_id: string;
  role: Role;
  display_name: string;
}
export interface Building {
  id: string;
  workspace_id: string;
  name: string;
  code: string;
  area: string;
  address: string;
  amenities: string[];
  notes: string;
  color: string;
  declared_levels: number | null;
  created_at: string;
}
export interface Floor {
  id: string;
  workspace_id: string;
  building_id: string;
  name: string;
  ordinal: number;
  purpose: "unspecified" | "residential" | "parking" | "service";
  notes: string;
}
export interface Unit {
  id: string;
  workspace_id: string;
  building_id: string;
  floor_id: string;
  code: string;
  category: Category;
  monthly_rent: number;
  area_sqft: number;
  status: "available" | "maintenance";
  amenities: string[];
  notes: string;
}
export interface Tenant {
  id: string;
  workspace_id: string;
  name: string;
  email: string;
  phone: string;
  nationality: string;
  company_name: string;
  trade_license: string;
  notes: string;
  created_at: string;
}
export interface Lease {
  id: string;
  workspace_id: string;
  tenant_id: string;
  unit_id: string;
  reference: string;
  start_date: string;
  end_date: string;
  annual_rent: number;
  installments: number;
  status: "active" | "ended";
  notes: string;
  closed_on: string | null;
}
export type ChequeStatus =
  | "scheduled"
  | "received"
  | "deposited"
  | "cleared"
  | "bounced"
  | "cancelled"
  | "returned";
export interface Cheque {
  id: string;
  workspace_id: string;
  tenant_id: string;
  lease_id: string | null;
  number: string;
  bank: string;
  amount: number;
  due_date: string;
  purpose: "rent" | "security";
  status: ChequeStatus;
  cleared_on: string | null;
}
export interface LedgerEntry {
  id: string;
  tenant_id: string;
  lease_id: string | null;
  cheque_id: string | null;
  kind: "opening" | "rent" | "parking" | "payment" | "adjustment";
  amount: number;
  description: string;
  entry_date: string;
  created_at: string;
}
export interface Deposit {
  id: string;
  tenant_id: string;
  amount: number;
  reference: string;
  status: "held" | "returned";
  received_on: string;
  returned_on: string | null;
}
export interface ParkingLot {
  id: string;
  workspace_id: string;
  building_id: string;
  floor_id: string | null;
  number: string;
  status: "available" | "blocked";
  rate_amount: number | null;
  rate_period: "monthly" | "yearly" | null;
  notes: string;
}
export interface ParkingAllocation {
  id: string;
  workspace_id: string;
  lot_id: string;
  lease_id: string;
  tenant_id: string;
  start_date: string;
  end_date: string;
  status: "active" | "cancelled";
  lot_label: string;
  property_label: string;
  rate_amount: number;
  rate_period: "monthly" | "yearly";
  annual_charge: number;
}
export interface DocumentRecord {
  id: string;
  workspace_id: string;
  target_type: "building" | "floor" | "unit" | "tenant" | "lease";
  target_id: string;
  category: string;
  name: string;
  mime: string;
  size: number;
  group_id: string;
  version: number;
  status: "current" | "superseded" | "archived";
  thumbnail_path: string | null;
  created_at: string;
  scan_engine: string;
}
export interface Notification {
  id: string;
  cheque_id: string;
  kind: "due_soon" | "overdue";
  created_at: string;
}
export interface Activity {
  id: string;
  actor_id: string | null;
  resource_type: string;
  resource_id: string;
  action: string;
  created_at: string;
}
export interface AppData {
  workspace: Workspace;
  workspaces: Workspace[];
  membership: Membership;
  members: Membership[];
  buildings: Building[];
  floors: Floor[];
  units: Unit[];
  tenants: Tenant[];
  leases: Lease[];
  cheques: Cheque[];
  ledger: LedgerEntry[];
  deposits: Deposit[];
  parkingLots: ParkingLot[];
  parkingAllocations: ParkingAllocation[];
  documents: DocumentRecord[];
  notifications: Notification[];
  readNotifications: string[];
  activities: Activity[];
}
export const categories = ["Studio", "1 BHK", "2 BHK", "3 BHK"] as const;
export function unitLabel(unit?: Pick<Unit, "category">) {
  return unit?.category === "Shop" ? "Shop" : "Flat";
}
export function annualParkingCharge(
  lot: Pick<ParkingLot, "rate_amount" | "rate_period">,
) {
  return lot.rate_amount == null
    ? 0
    : lot.rate_period === "monthly"
      ? lot.rate_amount * 12
      : lot.rate_amount;
}
export function parkingAvailable(
  allocations: ParkingAllocation[],
  lot: ParkingLot,
  starts: string,
  ends: string,
) {
  return (
    lot.status === "available" &&
    !allocations.some(
      (a) =>
        a.lot_id === lot.id &&
        a.status === "active" &&
        a.start_date <= ends &&
        a.end_date >= starts,
    )
  );
}
export const documentCategories = [
  "Photo",
  "Floor plan",
  "Passport",
  "Emirates ID",
  "Bank statement",
  "Trade licence",
  "Contract",
  "Other",
];
export const amenityOptions = [
  "Parking",
  "Central AC",
  "Security",
  "Elevator",
  "Balcony",
  "Gym",
  "Swimming pool",
  "Maintenance",
];
export function todayDubai(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dubai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
export function money(cents: number, decimals = false) {
  return new Intl.NumberFormat("en-AE", {
    maximumFractionDigits: decimals ? 2 : cents % 100 ? 2 : 0,
    minimumFractionDigits: decimals ? 2 : 0,
  }).format(cents / 100);
}
export function dateLabel(value: string, options?: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat(
    "en-GB",
    options ?? { day: "numeric", month: "short", year: "numeric" },
  ).format(new Date(`${value.slice(0, 10)}T12:00:00Z`));
}
export function daysUntil(date: string, today = todayDubai()) {
  return Math.round(
    (Date.parse(`${date}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) /
      86400000,
  );
}
export function currentLease(
  data: Pick<AppData, "leases">,
  unitId: string,
  today = todayDubai(),
) {
  return data.leases.find(
    (l) =>
      l.unit_id === unitId &&
      l.status === "active" &&
      l.start_date <= today &&
      l.end_date >= today,
  );
}
export function unitStatus(
  data: Pick<AppData, "leases">,
  unit: Unit,
  today = todayDubai(),
) {
  if (currentLease(data, unit.id, today)) return "Occupied";
  if (unit.status === "maintenance") return "Maintenance";
  if (
    data.leases.some(
      (l) =>
        l.unit_id === unit.id && l.status === "active" && l.start_date > today,
    )
  )
    return "Reserved";
  return "Vacant";
}
export function accountBalance(
  entries: LedgerEntry[],
  tenantId?: string,
  asOf = todayDubai(),
) {
  return entries
    .filter(
      (e) => (!tenantId || e.tenant_id === tenantId) && e.entry_date <= asOf,
    )
    .reduce((sum, e) => sum + e.amount, 0);
}
export function pendingCheque(c: Cheque) {
  return (
    c.purpose === "rent" &&
    ["scheduled", "received", "deposited", "bounced"].includes(c.status)
  );
}
export function visibleNotifications(
  data: Pick<AppData, "notifications" | "cheques">,
) {
  const cheques = new Map(data.cheques.map((c) => [c.id, c]));
  const notices = new Map<string, Notification>();
  for (const notice of data.notifications) {
    const cheque = cheques.get(notice.cheque_id);
    if (!cheque || !pendingCheque(cheque)) continue;
    if (!notices.has(cheque.id) || notice.kind === "overdue")
      notices.set(cheque.id, notice);
  }
  return [...notices.values()].sort((a, b) =>
    (cheques.get(a.cheque_id)?.due_date ?? "").localeCompare(
      cheques.get(b.cheque_id)?.due_date ?? "",
    ),
  );
}
export function installmentSchedule(
  annualCents: number,
  count: number,
  start: string,
) {
  if (
    !Number.isSafeInteger(annualCents) ||
    annualCents < count ||
    ![1, 2, 3, 4, 6, 12].includes(count)
  )
    throw new Error("Invalid installment schedule");
  const [year, month, day] = start.split("-").map(Number);
  return Array.from({ length: count }, (_, i) => {
    const monthDate = new Date(Date.UTC(year, month - 1 + i * (12 / count), 1));
    const lastDay = new Date(
      Date.UTC(monthDate.getUTCFullYear(), monthDate.getUTCMonth() + 1, 0),
    ).getUTCDate();
    monthDate.setUTCDate(Math.min(day, lastDay));
    return {
      amount:
        Math.floor(annualCents / count) +
        (i === count - 1 ? annualCents % count : 0),
      date: monthDate.toISOString().slice(0, 10),
    };
  });
}
export function annualEnd(start: string) {
  const [year, month, day] = start.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year + 1, month, 0)).getUTCDate();
  const anniversary = new Date(
    Date.UTC(year + 1, month - 1, Math.min(day, lastDay)),
  );
  anniversary.setUTCDate(anniversary.getUTCDate() - 1);
  return anniversary.toISOString().slice(0, 10);
}
export function exportCsv(filename: string, rows: (string | number)[][]) {
  const csv = rows
    .map((row) =>
      row
        .map((cell) => {
          let value = String(cell);
          if (/^[\s]*[=+\-@]/.test(value)) value = `'${value}`;
          return `"${value.replaceAll('"', '""')}"`;
        })
        .join(","),
    )
    .join("\r\n");
  const url = URL.createObjectURL(
    new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

import { todayDubai, type AppData, type ParkingAllocation } from "./domain";

export interface ParkingSummary {
  total: number;
  allocated: number;
  available: number;
  blocked: number;
  upcoming: number;
  annualCharges: number;
}
export function parkingReservationStatus(
  allocation: ParkingAllocation,
  today = todayDubai(),
) {
  if (allocation.status === "cancelled") return "Cancelled";
  if (allocation.end_date < today) return "Expired";
  if (allocation.start_date > today) return "Upcoming";
  return "Allocated";
}
export function parkingReport(
  data: Pick<AppData, "parkingLots" | "parkingAllocations">,
  propertyIds: Set<string>,
  today = todayDubai(),
) {
  const current = new Map<string, ParkingAllocation>();
  const next = new Map<string, ParkingAllocation>();
  for (const allocation of data.parkingAllocations) {
    const status = parkingReservationStatus(allocation, today);
    const existing = next.get(allocation.lot_id);
    if (status === "Allocated") current.set(allocation.lot_id, allocation);
    if (
      status === "Upcoming" &&
      (!existing || allocation.start_date < existing.start_date)
    )
      next.set(allocation.lot_id, allocation);
  }
  const empty = (): ParkingSummary => ({
    total: 0,
    allocated: 0,
    available: 0,
    blocked: 0,
    upcoming: 0,
    annualCharges: 0,
  });
  const byBuilding = new Map([...propertyIds].map((id) => [id, empty()]));
  const lots = data.parkingLots
    .filter((lot) => propertyIds.has(lot.building_id))
    .map((lot) => {
      const booking = current.get(lot.id);
      const upcoming = next.get(lot.id);
      const summary = byBuilding.get(lot.building_id) ?? empty();
      byBuilding.set(lot.building_id, summary);
      const status =
        lot.status === "blocked"
          ? "Blocked"
          : booking
            ? "Allocated"
            : "Available";
      summary.total++;
      if (status === "Blocked") summary.blocked++;
      else if (status === "Allocated") summary.allocated++;
      else summary.available++;
      if (upcoming) summary.upcoming++;
      if (booking) summary.annualCharges += booking.annual_charge;
      return { lot, booking, upcoming, status };
    })
    .sort(
      (a, b) =>
        a.lot.building_id.localeCompare(b.lot.building_id) ||
        a.lot.number.localeCompare(b.lot.number, undefined, { numeric: true }),
    );
  const totals = empty();
  for (const summary of byBuilding.values()) {
    for (const key of Object.keys(totals) as (keyof ParkingSummary)[])
      totals[key] += summary[key];
  }
  const lotIds = new Set(lots.map(({ lot }) => lot.id));
  const reservations = data.parkingAllocations
    .filter((a) => lotIds.has(a.lot_id))
    .sort((a, b) => b.start_date.localeCompare(a.start_date));
  return {
    byBuilding,
    lots,
    reservations,
    totals,
    forBuilding: (id: string) => byBuilding.get(id) ?? empty(),
  };
}

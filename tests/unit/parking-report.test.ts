import { describe, expect, it } from "vitest";
import {
  parkingReport,
  parkingReservationStatus,
} from "../../src/lib/parking-report";
import type { ParkingAllocation, ParkingLot } from "../../src/lib/domain";

const today = "2026-11-21";
function lot(id: string, building = "a", status = "available"): ParkingLot {
  return {
    id,
    building_id: building,
    number: id,
    status,
    rate_amount: 999999,
    rate_period: "yearly",
  } as ParkingLot;
}
function booking(
  id: string,
  lotId: string,
  start: string,
  end: string,
  charge: number,
  status = "active",
): ParkingAllocation {
  return {
    id,
    lot_id: lotId,
    start_date: start,
    end_date: end,
    annual_charge: charge,
    status,
  } as ParkingAllocation;
}

describe("Parking reporting", () => {
  it("counts registered lots separately from assignments and keeps future spaces available today", () => {
    const data = {
      parkingLots: [
        lot("current"),
        lot("future"),
        lot("blocked", "a", "blocked"),
        lot("expired"),
        lot("cancelled"),
        lot("other", "b"),
      ],
      parkingAllocations: [
        booking("now", "current", today, today, 123456),
        booking("renewal", "current", "2026-11-22", "2027-11-21", 222222),
        booking("later", "current", "2027-11-22", "2028-11-21", 333333),
        booking("next", "future", "2027-01-01", "2027-12-31", 444444),
        booking("old", "expired", "2025-11-21", "2026-11-20", 555555),
        booking(
          "void",
          "cancelled",
          "2026-01-01",
          "2026-12-31",
          666666,
          "cancelled",
        ),
        booking("outside", "other", "2026-01-01", "2026-12-31", 777777),
      ],
    };
    const report = parkingReport(data, new Set(["a"]), today);
    expect(report.totals).toEqual({
      total: 5,
      allocated: 1,
      available: 3,
      blocked: 1,
      upcoming: 2,
      annualCharges: 123456,
    });
    expect(report.totals.total).toBe(
      report.totals.allocated + report.totals.available + report.totals.blocked,
    );
    expect(report.lots.find((r) => r.lot.id === "future")?.status).toBe(
      "Available",
    );
    expect(report.lots.find((r) => r.lot.id === "current")?.upcoming?.id).toBe(
      "renewal",
    );
    expect(report.reservations.map((r) => r.id)).not.toContain("outside");
    expect(parkingReport(data, new Set(["b"]), today).totals).toEqual({
      total: 1,
      allocated: 1,
      available: 0,
      blocked: 0,
      upcoming: 0,
      annualCharges: 777777,
    });
  });
  it("uses inclusive date boundaries and preserves cancelled and expired history", () => {
    expect(
      parkingReservationStatus(
        booking("a", "l", today, "2027-11-20", 1),
        today,
      ),
    ).toBe("Allocated");
    expect(
      parkingReservationStatus(
        booking("a", "l", "2025-11-22", today, 1),
        today,
      ),
    ).toBe("Allocated");
    expect(
      parkingReservationStatus(
        booking("a", "l", "2026-11-22", "2027-11-21", 1),
        today,
      ),
    ).toBe("Upcoming");
    expect(
      parkingReservationStatus(
        booking("a", "l", "2025-11-21", "2026-11-20", 1),
        today,
      ),
    ).toBe("Expired");
    expect(
      parkingReservationStatus(
        booking("a", "l", today, today, 1, "cancelled"),
        today,
      ),
    ).toBe("Cancelled");
  });
  it("returns zero registered spaces for a building without inventing capacity", () => {
    const report = parkingReport(
      { parkingLots: [], parkingAllocations: [] },
      new Set(["a"]),
      today,
    );
    expect(report.totals).toEqual({
      total: 0,
      allocated: 0,
      available: 0,
      blocked: 0,
      upcoming: 0,
      annualCharges: 0,
    });
    expect(report.forBuilding("a")).toEqual(report.totals);
    expect(report.lots).toEqual([]);
  });
});

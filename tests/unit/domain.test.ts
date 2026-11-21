import { afterEach, describe, expect, it, vi } from "vitest";
import {
  accountBalance,
  annualEnd,
  installmentSchedule,
  todayDubai,
  unitStatus,
  visibleNotifications,
  type Cheque,
  type LedgerEntry,
  type Unit,
} from "../../src/lib/domain";
import { amount, signedAmount } from "../../src/lib/validation";
import { localDemoAllowed } from "../../src/lib/server/env";
afterEach(() => vi.unstubAllEnvs());

describe("Local preview and reminders", () => {
  it("shows only the most relevant reminder for a pending cheque", () => {
    const cheque = {
      id: "c",
      purpose: "rent",
      status: "received",
      due_date: "2026-11-21",
    } as Cheque;
    const notifications = [
      {
        id: "soon",
        cheque_id: "c",
        kind: "due_soon" as const,
        created_at: "2026-11-14",
      },
      {
        id: "late",
        cheque_id: "c",
        kind: "overdue" as const,
        created_at: "2026-11-22",
      },
    ];
    expect(
      visibleNotifications({ cheques: [cheque], notifications }).map(
        (n) => n.id,
      ),
    ).toEqual(["late"]);
    expect(
      visibleNotifications({
        cheques: [{ ...cheque, status: "cleared" }],
        notifications,
      }),
    ).toEqual([]);
  });
  it("allows explicit demo mode only with local request, app and backend", () => {
    vi.stubEnv("LOCAL_DEMO", "true");
    vi.stubEnv("APP_ORIGIN", "http://127.0.0.1:3200");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:56321");
    expect(localDemoAllowed("127.0.0.1:3200")).toBe(true);
    expect(localDemoAllowed("example.test")).toBe(false);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    expect(localDemoAllowed("127.0.0.1:3200")).toBe(false);
  });
  it("does not enable a demo on an externally configured application", () => {
    vi.stubEnv("LOCAL_DEMO", "true");
    vi.stubEnv("APP_ORIGIN", "https://assets.example.test");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:56321");
    expect(localDemoAllowed("127.0.0.1:3200")).toBe(false);
  });
});
describe("Rental amounts and dates", () => {
  it("keeps all cents when dividing annual rent across four and six cheques", () => {
    for (const count of [4, 6]) {
      const schedule = installmentSchedule(5400001, count, "2026-01-31");
      expect(schedule.reduce((s, c) => s + c.amount, 0)).toBe(5400001);
      expect(schedule).toHaveLength(count);
      expect(schedule.every((c) => Number.isInteger(c.amount))).toBe(true);
    }
  });
  it("clamps installment dates to valid month ends", () => {
    expect(installmentSchedule(60000, 6, "2026-12-31")[1].date).toBe(
      "2027-02-28",
    );
    expect(installmentSchedule(60000, 6, "2027-12-31")[1].date).toBe(
      "2028-02-29",
    );
  });
  it("uses the annual end date around leap days", () => {
    expect(annualEnd("2024-02-29")).toBe("2025-02-27");
    expect(annualEnd("2026-11-21")).toBe("2027-11-20");
  });
  it("parses money exactly and rejects extra precision", () => {
    expect(amount.parse("54000.01")).toBe(5400001);
    expect(signedAmount.parse("-125.50")).toBe(-12550);
    expect(amount.safeParse("1.999").success).toBe(false);
    expect(amount.safeParse("1e8").success).toBe(false);
  });
  it("calculates balances as of a date without future charges", () => {
    const entries = [
      { tenant_id: "t", amount: 12550, entry_date: "2026-01-01" },
      { tenant_id: "t", amount: 5400001, entry_date: "2026-02-01" },
      { tenant_id: "t", amount: -900000, entry_date: "2026-02-10" },
      { tenant_id: "t", amount: 100000, entry_date: "2027-01-01" },
    ] as LedgerEntry[];
    expect(accountBalance(entries, "t", "2026-11-21")).toBe(4512551);
  });
  it("uses Dubai's calendar date at UTC day boundaries", () => {
    expect(todayDubai(new Date("2026-11-20T21:30:00Z"))).toBe("2026-11-21");
  });
  it("does not count ended or future agreements as occupied", () => {
    const unit = { id: "u", status: "available" } as Unit;
    const data = {
      leases: [
        {
          unit_id: "u",
          status: "active",
          start_date: "2027-01-01",
          end_date: "2027-12-31",
        },
      ],
    } as Parameters<typeof unitStatus>[0];
    expect(unitStatus(data, unit, "2026-11-21")).toBe("Reserved");
    expect(unitStatus({ leases: [] }, unit, "2026-11-21")).toBe("Vacant");
  });
});

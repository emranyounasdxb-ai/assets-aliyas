import { describe, expect, it } from "vitest";
import {
  commissionBalance,
  type AgentCommission,
  type AgentReceipt,
} from "../../src/lib/domain";
import { createStatements } from "../../database/schema.mjs";
const commission = (amount: number | null) =>
  ({ id: "deal", amount }) as AgentCommission;
const receipt = (
  kind: "received" | "reversal",
  amount: number,
  commission_id = "deal",
) => ({ kind, amount, commission_id }) as AgentReceipt;
describe("Direct agent commission balances", () => {
  it("distinguishes an unentered amount from an explicitly agreed zero", () => {
    expect(commissionBalance(commission(null), [])).toEqual({
      received: 0,
      pending: null,
    });
    expect(commissionBalance(commission(0), [])).toEqual({
      received: 0,
      pending: 0,
    });
  });
  it("calculates partial receipts and their reversals in exact fils", () => {
    expect(
      commissionBalance(commission(125055), [receipt("received", 65025)]),
    ).toEqual({ received: 65025, pending: 60030 });
    expect(
      commissionBalance(commission(125055), [
        receipt("received", 65025),
        receipt("reversal", 65025),
        receipt("received", 100000, "other"),
      ]),
    ).toEqual({ received: 0, pending: 125055 });
  });
  it("adds only agent tracking tables and defines no default commission amount", () => {
    const previous = createStatements(2),
      next = createStatements(3);
    expect(previous.every((s) => next.includes(s))).toBe(true);
    const additions = next.filter((s) => !previous.includes(s));
    expect(additions).toHaveLength(4);
    expect(
      additions.every((s) => /^create table if not exists `agent/.test(s)),
    ).toBe(true);
    const table = additions.find((s) =>
      s.startsWith("create table if not exists `agent_commissions`"),
    );
    expect(table).toContain("`amount` bigint check");
    expect(table).not.toContain("`amount` bigint not null");
    expect(table).not.toContain("3000");
  });
});

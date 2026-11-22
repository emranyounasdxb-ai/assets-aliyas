import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { randomBytes, randomUUID } from "node:crypto";
import { adminDatabase } from "../../database/client.mjs";
import { todayDubai } from "../../src/lib/domain";
const origin = "http://127.0.0.1:3200";
const admin = adminDatabase();
let context: BrowserContext,
  page: Page,
  workspace = "",
  agent = "",
  building = "",
  tenant = "",
  unit = "",
  lease = "",
  commission = "",
  receipt = "",
  receiptDoc = "";
const users: string[] = [],
  workspaces: string[] = [];
async function action(
  name: string,
  data: Record<string, unknown>,
  ctx = context,
) {
  return ctx.request.post(`${origin}/api/records`, {
    headers: { origin },
    data: { action: name, data },
  });
}
async function checked(name: string, data: Record<string, unknown>) {
  const r = await action(name, data);
  expect(r.ok(), await r.text()).toBe(true);
  return r.json();
}
async function rows(table: string, w = workspace) {
  const { data, error } = await admin
    .from(table)
    .select("*")
    .eq("workspace_id", w);
  if (error) throw error;
  return data || [];
}
async function snapshot() {
  const r = await context.request.get(`${origin}/api/workspace`);
  expect(r.ok()).toBe(true);
  return r.json();
}
async function cleanup(w: string) {
  const notices = await rows("notifications", w);
  if (notices.length) {
    const reads = await admin
      .from("notification_reads")
      .delete()
      .in(
        "notification_id",
        notices.map((n) => n.id),
      );
    if (reads.error) throw reads.error;
  }
  const { data: files } = await admin.storage
    .from("aliyas-private")
    .list(w, { limit: 1000 });
  if (files?.length)
    await admin.storage
      .from("aliyas-private")
      .remove(files.map((f) => `${w}/${f.name}`));
  const reversal = await admin
    .from("agent_receipts")
    .delete()
    .eq("workspace_id", w)
    .eq("kind", "reversal");
  if (reversal.error) throw reversal.error;
  for (const table of [
    "agent_receipts",
    "agent_commission_events",
    "agent_commissions",
    "agents",
    "notifications",
    "activities",
    "property_covers",
    "documents",
    "ledger",
    "deposits",
    "cheques",
    "parking_allocations",
    "leases",
    "parking_lots",
    "units",
    "floors",
    "tenants",
    "memberships",
    "buildings",
  ]) {
    const r = await admin.from(table).delete().eq("workspace_id", w);
    if (r.error) throw r.error;
  }
  const r = await admin.from("workspaces").delete().eq("id", w);
  if (r.error) throw r.error;
}
test.describe.serial("Direct customer agent commissions", () => {
  test.beforeAll(async ({ browser }) => {
    if (new URL(process.env.DATABASE_URL || "").hostname !== "127.0.0.1")
      throw new Error("Local database required");
    context = await browser.newContext();
    const login = await context.request.post(`${origin}/api/auth`, {
      headers: { origin },
      data: { action: "demo" },
    });
    expect(login.ok()).toBe(true);
    workspace = (
      await checked("workspace_create", {
        name: "Demo agent commission verification",
      })
    ).id;
    page = await context.newPage();
    building = (
      await checked("building", {
        name: "Demo agent building",
        code: "DEMO-AG",
        area: "Demo area",
        floor_count: 0,
      })
    ).result;
    const floor = (await rows("floors"))[0].id;
    unit = (
      await checked("unit", {
        building_id: building,
        floor_id: floor,
        code: "DEMO-01",
        category: "Studio",
        monthly_rent: "1000",
      })
    ).result.id;
    tenant = (
      await checked("tenant", {
        name: "Demo commission customer",
        phone: "Demo contact",
      })
    ).result;
  });
  test.afterAll(async () => {
    await context?.close();
    for (const w of [workspace, ...workspaces]) if (w) await cleanup(w);
    for (const id of users) await admin.auth.admin.deleteUser(id);
  });
  test("records an agent and leaves agreement commission blank without any default", async () => {
    await page.goto(`${origin}/agents`);
    await page.getByRole("button", { name: "Add agent", exact: true }).click();
    let form = page.getByRole("dialog");
    await form
      .getByLabel("Agent name", { exact: true })
      .fill("Demo rental agent");
    await form.getByLabel("Company", { exact: true }).fill("Demo brokerage");
    await form.getByRole("button", { name: "Save agent", exact: true }).click();
    await expect(form).toHaveCount(0);
    agent = (await rows("agents"))[0].id;
    await page.goto(`${origin}/agreements`);
    await page
      .getByRole("button", { name: "Create agreement", exact: true })
      .click();
    form = page.getByRole("dialog");
    await expect(
      form.getByLabel("Commission amount (AED)", { exact: true }),
    ).toHaveValue("");
    await form.getByLabel("Agent", { exact: true }).selectOption(agent);
    await expect(
      form.getByLabel("Commission amount (AED)", { exact: true }),
    ).toHaveValue("");
    await form.getByLabel("Agreement reference").fill("DEMO-AGENT-01");
    await form
      .getByRole("button", { name: "Create agreement", exact: true })
      .click();
    await expect(form).toHaveCount(0);
    lease = (await rows("leases"))[0].id;
    const c = (await rows("agent_commissions"))[0];
    commission = c.id;
    expect(c.amount).toBeNull();
    expect(c.agent_id).toBe(agent);
    await page.goto(`${origin}/agreements/${lease}`);
    const panel = page.getByRole("region", {
      name: "Agent commission records",
    });
    await expect(
      panel.getByText("Amount not entered", { exact: true }),
    ).toBeVisible();
    await panel
      .getByRole("button", { name: "Edit commission", exact: true })
      .click();
    form = page.getByRole("dialog");
    await expect(
      form.getByLabel("Commission amount (AED)", { exact: true }),
    ).toHaveValue("");
    await form
      .getByLabel("Commission amount (AED)", { exact: true })
      .fill("1250.55");
    await form
      .getByLabel("Reason for change")
      .fill("Demo manually agreed commission");
    await form
      .getByRole("button", { name: "Save commission", exact: true })
      .click();
    await expect(form).toHaveCount(0);
    expect((await rows("agent_commissions"))[0].amount).toBe(125055);
    const stale = await action("agent_commission", {
      id: commission,
      lease_id: lease,
      agent_id: agent,
      amount: "2000",
      reason: "Stale edit",
      expected_revision: 1,
    });
    expect(stale.ok()).toBe(false);
    const next = await checked("lease", {
      tenant_id: tenant,
      unit_id: unit,
      start_date:
        String(Number(todayDubai().slice(0, 4)) + 1) + todayDubai().slice(4),
      annual_rent: "12000",
      installments: 4,
      reference: "DEMO-RENEWAL",
    });
    expect(next.result).toBeTruthy();
    expect(await rows("agent_commissions")).toHaveLength(1);
  });
  test("records direct receipts once, protects balances and preserves correction history", async () => {
    const before = await snapshot();
    const pdf = Buffer.from("%PDF-1.4\n% Demo commission receipt\n%%EOF");
    const uploaded = await context.request.post(`${origin}/api/documents`, {
      headers: { origin },
      multipart: {
        file: {
          name: "demo-agent-receipt.pdf",
          mimeType: "application/pdf",
          buffer: pdf,
        },
        target_type: "lease",
        target_id: lease,
        category: "Other",
        request_key: randomUUID(),
      },
    });
    expect(uploaded.ok(), await uploaded.text()).toBe(true);
    receiptDoc = (await uploaded.json()).id;
    await page.goto(`${origin}/agreements/${lease}`);
    await page
      .getByRole("button", {
        name: "Record customer payment DEMO-AGENT-01",
        exact: true,
      })
      .click();
    let form = page.getByRole("dialog");
    await expect(form.getByLabel("Amount received (AED)")).toHaveValue("");
    await form.getByLabel("Amount received (AED)").fill("650.25");
    await form.getByLabel("Payment reference").fill("DEMO-DIRECT-1");
    await form.getByLabel("Receipt document").selectOption(receiptDoc);
    await form.getByRole("checkbox").check();
    await form
      .getByRole("button", { name: "Record direct payment", exact: true })
      .click();
    await expect(form).toHaveCount(0);
    const payment = (await rows("agent_receipts"))[0];
    receipt = payment.id;
    const retry = {
      commission_id: commission,
      amount: "650.25",
      entry_date: todayDubai(),
      method: "bank",
      reference: "DEMO-DIRECT-1",
      receipt_document_id: receiptDoc,
      confirmed: true,
      request_key: payment.request_key,
    };
    expect((await action("agent_receipt", retry)).ok()).toBe(true);
    expect(await rows("agent_receipts")).toHaveLength(1);
    expect((await action("document_archive", { id: receiptDoc })).ok()).toBe(
      false,
    );
    expect(
      (
        await action("agent_receipt", {
          ...retry,
          amount: "900",
          request_key: randomUUID(),
          reference: "OVERPAY",
        })
      ).ok(),
    ).toBe(false);
    expect(
      (
        await action("agent_receipt", {
          ...retry,
          amount: "10",
          request_key: randomUUID(),
          confirmed: false,
          reference: "UNCONFIRMED",
        })
      ).ok(),
    ).toBe(false);
    const c = (await rows("agent_commissions"))[0];
    expect(
      (
        await action("agent_commission", {
          id: commission,
          lease_id: lease,
          agent_id: agent,
          amount: "100",
          reason: "Below received",
          expected_revision: c.revision,
        })
      ).ok(),
    ).toBe(false);
    const attempts = await Promise.all(
      ["A", "B"].map((reference) =>
        action("agent_receipt", {
          ...retry,
          amount: "450",
          request_key: randomUUID(),
          reference: `DEMO-RACE-${reference}`,
          receipt_document_id: "",
        }),
      ),
    );
    expect(attempts.filter((r) => r.ok())).toHaveLength(1);
    const race = (await rows("agent_receipts")).find((r) =>
      r.reference.startsWith("DEMO-RACE-"),
    );
    expect(race).toBeTruthy();
    if (!race) throw new Error("Concurrent payment fixture missing");
    await checked("agent_receipt_reverse", {
      id: race.id,
      reason: "Demo race fixture correction",
      request_key: randomUUID(),
    });
    await page.goto(`${origin}/agents/${agent}`);
    await page
      .getByRole("button", { name: "Reverse DEMO-DIRECT-1", exact: true })
      .click();
    form = page.getByRole("dialog");
    await form
      .getByLabel("Reversal reason")
      .fill("Demo payment entered incorrectly");
    await form
      .getByRole("button", { name: "Reverse payment", exact: true })
      .click();
    await expect(form).toHaveCount(0);
    expect(
      (
        await action("agent_receipt_reverse", {
          id: receipt,
          reason: "Double reversal",
          request_key: randomUUID(),
        })
      ).ok(),
    ).toBe(false);
    expect(await rows("agent_receipts")).toHaveLength(4);
    expect((await rows("agent_commission_events")).length).toBe(2);
    const after = await snapshot();
    expect(after.ledger).toEqual(before.ledger);
    expect(after.cheques).toEqual(before.cheques);
    expect(after.deposits).toEqual(before.deposits);
    await page.goto(`${origin}/properties/${building}`);
    await expect(
      page
        .getByRole("region", { name: "Agent commission records" })
        .getByText("Demo rental agent", { exact: true }),
    ).toBeVisible();
    await page.goto(`${origin}/tenants/${tenant}`);
    await page
      .getByRole("tab", { name: "Agent commission", exact: true })
      .click();
    await expect(
      page
        .getByRole("tabpanel", { name: "Agent commission", exact: true })
        .getByText("Demo rental agent", { exact: true }),
    ).toBeVisible();
  });
  test("rejects viewer and cross-workspace access and keeps forms and exports usable", async ({
    browser,
  }) => {
    for (const outsider of [false, true]) {
      const email = `${randomUUID()}@example.test`,
        password = randomBytes(24).toString("base64url");
      const user = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      expect(user.error).toBeNull();
      if (!user.data.user) throw new Error("Restricted user fixture missing");
      const id = user.data.user.id;
      users.push(id);
      let w = workspace;
      if (outsider) {
        const r = await admin
          .from("workspaces")
          .insert({ name: "Demo isolated agent workspace", is_demo: true })
          .select("id")
          .single();
        w = r.data.id;
        workspaces.push(w);
      }
      const membership = await admin.from("memberships").insert({
        workspace_id: w,
        user_id: id,
        role: outsider ? "owner" : "viewer",
        display_name: "Demo restricted user",
      });
      expect(membership.error).toBeNull();
      const other = await browser.newContext();
      const login = await other.request.post(`${origin}/api/auth`, {
        headers: { origin },
        data: { action: "login", email, password },
      });
      expect(login.ok()).toBe(true);
      const data = await (
        await other.request.get(`${origin}/api/workspace`)
      ).json();
      expect(data.agents).toHaveLength(0);
      expect(data.agentCommissions).toHaveLength(0);
      expect(data.agentReceipts).toHaveLength(0);
      expect(data.agentCommissionEvents).toHaveLength(0);
      expect(
        (
          await action(
            "agent_commission",
            {
              id: commission,
              lease_id: lease,
              agent_id: agent,
              amount: "9",
              reason: "Forbidden",
              expected_revision: 2,
            },
            other,
          )
        ).ok(),
      ).toBe(false);
      expect(
        (
          await action(
            "agent_receipt",
            {
              commission_id: commission,
              amount: "1",
              entry_date: todayDubai(),
              method: "cash",
              reference: "FORBIDDEN",
              confirmed: true,
              request_key: randomUUID(),
            },
            other,
          )
        ).ok(),
      ).toBe(false);
      expect(
        (
          await other.request.get(`${origin}/api/documents/${receiptDoc}/file`)
        ).status(),
      ).toBe(404);
      await other.close();
    }
    await page.goto(`${origin}/agents/${agent}`);
    const download = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Export statement", exact: true })
      .click();
    expect((await download).suggestedFilename()).toContain("agent-statement");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page
      .getByRole("button", { name: "Record commission", exact: true })
      .click();
    const form = page.getByRole("dialog");
    await expect(
      form.getByLabel("Commission amount (AED)", { exact: true }),
    ).toHaveValue("");
    expect(
      await form.evaluate((d) => {
        const r = d.getBoundingClientRect();
        return r.left >= 0 && r.right <= innerWidth;
      }),
    ).toBe(true);
    await page.keyboard.press("Tab");
    expect(await form.evaluate((d) => d.contains(document.activeElement))).toBe(
      true,
    );
    await page.keyboard.press("Escape");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto(`${origin}/agents`);
    const size = await page.locator(".stable-region").first().boundingBox();
    await page
      .getByRole("textbox", { name: "Search agents…" })
      .fill("no matching agent");
    await expect(
      page.getByText("No matching agents", { exact: true }),
    ).toBeVisible();
    const next = await page.locator(".stable-region").first().boundingBox();
    if (!next || !size) throw new Error("Agent result area missing");
    expect(Math.abs(next.height - size.height)).toBeLessThan(2);
  });
});

import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomBytes, randomUUID } from "node:crypto";
import net from "node:net";
import sharp from "sharp";
import { todayDubai } from "../../src/lib/domain";
const origin = "http://127.0.0.1:3200";
let context: BrowserContext;
let page: Page;
let admin: SupabaseClient;
let workspace = "";
let tenant = "";
let unit = "";
let building = "";
let lease = "";
let documentId = "";
let propertyPhoto = "";
const auxiliaryUsers: string[] = [];
const auxiliaryWorkspaces: string[] = [];
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
async function readRows(table: string) {
  const rows = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await admin
      .from(table)
      .select("*")
      .eq("workspace_id", workspace)
      .order("id")
      .range(offset, offset + 999);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) return rows;
  }
}
async function checkedAction(name: string, data: Record<string, unknown>) {
  const response = await action(name, data);
  expect(response.ok(), await response.text()).toBe(true);
  return response.json();
}
async function cleanupWorkspace(id: string) {
  const { data: files } = await admin.storage
    .from("aliyas-private")
    .list(id, { limit: 1000 });
  if (files?.length)
    await admin.storage
      .from("aliyas-private")
      .remove(files.map((f) => `${id}/${f.name}`));
  const { data: notices } = await admin
    .from("notifications")
    .select("id")
    .eq("workspace_id", id);
  if (notices?.length)
    await admin
      .from("notification_reads")
      .delete()
      .in(
        "notification_id",
        notices.map((n) => n.id),
      );
  for (const table of [
    "activities",
    "notifications",
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
    const { error } = await admin.from(table).delete().eq("workspace_id", id);
    if (error) throw error;
  }
  const { error } = await admin.from("workspaces").delete().eq("id", id);
  if (error) throw error;
}
test.describe.serial("Property management workspace", () => {
  test("the file scanner rejects the harmless antivirus test signature", async () => {
    const signature = Buffer.from(
      "X5O!P%@AP[4\\PZX54(P^)7CC)7}$" +
        "EICAR-" +
        "STANDARD-ANTIVIRUS-TEST-FILE!$H+H*",
    );
    const result = await new Promise<string>((resolve, reject) => {
      const socket = net.createConnection({ host: "127.0.0.1", port: 56331 });
      let reply = "";
      socket.setTimeout(10000, () => {
        socket.destroy();
        reject(new Error("Scanner test timed out"));
      });
      socket.on("error", reject);
      socket.on("connect", () => {
        const length = Buffer.alloc(4);
        length.writeUInt32BE(signature.length);
        socket.write(
          Buffer.concat([
            Buffer.from("zINSTREAM\0"),
            length,
            signature,
            Buffer.alloc(4),
          ]),
        );
      });
      socket.on("data", (chunk) => {
        reply += chunk.toString();
        if (reply.includes("\0")) {
          socket.end();
          resolve(reply);
        }
      });
    });
    expect(result).toContain("FOUND");
  });
  test.beforeAll(async ({ browser }) => {
    const backend = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const secret = process.env.SUPABASE_SECRET_KEY;
    if (!backend || !secret || new URL(backend).hostname !== "127.0.0.1")
      throw new Error("Tests require the local backend");
    admin = createClient(backend, secret, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    context = await browser.newContext();
    const login = await context.request.post(`${origin}/api/auth`, {
      headers: { origin },
      data: { action: "demo" },
    });
    expect(login.ok(), await login.text()).toBe(true);
    const response = await checkedAction("workspace_create", {
      name: `Verification workspace ${Date.now()}`,
    });
    workspace = response.id;
    page = await context.newPage();
  });
  test.afterAll(async () => {
    await context?.close();
    for (const id of [workspace, ...auxiliaryWorkspaces])
      if (id) await cleanupWorkspace(id);
    for (const id of auxiliaryUsers) await admin.auth.admin.deleteUser(id);
  });
  test("creates and edits a property and saves its floors after reload", async () => {
    await page.goto(`${origin}/properties`);
    await page
      .getByRole("button", { name: "Add property", exact: true })
      .click();
    const form = page.getByRole("dialog");
    await form.getByLabel("Property name").fill("Verification Residence");
    await form.getByLabel("Property code").fill("QA-RES");
    await form.getByLabel("Area", { exact: true }).fill("Al Nuaimiya");
    await form.getByLabel("Upper floors").fill("2");
    await form
      .getByRole("button", { name: "Save property", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Verification Residence" }),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Verification Residence" }),
    ).toBeVisible();
    const rows = await readRows("buildings");
    expect(rows).toHaveLength(1);
    building = rows[0].id;
    expect(await readRows("floors")).toHaveLength(3);
    await page
      .getByRole("button", { name: "Edit Verification Residence" })
      .click();
    await page
      .getByRole("dialog")
      .getByLabel("Area", { exact: true })
      .fill("Al Rawda");
    await page
      .getByRole("button", { name: "Save changes", exact: true })
      .click();
    await expect(page.getByText("Al Rawda, Ajman")).toBeVisible();
  });
  test("adds a flat and a tenant through their forms", async () => {
    await page.goto(`${origin}/properties/${building}`);
    await page.getByRole("button", { name: "Add flat", exact: true }).click();
    let form = page.getByRole("dialog");
    await form.getByLabel("Flat number").fill("101");
    await form.getByLabel("Monthly asking rent (AED)").fill("4500");
    await form.getByLabel("Area (sq ft)").fill("780");
    await form.getByRole("button", { name: "Save flat", exact: true }).click();
    await expect(page.getByRole("button", { name: /Flat 101/ })).toBeVisible();
    unit = (await readRows("units"))[0].id;
    await page.goto(`${origin}/tenants`);
    await page.getByRole("button", { name: "Add tenant", exact: true }).click();
    form = page.getByRole("dialog");
    await form.getByLabel("Full name").fill("Verification Tenant");
    await form.getByLabel("Phone number").fill("+971 50 000 0000");
    await form.getByLabel("Email address").fill("verification@example.test");
    await form.getByLabel("Opening balance (AED)").fill("125.50");
    await form
      .getByRole("button", { name: "Save tenant", exact: true })
      .click();
    await expect(page.getByText("Verification Tenant")).toBeVisible();
    tenant = (await readRows("tenants"))[0].id;
    expect((await readRows("ledger"))[0].amount).toBe(12550);
  });
  test("creates an annual agreement with exact installments and rejects an overlap", async () => {
    await page.goto(`${origin}/agreements`);
    await page
      .getByRole("button", { name: "Create agreement", exact: true })
      .click();
    const form = page.getByRole("dialog");
    await form.getByLabel("Annual agreed rent (AED)").fill("54000.01");
    await form.getByLabel("Rent cheques").selectOption("6");
    await form.getByLabel("Agreement reference").fill("QA-AGREEMENT-01");
    await form.getByLabel("Tenant's bank").fill("Verification Bank");
    await form
      .getByRole("button", { name: "Create agreement", exact: true })
      .click();
    await expect(
      page.getByRole("link", { name: "QA-AGREEMENT-01", exact: true }),
    ).toBeVisible();
    lease = (await readRows("leases"))[0].id;
    const checks = await readRows("cheques");
    expect(checks).toHaveLength(6);
    expect(checks.reduce((s, c) => s + c.amount, 0)).toBe(5400001);
    expect(checks.every((c) => c.status === "scheduled")).toBe(true);
    const overlap = await action("lease", {
      tenant_id: tenant,
      unit_id: unit,
      start_date: todayDubai(),
      annual_rent: "54000",
      installments: 4,
      reference: "QA-OVERLAP",
      bank: "",
    });
    expect(overlap.status()).toBe(400);
    expect(await readRows("leases")).toHaveLength(1);
    expect(await readRows("ledger")).toHaveLength(2);
  });
  test("clears a cheque and credits a payment once, keeping security separate", async () => {
    const cheque = (await readRows("cheques")).sort((a, b) =>
      a.due_date.localeCompare(b.due_date),
    )[0];
    const payload = {
      id: cheque.id,
      status: "cleared",
      number: "QA-470001",
      bank: "Verification Bank",
      on_date: todayDubai(),
    };
    await Promise.all([
      checkedAction("cheque", payload),
      checkedAction("cheque", payload),
    ]);
    let entries = await readRows("ledger");
    expect(entries.filter((e) => e.cheque_id === cheque.id)).toHaveLength(1);
    const request_key = randomUUID();
    const payment = {
      tenant_id: tenant,
      amount: "-20.25",
      kind: "payment",
      description: "Verification bank transfer",
      entry_date: todayDubai(),
      request_key,
    };
    await checkedAction("account", payment);
    await checkedAction("account", payment);
    entries = await readRows("ledger");
    expect(
      entries.filter((e) => e.idempotency_key === request_key),
    ).toHaveLength(1);
    const count = entries.length;
    await checkedAction("security", {
      tenant_id: tenant,
      amount: "1500",
      reference: "QA-CASH-SEC",
      type: "cash",
    });
    await checkedAction("security", {
      tenant_id: tenant,
      amount: "5000",
      reference: "QA-CHEQUE-SEC",
      type: "cheque",
      bank: "Verification Bank",
    });
    expect(await readRows("ledger")).toHaveLength(count);
    const security = (await readRows("cheques")).find(
      (c) => c.purpose === "security",
    );
    const invalid = await action("cheque", {
      id: security.id,
      status: "cleared",
      number: security.number,
      bank: security.bank,
      on_date: todayDubai(),
    });
    expect(invalid.status()).toBe(400);
    const future = (await readRows("cheques")).filter(
      (c) => c.purpose === "rent" && c.status === "scheduled",
    )[0];
    const tomorrow = new Date(`${todayDubai()}T12:00:00Z`);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    expect(
      (
        await action("cheque", {
          id: future.id,
          status: "cleared",
          number: future.number,
          bank: future.bank,
          on_date: tomorrow.toISOString().slice(0, 10),
        })
      ).status(),
    ).toBe(400);
  });
  test("uploads, versions, retries and privately downloads a scanned document", async () => {
    const pdfPage = await context.newPage();
    await pdfPage.setContent(
      "<html><body><h1>Verification document</h1><p>Fictional test data only.</p></body></html>",
    );
    const pdf = await pdfPage.pdf({ format: "A4" });
    await pdfPage.close();
    await page.goto(`${origin}/tenants/${tenant}`);
    await page.getByRole("tab", { name: /Documents/ }).click();
    await page.getByRole("button", { name: "Upload", exact: true }).click();
    let form = page.getByRole("dialog");
    await form.getByLabel("Document category").selectOption("Passport");
    await form.getByLabel("Choose document file").setInputFiles({
      name: "verification-passport.pdf",
      mimeType: "application/pdf",
      buffer: pdf,
    });
    await form
      .getByRole("button", { name: "Upload document", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 60000 });
    await expect(
      page.getByText("verification-passport.pdf", { exact: true }),
    ).toBeVisible();
    const docs = await readRows("documents");
    expect(docs).toHaveLength(1);
    documentId = docs[0].id;
    expect(docs[0].scan_engine).toBe("ClamAV");
    expect(
      (
        await context.request.get(`${origin}/api/documents/${documentId}/file`)
      ).status(),
    ).toBe(200);
    await page
      .getByRole("button", { name: "Replace verification-passport.pdf" })
      .click();
    form = page.getByRole("dialog");
    await form.getByLabel("Choose document file").setInputFiles({
      name: "verification-passport-v2.pdf",
      mimeType: "application/pdf",
      buffer: pdf,
    });
    await form
      .getByRole("button", { name: "Upload document", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 60000 });
    await expect(
      page.getByText("verification-passport-v2.pdf", { exact: true }),
    ).toBeVisible();
    const versions = await readRows("documents");
    expect(versions).toHaveLength(2);
    const latest = versions.find((d) => d.status === "current");
    expect(latest.version).toBe(2);
    expect(versions.find((d) => d.id === documentId).status).toBe("superseded");
    const retry = await context.request.post(`${origin}/api/documents`, {
      headers: { origin },
      multipart: {
        file: { name: latest.name, mimeType: "application/pdf", buffer: pdf },
        target_type: "tenant",
        target_id: tenant,
        category: "Passport",
        request_key: latest.upload_key,
      },
    });
    expect(retry.ok(), await retry.text()).toBe(true);
    expect(await readRows("documents")).toHaveLength(2);
    const invalid = await context.request.post(`${origin}/api/documents`, {
      headers: { origin },
      multipart: {
        file: {
          name: "disguised.pdf",
          mimeType: "application/pdf",
          buffer: Buffer.from("<script>not a document</script>"),
        },
        target_type: "tenant",
        target_id: tenant,
        category: "Passport",
        request_key: randomUUID(),
      },
    });
    expect(invalid.status()).toBe(400);
    expect(await readRows("documents")).toHaveLength(2);
  });
  test("stores a private original image and a WebP property preview", async () => {
    const png = await sharp({
      create: {
        width: 64,
        height: 48,
        channels: 3,
        background: { r: 110, g: 145, b: 95 },
      },
    })
      .png()
      .toBuffer();
    const response = await context.request.post(`${origin}/api/documents`, {
      headers: { origin },
      multipart: {
        file: {
          name: "verification-property.png",
          mimeType: "image/png",
          buffer: png,
        },
        target_type: "building",
        target_id: building,
        category: "Photo",
        request_key: randomUUID(),
      },
    });
    expect(response.ok(), await response.text()).toBe(true);
    propertyPhoto = (await response.json()).id;
    const original = await context.request.get(
      `${origin}/api/documents/${propertyPhoto}/file`,
    );
    expect(await original.body()).toEqual(png);
    const preview = await context.request.get(
      `${origin}/api/documents/${propertyPhoto}/file?preview=1`,
    );
    expect((await preview.body()).subarray(8, 12).toString()).toBe("WEBP");
    const stored = (await readRows("documents")).find(
      (d) => d.id === propertyPhoto,
    );
    const publicFile = await context.request.get(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/aliyas-private/${stored.storage_path}`,
    );
    expect(publicFile.status()).not.toBe(200);
  });
  test("accepts a supported document larger than the framework default body buffer", async () => {
    const padding = Buffer.alloc(11 * 1024 * 1024, 32);
    const pdf = Buffer.concat([
      Buffer.from("%PDF-1.4\n% Local fictional upload limit check\n"),
      padding,
      Buffer.from("\n%%EOF"),
    ]);
    const response = await context.request.post(`${origin}/api/documents`, {
      headers: { origin },
      multipart: {
        file: {
          name: "verification-large.pdf",
          mimeType: "application/pdf",
          buffer: pdf,
        },
        target_type: "tenant",
        target_id: tenant,
        category: "Other",
        request_key: randomUUID(),
      },
    });
    expect(response.ok(), await response.text()).toBe(true);
    const id = (await response.json()).id;
    expect((await readRows("documents")).find((d) => d.id === id).size).toBe(
      pdf.length,
    );
  });
  test("keeps reports complete beyond the database API page size", async () => {
    const rows = Array.from({ length: 1005 }, (_, index) => ({
      workspace_id: workspace,
      tenant_id: tenant,
      lease_id: lease,
      number: `QA-PAGE-${index}`,
      bank: "Verification Bank",
      amount: 1,
      due_date: todayDubai(),
      purpose: "rent",
      status: "cancelled",
    }));
    const { error } = await admin.from("cheques").insert(rows);
    if (error) throw error;
    await page.goto(`${origin}/cheques`);
    await expect(page.getByText("1–10 of 1011", { exact: true })).toBeVisible();
  });
  test("denies anonymous requests, viewer mutations and cross-workspace document access", async ({
    browser,
  }) => {
    const anonymous = await browser.newContext();
    expect(
      (
        await anonymous.request.get(
          `${origin}/api/documents/${documentId}/file`,
        )
      ).status(),
    ).toBe(401);
    expect(
      (
        await anonymous.request.post(`${origin}/api/records`, {
          headers: { origin },
          data: { action: "tenant", data: {} },
        })
      ).status(),
    ).toBe(401);
    await anonymous.close();
    expect(
      (
        await context.request.post(`${origin}/api/records`, {
          headers: { origin: "https://example.test" },
          data: { action: "tenant", data: {} },
        })
      ).status(),
    ).toBe(403);
    for (const role of ["viewer", "outsider"]) {
      const email = `${randomUUID()}@example.test`;
      const password = randomBytes(24).toString("base64url");
      const { data: user, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (error || !user.user)
        throw new Error("Could not create test principal");
      auxiliaryUsers.push(user.user.id);
      let memberWorkspace = workspace;
      if (role === "outsider") {
        const { data: created, error: createError } = await admin
          .from("workspaces")
          .insert({ name: "Verification isolated workspace", is_demo: true })
          .select("id")
          .single();
        if (createError || !created)
          throw new Error("Could not create isolated workspace");
        memberWorkspace = created.id;
        auxiliaryWorkspaces.push(created.id);
      }
      const { error: membershipError } = await admin
        .from("memberships")
        .insert({
          workspace_id: memberWorkspace,
          user_id: user.user.id,
          role: role === "viewer" ? "viewer" : "owner",
          display_name: `Verification ${role}`,
        });
      if (membershipError) throw membershipError;
      const other = await browser.newContext();
      const response = await other.request.post(`${origin}/api/auth`, {
        headers: { origin },
        data: { action: "login", email, password },
      });
      expect(response.ok(), await response.text()).toBe(true);
      expect(
        (
          await other.request.get(`${origin}/api/documents/${documentId}/file`)
        ).status(),
      ).toBe(404);
      if (role === "viewer") {
        expect(
          (
            await action(
              "parking_lot",
              {
                building_id: building,
                floor_id: "",
                number: "FORBIDDEN",
                status: "available",
                rate_amount: "100",
                rate_period: "monthly",
              },
              other,
            )
          ).status(),
        ).toBe(403);
        expect(
          (
            await action(
              "parking_allocate",
              { lease_id: lease, lot_ids: [unit] },
              other,
            )
          ).status(),
        ).toBe(403);
        expect(
          (
            await action(
              "tenant",
              { name: "Forbidden", phone: "No contact" },
              other,
            )
          ).status(),
        ).toBe(403);
        expect(
          (
            await other.request.get(
              `${origin}/api/documents/${propertyPhoto}/file?preview=1`,
            )
          ).status(),
        ).toBe(200);
      } else {
        const authClient = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
          process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
          { auth: { persistSession: false, autoRefreshToken: false } },
        );
        await authClient.auth.signInWithPassword({ email, password });
        const { data: rows } = await authClient
          .from("tenants")
          .select("id")
          .eq("workspace_id", workspace);
        expect(rows ?? []).toHaveLength(0);
      }
      await other.close();
    }
  });
  test("edits floor use and prevents apartments on service and parking levels", async () => {
    const floors = await readRows("floors");
    const floor = floors.find((f) => f.name === "Floor 2");
    expect(floor).toBeTruthy();
    await page.goto(`${origin}/properties/${building}`);
    await page
      .getByLabel("Choose floor", { exact: true })
      .selectOption(floor.id);
    await page
      .getByRole("button", { name: "Edit Floor 2", exact: true })
      .click();
    const form = page.getByRole("dialog");
    await form.getByLabel("Floor use").selectOption("service");
    await form
      .getByLabel("Floor notes")
      .fill("Verification gym. No apartments.");
    await form
      .getByRole("button", { name: "Save changes", exact: true })
      .click();
    await expect(form).toHaveCount(0);
    expect(
      (await readRows("floors")).find((f) => f.id === floor.id).purpose,
    ).toBe("service");
    const payload = {
      building_id: building,
      floor_id: floor.id,
      code: "BLOCKED-SERVICE",
      category: "Studio",
      monthly_rent: "1000",
      area_sqft: 400,
      amenities: [],
    };
    expect((await action("unit", payload)).status()).toBe(400);
    await checkedAction("floor", { ...floor, purpose: "parking" });
    expect(
      (await action("unit", { ...payload, code: "BLOCKED-PARKING" })).status(),
    ).toBe(400);
    await checkedAction("floor", { ...floor, purpose: "unspecified" });
  });
  test("reserves multiple paid parking lots with the combined agreement cheque schedule", async () => {
    const floors = await readRows("floors");
    const ground = floors.find(
      (f) => f.building_id === building && f.ordinal === 0,
    );
    await page.goto(`${origin}/parking`);
    await page
      .getByRole("button", { name: "Add parking lot", exact: true })
      .click();
    let form = page.getByRole("dialog");
    await form.getByLabel("Parking number", { exact: true }).fill("QA-P1-A");
    await form.getByLabel("Property", { exact: true }).selectOption(building);
    await form
      .getByLabel("Parking level", { exact: true })
      .selectOption(ground.id);
    await form.getByLabel("Reference parking rate (AED)").fill("100");
    await form
      .getByLabel("Rate period", { exact: true })
      .selectOption("monthly");
    await form
      .getByRole("button", { name: "Save parking lot", exact: true })
      .click();
    await expect(form).toHaveCount(0);
    await checkedAction("parking_lot", {
      building_id: building,
      floor_id: ground.id,
      number: "QA-P1-B",
      status: "available",
      rate_amount: "2400",
      rate_period: "yearly",
      notes: "Fictional verification lot",
    });
    const lots = await readRows("parking_lots");
    const lotA = lots.find((l) => l.number === "QA-P1-A");
    const lotB = lots.find((l) => l.number === "QA-P1-B");
    await checkedAction("unit", {
      building_id: building,
      floor_id: ground.id,
      code: "QA-PARK-A",
      category: "Studio",
      monthly_rent: "2000",
      area_sqft: 500,
      amenities: [],
    });
    const apartment = (await readRows("units")).find(
      (u) => u.code === "QA-PARK-A",
    );
    await page.goto(`${origin}/agreements`);
    await page
      .getByRole("button", { name: "Create agreement", exact: true })
      .click();
    form = page.getByRole("dialog");
    await form.getByLabel("Tenant", { exact: true }).selectOption(tenant);
    await form.getByLabel("Flat", { exact: true }).selectOption(apartment.id);
    await form
      .getByLabel("Agreement reference", { exact: true })
      .fill("QA-PARK-COMBINED");
    await form.getByLabel("Annual agreed rent (AED)").fill("24000");
    await form.getByRole("checkbox", { name: /Lot QA-P1-A/ }).check();
    await form.getByRole("checkbox", { name: /Lot QA-P1-B/ }).check();
    await expect(form.getByText(/27,600/)).toBeVisible();
    await form
      .getByRole("button", { name: "Create agreement", exact: true })
      .click();
    await expect(form).toHaveCount(0);
    const agreement = (await readRows("leases")).find(
      (l) => l.reference === "QA-PARK-COMBINED",
    );
    const allocations = (await readRows("parking_allocations")).filter(
      (a) => a.lease_id === agreement.id,
    );
    expect(allocations).toHaveLength(2);
    expect(allocations.reduce((s, a) => s + a.annual_charge, 0)).toBe(360000);
    const cheques = (await readRows("cheques")).filter(
      (c) => c.lease_id === agreement.id,
    );
    expect(cheques).toHaveLength(4);
    expect(cheques.every((c) => c.amount === 690000)).toBe(true);
    await checkedAction("parking_allocate", {
      lease_id: agreement.id,
      lot_ids: [lotA.id, lotB.id],
    });
    expect(
      (await readRows("ledger")).filter(
        (e) => e.lease_id === agreement.id && e.kind === "parking",
      ),
    ).toHaveLength(2);
    await checkedAction("parking_lot", {
      ...lotA,
      floor_id: ground.id,
      rate_amount: "200",
      rate_period: "monthly",
    });
    expect(
      (await readRows("parking_allocations")).find((a) => a.lot_id === lotA.id)
        .annual_charge,
    ).toBe(120000);
    await page.goto(`${origin}/agreements/${agreement.id}`);
    await expect(
      page.getByText("Ground floor · Lot QA-P1-A", { exact: true }).first(),
    ).toBeVisible();
    await page
      .getByRole("button", {
        name: "Remove parking Ground floor · Lot QA-P1-A",
        exact: true,
      })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Remove parking", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(
      (await readRows("cheques"))
        .filter((c) => c.lease_id === agreement.id)
        .reduce((s, c) => s + c.amount, 0),
    ).toBe(2640000);
    const before = (await readRows("ledger")).filter(
      (e) => e.lease_id === agreement.id,
    ).length;
    const firstCheque = (await readRows("cheques")).find(
      (c) => c.lease_id === agreement.id,
    );
    await checkedAction("cheque", {
      id: firstCheque.id,
      status: "received",
      number: firstCheque.number,
      bank: "Verification Bank",
      on_date: todayDubai(),
    });
    const remaining = (await readRows("parking_allocations")).find(
      (a) => a.lease_id === agreement.id && a.status === "active",
    );
    expect(
      (await action("parking_cancel", { id: remaining.id })).status(),
    ).toBe(400);
    expect(
      (await readRows("ledger")).filter((e) => e.lease_id === agreement.id),
    ).toHaveLength(before);
    expect(
      (
        await action("parking_lot", {
          ...lotB,
          number: "FORBIDDEN-RENAME",
          rate_amount: "2400",
          rate_period: "yearly",
        })
      ).status(),
    ).toBe(400);
  });
  test("prevents simultaneous double parking allocation and cross-building assignment", async () => {
    const ground = (await readRows("floors")).find(
      (f) => f.building_id === building && f.ordinal === 0,
    );
    await checkedAction("parking_lot", {
      building_id: building,
      floor_id: ground.id,
      number: "QA-RACE",
      status: "available",
      rate_amount: "1800",
      rate_period: "yearly",
    });
    const lot = (await readRows("parking_lots")).find(
      (l) => l.number === "QA-RACE",
    );
    const ids = [];
    for (const suffix of ["B", "C"]) {
      await checkedAction("unit", {
        building_id: building,
        floor_id: ground.id,
        code: `QA-PARK-${suffix}`,
        category: "Studio",
        monthly_rent: "2000",
        amenities: [],
      });
      const apartment = (await readRows("units")).find(
        (u) => u.code === `QA-PARK-${suffix}`,
      );
      const id = await checkedAction("lease", {
        tenant_id: tenant,
        unit_id: apartment.id,
        start_date: todayDubai(),
        annual_rent: "24000",
        installments: 4,
        reference: `QA-PARK-${suffix}`,
      });
      ids.push(id.result);
    }
    const results = await Promise.all(
      ids.map((lease_id) =>
        action("parking_allocate", { lease_id, lot_ids: [lot.id] }),
      ),
    );
    expect(results.map((r) => r.status()).sort()).toEqual([200, 400]);
    const active = (await readRows("parking_allocations")).filter(
      (a) => a.lot_id === lot.id && a.status === "active",
    );
    expect(active).toHaveLength(1);
    const loser = ids.find((id) => id !== active[0].lease_id);
    expect(
      (await readRows("ledger")).filter(
        (e) => e.lease_id === loser && e.kind === "parking",
      ),
    ).toHaveLength(0);
    expect(
      (await readRows("cheques"))
        .filter((c) => c.lease_id === loser)
        .reduce((s, c) => s + c.amount, 0),
    ).toBe(2400000);
    const otherId = (
      await checkedAction("building", {
        name: "Parking verification annex",
        code: "QA-ANNEX",
        area: "Al Aliya",
        floor_count: 0,
      })
    ).result;
    await checkedAction("parking_lot", {
      building_id: otherId,
      floor_id: "",
      number: "ANNEX-1",
      status: "available",
      rate_amount: "1500",
      rate_period: "yearly",
    });
    const otherLot = (await readRows("parking_lots")).find(
      (l) => l.number === "ANNEX-1",
    );
    const rejected = await action("parking_allocate", {
      lease_id: loser,
      lot_ids: [otherLot.id],
    });
    expect(rejected.status()).toBe(400);
    expect((await rejected.json()).error).toContain("same building");
  });
  test("uses profile tabs, property views and dashboard filters", async () => {
    await page.goto(`${origin}/tenants/${tenant}`);
    const overview = page.getByRole("tab", { name: "Overview", exact: true });
    await overview.focus();
    await overview.press("ArrowRight");
    await expect(page.getByRole("tab", { name: /Documents/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(
      page.getByRole("heading", { name: "Tenant documents", exact: true }),
    ).toBeVisible();
    await page.getByRole("tab", { name: "Account", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Account activity", exact: true }),
    ).toBeVisible();
    await page.goto(`${origin}/properties`);
    await page
      .getByRole("button", { name: "Property list view", exact: true })
      .click();
    await expect(page.locator(".property-list-view")).toBeVisible();
    await page
      .getByRole("button", { name: "Property grid view", exact: true })
      .click();
    await expect(page.locator(".property-list-view")).toHaveCount(0);
    await page.goto(`${origin}/`);
    await page.getByRole("link", { name: /Overdue rent cheques/ }).click();
    await expect(page.getByLabel("Cheque status", { exact: true })).toHaveValue(
      "overdue",
    );
    await page.goto(`${origin}/`);
    await page.getByRole("link", { name: /Flats ready to rent/ }).click();
    await expect(
      page.getByLabel("Filter flat status", { exact: true }),
    ).toHaveValue("Vacant");
  });
  test("exports a real occupancy CSV and displays a printable agreement", async () => {
    await page.goto(`${origin}/reports`);
    const download = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Export occupancy", exact: true })
      .click();
    expect((await download).suggestedFilename()).toBe(
      "aliyas-occupancy-report.csv",
    );
    await page.goto(`${origin}/agreements/${lease}`);
    await expect(
      page.getByRole("heading", { name: "Tenancy agreement summary" }),
    ).toBeVisible();
    await expect(
      page.getByText("Unsigned draft", { exact: true }),
    ).toBeVisible();
  });
  test("manages ground floor shops with commercial tenant details, annual cheques and separate reports", async () => {
    const property = await checkedAction("building", {
      name: "Verification Shops",
      code: "QA-SHOPS",
      area: "Verification area",
      floor_count: 1,
    });
    const shopBuilding = property.result;
    const levels = (await readRows("floors")).filter(
      (f) => f.building_id === shopBuilding,
    );
    const ground = levels.find((f) => f.ordinal === 0);
    const upper = levels.find((f) => f.ordinal === 1);
    await page.goto(`${origin}/shops`);
    await page.getByRole("button", { name: "Add shop", exact: true }).click();
    const form = page.getByRole("dialog");
    await form
      .getByLabel("Property", { exact: true })
      .selectOption(shopBuilding);
    await expect(form.getByLabel("Floor", { exact: true })).toHaveValue(
      ground.id,
    );
    await expect(
      form.getByLabel("Floor", { exact: true }).locator("option"),
    ).toHaveCount(2);
    await form.getByLabel("Shop number", { exact: true }).fill("S-QA-1");
    await form.getByLabel("Monthly asking rent (AED)").fill("4000");
    await form.getByLabel("Area (sq ft)").fill("1250");
    await form
      .getByLabel("Notes", { exact: true })
      .fill("Fictional shop for verification only");
    await form.getByRole("button", { name: "Save shop", exact: true }).click();
    await expect(form).toHaveCount(0);
    await page.reload();
    await expect(
      page.getByRole("button", { name: "View shop S-QA-1" }),
    ).toBeVisible();
    const shop = (await readRows("units")).find(
      (u) => u.building_id === shopBuilding && u.category === "Shop",
    );
    const values = {
      building_id: shopBuilding,
      floor_id: ground.id,
      code: "S-QA-1",
      monthly_rent: "4000",
    };
    expect((await action("shop", values)).status()).toBe(400);
    await checkedAction("unit", { ...values, category: "Studio" });
    const invalidFloor = await action("shop", {
      ...values,
      code: "S-UPPER",
      floor_id: upper.id,
    });
    expect(invalidFloor.status()).toBe(400);
    expect((await invalidFloor.json()).error).toContain("ground floor");
    const directInsert = await admin.from("units").insert({
      ...values,
      workspace_id: workspace,
      code: "S-BYPASS",
      category: "Shop",
      floor_id: upper.id,
      monthly_rent: 400000,
    });
    expect(directInsert.error?.message).toContain("ground floor");
    const changedGround = await action("floor", {
      id: ground.id,
      building_id: shopBuilding,
      name: "Ground floor",
      ordinal: 3,
    });
    expect(changedGround.status()).toBe(400);
    await checkedAction("shop", {
      ...values,
      id: shop.id,
      notes: "Edited verification shop",
      monthly_rent: "4100",
    });
    const company = await checkedAction("tenant", {
      name: "Verification Shop Contact",
      phone: "+971500000001",
      company_name: "Verification Shop Company",
      trade_license: "QA-LICENCE",
      opening: "123.45",
    });
    const shopTenant = company.result;
    await page.goto(`${origin}/tenants/${shopTenant}`);
    await expect(
      page.getByText("Verification Shop Company", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText("QA-LICENCE", { exact: true })).toBeVisible();
    await page.goto(`${origin}/shops`);
    await page.getByRole("button", { name: "View shop S-QA-1" }).click();
    await expect(
      page
        .getByRole("dialog")
        .getByText("Edited verification shop", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Create agreement", exact: true })
      .click();
    const agreementForm = page.getByRole("dialog");
    await expect(
      agreementForm.getByLabel("Rental type", { exact: true }),
    ).toHaveValue("Shop");
    await expect(agreementForm.getByLabel("Shop", { exact: true })).toHaveValue(
      shop.id,
    );
    await agreementForm
      .getByLabel("Tenant", { exact: true })
      .selectOption(shopTenant);
    await agreementForm
      .getByLabel("Agreement reference")
      .fill("QA-SHOP-ANNUAL");
    await agreementForm.getByLabel("Annual agreed rent (AED)").fill("48000.37");
    await agreementForm.getByLabel("Rent cheques").selectOption("6");
    await agreementForm
      .getByRole("button", { name: "Create agreement", exact: true })
      .click();
    await expect(agreementForm).toHaveCount(0);
    const shopLease = (await readRows("leases")).find(
      (l) => l.reference === "QA-SHOP-ANNUAL",
    );
    const checks = (await readRows("cheques")).filter(
      (c) => c.lease_id === shopLease.id,
    );
    expect(checks).toHaveLength(6);
    expect(checks.reduce((sum, c) => sum + c.amount, 0)).toBe(4800037);
    const overlap = await action("lease", {
      tenant_id: shopTenant,
      unit_id: shop.id,
      start_date: todayDubai(),
      annual_rent: "48000",
      installments: 4,
      reference: "QA-SHOP-OVERLAP",
    });
    expect(overlap.status()).toBe(400);
    const move = await action("shop", {
      ...values,
      id: shop.id,
      building_id: building,
      floor_id: (await readRows("floors")).find(
        (f) => f.building_id === building && f.ordinal === 0,
      ).id,
    });
    expect(move.status()).toBe(400);
    const cleared = checks.find((c) => c.due_date === todayDubai());
    await checkedAction("cheque", {
      id: cleared.id,
      number: "QA-SHOP-PAID",
      status: "cleared",
      bank: "Verification Bank",
      on_date: todayDubai(),
    });
    await checkedAction("cheque", {
      id: cleared.id,
      number: "QA-SHOP-PAID",
      status: "cleared",
      bank: "Verification Bank",
      on_date: todayDubai(),
    });
    const ledger = (await readRows("ledger")).filter(
      (e) => e.tenant_id === shopTenant,
    );
    expect(ledger.filter((e) => e.cheque_id === cleared.id)).toHaveLength(1);
    expect(ledger.reduce((sum, e) => sum + e.amount, 0)).toBe(
      12345 + 4800037 - cleared.amount,
    );
    const pdf = Buffer.from(
      "%PDF-1.4\n% Fictional trade licence verification\n%%EOF",
    );
    const upload = await context.request.post(`${origin}/api/documents`, {
      headers: { origin },
      multipart: {
        file: {
          name: "verification-trade-licence.pdf",
          mimeType: "application/pdf",
          buffer: pdf,
        },
        target_type: "tenant",
        target_id: shopTenant,
        category: "Trade licence",
        request_key: randomUUID(),
      },
    });
    expect(upload.ok(), await upload.text()).toBe(true);
    const file = await context.request.get(
      `${origin}/api/documents/${(await upload.json()).id}/file`,
    );
    expect(await file.body()).toEqual(pdf);
    await page.goto(`${origin}/agreements/${shopLease.id}`);
    await expect(
      page.getByText("Shop S-QA-1", { exact: false }).first(),
    ).toBeVisible();
    await expect(
      page.getByText("Verification Shop Company", { exact: true }),
    ).toBeVisible();
    await page.goto(`${origin}/units`);
    await expect(
      page.getByRole("button", { name: "View shop S-QA-1" }),
    ).toHaveCount(0);
    await page.goto(`${origin}/reports`);
    await page
      .getByLabel("Property", { exact: true })
      .selectOption(shopBuilding);
    await page.getByLabel("Rental type", { exact: true }).selectOption("Shop");
    const reportRow = page.getByRole("row").filter({
      has: page.getByRole("link", {
        name: "Verification Shops",
        exact: true,
      }),
    });
    await expect(reportRow.locator("td").nth(1)).toHaveText("0");
    await expect(reportRow.locator("td").nth(2)).toHaveText("1");
    await expect(reportRow.locator("td").nth(4)).toHaveText("1");
    await expect(reportRow.locator("td").last()).toContainText("8,000.06");
    await page.getByLabel("Rental type", { exact: true }).selectOption("Flat");
    await expect(reportRow.locator("td").nth(1)).toHaveText("1");
    await expect(reportRow.locator("td").nth(2)).toHaveText("0");
    await expect(reportRow.locator("td").last()).toContainText("0");
  });
  test("keeps the mobile layout, keyboard focus and reduced motion usable", async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(`${origin}/`);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page
      .getByRole("button", { name: "Open navigation", exact: true })
      .click();
    await expect(
      page.getByRole("link", { name: "Properties", exact: true }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await page
      .getByRole("button", { name: "Search workspace", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Tab");
    expect(
      await page.evaluate(
        () =>
          !!document.querySelector("dialog")?.contains(document.activeElement),
      ),
    ).toBe(true);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    for (const route of [
      "properties",
      "units",
      "shops",
      "tenants",
      "agreements",
      "cheques",
      "parking",
      "wallets",
      "documents",
      "reports",
      "settings",
    ]) {
      await page.goto(`${origin}/${route}`);
      await expect(page.locator("h1")).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
        `Horizontal overflow at ${route}`,
      ).toBe(true);
    }
  });
});

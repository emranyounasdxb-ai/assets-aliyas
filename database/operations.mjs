import { randomUUID } from "node:crypto";
import { addYears, addMonths, subDays, format, parseISO } from "date-fns";
import {
  atomic,
  databasePool,
  sql,
  one,
  insert,
  update,
  audit,
  fail,
} from "./sql.mjs";
import { permission } from "./client.mjs";
import { agentOperation, saveAgentCommission } from "./agents.mjs";
export const today = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dubai" }).format(
    new Date(),
  );
const shifted = (date, months = 0) =>
  format(addMonths(parseISO(date), months), "yyyy-MM-dd");
const MAX = 10000000000;
const money = (amount, positive = false) => {
  if (
    !Number.isSafeInteger(amount) ||
    Math.abs(amount) > MAX ||
    (positive && amount < 1)
  )
    fail("Invalid amount");
};
async function add(connection, client, table, row) {
  const id = await insert(connection, table, row);
  await audit(
    connection,
    table,
    { id, ...row },
    client.userId || row.uploaded_by,
    "insert",
  );
  return id;
}
async function change(connection, client, table, row, fields) {
  await update(connection, table, row.id, fields);
  await audit(
    connection,
    table,
    { ...row, ...fields },
    client.userId,
    "update",
  );
}
async function find(connection, table, id, workspace) {
  const row = await one(
    connection,
    `select * from ${table} where id=?${workspace ? " and workspace_id=?" : ""} for update`,
    workspace ? [id, workspace] : [id],
  );
  if (!row) fail("The linked record was not found");
  return row;
}
async function setPropertyCover(connection, client, doc) {
  const actor = { userId: client.userId || doc.uploaded_by };
  if (
    doc.target_type !== "building" ||
    doc.category !== "Photo" ||
    !doc.mime.startsWith("image/") ||
    doc.status !== "current"
  )
    fail("Choose a current property photo for the cover");
  const old = await one(
    connection,
    "select * from property_covers where building_id=? and workspace_id=? for update",
    [doc.target_id, doc.workspace_id],
  );
  if (old)
    await change(connection, actor, "property_covers", old, {
      document_id: doc.id,
    });
  else
    await add(connection, actor, "property_covers", {
      workspace_id: doc.workspace_id,
      building_id: doc.target_id,
      document_id: doc.id,
    });
}
export async function reminders(workspace = null, connection = null) {
  if (!connection) {
    if (!workspace) {
      const workspaces = await sql(
        databasePool(),
        "select id from workspaces order by id",
      );
      for (const row of workspaces) await reminders(row.id);
      return;
    }
    return atomic(workspace, (transaction) =>
      reminders(workspace, transaction),
    );
  }
  const values = workspace ? [workspace] : [];
  await sql(
    connection,
    `insert ignore into notifications(id,workspace_id,cheque_id,kind) select uuid(),workspace_id,id,case when due_date<date(utc_timestamp()+interval 4 hour) then 'overdue' else 'due_soon' end from cheques where purpose='rent' and status in ('scheduled','received','deposited','bounced') and due_date<=date(utc_timestamp()+interval 4 hour)+interval 7 day${workspace ? " and workspace_id=?" : ""}`,
    values,
  );
}
async function reprice(connection, client, lease) {
  const cheques = await sql(
    connection,
    "select * from cheques where lease_id=? and purpose='rent' order by due_date,id for update",
    [lease.id],
  );
  if (cheques.some((row) => row.status !== "scheduled"))
    fail(
      "Parking charges cannot change after cheques have been received or processed. Add parking when creating or renewing the agreement",
    );
  if (cheques.length !== lease.installments)
    fail("This agreement does not have a complete cheque schedule");
  const total =
    Number(
      (
        await one(
          connection,
          "select coalesce(sum(annual_charge),0) amount from parking_allocations where lease_id=? and status='active'",
          [lease.id],
        )
      ).amount,
    ) + lease.annual_rent;
  money(total, true);
  for (let i = 0; i < cheques.length; i++)
    await change(connection, client, "cheques", cheques[i], {
      amount:
        Math.floor(total / cheques.length) +
        (i === cheques.length - 1 ? total % cheques.length : 0),
    });
}
async function assign(connection, client, lease, lotIds) {
  await permission(connection, client, lease.workspace_id);
  if (lease.status !== "active" || lease.end_date < today())
    fail("Choose an active or upcoming agreement");
  if (
    !Array.isArray(lotIds) ||
    lotIds.length < 1 ||
    lotIds.length > 20 ||
    new Set(lotIds).size !== lotIds.length
  )
    fail("Choose between 1 and 20 different parking lots");
  const unit = await find(
    connection,
    "units",
    lease.unit_id,
    lease.workspace_id,
  );
  let changed = false;
  for (const id of [...lotIds].sort()) {
    const lot = await find(connection, "parking_lots", id, lease.workspace_id);
    if (lot.status !== "available")
      fail("A selected parking lot is unavailable");
    if (lot.building_id !== unit.building_id)
      fail(
        "Parking must be in the same building as the tenant apartment or shop",
      );
    if (
      await one(
        connection,
        "select id from parking_allocations where lease_id=? and lot_id=? and status='active'",
        [lease.id, lot.id],
      )
    )
      continue;
    if (
      await one(
        connection,
        "select id from parking_allocations where lot_id=? and status='active' and start_date<=? and end_date>=? limit 1",
        [lot.id, lease.end_date, lease.start_date],
      )
    )
      fail(
        "A selected parking lot is already reserved for these dates",
        "23P01",
      );
    if (!lot.rate_amount || !lot.rate_period)
      fail("Set a confirmed parking rate before allocating this lot");
    const charge = lot.rate_amount * (lot.rate_period === "monthly" ? 12 : 1);
    money(charge, true);
    const floor = lot.floor_id
      ? await find(connection, "floors", lot.floor_id, lease.workspace_id)
      : null;
    const building = await find(
      connection,
      "buildings",
      lot.building_id,
      lease.workspace_id,
    );
    const label = `${floor ? `${floor.name} · ` : ""}Lot ${lot.number}`;
    const allocation = await add(connection, client, "parking_allocations", {
      workspace_id: lease.workspace_id,
      lot_id: lot.id,
      lease_id: lease.id,
      tenant_id: lease.tenant_id,
      start_date: lease.start_date,
      end_date: lease.end_date,
      lot_label: label,
      property_label: building.name,
      rate_amount: lot.rate_amount,
      rate_period: lot.rate_period,
      annual_charge: charge,
    });
    await add(connection, client, "ledger", {
      workspace_id: lease.workspace_id,
      tenant_id: lease.tenant_id,
      lease_id: lease.id,
      parking_allocation_id: allocation,
      kind: "parking",
      amount: charge,
      description:
        `Annual parking · ${building.name} · ${label} · ${lease.reference}`.slice(
          0,
          300,
        ),
      entry_date: lease.start_date,
      idempotency_key: allocation,
    });
    changed = true;
  }
  if (changed) await reprice(connection, client, lease);
  return lease.id;
}
export async function operation(client, name, p) {
  const operations = [
    "create_building",
    "create_tenant",
    "create_lease",
    "create_lease_with_parking",
    "allocate_parking",
    "cancel_parking_allocation",
    "set_cheque_status",
    "update_cheque_details",
    "record_account_entry",
    "add_security",
    "return_deposit",
    "end_lease",
    "register_scanned_document",
    "set_property_cover",
    "manage_document",
    "agent_save",
    "agent_commission_save",
    "agent_receipt_record",
    "agent_receipt_reverse",
  ];
  if (!operations.includes(name)) fail("Unknown operation");
  let workspace = p.w || p.p?.workspace_id;
  if (!workspace) {
    const table = name.includes("cheque")
      ? "cheques"
      : name === "return_deposit"
        ? "deposits"
        : name === "cancel_parking_allocation"
          ? "parking_allocations"
          : "leases";
    workspace = (
      await one(
        databasePool(),
        `select workspace_id from ${table} where id=?`,
        [p.c || p.d || p.a || p.l],
      )
    )?.workspace_id;
  }
  if (!workspace) fail("Record not found or permission denied");
  const execute = async (connection) => {
    if (name.startsWith("agent_"))
      return agentOperation(connection, client, name, workspace, p);
    if (name === "register_scanned_document") {
      client.requireAdmin();
      const doc = p.p;
      const existing = await one(
        connection,
        "select id from documents where upload_key=? and workspace_id=? and uploaded_by=?",
        [doc.upload_key, workspace, doc.uploaded_by],
      );
      if (existing) return existing.id;
      let group = randomUUID(),
        version = 1;
      if (doc.replaces) {
        const old = await find(
          connection,
          "documents",
          doc.replaces,
          workspace,
        );
        if (
          old.status !== "current" ||
          old.target_id !== doc.target_id ||
          old.target_type !== doc.target_type ||
          old.category !== doc.category
        )
          fail("The original document has changed. Refresh and try again.");
        group = old.group_id;
        version = old.version + 1;
        await change(connection, client, "documents", old, {
          status: "superseded",
        });
      }
      const { replaces: _, make_cover, ...fields } = doc;
      const id = await add(connection, client, "documents", {
        ...fields,
        group_id: group,
        version,
      });
      if (doc.target_type === "building" && doc.category === "Photo") {
        const cover = await one(
          connection,
          "select document_id from property_covers where building_id=? and workspace_id=?",
          [doc.target_id, workspace],
        );
        if (make_cover || !cover || cover.document_id === doc.replaces)
          await setPropertyCover(connection, client, {
            ...fields,
            id,
            status: "current",
          });
      }
      return id;
    }
    if (["set_property_cover", "manage_document"].includes(name)) {
      await permission(connection, client, workspace, true);
      const doc = await find(connection, "documents", p.id, workspace);
      if (doc.status !== "current")
        fail("This file has changed. Refresh and try again.");
      if (name === "set_property_cover") {
        if (doc.target_id !== p.building_id)
          fail("Choose a photo from this property");
        await setPropertyCover(connection, client, doc);
      } else if (p.archive) {
        if (
          await one(
            connection,
            "select id from agent_receipts where receipt_document_id=? and workspace_id=? limit 1",
            [doc.id, workspace],
          )
        )
          fail(
            "This document supports a recorded commission payment and cannot be archived",
          );
        await sql(
          connection,
          "delete from property_covers where document_id=? and workspace_id=?",
          [doc.id, workspace],
        );
        // Preserve the original and its audit trail; archived files are no longer served.
        await change(connection, client, "documents", doc, {
          status: "archived",
        });
      } else {
        if (
          typeof p.name !== "string" ||
          !p.name.trim() ||
          p.name.length > 200 ||
          [...p.name].some(
            (char) =>
              (char.codePointAt(0) ?? 0) < 32 ||
              char === String.fromCharCode(127) ||
              char === "/" ||
              char === "\\",
          )
        )
          fail("Enter a valid file name up to 200 characters");
        await change(connection, client, "documents", doc, {
          name: p.name.trim(),
        });
      }
      return doc.id;
    }
    const finance = [
      "set_cheque_status",
      "update_cheque_details",
      "record_account_entry",
      "add_security",
      "return_deposit",
    ].includes(name);
    await permission(connection, client, workspace, finance);
    if (name === "create_building") {
      if (
        !Number.isInteger(p.floor_count) ||
        p.floor_count < 0 ||
        p.floor_count > 100
      )
        fail("Choose between 0 and 100 upper floors");
      const building = await add(connection, client, "buildings", {
        ...p.p,
        workspace_id: workspace,
      });
      for (let i = 0; i <= p.floor_count; i++)
        await insert(connection, "floors", {
          workspace_id: workspace,
          building_id: building,
          name: i === 0 ? "Ground floor" : `Floor ${i}`,
          ordinal: i,
        });
      return building;
    }
    if (name === "create_tenant") {
      money(p.opening || 0);
      const tenant = await add(connection, client, "tenants", {
        ...p.details,
        workspace_id: workspace,
      });
      if (p.opening)
        await add(connection, client, "ledger", {
          workspace_id: workspace,
          tenant_id: tenant,
          kind: "opening",
          amount: p.opening,
          description: "Opening balance carried forward",
        });
      return tenant;
    }
    if (name === "create_lease" || name === "create_lease_with_parking") {
      money(p.rent, true);
      if (![1, 2, 3, 4, 6, 12].includes(p.checks))
        fail("Invalid payment schedule");
      const unit = await find(connection, "units", p.u, workspace);
      await find(connection, "tenants", p.t, workspace);
      if (unit.status !== "available")
        fail("Choose an available flat or shop from this workspace");
      const finish = format(
        subDays(addYears(parseISO(p.starts), 1), 1),
        "yyyy-MM-dd",
      );
      if (
        await one(
          connection,
          "select id from leases where unit_id=? and status='active' and start_date<=? and end_date>=? limit 1",
          [unit.id, finish, p.starts],
        )
      )
        fail("This rental unit already has an agreement covering these dates");
      const id = await add(connection, client, "leases", {
        workspace_id: workspace,
        tenant_id: p.t,
        unit_id: p.u,
        reference: p.ref,
        start_date: p.starts,
        end_date: finish,
        annual_rent: p.rent,
        installments: p.checks,
        notes: p.notes_text || "",
      });
      await add(connection, client, "ledger", {
        workspace_id: workspace,
        tenant_id: p.t,
        lease_id: id,
        kind: "rent",
        amount: p.rent,
        description: `Annual rent · ${p.ref}`,
        entry_date: p.starts,
      });
      for (let i = 0; i < p.checks; i++) {
        const amount =
          Math.floor(p.rent / p.checks) +
          (i === p.checks - 1 ? p.rent % p.checks : 0);
        money(amount, true);
        await add(connection, client, "cheques", {
          workspace_id: workspace,
          tenant_id: p.t,
          lease_id: id,
          number: `${p.ref}/${i + 1}`,
          bank: p.bank_name || "",
          amount,
          due_date: shifted(p.starts, i * (12 / p.checks)),
        });
      }
      if (name === "create_lease_with_parking")
        await assign(
          connection,
          client,
          await find(connection, "leases", id, workspace),
          p.lot_ids,
        );
      if (p.agent_id)
        await saveAgentCommission(connection, client, workspace, {
          lease_id: id,
          agent_id: p.agent_id,
          amount: p.commission_amount,
          notes: "",
        });
      return id;
    }
    if (name === "allocate_parking")
      return assign(
        connection,
        client,
        await find(connection, "leases", p.l, workspace),
        p.lot_ids,
      );
    if (name === "cancel_parking_allocation") {
      const allocation = await find(
        connection,
        "parking_allocations",
        p.a,
        workspace,
      );
      if (allocation.status === "cancelled") return allocation.lease_id;
      const lease = await find(
        connection,
        "leases",
        allocation.lease_id,
        workspace,
      );
      await change(connection, client, "parking_allocations", allocation, {
        status: "cancelled",
      });
      await add(connection, client, "ledger", {
        workspace_id: workspace,
        tenant_id: allocation.tenant_id,
        lease_id: lease.id,
        parking_allocation_id: allocation.id,
        kind: "adjustment",
        amount: -allocation.annual_charge,
        description:
          `Parking reservation cancelled · ${allocation.lot_label}`.slice(
            0,
            300,
          ),
        entry_date: allocation.start_date,
      });
      await reprice(connection, client, lease);
      return lease.id;
    }
    if (name === "set_cheque_status" || name === "update_cheque_details") {
      const cheque = await find(connection, "cheques", p.c, workspace);
      if (name === "set_cheque_status" && p.new_status === cheque.status)
        return cheque.id;
      if (["cleared", "cancelled", "returned"].includes(cheque.status))
        fail("A finalized cheque cannot be changed");
      if (name === "update_cheque_details") {
        await change(connection, client, "cheques", cheque, {
          number: p.ref,
          bank: p.bank_name,
        });
        return cheque.id;
      }
      if (
        ![
          "scheduled",
          "received",
          "deposited",
          "cleared",
          "bounced",
          "cancelled",
          "returned",
        ].includes(p.new_status)
      )
        fail("Invalid cheque status");
      if (
        cheque.purpose === "security" &&
        !["received", "returned", "cancelled"].includes(p.new_status)
      )
        fail("Security cheques are held separately from rental payments");
      if (cheque.purpose === "rent" && p.new_status === "returned")
        fail("Use cancelled for a returned rent cheque");
      if (p.new_status === "bounced" && cheque.status !== "deposited")
        fail("Only a deposited cheque can be marked bounced");
      const on = p.on_date || today();
      if (on > today()) fail("Payment date cannot be in the future");
      await change(connection, client, "cheques", cheque, {
        status: p.new_status,
        cleared_on: p.new_status === "cleared" ? on : null,
        number: p.new_number ?? cheque.number,
        bank: p.new_bank ?? cheque.bank,
      });
      if (p.new_status === "cleared")
        await add(connection, client, "ledger", {
          workspace_id: workspace,
          tenant_id: cheque.tenant_id,
          lease_id: cheque.lease_id,
          cheque_id: cheque.id,
          kind: "payment",
          amount: -cheque.amount,
          description: `Cheque cleared · ${p.new_number ?? cheque.number}`,
          entry_date: on,
        });
      return cheque.id;
    }
    if (name === "record_account_entry") {
      money(p.amount_cents);
      if (
        !["payment", "adjustment"].includes(p.entry_kind) ||
        p.amount_cents === 0 ||
        (p.entry_kind === "payment" && p.amount_cents > 0) ||
        p.label.trim().length < 3 ||
        p.label.length > 300
      )
        fail("Invalid account entry");
      if (p.on_date > today()) fail("Payment date cannot be in the future");
      await find(connection, "tenants", p.t, workspace);
      const existing = await one(
        connection,
        "select * from ledger where idempotency_key=?",
        [p.request_key],
      );
      if (existing) {
        if (
          existing.workspace_id !== workspace ||
          existing.tenant_id !== p.t ||
          existing.amount !== p.amount_cents ||
          existing.kind !== p.entry_kind ||
          existing.entry_date !== p.on_date
        )
          fail("This payment reference was already used");
        return existing.id;
      }
      return add(connection, client, "ledger", {
        workspace_id: workspace,
        tenant_id: p.t,
        kind: p.entry_kind,
        amount: p.amount_cents,
        description: p.label,
        entry_date: p.on_date,
        idempotency_key: p.request_key,
      });
    }
    if (name === "add_security") {
      money(p.amount_cents, true);
      await find(connection, "tenants", p.t, workspace);
      return p.is_cheque
        ? add(connection, client, "cheques", {
            workspace_id: workspace,
            tenant_id: p.t,
            amount: p.amount_cents,
            number: p.ref,
            bank: p.bank_name || "",
            due_date: today(),
            purpose: "security",
            status: "received",
          })
        : add(connection, client, "deposits", {
            workspace_id: workspace,
            tenant_id: p.t,
            amount: p.amount_cents,
            reference: p.ref,
          });
    }
    if (name === "return_deposit") {
      const deposit = await find(connection, "deposits", p.d, workspace);
      if (deposit.status === "held")
        await change(connection, client, "deposits", deposit, {
          status: "returned",
          returned_on: today(),
        });
      return deposit.id;
    }
    if (name === "end_lease") {
      const lease = await find(connection, "leases", p.l, workspace);
      if (p.on_date < lease.end_date || p.on_date > today())
        fail(
          "Close only on or after the agreement end date. Early termination requires a reviewed settlement.",
        );
      await change(connection, client, "leases", lease, {
        status: "ended",
        closed_on: p.on_date,
      });
      return lease.id;
    }
  };
  return atomic(workspace, async (connection) => {
    const result = await execute(connection);
    await reminders(workspace, connection);
    return result;
  });
}

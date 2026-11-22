import { one, insert, update, audit, fail } from "./sql.mjs";
import { permission } from "./client.mjs";
const validAmount = (amount, nullable = false) => {
  if (nullable && amount === null) return;
  if (
    !Number.isSafeInteger(amount) ||
    amount < (nullable ? 0 : 1) ||
    amount > 10000000000
  )
    fail("Enter a valid commission amount");
};
async function linked(connection, table, id, workspace) {
  const row = await one(
    connection,
    `select * from ${table} where id=? and workspace_id=? for update`,
    [id, workspace],
  );
  if (!row) fail("The linked commission record was not found");
  return row;
}
async function add(connection, client, table, row) {
  const id = await insert(connection, table, row);
  await audit(connection, table, { id, ...row }, client.userId, "insert");
  return id;
}
async function received(connection, id, workspace) {
  const row = await one(
    connection,
    "select coalesce(sum(case when kind='received' then amount else -amount end),0) total from agent_receipts where commission_id=? and workspace_id=?",
    [id, workspace],
  );
  return Number(row.total);
}
export async function saveAgentCommission(connection, client, workspace, p) {
  await permission(connection, client, workspace, true);
  validAmount(p.amount, true);
  await linked(connection, "leases", p.lease_id, workspace);
  const agent = await linked(connection, "agents", p.agent_id, workspace);
  const old = await one(
    connection,
    "select * from agent_commissions where lease_id=? and workspace_id=? for update",
    [p.lease_id, workspace],
  );
  if (agent.status !== "active" && old?.agent_id !== agent.id)
    fail("Choose an active agent");
  if (
    old &&
    (!p.id || p.id !== old.id || p.expected_revision !== Number(old.revision))
  )
    fail("This commission has changed. Refresh and reopen the form");
  if (!old && p.id) fail("Commission not found");
  if (old) {
    const total = await received(connection, old.id, workspace);
    if (
      (p.amount === null && total > 0) ||
      (p.amount !== null && p.amount < total)
    )
      fail(
        "The agreed commission cannot be less than the recorded payments. Reverse an incorrect payment first",
      );
    if (
      old.agent_id !== p.agent_id &&
      (await one(
        connection,
        "select id from agent_receipts where commission_id=? limit 1",
        [old.id],
      ))
    )
      fail("An agent cannot change after payment history has been recorded");
    if (typeof p.reason !== "string" || !p.reason.trim())
      fail("Enter a reason for changing the commission");
  }
  const fields = {
    agent_id: p.agent_id,
    amount: p.amount,
    notes: p.notes || "",
  };
  let id;
  if (old) {
    id = old.id;
    await update(connection, "agent_commissions", id, {
      ...fields,
      revision: Number(old.revision) + 1,
    });
    await audit(connection, "agent_commissions", old, client.userId, "update");
  } else
    id = await add(connection, client, "agent_commissions", {
      ...fields,
      workspace_id: workspace,
      lease_id: p.lease_id,
    });
  await add(connection, client, "agent_commission_events", {
    workspace_id: workspace,
    commission_id: id,
    old_amount: old?.amount ?? null,
    new_amount: p.amount,
    old_agent_id: old?.agent_id ?? null,
    new_agent_id: p.agent_id,
    reason: old ? p.reason.trim() : "Agent linked to agreement",
    changed_by: client.userId,
  });
  return id;
}
export async function agentOperation(connection, client, name, workspace, p) {
  await permission(connection, client, workspace, true);
  if (name === "agent_save") {
    const fields = p.details;
    if (
      !fields?.name?.trim() ||
      !["active", "inactive"].includes(fields.status)
    )
      fail("Enter valid agent details");
    if (!p.id)
      return add(connection, client, "agents", {
        ...fields,
        workspace_id: workspace,
      });
    const old = await linked(connection, "agents", p.id, workspace);
    await update(connection, "agents", old.id, fields);
    await audit(connection, "agents", old, client.userId, "update");
    return old.id;
  }
  if (name === "agent_commission_save")
    return saveAgentCommission(connection, client, workspace, p);
  if (!["agent_receipt_record", "agent_receipt_reverse"].includes(name))
    fail("Unknown agent operation");
  const retry = await one(
    connection,
    "select * from agent_receipts where workspace_id=? and request_key=?",
    [workspace, p.request_key],
  );
  if (retry) {
    const same =
      name === "agent_receipt_reverse"
        ? retry.kind === "reversal" &&
          retry.reverses === p.id &&
          retry.notes === p.reason
        : retry.kind === "received" &&
          retry.commission_id === p.commission_id &&
          Number(retry.amount) === p.amount &&
          retry.entry_date === p.entry_date &&
          retry.method === p.method &&
          retry.reference === p.reference &&
          retry.receipt_document_id === (p.receipt_document_id || null) &&
          retry.notes === (p.notes || "");
    if (!same) fail("This payment request was already used for another record");
    return retry.id;
  }
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dubai",
  }).format(new Date());
  if (name === "agent_receipt_reverse") {
    const original = await linked(
      connection,
      "agent_receipts",
      p.id,
      workspace,
    );
    if (original.kind !== "received")
      fail("Only a received payment can be reversed");
    if (!p.reason?.trim()) fail("Enter a reversal reason");
    if (
      await one(connection, "select id from agent_receipts where reverses=?", [
        original.id,
      ])
    )
      fail("This payment was already reversed");
    return add(connection, client, "agent_receipts", {
      workspace_id: workspace,
      commission_id: original.commission_id,
      kind: "reversal",
      amount: original.amount,
      entry_date: today,
      method: original.method,
      reference: original.reference,
      notes: p.reason,
      reverses: original.id,
      request_key: p.request_key,
      recorded_by: client.userId,
    });
  }
  const commission = await linked(
    connection,
    "agent_commissions",
    p.commission_id,
    workspace,
  );
  validAmount(p.amount);
  if (p.confirmed !== true)
    fail("Confirm that the customer paid the agent directly");
  if (!p.entry_date || p.entry_date > today)
    fail("Choose a payment date on or before today");
  if (!p.reference?.trim() || !["cash", "bank", "cheque"].includes(p.method))
    fail("Enter payment details");
  if (commission.amount === null)
    fail("Enter the agreed commission before recording a payment");
  if (
    (await received(connection, commission.id, workspace)) + p.amount >
    Number(commission.amount)
  )
    fail("This payment exceeds the pending commission");
  if (p.receipt_document_id) {
    const doc = await linked(
      connection,
      "documents",
      p.receipt_document_id,
      workspace,
    );
    if (
      doc.target_type !== "lease" ||
      doc.target_id !== commission.lease_id ||
      doc.status !== "current"
    )
      fail("Choose a current receipt document linked to this agreement");
  }
  return add(connection, client, "agent_receipts", {
    workspace_id: workspace,
    commission_id: commission.id,
    kind: "received",
    amount: p.amount,
    entry_date: p.entry_date,
    method: p.method,
    reference: p.reference,
    notes: p.notes || "",
    receipt_document_id: p.receipt_document_id || null,
    request_key: p.request_key,
    recorded_by: client.userId,
  });
}

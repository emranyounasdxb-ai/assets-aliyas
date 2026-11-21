"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Check, Plus } from "@phosphor-icons/react";
import { useApp } from "./provider";
import {
  Avatar,
  Badge,
  Button,
  ErrorText,
  Field,
  Modal,
  PageHeader,
} from "./ui";
export function Settings() {
  const { data, mutate, notify } = useApp();
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [create, setCreate] = useState(false);
  const [name, setName] = useState("");
  const owner = data.membership.role === "owner";
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setPending(true);
    try {
      await mutate(
        "workspace_update",
        Object.fromEntries(new FormData(e.currentTarget)),
      );
      notify("Workspace details saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save details");
    } finally {
      setPending(false);
    }
  }
  async function createWorkspace(e: FormEvent) {
    e.preventDefault();
    setError("");
    setPending(true);
    try {
      await mutate("workspace_create", { name });
      setCreate(false);
      notify("Your empty workspace is ready. Add your first property.");
      router.replace("/");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not create workspace",
      );
    } finally {
      setPending(false);
    }
  }
  async function switchWorkspace(id: string) {
    try {
      await mutate("workspace_switch", { id });
      router.replace("/");
      router.refresh();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Could not switch workspace");
    }
  }
  return (
    <>
      <PageHeader title="Settings" />
      <div className="settings-layout">
        <div className="settings-form">
          <section className="panel padded settings-section">
            <h2>Company details</h2>
            <form onSubmit={save} key={data.workspace.id}>
              <div className="form-grid">
                <Field wide label="Company name">
                  <input
                    name="name"
                    required
                    maxLength={160}
                    disabled={!owner}
                    defaultValue={data.workspace.name}
                  />
                </Field>
                <Field wide label="Address">
                  <input
                    name="address"
                    maxLength={300}
                    disabled={!owner}
                    defaultValue={data.workspace.address}
                  />
                </Field>
                <Field label="Email">
                  <input
                    name="email"
                    type="email"
                    maxLength={180}
                    disabled={!owner}
                    defaultValue={data.workspace.email}
                  />
                </Field>
                <Field label="Phone">
                  <input
                    name="phone"
                    maxLength={40}
                    disabled={!owner}
                    defaultValue={data.workspace.phone}
                  />
                </Field>
              </div>
              {!create && <ErrorText message={error} />}
              <div className="form-actions">
                {owner && (
                  <Button type="submit" disabled={pending} variant="primary">
                    <Check size={17} />
                    {pending ? "Saving…" : "Save details"}
                  </Button>
                )}
              </div>
            </form>
          </section>
          <section className="panel padded settings-section">
            <h2>Team</h2>
            {data.members.map((m) => (
              <div className="member-row" key={m.user_id}>
                <Avatar name={m.display_name} />
                <div>
                  <strong>
                    {m.display_name}
                    {m.user_id === data.membership.user_id ? " (you)" : ""}
                  </strong>
                  <small>
                    {m.role === "owner"
                      ? "Full workspace access"
                      : m.role === "manager"
                        ? "Properties, tenants and accounts"
                        : m.role === "accountant"
                          ? "Payments and private documents"
                          : "Read access; private tenant documents restricted"}
                  </small>
                </div>
                <Badge tone="mint">{m.role}</Badge>
              </div>
            ))}
          </section>
          <section className="panel padded settings-section">
            <h2>Working defaults</h2>
            <div className="profile-contact">
              <div>
                <small>Currency</small>
                <strong>AED · UAE dirham</strong>
              </div>
              <div>
                <small>Business timezone</small>
                <strong>Asia/Dubai</strong>
              </div>
              <div>
                <small>Cheque reminders</small>
                <strong>7 days before the due date</strong>
              </div>
              <div>
                <small>Reminder channel</small>
                <strong>Workspace notifications</strong>
              </div>
              <div>
                <small>Private document uploads</small>
                <strong>PDF, JPG, PNG, WebP · 20 MB</strong>
              </div>
              <div>
                <small>File access</small>
                <strong>Private, with permission checks</strong>
              </div>
            </div>
          </section>
        </div>
        <div className="detail-stack">
          <section className="panel padded settings-section">
            <h2>Current workspace</h2>
            <select
              className="workspace-select"
              aria-label="Switch workspace"
              value={data.workspace.id}
              onChange={(e) => switchWorkspace(e.target.value)}
            >
              {data.workspaces.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                  {w.is_demo ? " (demo)" : ""}
                </option>
              ))}
            </select>
            {data.workspace.is_demo && (
              <div style={{ marginTop: 16 }}>
                <Badge tone="warning">Fictional demo records</Badge>
              </div>
            )}
          </section>
          {owner && (
            <div className="workspace-create">
              <Button
                onClick={() => {
                  setError("");
                  setName("");
                  setCreate(true);
                }}
              >
                <Plus size={16} />
                Create workspace
              </Button>
            </div>
          )}
        </div>
      </div>
      {create && (
        <Modal title="Create workspace" onClose={() => setCreate(false)}>
          <form onSubmit={createWorkspace}>
            <div className="form-grid">
              <Field wide label="Company name">
                <input
                  name="name"
                  required
                  maxLength={160}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Aliyas Real Estate"
                />
              </Field>
            </div>
            <ErrorText message={error} />
            <div className="modal-footer">
              <Button
                disabled={pending}
                type="button"
                onClick={() => setCreate(false)}
              >
                Cancel
              </Button>
              <Button disabled={pending} type="submit" variant="primary">
                {pending ? "Creating…" : "Create workspace"}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

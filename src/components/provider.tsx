"use client";
import {
  createContext,
  startTransition,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { AppData } from "@/lib/domain";
import { RecordForm, type FormKind } from "./record-form";
interface AppContextValue {
  data: AppData;
  notify: (message: string) => void;
  mutate: (action: string, data: Record<string, unknown>) => Promise<unknown>;
  openForm: (kind: FormKind, initial?: Record<string, unknown>) => void;
  refresh: (force?: boolean) => Promise<void>;
}
const Context = createContext<AppContextValue | null>(null);
export function AppProvider({
  data,
  children,
}: {
  data: AppData;
  children: ReactNode;
}) {
  return (
    <WorkspaceProvider
      key={`${data.membership.user_id}:${data.workspace.id}:${data.membership.role}`}
      data={data}
    >
      {children}
    </WorkspaceProvider>
  );
}
function WorkspaceProvider({
  data: serverData,
  children,
}: {
  data: AppData;
  children: ReactNode;
}) {
  const [data, setData] = useState(serverData);
  const snapshot = useRef(JSON.stringify(serverData));
  const sequence = useRef(0);
  const request = useRef<{
    controller: AbortController;
    promise: Promise<void>;
  } | null>(null);
  const channel = useRef<BroadcastChannel | null>(null);
  useEffect(() => {
    sequence.current++;
    request.current?.controller.abort();
    request.current = null;
    snapshot.current = JSON.stringify(serverData);
    setData(serverData);
  }, [serverData]);
  const refresh = useCallback(
    (force = false): Promise<void> => {
      if (request.current && !force) return request.current.promise;
      request.current?.controller.abort();
      const controller = new AbortController();
      const revision = ++sequence.current;
      const promise = (async () => {
        try {
          const response = await fetch("/api/workspace", {
            cache: "no-store",
            credentials: "same-origin",
            signal: AbortSignal.any([
              controller.signal,
              AbortSignal.timeout(15000),
            ]),
          });
          if (controller.signal.aborted || revision !== sequence.current)
            return;
          if ([401, 403].includes(response.status)) {
            window.location.replace("/login");
            return;
          }
          if (!response.ok) return;
          const next: AppData = await response.json();
          if (controller.signal.aborted || revision !== sequence.current)
            return;
          if (
            next.workspace.id !== serverData.workspace.id ||
            next.membership.user_id !== serverData.membership.user_id ||
            next.membership.role !== serverData.membership.role
          ) {
            window.location.replace("/");
            return;
          }
          const serialized = JSON.stringify(next);
          if (serialized !== snapshot.current) {
            snapshot.current = serialized;
            startTransition(() => setData(next));
          }
        } catch {
          // Keep the current records and filters visible during a failed refresh.
        } finally {
          if (revision === sequence.current) request.current = null;
        }
      })();
      request.current = { controller, promise };
      return promise;
    },
    [
      serverData.workspace.id,
      serverData.membership.user_id,
      serverData.membership.role,
    ],
  );
  useEffect(() => {
    const update = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const timer = setInterval(update, 15000);
    document.addEventListener("visibilitychange", update);
    window.addEventListener("online", update);
    if (typeof BroadcastChannel !== "undefined") {
      const live = new BroadcastChannel("aliyas-records");
      channel.current = live;
      live.onmessage = () => {
        void refresh(true);
      };
    }
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", update);
      window.removeEventListener("online", update);
      channel.current?.close();
      channel.current = null;
      sequence.current++;
      request.current?.controller.abort();
      request.current = null;
    };
  }, [refresh]);
  const [toast, setToast] = useState("");
  const [form, setForm] = useState<{
    kind: FormKind;
    initial: Record<string, unknown>;
  } | null>(null);
  const notify = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(""), 4500);
  };
  async function mutate(action: string, payload: Record<string, unknown>) {
    const response = await fetch("/api/records", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, data: payload }),
    });
    const result = await response.json();
    if (!response.ok)
      throw new Error(result.error ?? "The change could not be saved");
    if (["workspace_switch", "workspace_create"].includes(action)) {
      sequence.current++;
      request.current?.controller.abort();
      request.current = null;
    } else {
      await refresh(true);
      channel.current?.postMessage("records-updated");
    }
    return result.result ?? result.id;
  }
  return (
    <Context.Provider
      value={{
        data,
        notify,
        mutate,
        openForm: (kind, initial = {}) => setForm({ kind, initial }),
        refresh,
      }}
    >
      {children}
      {form && (
        <RecordForm
          key={`${form.kind}-${String(form.initial.id ?? "new")}`}
          kind={form.kind}
          initial={form.initial}
          onClose={() => setForm(null)}
        />
      )}{" "}
      {toast && (
        <div className="toast" role="status">
          <span className="status-dot" />
          {toast}
        </div>
      )}
    </Context.Provider>
  );
}
export function useApp() {
  const value = useContext(Context);
  if (!value) throw new Error("Workspace provider is missing");
  return value;
}

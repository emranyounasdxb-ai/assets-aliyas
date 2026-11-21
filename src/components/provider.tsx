"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import type { AppData } from "@/lib/domain";
import { RecordForm, type FormKind } from "./record-form";
interface AppContextValue {
  data: AppData;
  notify: (message: string) => void;
  mutate: (action: string, data: Record<string, unknown>) => Promise<unknown>;
  openForm: (kind: FormKind, initial?: Record<string, unknown>) => void;
}
const Context = createContext<AppContextValue | null>(null);
export function AppProvider({
  data,
  children,
}: {
  data: AppData;
  children: ReactNode;
}) {
  const router = useRouter();
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const timer = setInterval(refresh, 60000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [router]);
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
    router.refresh();
    return result.result ?? result.id;
  }
  return (
    <Context.Provider
      value={{
        data,
        notify,
        mutate,
        openForm: (kind, initial = {}) => setForm({ kind, initial }),
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

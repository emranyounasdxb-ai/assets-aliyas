import { redirect } from "next/navigation";
import { AppError, loadData } from "@/lib/server/context";
import { AppShell } from "@/components/app-shell";
import type { AppData } from "@/lib/domain";
export const dynamic = "force-dynamic";
export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let data: AppData;
  try {
    data = await loadData();
  } catch (error) {
    if (error instanceof AppError && [401, 403].includes(error.status))
      redirect("/login");
    throw error;
  }
  return <AppShell data={data}>{children}</AppShell>;
}

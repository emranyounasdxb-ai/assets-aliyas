import { Cheques } from "@/components/accounts";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view } = await searchParams;
  const filter = view === "overdue" || view === "upcoming" ? view : "all";
  return <Cheques key={filter} initialFilter={filter} />;
}

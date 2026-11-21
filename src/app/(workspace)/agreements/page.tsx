import { Agreements } from "@/components/agreements";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view } = await searchParams;
  const filter = view === "expiring" ? view : "all";
  return <Agreements key={filter} initialStatus={filter} />;
}

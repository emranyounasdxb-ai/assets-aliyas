import { Units } from "@/components/properties";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const filter =
    status && ["Vacant", "Occupied", "Reserved", "Maintenance"].includes(status)
      ? status
      : "all";
  return <Units key={filter} initialStatus={filter} />;
}

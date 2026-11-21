import { Units } from "@/components/properties";
export default async function ShopsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  return <Units shops initialStatus={status ?? "all"} />;
}

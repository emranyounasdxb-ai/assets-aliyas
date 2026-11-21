import { PropertyDetail } from "@/components/properties";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <PropertyDetail id={(await params).id} />;
}

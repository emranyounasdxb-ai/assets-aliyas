import { TenantDetail } from "@/components/tenants";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <TenantDetail id={(await params).id} />;
}

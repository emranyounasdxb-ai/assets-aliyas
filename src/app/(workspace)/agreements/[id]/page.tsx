import { AgreementDetail } from "@/components/agreements";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <AgreementDetail id={(await params).id} />;
}

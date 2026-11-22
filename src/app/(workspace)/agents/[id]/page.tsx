import { AgentDetail } from "@/components/agents";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <AgentDetail id={(await params).id} />;
}

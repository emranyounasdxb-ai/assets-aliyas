import { Login } from "@/components/login";
import { headers } from "next/headers";
import { localDemoAllowed } from "@/lib/server/env";
export default async function Page() {
  const demo = localDemoAllowed((await headers()).get("host"));
  return <Login demo={demo} />;
}

import { apiError, loadData } from "@/lib/server/context";

export const dynamic = "force-dynamic";
export async function GET() {
  try {
    return Response.json(await loadData(), {
      headers: { "Cache-Control": "private, no-store", Vary: "Cookie" },
    });
  } catch (error) {
    const response = apiError(error);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }
}

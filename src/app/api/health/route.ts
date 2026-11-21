export function GET() {
  return Response.json(
    { application: "aliyas-assets", status: "ok" },
    { headers: { "Cache-Control": "no-store" } },
  );
}

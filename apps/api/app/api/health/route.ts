export async function GET() {
  return Response.json({
    service: "spore-api",
    status: "ok"
  });
}

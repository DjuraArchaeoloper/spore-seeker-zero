import { getCurrentAdmin, noStoreHeaders } from "../../../../lib/adminApi";

export const runtime = "nodejs";

export async function GET() {
  const admin = await getCurrentAdmin();
  return admin
    ? Response.json({ admin }, { headers: noStoreHeaders })
    : Response.json({ error: "Unauthorized." }, { status: 401, headers: noStoreHeaders });
}

import { adminRoute } from "../../../../../../src/admin/route";
import { submitSignedPayout, PayoutError } from "../../../../../../src/admin/payout";
import { readJsonObject } from "../../../../../../src/http/request";
import { jsonOk } from "../../../../../../src/http/responses";

export const runtime = "nodejs";
type Context = { params: Promise<{ seasonId: string }> };
export function POST(request: Request, context: Context) {
  return adminRoute(request, async () => {
    const body = await readJsonObject(request, 4096);
    if (typeof body.transactionId !== "string" || typeof body.signedTransactionBase64 !== "string") {
      throw new PayoutError("Signed payout transaction is required.", 400);
    }
    return jsonOk(await submitSignedPayout((await context.params).seasonId, body.transactionId, body.signedTransactionBase64));
  });
}

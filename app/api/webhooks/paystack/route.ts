import { handleProviderWebhook } from "@/lib/payments/handle-webhook";

export async function POST(req: Request) {
  const rawBody = await req.text();
  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    json = {};
  }
  const sig = req.headers.get("x-paystack-signature");
  const result = await handleProviderWebhook("paystack", rawBody, sig, json);
  return Response.json(result);
}

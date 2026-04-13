import { handleProviderWebhook } from "@/lib/payments/handle-webhook";

export async function POST(req: Request) {
  const rawBody = await req.text();
  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    json = {};
  }
  const sig = req.headers.get("verif-hash");
  const result = await handleProviderWebhook("flutterwave", rawBody, sig, json);
  return Response.json(result);
}

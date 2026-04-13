import { handleProviderWebhook } from "@/lib/payments/handle-webhook";

export async function POST(req: Request) {
  const rawBody = await req.text();
  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    json = { raw: rawBody };
  }
  const sig = req.headers.get("x-moolre-signature");
  const result = await handleProviderWebhook("moolre", rawBody, sig, json);
  return Response.json(result);
}

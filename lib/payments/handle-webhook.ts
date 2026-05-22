import { createServiceRoleClient } from "@/lib/supabase/server";
import type { PaymentProviderId } from "./types";
import { parseWebhook, verifyWebhook } from "./index";
import { markOrderPaidByReference } from "./mark-order-paid";

export async function handleProviderWebhook(
  provider: PaymentProviderId,
  rawBody: string,
  signature: string | null,
  parsedJson: unknown
) {
  const supabase = createServiceRoleClient();
  const parsed = parseWebhook(provider, parsedJson);
  const sigOk = verifyWebhook(provider, rawBody, signature, parsedJson);

  await supabase.from("webhook_logs").insert({
    provider,
    event_type: "payment",
    payload: parsedJson as object,
    signature_ok: sigOk,
    processed: false,
    error: sigOk ? null : "Invalid signature",
  });

  if (!sigOk || !parsed.success || !parsed.reference) {
    return {
      ok: false,
      reason: !sigOk ? "verify" : !parsed.success ? "parse" : "no_reference",
    };
  }

  const marked = await markOrderPaidByReference(parsed.reference, provider, "webhook");
  if (!marked.ok) {
    await supabase.from("webhook_logs").insert({
      provider,
      event_type: "payment_error",
      payload: { error: marked.reason, reference: parsed.reference },
      signature_ok: sigOk,
      processed: false,
    });
    return { ok: false, reason: marked.reason };
  }

  await supabase.from("webhook_logs").insert({
    provider,
    event_type: "payment_processed",
    payload: { reference: parsed.reference, order_id: marked.orderId },
    signature_ok: sigOk,
    processed: true,
  });

  return { ok: true, idempotent: marked.idempotent };
}

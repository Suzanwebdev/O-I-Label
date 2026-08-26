import { createServiceRoleClient } from "@/lib/supabase/server";
import { observeOperationalEvent } from "@/lib/errors/capture-event";
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
    const reason = !sigOk ? "verify" : !parsed.success ? "parse" : "no_reference";
    observeOperationalEvent({
      severity: reason === "verify" ? "warning" : "error",
      category: "webhook",
      surface: "webhook",
      code: `moolre_${reason}`,
      message:
        reason === "verify"
          ? "Moolre webhook signature verification failed"
          : reason === "parse"
            ? "Moolre webhook payload could not be parsed"
            : "Moolre webhook missing payment reference",
      metadata: { provider, reason },
    });
    return {
      ok: false,
      reason,
    };
  }

  const marked = await markOrderPaidByReference(parsed.reference, provider, "webhook", {
    amountGhs: parsed.amountGhs,
    orderId: parsed.orderId,
  });
  if (!marked.ok) {
    await supabase.from("webhook_logs").insert({
      provider,
      event_type: "payment_error",
      payload: { error: marked.reason, reference: parsed.reference },
      signature_ok: sigOk,
      processed: false,
    });
    observeOperationalEvent({
      severity: marked.reason === "amount_mismatch" ? "critical" : "error",
      category: marked.reason === "amount_mismatch" ? "payment" : "webhook",
      surface: "webhook",
      code: `moolre_${marked.reason}`,
      message: `Moolre webhook processing failed: ${marked.reason}`,
      metadata: { provider, reason: marked.reason },
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

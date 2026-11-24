import { NextResponse } from "next/server";
import { getRequestAuthz, hasMinAdminRole } from "@/lib/authz";
import {
  customerMessageLimits,
  loadCustomersForMessaging,
  sendCustomerMessages,
  type CustomerMessageChannel,
} from "@/lib/admin/customer-messaging";

/**
 * POST /api/admin/customers/message
 * Body: {
 *   customerIds: string[],
 *   channel: "email" | "sms" | "both",
 *   subject?: string,
 *   message: string,
 *   confirm?: boolean, // required when more than one recipient
 *   respectPromoOptOut?: boolean // default true
 * }
 */
export async function POST(request: Request) {
  const authz = await getRequestAuthz();
  if (!hasMinAdminRole(authz, "admin") || !authz.user) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const b = body as {
    customerIds?: unknown;
    channel?: unknown;
    subject?: unknown;
    message?: unknown;
    confirm?: unknown;
    respectPromoOptOut?: unknown;
  };

  const customerIds = Array.isArray(b.customerIds)
    ? b.customerIds.filter((id): id is string => typeof id === "string" && id.trim().length > 0)
    : [];

  if (!customerIds.length) {
    return NextResponse.json({ error: "customerIds is required" }, { status: 400 });
  }

  const { maxRecipients } = customerMessageLimits();
  if (customerIds.length > maxRecipients) {
    return NextResponse.json(
      { error: `Select at most ${maxRecipients} customers per send.` },
      { status: 400 }
    );
  }

  const channelRaw = typeof b.channel === "string" ? b.channel.trim() : "";
  if (channelRaw !== "email" && channelRaw !== "sms" && channelRaw !== "both") {
    return NextResponse.json({ error: "channel must be email, sms, or both" }, { status: 400 });
  }
  const channel = channelRaw as CustomerMessageChannel;

  const message = typeof b.message === "string" ? b.message : "";
  const subject = typeof b.subject === "string" ? b.subject : "";
  const confirm = b.confirm === true;
  const respectPromoOptOut = b.respectPromoOptOut !== false;

  if (customerIds.length > 1 && !confirm) {
    return NextResponse.json(
      { error: "Set confirm: true to send to multiple customers." },
      { status: 400 }
    );
  }

  try {
    const recipients = await loadCustomersForMessaging(customerIds);
    if (!recipients.length) {
      return NextResponse.json({ error: "No matching customers found." }, { status: 404 });
    }

    const result = await sendCustomerMessages({
      recipients,
      channel,
      subject,
      message,
      actorId: authz.user.id,
      respectPromoOptOut,
    });

    return NextResponse.json({
      ok: result.sent > 0,
      ...result,
      total: recipients.length,
      summary: `${result.sent} sent, ${result.failed} failed, ${result.skipped} skipped (${recipients.length} customers)`,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not send message";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

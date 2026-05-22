import { NextResponse } from "next/server";
import { getRequestAuthz } from "@/lib/authz";
import { sendOrderCustomerUpdates } from "@/lib/admin/send-order-customer-update";
import { createServiceRoleClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const authz = await getRequestAuthz();
  if (!authz.isAdmin || !authz.user) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const orderIds = Array.isArray((body as { orderIds?: unknown })?.orderIds)
    ? ((body as { orderIds: unknown[] }).orderIds as unknown[]).filter(
        (v): v is string => typeof v === "string" && v.length > 0
      )
    : [];

  if (!orderIds.length) {
    return NextResponse.json({ error: "orderIds is required" }, { status: 400 });
  }

  const service = createServiceRoleClient();
  const { results, errors, sent, failed, skipped } = await sendOrderCustomerUpdates(
    service,
    orderIds,
    {
      actorId: authz.user.id,
      respectNotifyFlag: true,
      eventSource: "bulk_notify",
    }
  );

  return NextResponse.json({
    ok: sent > 0,
    sent,
    failed,
    skipped,
    total: orderIds.length,
    results,
    errors,
    summary: `${sent} notified, ${failed} failed, ${skipped} skipped (${orderIds.length} selected)`,
  });
}

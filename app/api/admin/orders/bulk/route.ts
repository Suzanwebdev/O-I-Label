import { NextResponse } from "next/server";
import { getRequestAuthz } from "@/lib/authz";
import { createServiceRoleClient } from "@/lib/supabase/server";

const allowedStatuses = new Set([
  "pending",
  "paid",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "refunded",
]);

export async function PATCH(request: Request) {
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
  const status =
    typeof (body as { status?: unknown })?.status === "string"
      ? (body as { status: string }).status
      : "";

  if (!orderIds.length || !allowedStatuses.has(status)) {
    return NextResponse.json({ error: "orderIds and valid status are required" }, { status: 400 });
  }

  const service = createServiceRoleClient();
  const now = new Date().toISOString();
  const { error } = await service
    .from("orders")
    .update({ status, updated_at: now })
    .in("id", orderIds);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await service.from("order_events").insert(
    orderIds.map((id) => ({
      order_id: id,
      event_type: "bulk_status_change",
      actor_id: authz.user?.id ?? null,
      message: `Status changed to ${status} via bulk action`,
      meta: { status },
    }))
  );

  return NextResponse.json({ ok: true, updated: orderIds.length });
}

import { NextResponse } from "next/server";
import { getRequestAuthz } from "@/lib/authz";
import { sendOrderCustomerUpdate } from "@/lib/admin/send-order-customer-update";
import { createServiceRoleClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{ orderId: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const authz = await getRequestAuthz();
  if (!authz.isAdmin || !authz.user) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { orderId } = await context.params;
  const service = createServiceRoleClient();

  const out = await sendOrderCustomerUpdate(service, orderId, {
    actorId: authz.user.id,
    respectNotifyFlag: false,
    eventSource: "manual",
  });

  if ("error" in out) {
    return NextResponse.json({ error: out.error }, { status: 404 });
  }

  return NextResponse.json({
    ok: out.ok,
    email: out.email,
    sms: out.sms,
    summary: out.summary,
    skipped: out.skipped,
  });
}

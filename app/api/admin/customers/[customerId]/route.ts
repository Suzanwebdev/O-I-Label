import { NextResponse } from "next/server";
import { getRequestAuthz } from "@/lib/authz";
import { createServiceRoleClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ customerId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const authz = await getRequestAuthz();
  if (!authz.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { customerId } = await context.params;
  const service = createServiceRoleClient();

  const [{ data: customer, error }, { data: addresses }, { data: orders }] = await Promise.all([
    service
      .from("customers")
      .select("id, email, full_name, phone, tags, total_spend_ghs, created_at")
      .eq("id", customerId)
      .maybeSingle(),
    service
      .from("addresses")
      .select("id, line1, line2, city, region, country, is_default, created_at")
      .eq("customer_id", customerId)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false }),
    service
      .from("orders")
      .select("id, order_number, status, total_ghs, created_at")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  if (error || !customer) {
    return NextResponse.json({ error: error?.message ?? "Customer not found" }, { status: 404 });
  }

  return NextResponse.json({
    customer: {
      ...customer,
      total_spend_ghs: Number(customer.total_spend_ghs ?? 0),
      tags: Array.isArray(customer.tags) ? customer.tags.filter((t) => typeof t === "string") : [],
    },
    addresses: addresses ?? [],
    orders: (orders ?? []).map((o) => ({ ...o, total_ghs: Number(o.total_ghs ?? 0) })),
  });
}

export async function PATCH(request: Request, context: RouteContext) {
  const authz = await getRequestAuthz();
  if (!authz.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { customerId } = await context.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const fullName =
    typeof (body as { full_name?: unknown })?.full_name === "string"
      ? (body as { full_name: string }).full_name.trim()
      : undefined;
  const phone =
    typeof (body as { phone?: unknown })?.phone === "string"
      ? (body as { phone: string }).phone.trim()
      : undefined;
  const tagsRaw = Array.isArray((body as { tags?: unknown })?.tags)
    ? ((body as { tags: unknown[] }).tags as unknown[])
    : undefined;
  const tags =
    tagsRaw?.filter((t): t is string => typeof t === "string").map((t) => t.trim()).filter(Boolean) ?? undefined;

  const update: Record<string, unknown> = {};
  if (fullName !== undefined) update.full_name = fullName || null;
  if (phone !== undefined) update.phone = phone || null;
  if (tags !== undefined) update.tags = Array.from(new Set(tags)).slice(0, 20);
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const service = createServiceRoleClient();
  const { error } = await service.from("customers").update(update).eq("id", customerId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

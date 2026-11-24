import { NextResponse } from "next/server";
import { getRequestAuthz } from "@/lib/authz";
import { createServiceRoleClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ customerId: string }> };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(_request: Request, context: RouteContext) {
  const authz = await getRequestAuthz();
  if (!authz.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { customerId } = await context.params;
  const service = createServiceRoleClient();

  if (UUID_RE.test(customerId)) {
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
      editable: true,
      customer: {
        ...customer,
        total_spend_ghs: Number(customer.total_spend_ghs ?? 0),
        tags: Array.isArray(customer.tags) ? customer.tags.filter((t) => typeof t === "string") : [],
      },
      addresses: addresses ?? [],
      orders: (orders ?? []).map((o) => ({ ...o, total_ghs: Number(o.total_ghs ?? 0) })),
    });
  }

  if (customerId.startsWith("e:")) {
    const email = customerId.slice(2).trim().toLowerCase();
    if (!email) return NextResponse.json({ error: "Invalid contact id" }, { status: 400 });

    const [{ data: orders }, { data: waitlist }, { data: newsletter }] = await Promise.all([
      service
        .from("orders")
        .select("id, order_number, status, total_ghs, created_at, phone, shipping_address")
        .ilike("email", email)
        .order("created_at", { ascending: false })
        .limit(50),
      service
        .from("store_waitlist")
        .select("first_name, phone_e164, source, created_at")
        .eq("email_normalized", email)
        .maybeSingle(),
      service
        .from("newsletter_subscribers")
        .select("phone_e164, source, created_at")
        .eq("email_normalized", email)
        .maybeSingle(),
    ]);

    const firstOrder = orders?.[0] as
      | {
          phone?: string | null;
          shipping_address?: { first_name?: string; last_name?: string } | null;
          created_at?: string;
        }
      | undefined;
    const ship = firstOrder?.shipping_address;
    const shipName = ship
      ? `${ship.first_name ?? ""} ${ship.last_name ?? ""}`.trim() || null
      : null;

    return NextResponse.json({
      editable: false,
      customer: {
        id: customerId,
        email,
        full_name: waitlist?.first_name ?? shipName,
        phone: waitlist?.phone_e164 ?? newsletter?.phone_e164 ?? firstOrder?.phone ?? null,
        tags: [
          ...(waitlist?.source ? [`waitlist:${waitlist.source}`] : []),
          ...(newsletter?.source ? [`newsletter:${newsletter.source}`] : []),
        ],
        total_spend_ghs: (orders ?? []).reduce((sum, o) => sum + Number(o.total_ghs ?? 0), 0),
        created_at:
          waitlist?.created_at ??
          newsletter?.created_at ??
          firstOrder?.created_at ??
          new Date(0).toISOString(),
      },
      addresses: [],
      orders: (orders ?? []).map((o) => ({
        id: o.id,
        order_number: o.order_number,
        status: o.status,
        total_ghs: Number(o.total_ghs ?? 0),
        created_at: o.created_at,
      })),
    });
  }

  return NextResponse.json({ error: "Customer not found" }, { status: 404 });
}

export async function PATCH(request: Request, context: RouteContext) {
  const authz = await getRequestAuthz();
  if (!authz.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { customerId } = await context.params;
  if (!UUID_RE.test(customerId)) {
    return NextResponse.json(
      { error: "Only account profiles can be edited here." },
      { status: 400 }
    );
  }

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
    tagsRaw?.filter((t): t is string => typeof t === "string").map((t) => t.trim()).filter(Boolean) ??
    undefined;

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

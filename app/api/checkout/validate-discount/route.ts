import { NextResponse } from "next/server";
import { resolveCheckoutDiscount } from "@/lib/checkout/discount";
import { assertCheckoutAllowed } from "@/lib/store-control/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { enforceRateLimit } from "@/lib/http/rate-limit";

export async function POST(request: Request) {
  const limited = await enforceRateLimit(request, "checkout:validate-discount", 40);
  if (limited) return limited;

  const checkoutGate = await assertCheckoutAllowed();
  if (!checkoutGate.ok) {
    return NextResponse.json(
      { error: checkoutGate.error, code: checkoutGate.code },
      { status: checkoutGate.status, headers: { "Retry-After": "3600" } }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const code = typeof (body as { code?: unknown })?.code === "string" ? (body as { code: string }).code : "";
  const subtotalGhs = Number((body as { subtotalGhs?: unknown })?.subtotalGhs);
  const shippingGhs = Number((body as { shippingGhs?: unknown })?.shippingGhs ?? 0);

  if (!Number.isFinite(subtotalGhs) || subtotalGhs <= 0) {
    return NextResponse.json({ error: "Cart subtotal is required" }, { status: 400 });
  }

  const service = createServiceRoleClient();
  const result = await resolveCheckoutDiscount(
    service,
    code,
    subtotalGhs,
    Number.isFinite(shippingGhs) ? shippingGhs : 0
  );

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }

  const { applied } = result;
  const totalGhs =
    Math.round((subtotalGhs + applied.shippingGhs - applied.discountGhs) * 100) / 100;

  return NextResponse.json({
    ok: true,
    code: applied.code,
    kind: applied.kind,
    label: applied.label,
    discountGhs: applied.discountGhs,
    shippingGhs: applied.shippingGhs,
    totalGhs: Math.max(0, totalGhs),
  });
}

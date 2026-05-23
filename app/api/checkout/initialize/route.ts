import { NextResponse } from "next/server";
import {
  incrementDiscountUsage,
  resolveCheckoutDiscount,
} from "@/lib/checkout/discount";
import {
  aggregateVariantQuantities,
  findInsufficientStock,
} from "@/lib/inventory/deduct-order-stock";
import { initiatePayment } from "@/lib/payments";
import { resolveMoolreCallbackUrl } from "@/lib/payments/providers/moolre";
import { createServiceRoleClient } from "@/lib/supabase/server";

type CheckoutLineInput = {
  variantId?: unknown;
  quantity?: unknown;
  name?: unknown;
};

function appBaseUrl(): string {
  const base = process.env.APP_BASE_URL?.trim() || process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!base) throw new Error("APP_BASE_URL or NEXT_PUBLIC_SITE_URL is required");
  return base.replace(/\/$/, "");
}

function orderNumber(): string {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `OI-${y}${m}${day}-${rand}`;
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const b = body as {
    email?: unknown;
    phone?: unknown;
    firstName?: unknown;
    lastName?: unknown;
    address?: unknown;
    city?: unknown;
    region?: unknown;
    lines?: unknown;
    discountCode?: unknown;
  };

  const email = typeof b.email === "string" ? b.email.trim().toLowerCase() : "";
  const phone = typeof b.phone === "string" ? b.phone.trim() : "";
  const firstName = typeof b.firstName === "string" ? b.firstName.trim() : "";
  const lastName = typeof b.lastName === "string" ? b.lastName.trim() : "";
  const address = typeof b.address === "string" ? b.address.trim() : "";
  const city = typeof b.city === "string" ? b.city.trim() : "";
  const region = typeof b.region === "string" ? b.region.trim() : "";
  const rawLines = Array.isArray(b.lines) ? (b.lines as CheckoutLineInput[]) : [];

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
  }
  if (!phone) {
    return NextResponse.json({ error: "Phone is required" }, { status: 400 });
  }
  if (!address || !city || !region) {
    return NextResponse.json({ error: "Shipping address, city, and region are required" }, { status: 400 });
  }

  const parsedLines = rawLines
    .map((l) => ({
      variantId: typeof l.variantId === "string" ? l.variantId.trim() : "",
      quantity: Number(l.quantity),
      name: typeof l.name === "string" ? l.name.trim() : "",
    }))
    .filter((l) => l.variantId && Number.isFinite(l.quantity) && l.quantity > 0);

  if (!parsedLines.length) {
    return NextResponse.json({ error: "No checkout items provided" }, { status: 400 });
  }

  const service = createServiceRoleClient();
  const variantIds = [...new Set(parsedLines.map((l) => l.variantId))];
  const { data: variants, error: variantErr } = await service
    .from("variants")
    .select("id, product_id, sku, price_ghs, stock")
    .in("id", variantIds);

  if (variantErr || !variants?.length) {
    return NextResponse.json({ error: variantErr?.message ?? "Could not load product variants" }, { status: 500 });
  }

  const variantMap = new Map(variants.map((v) => [v.id, v]));
  const missing = variantIds.filter((id) => !variantMap.has(id));
  if (missing.length) {
    return NextResponse.json({ error: "One or more selected items are no longer available" }, { status: 409 });
  }

  const requestedByVariant = aggregateVariantQuantities(parsedLines);
  const insufficient = findInsufficientStock(
    requestedByVariant,
    variants.map((v) => ({ id: v.id, stock: Number(v.stock ?? 0), sku: v.sku }))
  );
  if (insufficient.length) {
    const detail = insufficient
      .map((s) => `${s.sku}: only ${s.available} left (${s.requested} requested)`)
      .join("; ");
    return NextResponse.json(
      {
        error: "Not enough stock for one or more items",
        code: "insufficient_stock",
        items: insufficient,
        detail,
      },
      { status: 409 }
    );
  }

  const subtotal = parsedLines.reduce((sum, line) => {
    const v = variantMap.get(line.variantId)!;
    return sum + Number(v.price_ghs) * line.quantity;
  }, 0);

  const shipping = 0;
  const tax = 0;
  let discount = 0;
  let discountId: string | null = null;
  const discountCode =
    typeof b.discountCode === "string" ? b.discountCode.trim() : "";

  if (discountCode) {
    const discountResult = await resolveCheckoutDiscount(service, discountCode, subtotal, shipping);
    if (!discountResult.ok) {
      return NextResponse.json({ error: discountResult.error }, { status: 400 });
    }
    discount = discountResult.applied.discountGhs;
    discountId = discountResult.applied.discountId;
    if (discountResult.applied.kind === "free_shipping") {
      // shipping stays 0 for now; discount_ghs records waived amount
    }
  }

  const total = Math.max(0, Math.round((subtotal + shipping + tax - discount) * 100) / 100);

  const { data: order, error: orderErr } = await service
    .from("orders")
    .insert({
      order_number: orderNumber(),
      email,
      phone,
      status: "pending",
      subtotal_ghs: subtotal,
      shipping_ghs: shipping,
      tax_ghs: tax,
      discount_ghs: discount,
      total_ghs: total,
      currency: "GHS",
      shipping_address: {
        first_name: firstName,
        last_name: lastName,
        address,
        city,
        region,
        phone,
      },
      billing_address: {
        first_name: firstName,
        last_name: lastName,
        address,
        city,
        region,
        phone,
      },
      notify_customer: true,
    })
    .select("id, order_number")
    .single();

  if (orderErr || !order) {
    return NextResponse.json({ error: orderErr?.message ?? "Could not create order" }, { status: 500 });
  }

  const orderItems = parsedLines.map((line) => {
    const v = variantMap.get(line.variantId)!;
    return {
      order_id: order.id,
      product_id: v.product_id,
      variant_id: v.id,
      name: line.name || v.sku,
      sku: v.sku,
      unit_price_ghs: Number(v.price_ghs),
      quantity: line.quantity,
    };
  });

  const { error: itemErr } = await service.from("order_items").insert(orderItems);
  if (itemErr) {
    await service.from("orders").delete().eq("id", order.id);
    return NextResponse.json({ error: itemErr.message ?? "Could not add order items" }, { status: 500 });
  }

  if (discountId) {
    await incrementDiscountUsage(service, discountId);
  }

  try {
    const base = appBaseUrl();
    const payment = await initiatePayment("moolre", {
      orderId: order.id,
      amountGhs: total,
      email,
      callbackUrl: resolveMoolreCallbackUrl(),
      redirectUrl: `${base}/checkout/success?order=${order.id}`,
      metadata: {
        order_number: order.order_number,
      },
    });

    const { error: paymentErr } = await service.from("payments").insert({
      order_id: order.id,
      provider: payment.provider,
      reference: payment.reference,
      amount_ghs: total,
      status: "pending",
      raw: payment.raw ?? null,
    });

    if (paymentErr) {
      return NextResponse.json({ error: paymentErr.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      orderId: order.id,
      orderNumber: order.order_number,
      provider: payment.provider,
      redirectUrl: payment.redirectUrl,
      reference: payment.reference,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Payment initialization failed";
    await service.from("payments").delete().eq("order_id", order.id);
    await service.from("order_items").delete().eq("order_id", order.id);
    await service.from("orders").delete().eq("id", order.id);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}


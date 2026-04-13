import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { getRequestAuthz } from "@/lib/authz";
import {
  getDefaultProvider,
  initiatePayment,
  type PaymentProviderId,
} from "@/lib/payments";

export async function POST(req: Request) {
  try {
    const authz = await getRequestAuthz();
    if (!authz.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as {
      orderId?: string;
      provider?: PaymentProviderId;
      email?: string;
    };
    if (!body.orderId || !body.email) {
      return NextResponse.json(
        { error: "orderId and email required" },
        { status: 400 }
      );
    }

    const supabase = createServiceRoleClient();
    const { data: order, error } = await supabase
      .from("orders")
      .select("id, total_ghs, email, status, customer_id")
      .eq("id", body.orderId)
      .single();

    if (error || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (order.status !== "pending") {
      return NextResponse.json(
        { error: `Order cannot be paid in status: ${order.status}` },
        { status: 409 }
      );
    }

    const requestEmail = body.email.trim().toLowerCase();
    const userEmail = (authz.user.email ?? "").toLowerCase();
    if (!userEmail || requestEmail !== userEmail) {
      return NextResponse.json(
        { error: "Email does not match authenticated user" },
        { status: 403 }
      );
    }

    const customerId = order.customer_id as string | null;
    const orderEmail = String(order.email ?? "").toLowerCase();
    if (customerId) {
      if (customerId !== authz.user.id) {
        return NextResponse.json(
          { error: "You cannot initiate payment for this order" },
          { status: 403 }
        );
      }
    } else if (orderEmail !== userEmail) {
      return NextResponse.json(
        { error: "Order email does not belong to this user" },
        { status: 403 }
      );
    }

    const { data: activePayment } = await supabase
      .from("payments")
      .select("reference, status")
      .eq("order_id", order.id)
      .in("status", ["processing", "paid"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (activePayment) {
      return NextResponse.json(
        {
          error: `Payment already ${activePayment.status}`,
          reference: activePayment.reference,
        },
        { status: 409 }
      );
    }

    const base = process.env.APP_BASE_URL ?? "http://localhost:3000";
    const provider =
      body.provider ?? getDefaultProvider({ moolre: true, paystack: true });

    const result = await initiatePayment(provider, {
      orderId: order.id,
      amountGhs: Number(order.total_ghs),
      email: body.email,
      callbackUrl: `${base}/checkout/return`,
      metadata: { order_id: order.id },
    });

    await supabase.from("payments").insert({
      order_id: order.id,
      provider,
      reference: result.reference,
      amount_ghs: Number(order.total_ghs),
      status: "processing",
      raw: result.raw as object,
    });

    return NextResponse.json({
      redirectUrl: result.redirectUrl,
      reference: result.reference,
      provider,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Init failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { getRequestAuthz } from "@/lib/authz";
import {
  buildInvoiceErrorHtml,
  buildInvoiceHtmlDocument,
} from "@/lib/admin/order-invoice";
import {
  buildShippingLabelSection,
  SHIPPING_LABEL_CSS,
  validateShippingLabelOrder,
} from "@/lib/admin/order-shipping-label";
import { createServiceRoleClient } from "@/lib/supabase/server";
import type { OrderAddressJson } from "@/lib/orders/format-address";

type RouteContext = {
  params: Promise<{ orderId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const authz = await getRequestAuthz();
  if (!authz.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { orderId } = await context.params;
  const service = createServiceRoleClient();
  const { data: order, error } = await service
    .from("orders")
    .select("order_number, phone, shipping_address")
    .eq("id", orderId)
    .maybeSingle();

  if (error || !order) {
    return NextResponse.json({ error: error?.message ?? "Order not found" }, { status: 404 });
  }

  const shipOrder = {
    order_number: String(order.order_number ?? ""),
    phone: order.phone == null ? null : String(order.phone),
    shipping_address: order.shipping_address as OrderAddressJson,
  };

  const validation = validateShippingLabelOrder(shipOrder);
  if (!validation.ok) {
    return new NextResponse(
      buildInvoiceErrorHtml(
        `Cannot print shipping label for ${shipOrder.order_number}. Missing: ${validation.missing.join(", ")}.`
      ),
      {
        status: 400,
        headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
      }
    );
  }

  const html = buildInvoiceHtmlDocument({
    title: `Shipping label ${shipOrder.order_number}`,
    sections: [buildShippingLabelSection(shipOrder, { pageBreakAfter: false })],
    extraCss: SHIPPING_LABEL_CSS,
  });

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

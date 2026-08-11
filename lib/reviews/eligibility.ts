import { createServiceRoleClient } from "@/lib/supabase/server";
import { isOrderPaid } from "@/lib/admin/order-status";
import type { EligibleReviewItem, ReviewStatus } from "@/lib/reviews/types";

type Service = ReturnType<typeof createServiceRoleClient>;

/**
 * Server-side eligibility: paid order owned by customer, product matches line,
 * variant snapshot from order_items.variant_id → variants (historical color/size).
 */
export async function getEligibleItemsForCustomer(
  customerId: string,
  opts?: { productId?: string; orderItemId?: string }
): Promise<EligibleReviewItem[]> {
  const service = createServiceRoleClient();

  let orderQuery = service
    .from("orders")
    .select(
      `
      id,
      order_number,
      paid_at,
      status,
      order_items (
        id,
        product_id,
        variant_id,
        name,
        quantity,
        variants ( color, size ),
        products ( slug )
      )
    `
    )
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false })
    .limit(100);

  const { data: orders, error } = await orderQuery;
  if (error || !orders?.length) {
    if (error) console.error("[reviews] eligibility orders:", error.message);
    return [];
  }

  const itemIds: string[] = [];
  for (const order of orders) {
    const items = Array.isArray(order.order_items) ? order.order_items : [];
    for (const item of items) {
      if (item?.id) itemIds.push(String(item.id));
    }
  }

  const existingByItem = new Map<
    string,
    { id: string; status: ReviewStatus }
  >();
  if (itemIds.length) {
    const { data: existing } = await service
      .from("reviews")
      .select("id, order_item_id, status")
      .in("order_item_id", itemIds);
    for (const row of existing ?? []) {
      if (row.order_item_id) {
        existingByItem.set(String(row.order_item_id), {
          id: String(row.id),
          status: row.status as ReviewStatus,
        });
      }
    }
  }

  const out: EligibleReviewItem[] = [];

  for (const order of orders) {
    const paid = isOrderPaid({
      payment_status: order.paid_at ? "paid" : null,
      paid_at: order.paid_at ?? null,
    });
    if (!paid) continue;

    const items = Array.isArray(order.order_items) ? order.order_items : [];
    for (const item of items) {
      if (!item?.id || !item.product_id) continue;
      const productId = String(item.product_id);
      const orderItemId = String(item.id);
      if (opts?.productId && productId !== opts.productId) continue;
      if (opts?.orderItemId && orderItemId !== opts.orderItemId) continue;

      const variant = item.variants;
      const variantObj = Array.isArray(variant) ? variant[0] : variant;
      const products = item.products;
      const productObj = Array.isArray(products) ? products[0] : products;
      const existing = existingByItem.get(orderItemId);

      out.push({
        order_id: String(order.id),
        order_number: String(order.order_number),
        order_item_id: orderItemId,
        product_id: productId,
        product_name: String(item.name ?? "Item"),
        product_slug:
          productObj && typeof productObj === "object" && "slug" in productObj
            ? String((productObj as { slug?: string }).slug ?? "") || null
            : null,
        purchased_color:
          variantObj && typeof variantObj === "object" && "color" in variantObj
            ? ((variantObj as { color?: string | null }).color ?? null)
            : null,
        purchased_size:
          variantObj && typeof variantObj === "object" && "size" in variantObj
            ? ((variantObj as { size?: string | null }).size ?? null)
            : null,
        purchased_variant_id: item.variant_id ? String(item.variant_id) : null,
        paid_at: order.paid_at ? String(order.paid_at) : null,
        already_reviewed: Boolean(existing),
        existing_review_id: existing?.id ?? null,
        existing_review_status: existing?.status ?? null,
      });
    }
  }

  return out;
}

export async function assertEligibleOrderItem(opts: {
  customerId: string;
  orderItemId: string;
  productId: string;
}): Promise<
  | { ok: true; item: EligibleReviewItem }
  | { ok: false; error: string }
> {
  const items = await getEligibleItemsForCustomer(opts.customerId, {
    orderItemId: opts.orderItemId,
    productId: opts.productId,
  });
  const item = items[0];
  if (!item) {
    return { ok: false, error: "This purchase is not eligible for a review." };
  }
  if (item.product_id !== opts.productId) {
    return { ok: false, error: "Product does not match this purchase." };
  }
  if (item.already_reviewed) {
    return { ok: false, error: "You have already reviewed this purchase." };
  }
  return { ok: true, item };
}

export async function loadOrderItemSnapshot(
  service: Service,
  orderItemId: string
) {
  const { data, error } = await service
    .from("order_items")
    .select(
      `
      id,
      order_id,
      product_id,
      variant_id,
      name,
      orders ( id, customer_id, paid_at, status, payments ( status ) ),
      variants ( color, size )
    `
    )
    .eq("id", orderItemId)
    .maybeSingle();
  if (error || !data) return null;
  return data;
}

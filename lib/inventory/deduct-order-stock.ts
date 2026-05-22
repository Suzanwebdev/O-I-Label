import type { SupabaseClient } from "@supabase/supabase-js";

export type DeductOrderStockResult =
  | { ok: true; idempotent?: boolean; lines: number }
  | { ok: false; reason: string };

type OrderItemRow = {
  variant_id: string | null;
  quantity: number;
  name: string;
  sku: string | null;
};

/**
 * Idempotently reduce variant stock when an order is paid.
 * Logs inventory_movements and an order_events audit row.
 */
export async function deductStockForPaidOrder(
  supabase: SupabaseClient,
  orderId: string,
  opts?: { orderNumber?: string; source?: string }
): Promise<DeductOrderStockResult> {
  const { data: existing } = await supabase
    .from("order_events")
    .select("id")
    .eq("order_id", orderId)
    .eq("event_type", "inventory_deducted")
    .limit(1)
    .maybeSingle();

  if (existing?.id) {
    return { ok: true, idempotent: true, lines: 0 };
  }

  const { data: items, error: itemsErr } = await supabase
    .from("order_items")
    .select("variant_id, quantity, name, sku")
    .eq("order_id", orderId);

  if (itemsErr) {
    return { ok: false, reason: "order_items_load" };
  }

  const rows = (items ?? []) as OrderItemRow[];
  const byVariant = new Map<string, { quantity: number; label: string }>();

  for (const row of rows) {
    if (!row.variant_id) continue;
    const qty = Number(row.quantity);
    if (!Number.isFinite(qty) || qty <= 0) continue;
    const label = row.name || row.sku || row.variant_id;
    const cur = byVariant.get(row.variant_id);
    if (cur) {
      cur.quantity += qty;
    } else {
      byVariant.set(row.variant_id, { quantity: qty, label });
    }
  }

  if (!byVariant.size) {
    await supabase.from("order_events").insert({
      order_id: orderId,
      event_type: "inventory_deducted",
      actor_id: null,
      message: "No variant lines to deduct — stock unchanged",
      meta: { source: opts?.source ?? null, order_number: opts?.orderNumber ?? null },
    });
    return { ok: true, lines: 0 };
  }

  const shortages: Array<{ variant_id: string; label: string; before: number; needed: number }> = [];
  let linesAdjusted = 0;

  for (const [variantId, { quantity, label }] of byVariant) {
    const { data: variant, error: varErr } = await supabase
      .from("variants")
      .select("stock")
      .eq("id", variantId)
      .maybeSingle();

    if (varErr || !variant) {
      return { ok: false, reason: "variant_not_found" };
    }

    const before = Number(variant.stock ?? 0);
    const next = before - quantity;

    if (before < quantity) {
      shortages.push({ variant_id: variantId, label, before, needed: quantity });
    }

    const { error: updErr } = await supabase
      .from("variants")
      .update({ stock: next })
      .eq("id", variantId);

    if (updErr) {
      return { ok: false, reason: "variant_update" };
    }

    await supabase.from("inventory_movements").insert({
      variant_id: variantId,
      delta: -quantity,
      reason: "order_paid",
      created_by: null,
    });

    linesAdjusted += 1;
  }

  const orderRef = opts?.orderNumber ? ` (${opts.orderNumber})` : "";
  const baseMsg =
    linesAdjusted === 1
      ? `Stock deducted for 1 line item${orderRef}`
      : `Stock deducted for ${linesAdjusted} line items${orderRef}`;

  await supabase.from("order_events").insert({
    order_id: orderId,
    event_type: "inventory_deducted",
    actor_id: null,
    message: shortages.length
      ? `${baseMsg} — ${shortages.length} variant(s) went below zero before sale`
      : baseMsg,
    meta: {
      source: opts?.source ?? null,
      order_number: opts?.orderNumber ?? null,
      lines: linesAdjusted,
      shortages: shortages.length ? shortages : undefined,
    },
  });

  return { ok: true, lines: linesAdjusted };
}

/** Sum requested quantities per variant for checkout validation. */
export function aggregateVariantQuantities(
  lines: Array<{ variantId: string; quantity: number }>
): Map<string, number> {
  const map = new Map<string, number>();
  for (const line of lines) {
    const prev = map.get(line.variantId) ?? 0;
    map.set(line.variantId, prev + line.quantity);
  }
  return map;
}

export function findInsufficientStock(
  requested: Map<string, number>,
  variants: Array<{ id: string; stock: number; sku: string }>
): Array<{ variantId: string; sku: string; available: number; requested: number }> {
  const variantMap = new Map(variants.map((v) => [v.id, v]));
  const short: Array<{ variantId: string; sku: string; available: number; requested: number }> = [];

  for (const [variantId, qty] of requested) {
    const v = variantMap.get(variantId);
    if (!v) continue;
    const available = Number(v.stock ?? 0);
    if (available < qty) {
      short.push({ variantId, sku: v.sku, available, requested: qty });
    }
  }

  return short;
}

import { createServiceRoleClient } from "@/lib/supabase/server";

export type AdminCategory = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sort_order: number;
};

export type AdminCollection = {
  id: string;
  title: string;
  slug: string;
  is_smart: boolean;
  created_at: string;
};

export type AdminInventoryRow = {
  variant_id: string;
  sku: string;
  stock: number;
  price_ghs: number;
  product_name: string;
  product_slug: string;
};

export type AdminSupportSnapshot = {
  openOrders: number;
  totalCustomers: number;
  pendingPayments: number;
  recentOrders: {
    id: string;
    order_number: string;
    email: string;
    status: string;
    total_ghs: number;
    created_at: string;
  }[];
};

export type AdminAnalyticsSnapshot = {
  totalOrders: number;
  paidOrders: number;
  grossRevenue: number;
  activeProducts: number;
};

export async function listAdminCategories(): Promise<AdminCategory[]> {
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from("categories")
    .select("id, name, slug, description, sort_order")
    .order("sort_order", { ascending: true });
  return (data ?? []) as AdminCategory[];
}

export async function listAdminCollections(): Promise<AdminCollection[]> {
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from("collections")
    .select("id, title, slug, is_smart, created_at")
    .order("created_at", { ascending: false });
  return (data ?? []) as AdminCollection[];
}

export async function listAdminInventory(): Promise<AdminInventoryRow[]> {
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from("variants")
    .select("id, sku, stock, price_ghs, products!inner(name, slug)")
    .order("stock", { ascending: true })
    .limit(200);

  return (data ?? []).map((row) => {
    const product = Array.isArray(row.products) ? row.products[0] : row.products;
    return {
      variant_id: row.id,
      sku: row.sku,
      stock: row.stock,
      price_ghs: Number(row.price_ghs),
      product_name: product?.name ?? "Unknown product",
      product_slug: product?.slug ?? "",
    };
  });
}

export async function getSupportSnapshot(): Promise<AdminSupportSnapshot> {
  const supabase = createServiceRoleClient();
  const [{ count: openOrders }, { count: totalCustomers }, { count: pendingPayments }, { data: recentOrders }] =
    await Promise.all([
      supabase.from("orders").select("id", { count: "exact", head: true }).in("status", ["pending", "processing"]),
      supabase.from("customers").select("id", { count: "exact", head: true }),
      supabase.from("payments").select("id", { count: "exact", head: true }).in("status", ["pending", "processing"]),
      supabase
        .from("orders")
        .select("id, order_number, email, status, total_ghs, created_at")
        .order("created_at", { ascending: false })
        .limit(8),
    ]);

  return {
    openOrders: openOrders ?? 0,
    totalCustomers: totalCustomers ?? 0,
    pendingPayments: pendingPayments ?? 0,
    recentOrders: ((recentOrders ?? []) as AdminSupportSnapshot["recentOrders"]).map((o) => ({
      ...o,
      total_ghs: Number(o.total_ghs),
    })),
  };
}

export async function getAnalyticsSnapshot(): Promise<AdminAnalyticsSnapshot> {
  const supabase = createServiceRoleClient();
  const [{ count: totalOrders }, { count: paidOrders }, { data: paidTotals }, { count: activeProducts }] =
    await Promise.all([
      supabase.from("orders").select("id", { count: "exact", head: true }),
      supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "paid"),
      supabase.from("orders").select("total_ghs").eq("status", "paid"),
      supabase.from("products").select("id", { count: "exact", head: true }).eq("is_active", true),
    ]);

  const grossRevenue = (paidTotals ?? []).reduce((sum, row) => sum + Number(row.total_ghs ?? 0), 0);

  return {
    totalOrders: totalOrders ?? 0,
    paidOrders: paidOrders ?? 0,
    grossRevenue,
    activeProducts: activeProducts ?? 0,
  };
}


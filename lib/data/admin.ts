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

export type AdminDashboardSnapshot = {
  revenue30d: number;
  orders30d: number;
  aov30d: number;
  paidRatePct: number;
};

export type AdminBlogPost = {
  id: string;
  slug: string;
  title: string;
  published: boolean;
  published_at: string | null;
  created_at: string;
};

export type AdminContentSnapshot = {
  blogCount: number;
  publishedBlogCount: number;
  policyCount: number;
  hasHomepageConfig: boolean;
};

export type AdminTeamMember = {
  user_id: string;
  email: string;
  role: "superadmin" | "admin" | "staff";
};

export type AdminFeatureFlagsSnapshot = {
  featureFlags: Record<string, unknown>;
  maintenanceMode: boolean;
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

export async function getDashboardSnapshot(): Promise<AdminDashboardSnapshot> {
  const supabase = createServiceRoleClient();
  const since = new Date();
  since.setDate(since.getDate() - 30);
  const iso = since.toISOString();

  const [{ count: orders30d }, { count: paid30d }, { data: paidTotals }] = await Promise.all([
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .gte("created_at", iso),
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .gte("created_at", iso)
      .eq("status", "paid"),
    supabase
      .from("orders")
      .select("total_ghs")
      .gte("created_at", iso)
      .eq("status", "paid"),
  ]);

  const revenue30d = (paidTotals ?? []).reduce((sum, row) => sum + Number(row.total_ghs ?? 0), 0);
  const paidCount = paid30d ?? 0;
  const orderCount = orders30d ?? 0;

  return {
    revenue30d,
    orders30d: orderCount,
    aov30d: paidCount > 0 ? revenue30d / paidCount : 0,
    paidRatePct: orderCount > 0 ? (paidCount / orderCount) * 100 : 0,
  };
}

export async function listAdminBlogPosts(): Promise<AdminBlogPost[]> {
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from("blog_posts")
    .select("id, slug, title, published, published_at, created_at")
    .order("created_at", { ascending: false })
    .limit(40);

  return (data ?? []) as AdminBlogPost[];
}

export async function getAdminContentSnapshot(): Promise<AdminContentSnapshot> {
  const supabase = createServiceRoleClient();
  const [{ count: blogCount }, { count: publishedBlogCount }, { count: policyCount }, { data: homeRow }] =
    await Promise.all([
      supabase.from("blog_posts").select("id", { count: "exact", head: true }),
      supabase.from("blog_posts").select("id", { count: "exact", head: true }).eq("published", true),
      supabase.from("policy_pages").select("id", { count: "exact", head: true }),
      supabase.from("home_content").select("id").eq("id", 1).maybeSingle(),
    ]);

  return {
    blogCount: blogCount ?? 0,
    publishedBlogCount: publishedBlogCount ?? 0,
    policyCount: policyCount ?? 0,
    hasHomepageConfig: Boolean(homeRow),
  };
}

export async function getHomepageSectionsJson(): Promise<string> {
  const supabase = createServiceRoleClient();
  const { data } = await supabase.from("home_content").select("sections").eq("id", 1).maybeSingle();
  return JSON.stringify(data?.sections ?? {}, null, 2);
}

export async function getFeatureFlagsSnapshot(): Promise<AdminFeatureFlagsSnapshot> {
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from("site_settings")
    .select("feature_flags, maintenance_mode")
    .eq("id", 1)
    .maybeSingle();

  const flags =
    data?.feature_flags && typeof data.feature_flags === "object" && !Array.isArray(data.feature_flags)
      ? (data.feature_flags as Record<string, unknown>)
      : {};

  return {
    featureFlags: flags,
    maintenanceMode: Boolean(data?.maintenance_mode),
  };
}

export async function listAdminTeamMembers(): Promise<AdminTeamMember[]> {
  const supabase = createServiceRoleClient();
  const [{ data: admins }, { data: supers }] = await Promise.all([
    supabase.from("admins").select("user_id, email, role").order("created_at", { ascending: true }),
    supabase.from("superadmins").select("user_id, email").order("created_at", { ascending: true }),
  ]);

  const members: AdminTeamMember[] = [];
  const seen = new Set<string>();

  for (const s of supers ?? []) {
    const key = s.user_id;
    if (seen.has(key)) continue;
    seen.add(key);
    members.push({ user_id: s.user_id, email: s.email ?? "", role: "superadmin" });
  }
  for (const a of admins ?? []) {
    const key = a.user_id;
    if (seen.has(key)) continue;
    seen.add(key);
    const role = (a.role === "admin" || a.role === "staff" || a.role === "superadmin" ? a.role : "staff") as
      | "superadmin"
      | "admin"
      | "staff";
    members.push({ user_id: a.user_id, email: a.email, role });
  }

  return members;
}


import { createServiceRoleClient } from "@/lib/supabase/server";
import { mockCategories } from "@/lib/mock-data";

export type AdminCategory = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
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
  category_slug: string | null;
  category_name: string | null;
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

export type AdminProductRow = {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  badges: string[];
  occasions: ("birthday" | "vacation" | "wedding" | "corporate")[];
  category_name: string;
  created_at: string;
  variants: {
    id: string;
    sku: string;
    stock: number;
    price_ghs: number;
    size: string | null;
    color: string | null;
  }[];
};

/** Full row for admin product edit screen (nested images + variants). */
export type AdminProductDetail = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category_id: string | null;
  is_active: boolean;
  badges: string[];
  occasions: ("birthday" | "vacation" | "wedding" | "corporate")[];
  seo_title: string | null;
  seo_description: string | null;
  video_urls: string[];
  image_paths: string[];
  variants: {
    id: string;
    sku: string;
    stock: number;
    price_ghs: number;
    compare_at_ghs: number | null;
    size: string | null;
    color: string | null;
  }[];
};

export async function getAdminProductById(productId: string): Promise<AdminProductDetail | null> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("products")
    .select(
      `
      id, name, slug, description, category_id, is_active, badges, occasions, seo_title, seo_description, video_urls,
      variants ( id, sku, stock, price_ghs, compare_at_ghs, size, color ),
      product_images ( storage_path, sort_order )
    `
    )
    .eq("id", productId)
    .maybeSingle();

  if (error || !data) return null;

  const rawImages = (data.product_images ?? []) as { storage_path: string | null; sort_order: number | null }[];
  const images = [...rawImages]
    .filter((img) => typeof img.storage_path === "string" && img.storage_path.length > 0)
    .sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0));

  const rawVariants = (data.variants ?? []) as {
    id: string;
    sku: string | null;
    stock: number | null;
    price_ghs: number | null;
    compare_at_ghs: number | null;
    size: string | null;
    color: string | null;
  }[];

  const variants = rawVariants.map((row) => ({
    id: row.id,
    sku: row.sku ?? "",
    stock: Number(row.stock ?? 0),
    price_ghs: Number(row.price_ghs ?? 0),
    compare_at_ghs: row.compare_at_ghs != null ? Number(row.compare_at_ghs) : null,
    size: row.size ?? null,
    color: row.color ?? null,
  }));
  variants.sort((a, b) => (a.sku || "").localeCompare(b.sku || ""));

  return {
    id: data.id,
    name: data.name ?? "",
    slug: data.slug ?? "",
    description: typeof data.description === "string" ? data.description : null,
    category_id: typeof data.category_id === "string" ? data.category_id : null,
    is_active: Boolean(data.is_active),
    badges: Array.isArray(data.badges) ? data.badges.filter((b): b is string => typeof b === "string") : [],
    occasions: Array.isArray(data.occasions)
      ? data.occasions.filter(
          (o): o is AdminProductDetail["occasions"][number] =>
            o === "birthday" || o === "vacation" || o === "wedding" || o === "corporate"
        )
      : [],
    seo_title: typeof data.seo_title === "string" ? data.seo_title : null,
    seo_description: typeof data.seo_description === "string" ? data.seo_description : null,
    video_urls: Array.isArray(data.video_urls) ? data.video_urls.filter((v): v is string => typeof v === "string") : [],
    image_paths: images.map((img) => img.storage_path ?? ""),
    variants,
  };
}

export type AdminOrderRow = {
  id: string;
  order_number: string;
  email: string;
  status: "pending" | "paid" | "processing" | "shipped" | "delivered" | "cancelled" | "refunded";
  total_ghs: number;
  notify_customer: boolean;
  created_at: string;
  tracking_number: string | null;
  carrier: string | null;
  shipment_status: string | null;
};

export type AdminOrdersKpi = {
  pending: number;
  paid: number;
  processing: number;
  shipped: number;
  delivered: number;
  cancelled: number;
  refunded: number;
  revenuePaid: number;
};

export type AdminCustomerRow = {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  tags: string[];
  total_spend_ghs: number;
  orders_count: number;
  last_order_at: string | null;
  created_at: string;
};

export type AdminCustomersKpi = {
  total: number;
  new30d: number;
  repeat: number;
  highValue: number;
  avgLifetimeValue: number;
};

const DEFAULT_COLLECTIONS = [
  { title: "New Arrivals", slug: "new-arrivals", is_smart: true },
  { title: "Best Sellers", slug: "best-sellers", is_smart: true },
  { title: "Shop The Look", slug: "shop-the-look", is_smart: false },
  { title: "Occasion Edit", slug: "occasion-edit", is_smart: false },
] as const;

async function seedCategoriesIfEmpty() {
  const supabase = createServiceRoleClient();
  const { count } = await supabase.from("categories").select("id", { count: "exact", head: true });
  if ((count ?? 0) > 0) return;

  await supabase.from("categories").insert(
    mockCategories.map((c, idx) => ({
      slug: c.slug,
      name: c.name,
      description: null,
      sort_order: idx,
    }))
  );
}

async function seedCollectionsIfEmpty() {
  const supabase = createServiceRoleClient();
  const { count } = await supabase.from("collections").select("id", { count: "exact", head: true });
  if ((count ?? 0) > 0) return;

  await supabase
    .from("collections")
    .insert(DEFAULT_COLLECTIONS.map((c) => ({ title: c.title, slug: c.slug, is_smart: c.is_smart })));
}

export async function listAdminCategories(): Promise<AdminCategory[]> {
  await seedCategoriesIfEmpty();
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from("categories")
    .select("id, name, slug, description, image_url, sort_order")
    .order("sort_order", { ascending: true });
  return (data ?? []) as AdminCategory[];
}

export async function listAdminCollections(): Promise<AdminCollection[]> {
  await seedCollectionsIfEmpty();
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from("collections")
    .select("id, title, slug, is_smart, created_at")
    .order("created_at", { ascending: false });
  return (data ?? []) as AdminCollection[];
}

export type AdminDiscountRow = {
  id: string;
  code: string;
  kind: "percent" | "fixed" | "free_shipping";
  value: number | null;
  min_spend_ghs: number | null;
  usage_limit: number | null;
  used_count: number;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
  created_at: string;
};

export async function listAdminDiscounts(): Promise<AdminDiscountRow[]> {
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from("discounts")
    .select(
      "id, code, kind, value, min_spend_ghs, usage_limit, used_count, starts_at, ends_at, is_active, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(200);

  return (data ?? []).map((row) => ({
    id: row.id as string,
    code: typeof row.code === "string" ? row.code : "",
    kind:
      row.kind === "percent" || row.kind === "fixed" || row.kind === "free_shipping"
        ? row.kind
        : "percent",
    value: row.value != null ? Number(row.value) : null,
    min_spend_ghs: row.min_spend_ghs != null ? Number(row.min_spend_ghs) : null,
    usage_limit: row.usage_limit != null ? Number(row.usage_limit) : null,
    used_count: Number(row.used_count ?? 0),
    starts_at: row.starts_at == null ? null : String(row.starts_at),
    ends_at: row.ends_at == null ? null : String(row.ends_at),
    is_active: Boolean(row.is_active),
    created_at: typeof row.created_at === "string" ? row.created_at : new Date(0).toISOString(),
  }));
}

export async function listAdminInventory(): Promise<AdminInventoryRow[]> {
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from("variants")
    .select(
      "id, sku, stock, price_ghs, products!inner(name, slug, categories ( slug, name ))"
    )
    .order("stock", { ascending: true })
    .limit(200);

  return (data ?? []).map((row) => {
    const product = Array.isArray(row.products) ? row.products[0] : row.products;
    const cat = product?.categories
      ? Array.isArray(product.categories)
        ? product.categories[0]
        : product.categories
      : null;
    return {
      variant_id: row.id,
      sku: row.sku,
      stock: row.stock,
      price_ghs: Number(row.price_ghs),
      product_name: product?.name ?? "Unknown product",
      product_slug: product?.slug ?? "",
      category_slug: typeof cat?.slug === "string" ? cat.slug : null,
      category_name: typeof cat?.name === "string" ? cat.name : null,
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

export async function getHomeContentSectionsAdmin(): Promise<Record<string, unknown>> {
  const supabase = createServiceRoleClient();
  const { data } = await supabase.from("home_content").select("sections").eq("id", 1).maybeSingle();
  const s = data?.sections;
  if (s && typeof s === "object" && !Array.isArray(s)) {
    return s as Record<string, unknown>;
  }
  return {};
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

export async function listAdminProducts(): Promise<AdminProductRow[]> {
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from("products")
    .select(
      `
      id, name, slug, is_active, badges, occasions, created_at,
      categories ( name ),
      variants ( id, sku, stock, price_ghs, size, color )
    `
    )
    .order("created_at", { ascending: false })
    .limit(400);

  return (data ?? []).map((row) => {
    const category = Array.isArray(row.categories) ? row.categories[0] : row.categories;
    const variants = (row.variants ?? []).map((variant) => ({
      id: variant.id,
      sku: variant.sku ?? "",
      stock: Number(variant.stock ?? 0),
      price_ghs: Number(variant.price_ghs ?? 0),
      size: variant.size ?? null,
      color: variant.color ?? null,
    }));

    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      is_active: Boolean(row.is_active),
      badges: Array.isArray(row.badges) ? row.badges.filter((b) => typeof b === "string") : [],
      occasions: Array.isArray(row.occasions)
        ? row.occasions.filter(
            (o): o is "birthday" | "vacation" | "wedding" | "corporate" =>
              o === "birthday" || o === "vacation" || o === "wedding" || o === "corporate"
          )
        : [],
      category_name: category?.name ?? "Uncategorized",
      created_at: row.created_at ?? new Date(0).toISOString(),
      variants,
    };
  });
}

export async function listAdminOrders(): Promise<AdminOrderRow[]> {
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from("orders")
    .select(
      `
      id, order_number, email, status, total_ghs, notify_customer, created_at,
      shipments ( tracking_number, carrier, status, created_at )
    `
    )
    .order("created_at", { ascending: false })
    .limit(300);

  return (data ?? []).map((row) => {
    const shipment = Array.isArray(row.shipments) ? row.shipments[0] : row.shipments;
    return {
      id: row.id,
      order_number: row.order_number,
      email: row.email,
      status: row.status as AdminOrderRow["status"],
      total_ghs: Number(row.total_ghs ?? 0),
      notify_customer: Boolean(row.notify_customer),
      created_at: row.created_at,
      tracking_number: shipment?.tracking_number ?? null,
      carrier: shipment?.carrier ?? null,
      shipment_status: shipment?.status ?? null,
    };
  });
}

export async function getAdminOrdersKpi(): Promise<AdminOrdersKpi> {
  const supabase = createServiceRoleClient();
  const { data } = await supabase.from("orders").select("status, total_ghs");

  const kpi: AdminOrdersKpi = {
    pending: 0,
    paid: 0,
    processing: 0,
    shipped: 0,
    delivered: 0,
    cancelled: 0,
    refunded: 0,
    revenuePaid: 0,
  };

  for (const row of data ?? []) {
    const status = row.status as keyof Omit<AdminOrdersKpi, "revenuePaid">;
    (kpi[status] as number) += 1;
    if (row.status === "paid" || row.status === "processing" || row.status === "shipped" || row.status === "delivered") {
      kpi.revenuePaid += Number(row.total_ghs ?? 0);
    }
  }

  return kpi;
}

export async function listAdminCustomers(): Promise<AdminCustomerRow[]> {
  const supabase = createServiceRoleClient();
  const [{ data: customers }, { data: orders }] = await Promise.all([
    supabase
      .from("customers")
      .select("id, email, full_name, phone, tags, total_spend_ghs, created_at")
      .order("created_at", { ascending: false })
      .limit(1000),
    supabase
      .from("orders")
      .select("id, customer_id, email, total_ghs, created_at")
      .order("created_at", { ascending: false })
      .limit(4000),
  ]);

  const byCustomerId = new Map<string, { count: number; spend: number; lastOrderAt: string | null }>();
  const byEmail = new Map<string, { count: number; spend: number; lastOrderAt: string | null }>();

  for (const order of orders ?? []) {
    const spend = Number(order.total_ghs ?? 0);
    const stamp = order.created_at ?? null;
    if (order.customer_id) {
      const agg = byCustomerId.get(order.customer_id) ?? { count: 0, spend: 0, lastOrderAt: null };
      agg.count += 1;
      agg.spend += spend;
      if (!agg.lastOrderAt || (stamp && stamp > agg.lastOrderAt)) agg.lastOrderAt = stamp;
      byCustomerId.set(order.customer_id, agg);
    }
    const email = (order.email ?? "").toLowerCase();
    if (email) {
      const agg = byEmail.get(email) ?? { count: 0, spend: 0, lastOrderAt: null };
      agg.count += 1;
      agg.spend += spend;
      if (!agg.lastOrderAt || (stamp && stamp > agg.lastOrderAt)) agg.lastOrderAt = stamp;
      byEmail.set(email, agg);
    }
  }

  return (customers ?? []).map((c) => {
    const email = (c.email ?? "").toLowerCase();
    const direct = byCustomerId.get(c.id);
    const fallback = email ? byEmail.get(email) : undefined;
    const ordersCount = direct?.count ?? fallback?.count ?? 0;
    const spend = direct?.spend ?? fallback?.spend ?? Number(c.total_spend_ghs ?? 0);
    const lastOrderAt = direct?.lastOrderAt ?? fallback?.lastOrderAt ?? null;
    return {
      id: c.id,
      email: c.email ?? "",
      full_name: c.full_name ?? null,
      phone: c.phone ?? null,
      tags: Array.isArray(c.tags) ? c.tags.filter((t) => typeof t === "string") : [],
      total_spend_ghs: spend,
      orders_count: ordersCount,
      last_order_at: lastOrderAt,
      created_at: c.created_at ?? new Date(0).toISOString(),
    };
  });
}

export async function getAdminCustomersKpi(): Promise<AdminCustomersKpi> {
  const customers = await listAdminCustomers();
  const since = Date.now() - 30 * 24 * 60 * 60 * 1000;

  let totalSpend = 0;
  let repeat = 0;
  let highValue = 0;
  let new30d = 0;

  for (const c of customers) {
    totalSpend += c.total_spend_ghs;
    if (c.orders_count >= 2) repeat += 1;
    if (c.total_spend_ghs >= 1000) highValue += 1;
    if (new Date(c.created_at).getTime() >= since) new30d += 1;
  }

  return {
    total: customers.length,
    new30d,
    repeat,
    highValue,
    avgLifetimeValue: customers.length ? totalSpend / customers.length : 0,
  };
}


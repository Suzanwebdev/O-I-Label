import { createServiceRoleClient } from "@/lib/supabase/server";
import type { StoreControlAnalytics } from "@/lib/store-control/types";

export async function getStoreControlAnalytics(): Promise<StoreControlAnalytics> {
  const service = createServiceRoleClient();
  const since = new Date();
  since.setDate(since.getDate() - 30);
  const sinceIso = since.toISOString();

  const [
    { count: waitlistTotal },
    { count: waitlistLast30d },
    { data: waitlistRecent },
    { count: ordersLast30d },
    { data: paidOrders },
  ] = await Promise.all([
    service.from("store_waitlist").select("id", { count: "exact", head: true }),
    service.from("store_waitlist").select("id", { count: "exact", head: true }).gte("created_at", sinceIso),
    service.from("store_waitlist").select("source").gte("created_at", sinceIso),
    service.from("orders").select("id", { count: "exact", head: true }).gte("created_at", sinceIso),
    service
      .from("orders")
      .select("total_ghs, paid_at")
      .gte("created_at", sinceIso)
      .not("paid_at", "is", null),
  ]);

  const revenueLast30d = (paidOrders ?? []).reduce((sum, o) => sum + Number(o.total_ghs ?? 0), 0);
  const paidOrdersLast30d = paidOrders?.length ?? 0;
  const waitlist30 = waitlistLast30d ?? 0;

  const sourceCounts = new Map<string, number>();
  let presaleSignupsLast30d = 0;
  let launchSignupsLast30d = 0;
  for (const row of waitlistRecent ?? []) {
    const source = String(row.source ?? "unknown");
    sourceCounts.set(source, (sourceCounts.get(source) ?? 0) + 1);
    if (/presale/i.test(source)) presaleSignupsLast30d += 1;
    if (/launch|pre-launch|pre_launch/i.test(source)) launchSignupsLast30d += 1;
  }

  const topTrafficSources = [...sourceCounts.entries()]
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const conversionRateLast30d =
    waitlist30 > 0 ? Math.round((paidOrdersLast30d / waitlist30) * 1000) / 10 : 0;

  return {
    waitlistTotal: waitlistTotal ?? 0,
    waitlistLast30d: waitlist30,
    presaleSignupsLast30d,
    launchSignupsLast30d,
    ordersLast30d: ordersLast30d ?? 0,
    revenueLast30d: Math.round(revenueLast30d * 100) / 100,
    paidOrdersLast30d,
    conversionRateLast30d,
    topTrafficSources,
  };
}

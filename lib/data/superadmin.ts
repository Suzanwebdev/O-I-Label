import { createServiceRoleClient } from "@/lib/supabase/server";
import {
  parseSuperadminPaymentsPeriod,
  resolvePaymentsPeriodRange,
  type SuperadminPaymentsPeriod,
} from "@/lib/superadmin/payments-period";

export type { SuperadminPaymentsPeriod };

export type SuperadminUsersSnapshot = {
  roleCounts: Array<{ role: "superadmin" | "admin" | "staff"; users: number; description: string }>;
  teamMembers: Array<{ user_id: string; email: string; role: "superadmin" | "admin" | "staff"; created_at: string }>;
  recentMembers: Array<{ email: string; role: "superadmin" | "admin" | "staff"; created_at: string }>;
};

export type SuperadminPaymentRow = {
  id: string;
  created_at: string;
  order_number: string | null;
  order_id: string;
  provider: string;
  reference: string | null;
  amount_ghs: number;
  status: string;
};

export type SuperadminPaymentsSnapshot = {
  period: SuperadminPaymentsPeriod;
  periodLabel: string;
  successful: number;
  failed: number;
  pending: number;
  gross: number;
  avgPaidAmount: number;
  transactions: SuperadminPaymentRow[];
  providers: Array<{ name: string; status: "Enabled" | "Disabled"; note: string }>;
};

export type SuperadminSystemSnapshot = {
  pendingOrders: number;
  processingOrders: number;
  webhookErrors24h: number;
  appErrors24h: number;
};

export type SuperadminExportsSnapshot = {
  orders30d: number;
  payments30d: number;
  usersTotal: number;
  failedWebhooks7d: number;
};

export type SuperadminSecuritySnapshot = {
  superadmins: number;
  admins: number;
  staff: number;
  auditEvents7d: number;
  badSignatures7d: number;
  recentAuditActions: Array<{ action: string; created_at: string }>;
};

export async function getSuperadminUsersSnapshot(): Promise<SuperadminUsersSnapshot> {
  const supabase = createServiceRoleClient();
  const [{ data: admins }, { data: supers }] = await Promise.all([
    supabase.from("admins").select("user_id, email, role, created_at").order("created_at", { ascending: false }),
    supabase.from("superadmins").select("user_id, email, created_at").order("created_at", { ascending: false }),
  ]);

  const roleCounts = {
    superadmin: 0,
    admin: 0,
    staff: 0,
  };

  const recentMembers: SuperadminUsersSnapshot["recentMembers"] = [];
  const byUserId = new Map<string, SuperadminUsersSnapshot["teamMembers"][number]>();

  for (const row of supers ?? []) {
    roleCounts.superadmin += 1;
    byUserId.set(row.user_id, {
      user_id: row.user_id,
      email: row.email ?? "unknown@user",
      role: "superadmin",
      created_at: row.created_at,
    });
    recentMembers.push({
      email: row.email ?? "unknown@user",
      role: "superadmin",
      created_at: row.created_at,
    });
  }

  for (const row of admins ?? []) {
    const role: "superadmin" | "admin" | "staff" =
      row.role === "superadmin" || row.role === "admin" || row.role === "staff" ? row.role : "staff";
    if (!byUserId.has(row.user_id)) {
      roleCounts[role] += 1;
      byUserId.set(row.user_id, {
        user_id: row.user_id,
        email: row.email,
        role,
        created_at: row.created_at,
      });
    }
    recentMembers.push({
      email: row.email,
      role,
      created_at: row.created_at,
    });
  }

  recentMembers.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  const teamMembers = Array.from(byUserId.values()).sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

  return {
    roleCounts: [
      {
        role: "superadmin",
        users: roleCounts.superadmin,
        description: "Full access to platform settings, security, and role management.",
      },
      {
        role: "admin",
        users: roleCounts.admin,
        description: "Operational access to orders, catalog, and fulfillment tools.",
      },
      {
        role: "staff",
        users: roleCounts.staff,
        description: "Day-to-day operations with restricted configuration access.",
      },
    ],
    teamMembers,
    recentMembers: recentMembers.slice(0, 8),
  };
}

export async function getSuperadminPaymentsSnapshot(
  periodInput?: string
): Promise<SuperadminPaymentsSnapshot> {
  const supabase = createServiceRoleClient();
  const period = parseSuperadminPaymentsPeriod(periodInput);
  const range = resolvePaymentsPeriodRange(period);

  let paymentsQuery = supabase
    .from("payments")
    .select(
      "id, order_id, status, provider, reference, amount_ghs, created_at, orders ( order_number )"
    )
    .order("created_at", { ascending: false })
    .limit(500);

  if (range.since) {
    paymentsQuery = paymentsQuery.gte("created_at", range.since);
  }
  if (range.until) {
    paymentsQuery = paymentsQuery.lte("created_at", range.until);
  }

  const [{ data: payments }, { data: settings }] = await Promise.all([
    paymentsQuery,
    supabase
      .from("site_settings")
      .select("payment_moolre_enabled, payment_paystack_enabled, payment_flutterwave_enabled")
      .eq("id", 1)
      .maybeSingle(),
  ]);

  let successful = 0;
  let failed = 0;
  let pending = 0;
  let gross = 0;
  const paidAmounts: number[] = [];
  const transactions: SuperadminPaymentRow[] = [];

  for (const payment of payments ?? []) {
    const amount = Number(payment.amount_ghs ?? 0);
    const status = String(payment.status ?? "pending");
    const orders = payment.orders as { order_number?: string } | { order_number?: string }[] | null;
    const orderNumber = Array.isArray(orders)
      ? orders[0]?.order_number ?? null
      : orders?.order_number ?? null;

    transactions.push({
      id: payment.id,
      created_at: payment.created_at,
      order_id: payment.order_id,
      order_number: orderNumber,
      provider: payment.provider,
      reference: payment.reference,
      amount_ghs: amount,
      status,
    });

    if (status === "paid") {
      successful += 1;
      gross += amount;
      paidAmounts.push(amount);
    } else if (status === "failed" || status === "refunded") {
      failed += 1;
    } else if (status === "pending" || status === "processing") {
      pending += 1;
    }
  }

  return {
    period,
    periodLabel: range.label,
    successful,
    failed,
    pending,
    gross,
    avgPaidAmount: paidAmounts.length ? gross / paidAmounts.length : 0,
    transactions,
    providers: [
      {
        name: "Moolre",
        status: settings?.payment_moolre_enabled ? "Enabled" : "Disabled",
        note: "Primary Ghana rails and mobile money.",
      },
      {
        name: "Paystack",
        status: settings?.payment_paystack_enabled ? "Enabled" : "Disabled",
        note: "Cards and multi-country processing.",
      },
      {
        name: "Flutterwave",
        status: settings?.payment_flutterwave_enabled ? "Enabled" : "Disabled",
        note: "Regional fallback and checkout redundancy.",
      },
    ],
  };
}

export async function getSuperadminSystemSnapshot(): Promise<SuperadminSystemSnapshot> {
  const supabase = createServiceRoleClient();
  const since = new Date();
  since.setDate(since.getDate() - 1);
  const iso = since.toISOString();

  const [{ count: pendingOrders }, { count: processingOrders }, { count: webhookErrors24h }, { count: appErrors24h }] =
    await Promise.all([
      supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "processing"),
      supabase
        .from("webhook_logs")
        .select("id", { count: "exact", head: true })
        .gte("created_at", iso)
        .not("error", "is", null),
      supabase.from("error_logs").select("id", { count: "exact", head: true }).gte("created_at", iso),
    ]);

  return {
    pendingOrders: pendingOrders ?? 0,
    processingOrders: processingOrders ?? 0,
    webhookErrors24h: webhookErrors24h ?? 0,
    appErrors24h: appErrors24h ?? 0,
  };
}

export async function getSuperadminExportsSnapshot(): Promise<SuperadminExportsSnapshot> {
  const supabase = createServiceRoleClient();
  const since = new Date();
  since.setDate(since.getDate() - 30);
  const iso = since.toISOString();
  const week = new Date();
  week.setDate(week.getDate() - 7);

  const [{ count: orders30d }, { count: payments30d }, { count: usersTotal }, { count: failedWebhooks7d }] =
    await Promise.all([
      supabase.from("orders").select("id", { count: "exact", head: true }).gte("created_at", iso),
      supabase.from("payments").select("id", { count: "exact", head: true }).gte("created_at", iso),
      supabase.from("customers").select("id", { count: "exact", head: true }),
      supabase
        .from("webhook_logs")
        .select("id", { count: "exact", head: true })
        .gte("created_at", week.toISOString())
        .not("error", "is", null),
    ]);

  return {
    orders30d: orders30d ?? 0,
    payments30d: payments30d ?? 0,
    usersTotal: usersTotal ?? 0,
    failedWebhooks7d: failedWebhooks7d ?? 0,
  };
}

export async function getSuperadminSecuritySnapshot(): Promise<SuperadminSecuritySnapshot> {
  const supabase = createServiceRoleClient();
  const since = new Date();
  since.setDate(since.getDate() - 7);
  const iso = since.toISOString();

  const [
    { count: superadmins },
    { data: admins },
    { count: auditEvents7d },
    { count: badSignatures7d },
    { data: recentAuditActions },
  ] = await Promise.all([
    supabase.from("superadmins").select("user_id", { count: "exact", head: true }),
    supabase.from("admins").select("role"),
    supabase.from("audit_logs").select("id", { count: "exact", head: true }).gte("created_at", iso),
    supabase
      .from("webhook_logs")
      .select("id", { count: "exact", head: true })
      .gte("created_at", iso)
      .eq("signature_ok", false),
    supabase.from("audit_logs").select("action, created_at").order("created_at", { ascending: false }).limit(6),
  ]);

  let adminsCount = 0;
  let staffCount = 0;
  for (const row of admins ?? []) {
    if (row.role === "admin") adminsCount += 1;
    if (row.role === "staff") staffCount += 1;
  }

  return {
    superadmins: superadmins ?? 0,
    admins: adminsCount,
    staff: staffCount,
    auditEvents7d: auditEvents7d ?? 0,
    badSignatures7d: badSignatures7d ?? 0,
    recentAuditActions: (recentAuditActions ?? []).map((row) => ({
      action: row.action,
      created_at: row.created_at,
    })),
  };
}

import { createServiceRoleClient } from "@/lib/supabase/server";

export type SuperadminUsersSnapshot = {
  roleCounts: Array<{ role: "superadmin" | "admin" | "staff"; users: number; description: string }>;
  teamMembers: Array<{ user_id: string; email: string; role: "superadmin" | "admin" | "staff"; created_at: string }>;
  recentMembers: Array<{ email: string; role: "superadmin" | "admin" | "staff"; created_at: string }>;
};

export type SuperadminPaymentsSnapshot = {
  successful7d: number;
  failed7d: number;
  gross7d: number;
  avgPaidAmount7d: number;
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

export async function getSuperadminPaymentsSnapshot(): Promise<SuperadminPaymentsSnapshot> {
  const supabase = createServiceRoleClient();
  const since = new Date();
  since.setDate(since.getDate() - 7);

  const [{ data: payments }, { data: settings }] = await Promise.all([
    supabase
      .from("payments")
      .select("status, provider, amount_ghs")
      .gte("created_at", since.toISOString()),
    supabase
      .from("site_settings")
      .select("payment_moolre_enabled, payment_paystack_enabled, payment_flutterwave_enabled")
      .eq("id", 1)
      .maybeSingle(),
  ]);

  let successful7d = 0;
  let failed7d = 0;
  let gross7d = 0;
  const paidAmounts: number[] = [];

  for (const payment of payments ?? []) {
    const amount = Number(payment.amount_ghs ?? 0);
    if (payment.status === "paid") {
      successful7d += 1;
      gross7d += amount;
      paidAmounts.push(amount);
    } else if (payment.status === "failed" || payment.status === "cancelled") {
      failed7d += 1;
    }
  }

  return {
    successful7d,
    failed7d,
    gross7d,
    avgPaidAmount7d: paidAmounts.length ? gross7d / paidAmounts.length : 0,
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

import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase/server";

export type RequestAuthz = {
  user: { id: string; email?: string | null } | null;
  isAdmin: boolean;
  isSuperadmin: boolean;
  adminRole: "superadmin" | "admin" | "staff" | null;
};

/**
 * Resolve current authenticated user + admin/superadmin flags for server routes/components.
 * Uses anon client for session, service role for privileged role-table lookup.
 */
export async function getRequestAuthz(): Promise<RequestAuthz> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      user: null,
      isAdmin: false,
      isSuperadmin: false,
      adminRole: null,
    };
  }

  const service = createServiceRoleClient();
  const [{ data: superRow }, { data: adminRow }] = await Promise.all([
    service
      .from("superadmins")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle(),
    service
      .from("admins")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  const adminRole = (adminRow?.role ?? null) as RequestAuthz["adminRole"];
  const isSuperadmin = Boolean(superRow) || adminRole === "superadmin";
  const isAdmin = isSuperadmin || Boolean(adminRow);

  return {
    user: { id: user.id, email: user.email },
    isAdmin,
    isSuperadmin,
    adminRole,
  };
}


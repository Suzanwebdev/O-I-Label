import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { getRequestAuthz } from "@/lib/authz";

/**
 * CSV export — protect with superadmin check in production (session + admins table).
 * Query: ?type=orders|customers|products
 */
export async function GET(req: Request) {
  const authz = await getRequestAuthz();
  if (!authz.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!authz.isSuperadmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const type = url.searchParams.get("type") ?? "orders";
  const supabase = createServiceRoleClient();

  if (type === "orders") {
    const { data, error } = await supabase
      .from("orders")
      .select("order_number,email,status,total_ghs,created_at")
      .limit(5000);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const rows = data ?? [];
    const csv = toCsv(
      ["order_number", "email", "status", "total_ghs", "created_at"],
      rows
    );
    return csvResponse("orders.csv", csv);
  }

  if (type === "customers") {
    const { data, error } = await supabase
      .from("customers")
      .select("email,full_name,phone,total_spend_ghs,created_at")
      .limit(5000);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const csv = toCsv(
      ["email", "full_name", "phone", "total_spend_ghs", "created_at"],
      data ?? []
    );
    return csvResponse("customers.csv", csv);
  }

  if (type === "products") {
    const { data, error } = await supabase
      .from("products")
      .select("slug,name,is_active,created_at")
      .limit(5000);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const csv = toCsv(["slug", "name", "is_active", "created_at"], data ?? []);
    return csvResponse("products.csv", csv);
  }

  return NextResponse.json({ error: "Invalid type" }, { status: 400 });
}

function toCsv(headers: string[], rows: Record<string, unknown>[]) {
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const head = headers.join(",");
  const body = rows.map((r) => headers.map((h) => esc(r[h])).join(",")).join("\n");
  return `${head}\n${body}`;
}

function csvResponse(filename: string, csv: string) {
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

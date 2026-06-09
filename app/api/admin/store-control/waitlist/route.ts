import { NextResponse } from "next/server";
import { getRequestAuthz } from "@/lib/authz";
import { listWaitlistSubscribers } from "@/lib/store-control/waitlist";

export async function GET(request: Request) {
  const authz = await getRequestAuthz();
  if (!authz.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? undefined;
  const page = Number(searchParams.get("page") ?? "1");
  const pageSize = Number(searchParams.get("pageSize") ?? "25");
  const exportCsv = searchParams.get("export") === "csv";

  const { rows, total } = await listWaitlistSubscribers({
    q,
    page: exportCsv ? 1 : page,
    pageSize: exportCsv ? 10000 : pageSize,
  });

  if (exportCsv) {
    const header = "Name,Email,Phone,Country,Source,Date Joined\n";
    const lines = rows.map((r) => {
      const cols = [
        r.first_name,
        r.email_raw,
        r.phone_e164 ?? "",
        r.country_iso,
        r.source,
        r.created_at,
      ].map((c) => `"${String(c).replace(/"/g, '""')}"`);
      return cols.join(",");
    });
    return new NextResponse(header + lines.join("\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="waitlist-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  }

  return NextResponse.json({ rows, total, page, pageSize });
}

import { NextResponse } from "next/server";
import { getRequestAuthz } from "@/lib/authz";
import {
  formatNewsletterPhone,
  listNewsletterSubscribers,
} from "@/lib/newsletter/subscribers";

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

  const { rows, total } = await listNewsletterSubscribers({
    q,
    page: exportCsv ? 1 : page,
    pageSize: exportCsv ? 10000 : pageSize,
  });

  if (exportCsv) {
    const header =
      "Email,Phone,Country,Source,Email opt-in,SMS opt-in,Welcome email sent,Date joined\n";
    const lines = rows.map((r) => {
      const cols = [
        r.email_raw,
        formatNewsletterPhone(r.phone_e164),
        r.country_iso,
        r.source,
        r.email_promo_opt_in ? "yes" : "no",
        r.sms_promo_opt_in ? "yes" : "no",
        r.welcome_email_sent_at ?? "",
        r.created_at,
      ].map((c) => `"${String(c).replace(/"/g, '""')}"`);
      return cols.join(",");
    });
    return new NextResponse(header + lines.join("\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="newsletter-subscribers-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  }

  return NextResponse.json({ rows, total, page, pageSize });
}

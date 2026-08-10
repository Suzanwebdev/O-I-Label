import { NextResponse } from "next/server";
import { getRequestAuthz } from "@/lib/authz";
import { reconcilePendingPayments } from "@/lib/payments/reconcile-payment";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Admin: sync all recent unpaid Moolre payments by unique payment reference. */
export async function POST(request: Request) {
  const authz = await getRequestAuthz();
  if (!authz.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let limit = 40;
  try {
    const body = (await request.json()) as { limit?: number };
    if (typeof body.limit === "number" && Number.isFinite(body.limit)) {
      limit = body.limit;
    }
  } catch {
    // empty body is fine
  }

  const summary = await reconcilePendingPayments({ limit, maxAgeHours: 72 });
  return NextResponse.json({
    ok: true,
    checked: summary.checked,
    markedPaid: summary.markedPaid,
    stillPending: summary.stillPending,
    failed: summary.failed,
    results: summary.results,
  });
}

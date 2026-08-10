import { NextResponse } from "next/server";
import { reconcilePendingPayments } from "@/lib/payments/reconcile-payment";

export const runtime = "nodejs";
export const maxDuration = 60;

function cronAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    // Allow in non-production so local/dev can hit the route; require secret in prod.
    return process.env.VERCEL_ENV !== "production" && process.env.NODE_ENV !== "production";
  }
  const auth = request.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
  const header = request.headers.get("x-cron-secret");
  return header === secret;
}

/** Vercel Cron: poll Moolre for pending payments and mark matching orders paid by reference. */
export async function GET(request: Request) {
  if (!cronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const summary = await reconcilePendingPayments({ limit: 40, maxAgeHours: 72 });
  return NextResponse.json({ ok: true, ...summary });
}

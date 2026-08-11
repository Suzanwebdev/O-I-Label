import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getEligibleItemsForCustomer } from "@/lib/reviews/eligibility";

export async function GET(request: Request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const productId = url.searchParams.get("productId")?.trim() || undefined;

  const items = await getEligibleItemsForCustomer(user.id, { productId });
  return NextResponse.json({ ok: true, items });
}

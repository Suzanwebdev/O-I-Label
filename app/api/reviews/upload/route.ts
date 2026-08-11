import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { enforceRateLimit } from "@/lib/http/rate-limit";
import { uploadReviewPhoto, REVIEW_MAX_PHOTOS } from "@/lib/reviews/media";

export async function POST(request: Request) {
  const limited = await enforceRateLimit(request, "reviews:upload", 20);
  if (limited) return limited;

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    return NextResponse.json({ error: "Please sign in to upload photos." }, { status: 401 });
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No image provided." }, { status: 400 });
  }

  const countRaw = form.get("count");
  const count = typeof countRaw === "string" ? Number(countRaw) : 0;
  if (count >= REVIEW_MAX_PHOTOS) {
    return NextResponse.json(
      { error: `You can upload up to ${REVIEW_MAX_PHOTOS} photos.` },
      { status: 400 }
    );
  }

  const result = await uploadReviewPhoto({ customerId: user.id, file });
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true, ...result });
}

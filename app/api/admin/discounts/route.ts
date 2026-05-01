import { NextResponse } from "next/server";
import { getRequestAuthz } from "@/lib/authz";
import { createServiceRoleClient } from "@/lib/supabase/server";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizeCode(raw: string): string {
  return raw.trim().toUpperCase();
}

type DiscountKind = "percent" | "fixed" | "free_shipping";

function parseKind(raw: unknown): DiscountKind | null {
  if (raw === "percent" || raw === "fixed" || raw === "free_shipping") return raw;
  return null;
}

function parseOptionalTs(raw: unknown): string | null {
  if (raw == null || raw === "") return null;
  if (typeof raw !== "string") return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function parseOptionalPositiveInt(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) return null;
  return n;
}

function parseOptionalMoney(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

export async function POST(request: Request) {
  const authz = await getRequestAuthz();
  if (!authz.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const code = typeof (body as { code?: unknown })?.code === "string" ? normalizeCode((body as { code: string }).code) : "";
  const kind = parseKind((body as { kind?: unknown })?.kind);
  const minSpendRaw = parseOptionalMoney((body as { minSpendGhs?: unknown })?.minSpendGhs);
  const usageLimitRaw = parseOptionalPositiveInt((body as { usageLimit?: unknown })?.usageLimit);
  const startsAt = parseOptionalTs((body as { startsAt?: unknown })?.startsAt);
  const endsAt = parseOptionalTs((body as { endsAt?: unknown })?.endsAt);
  const isActive = Boolean((body as { isActive?: unknown })?.isActive);
  const valueRaw =
    (body as { value?: unknown })?.value == null || (body as { value?: unknown })?.value === ""
      ? null
      : Number((body as { value: unknown }).value);

  if (!code || code.length < 2) {
    return NextResponse.json({ error: "Promo code must be at least 2 characters" }, { status: 400 });
  }
  if (!kind) {
    return NextResponse.json({ error: "Kind must be percent, fixed, or free_shipping" }, { status: 400 });
  }

  let value: number | null = null;
  if (kind === "percent") {
    if (valueRaw == null || !Number.isFinite(valueRaw) || valueRaw <= 0 || valueRaw > 100) {
      return NextResponse.json({ error: "Percent discounts need a value between 1 and 100" }, { status: 400 });
    }
    value = Math.round(valueRaw * 100) / 100;
  } else if (kind === "fixed") {
    if (valueRaw == null || !Number.isFinite(valueRaw) || valueRaw <= 0) {
      return NextResponse.json({ error: "Fixed discounts need an amount greater than 0 GH₵" }, { status: 400 });
    }
    value = Math.round(valueRaw * 100) / 100;
  } else {
    value = null;
  }

  if (startsAt && endsAt && new Date(endsAt) <= new Date(startsAt)) {
    return NextResponse.json({ error: "End time must be after start time" }, { status: 400 });
  }

  const service = createServiceRoleClient();
  const { data: existing } = await service.from("discounts").select("id").eq("code", code).maybeSingle();
  if (existing) {
    return NextResponse.json({ error: "A discount with this code already exists" }, { status: 409 });
  }

  const { data: row, error } = await service
    .from("discounts")
    .insert({
      code,
      kind,
      value,
      min_spend_ghs: minSpendRaw,
      usage_limit: usageLimitRaw,
      used_count: 0,
      starts_at: startsAt,
      ends_at: endsAt,
      is_active: isActive,
    })
    .select("id")
    .single();

  if (error || !row) {
    return NextResponse.json({ error: error?.message ?? "Could not create discount" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: row.id }, { status: 201 });
}

export async function PATCH(request: Request) {
  const authz = await getRequestAuthz();
  if (!authz.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const discountId =
    typeof (body as { discountId?: unknown })?.discountId === "string"
      ? (body as { discountId: string }).discountId.trim()
      : "";
  if (!discountId || !UUID_RE.test(discountId)) {
    return NextResponse.json({ error: "Valid discountId is required" }, { status: 400 });
  }

  const codeRaw = (body as { code?: unknown })?.code;
  const code = typeof codeRaw === "string" ? normalizeCode(codeRaw) : undefined;
  const kind = parseKind((body as { kind?: unknown })?.kind);
  const minSpendRaw = (body as { minSpendGhs?: unknown })?.minSpendGhs;
  const usageLimitRaw = (body as { usageLimit?: unknown })?.usageLimit;
  const startsAtRaw = (body as { startsAt?: unknown })?.startsAt;
  const endsAtRaw = (body as { endsAt?: unknown })?.endsAt;
  const isActiveRaw = (body as { isActive?: unknown })?.isActive;
  const valueRaw = (body as { value?: unknown })?.value;

  const service = createServiceRoleClient();
  const { data: existing } = await service
    .from("discounts")
    .select("id, kind, starts_at, ends_at")
    .eq("id", discountId)
    .maybeSingle();
  if (!existing) {
    return NextResponse.json({ error: "Discount not found" }, { status: 404 });
  }

  const update: Record<string, unknown> = {};

  if (code !== undefined) {
    if (!code || code.length < 2) {
      return NextResponse.json({ error: "Promo code must be at least 2 characters" }, { status: 400 });
    }
    const { data: dup } = await service.from("discounts").select("id").eq("code", code).maybeSingle();
    if (dup && dup.id !== discountId) {
      return NextResponse.json({ error: "Another discount already uses this code" }, { status: 409 });
    }
    update.code = code;
  }

  const effectiveKind = kind ?? (existing.kind as DiscountKind);
  if (kind != null) update.kind = kind;

  if (minSpendRaw !== undefined) {
    if (minSpendRaw == null || minSpendRaw === "") update.min_spend_ghs = null;
    else {
      const m = parseOptionalMoney(minSpendRaw);
      if (m == null) return NextResponse.json({ error: "Invalid minimum spend" }, { status: 400 });
      update.min_spend_ghs = m;
    }
  }

  if (usageLimitRaw !== undefined) {
    if (usageLimitRaw == null || usageLimitRaw === "") update.usage_limit = null;
    else {
      const u = parseOptionalPositiveInt(usageLimitRaw);
      if (u == null) return NextResponse.json({ error: "Usage limit must be a positive whole number or empty" }, { status: 400 });
      update.usage_limit = u;
    }
  }

  if (startsAtRaw !== undefined) {
    if (startsAtRaw == null || startsAtRaw === "") update.starts_at = null;
    else {
      const s = parseOptionalTs(startsAtRaw);
      if (!s) return NextResponse.json({ error: "Invalid start time" }, { status: 400 });
      update.starts_at = s;
    }
  }

  if (endsAtRaw !== undefined) {
    if (endsAtRaw == null || endsAtRaw === "") update.ends_at = null;
    else {
      const e = parseOptionalTs(endsAtRaw);
      if (!e) return NextResponse.json({ error: "Invalid end time" }, { status: 400 });
      update.ends_at = e;
    }
  }

  if (isActiveRaw !== undefined) {
    update.is_active = Boolean(isActiveRaw);
  }

  if (valueRaw !== undefined) {
    if (valueRaw == null || valueRaw === "") {
      if (effectiveKind === "free_shipping") update.value = null;
      else return NextResponse.json({ error: "Value is required for this discount type" }, { status: 400 });
    } else {
      const n = Number(valueRaw);
      if (effectiveKind === "percent") {
        if (!Number.isFinite(n) || n <= 0 || n > 100) {
          return NextResponse.json({ error: "Percent value must be between 1 and 100" }, { status: 400 });
        }
        update.value = Math.round(n * 100) / 100;
      } else if (effectiveKind === "fixed") {
        if (!Number.isFinite(n) || n <= 0) {
          return NextResponse.json({ error: "Fixed amount must be greater than 0" }, { status: 400 });
        }
        update.value = Math.round(n * 100) / 100;
      } else {
        update.value = null;
      }
    }
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No changes provided" }, { status: 400 });
  }

  const nextStarts = Object.prototype.hasOwnProperty.call(update, "starts_at")
    ? (update.starts_at as string | null)
    : existing.starts_at;
  const nextEnds = Object.prototype.hasOwnProperty.call(update, "ends_at") ? (update.ends_at as string | null) : existing.ends_at;
  if (nextStarts && nextEnds && new Date(String(nextEnds)) <= new Date(String(nextStarts))) {
    return NextResponse.json({ error: "End time must be after start time" }, { status: 400 });
  }

  const { error } = await service.from("discounts").update(update).eq("id", discountId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const authz = await getRequestAuthz();
  if (!authz.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const discountId = (searchParams.get("discountId") ?? "").trim();
  if (!discountId || !UUID_RE.test(discountId)) {
    return NextResponse.json({ error: "Valid discountId query param is required" }, { status: 400 });
  }

  const service = createServiceRoleClient();
  const { data: removed, error } = await service.from("discounts").delete().eq("id", discountId).select("id");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!removed?.length) {
    return NextResponse.json({ error: "Discount not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

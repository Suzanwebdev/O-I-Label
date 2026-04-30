import { NextResponse } from "next/server";
import { getRequestAuthz } from "@/lib/authz";
import { createServiceRoleClient } from "@/lib/supabase/server";
import {
  OCCASION_CARDS_LIMIT,
  type OccasionSectionCardStored,
  type ShopOccasionKey,
} from "@/lib/home/shop-by-occasion";

function isOccasionKey(v: unknown): v is ShopOccasionKey {
  return v === "birthday" || v === "vacation" || v === "wedding" || v === "corporate";
}

function isValidId(v: string): boolean {
  return /^[a-zA-Z0-9_.-]{1,128}$/.test(v);
}

function isValidHref(v: string): boolean {
  if (v.startsWith("/") && !v.startsWith("//")) return true;
  try {
    const u = new URL(v);
    return u.protocol === "https:";
  } catch {
    return false;
  }
}

function isValidImageUrl(v: string): boolean {
  if (v.startsWith("/") && v.length > 1 && !v.startsWith("//")) return true;
  try {
    const u = new URL(v);
    return u.protocol === "https:";
  } catch {
    return false;
  }
}

function compactCard(c: OccasionSectionCardStored): OccasionSectionCardStored {
  const out: OccasionSectionCardStored = { id: c.id };
  if (c.preset_key) out.preset_key = c.preset_key;
  if (typeof c.title === "string" && c.title.trim()) out.title = c.title.trim();
  if (typeof c.href === "string" && c.href.trim()) out.href = c.href.trim();
  if (typeof c.image_url === "string" && c.image_url.trim()) out.image_url = c.image_url.trim();
  if (typeof c.alt === "string" && c.alt.trim()) out.alt = c.alt.trim();
  if (typeof c.image_class_name === "string" && c.image_class_name.trim()) {
    out.image_class_name = c.image_class_name.trim();
  }
  return out;
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

  const rawCards = (body as { cards?: unknown })?.cards;
  if (!Array.isArray(rawCards)) {
    return NextResponse.json({ error: "cards must be an array" }, { status: 400 });
  }
  if (rawCards.length > OCCASION_CARDS_LIMIT) {
    return NextResponse.json(
      { error: `At most ${OCCASION_CARDS_LIMIT} collection cards allowed` },
      { status: 400 }
    );
  }

  const ids = new Set<string>();
  const presetKeysSeen = new Set<ShopOccasionKey>();
  const cards: OccasionSectionCardStored[] = [];

  for (let i = 0; i < rawCards.length; i++) {
    const rowUnknown = rawCards[i];
    if (!rowUnknown || typeof rowUnknown !== "object" || Array.isArray(rowUnknown)) {
      return NextResponse.json({ error: `Invalid row at index ${i}` }, { status: 400 });
    }
    const r = rowUnknown as Record<string, unknown>;
    const id = typeof r["id"] === "string" ? r["id"].trim() : "";
    if (!id || !isValidId(id)) {
      return NextResponse.json({ error: `Invalid id at index ${i}` }, { status: 400 });
    }
    if (ids.has(id)) {
      return NextResponse.json({ error: `Duplicate id: ${id}` }, { status: 400 });
    }
    ids.add(id);

    const pkRaw = r["preset_key"] ?? r["key"];
    const preset_key = isOccasionKey(pkRaw) ? pkRaw : undefined;
    if (preset_key) {
      if (presetKeysSeen.has(preset_key)) {
        return NextResponse.json(
          { error: `Duplicate preset template "${preset_key}" — use one row per preset or custom cards without preset` },
          { status: 400 }
        );
      }
      presetKeysSeen.add(preset_key);
    }

    const title = typeof r["title"] === "string" ? r["title"].trim() : "";
    const href = typeof r["href"] === "string" ? r["href"].trim() : "";
    const image_url = typeof r["image_url"] === "string" ? r["image_url"].trim() : "";
    const alt = typeof r["alt"] === "string" ? r["alt"].trim() : "";
    const image_class_name = typeof r["image_class_name"] === "string" ? r.image_class_name.trim() : "";

    if (preset_key) {
      if (href && !isValidHref(href)) {
        return NextResponse.json({ error: `Invalid link at index ${i}` }, { status: 400 });
      }
      if (image_url && !isValidImageUrl(image_url)) {
        return NextResponse.json({ error: `Invalid image URL at index ${i}` }, { status: 400 });
      }
      const card: OccasionSectionCardStored = { id, preset_key };
      if (title) card.title = title;
      if (href) card.href = href;
      if (image_url) card.image_url = image_url;
      if (alt) card.alt = alt;
      if (image_class_name) card.image_class_name = image_class_name;
      cards.push(compactCard(card));
    } else {
      if (!title) {
        return NextResponse.json(
          { error: `Custom card at index ${i} requires a title` },
          { status: 400 }
        );
      }
      if (!href || !isValidHref(href)) {
        return NextResponse.json(
          { error: `Custom card at index ${i} requires a valid https: or site-relative link` },
          { status: 400 }
        );
      }
      if (!image_url || !isValidImageUrl(image_url)) {
        return NextResponse.json(
          { error: `Custom card at index ${i} requires a valid image URL` },
          { status: 400 }
        );
      }
      const card: OccasionSectionCardStored = { id, title, href, image_url };
      if (alt) card.alt = alt;
      if (image_class_name) card.image_class_name = image_class_name;
      cards.push(compactCard(card));
    }
  }

  const service = createServiceRoleClient();
  const { data: row, error: fetchErr } = await service.from("home_content").select("sections").eq("id", 1).maybeSingle();
  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }

  const prev =
    row?.sections && typeof row.sections === "object" && !Array.isArray(row.sections)
      ? { ...(row.sections as Record<string, unknown>) }
      : {};

  const nextSections = {
    ...prev,
    shop_by_occasion: { cards },
  };

  const { data: updated, error: updateErr } = await service
    .from("home_content")
    .update({ sections: nextSections, updated_at: new Date().toISOString() })
    .eq("id", 1)
    .select("sections")
    .single();

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, sections: updated.sections });
}

/** Human-readable variant attrs from a joined `variants` row (Supabase object or array). */
export function pickOrderItemVariantAttrs(variants: unknown): {
  color: string | null;
  size: string | null;
} {
  const row = Array.isArray(variants) ? variants[0] : variants;
  if (!row || typeof row !== "object") {
    return { color: null, size: null };
  }
  const color =
    "color" in row && typeof row.color === "string" && row.color.trim()
      ? row.color.trim()
      : null;
  const size =
    "size" in row && typeof row.size === "string" && row.size.trim() ? row.size.trim() : null;
  return { color, size };
}

/** Packing-slip variant line: "Black · S", or color-only / size-only. Never SKU. */
export function formatPackingSlipVariantLine(opts: {
  color?: string | null;
  size?: string | null;
  variant_label?: string | null;
}): string | null {
  const explicit = opts.variant_label?.trim();
  if (explicit) return explicit;
  const color = opts.color?.trim() || null;
  const size = opts.size?.trim() || null;
  if (color && size) return `${color} · ${size}`;
  if (color) return color;
  if (size) return size;
  return null;
}

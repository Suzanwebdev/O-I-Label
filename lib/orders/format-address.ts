export type OrderAddressJson = Record<string, unknown> | null | undefined;

export function formatOrderCustomerName(address: OrderAddressJson): string | null {
  if (!address || typeof address !== "object" || Array.isArray(address)) return null;
  const first = typeof address.first_name === "string" ? address.first_name.trim() : "";
  const last = typeof address.last_name === "string" ? address.last_name.trim() : "";
  const name = [first, last].filter(Boolean).join(" ");
  return name || null;
}

/** Multi-line block for detail view and invoices. */
export function formatOrderShippingAddressLines(
  address: OrderAddressJson,
  phone?: string | null
): string[] {
  const lines: string[] = [];
  const name = formatOrderCustomerName(address);
  if (name) lines.push(name);

  if (address && typeof address === "object" && !Array.isArray(address)) {
    const street = typeof address.address === "string" ? address.address.trim() : "";
    const city = typeof address.city === "string" ? address.city.trim() : "";
    const region = typeof address.region === "string" ? address.region.trim() : "";
    if (street) lines.push(street);
    const locality = [city, region].filter(Boolean).join(", ");
    if (locality) lines.push(locality);
    const addrPhone =
      typeof address.phone === "string" ? address.phone.trim() : "";
    if (addrPhone && addrPhone !== (phone ?? "").trim()) lines.push(addrPhone);
  }

  const orderPhone = phone?.trim();
  if (orderPhone && !lines.includes(orderPhone)) {
    lines.push(orderPhone);
  }

  return lines;
}

export function formatOrderShippingAddressBlock(
  address: OrderAddressJson,
  phone?: string | null
): string {
  return formatOrderShippingAddressLines(address, phone).join("\n");
}

/** One-line summary for the orders table (city, region). */
export function formatOrderLocationSummary(address: OrderAddressJson): string | null {
  if (!address || typeof address !== "object" || Array.isArray(address)) return null;
  const city = typeof address.city === "string" ? address.city.trim() : "";
  const region = typeof address.region === "string" ? address.region.trim() : "";
  const line = [city, region].filter(Boolean).join(", ");
  return line || null;
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

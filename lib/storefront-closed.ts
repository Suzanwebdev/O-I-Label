export const STOREFRONT_CLOSED_PRESETS = ["maintenance", "sale_prep", "closed"] as const;

export type StorefrontClosedPreset = (typeof STOREFRONT_CLOSED_PRESETS)[number];

export type StorefrontClosedCopyBlock = {
  title?: string;
  message?: string;
};

export type StorefrontClosedCopy = Partial<
  Record<StorefrontClosedPreset, StorefrontClosedCopyBlock>
>;

export type StorefrontClosedSettings = {
  maintenance_mode: boolean;
  storefront_closed_preset: StorefrontClosedPreset;
  storefront_closed_copy: StorefrontClosedCopy;
};

export const STOREFRONT_CLOSED_PRESET_LABELS: Record<StorefrontClosedPreset, string> = {
  maintenance: "Maintenance",
  sale_prep: "Sale preparation",
  closed: "Not selling right now",
};

export const DEFAULT_STOREFRONT_CLOSED_COPY: Record<
  StorefrontClosedPreset,
  { title: string; message: string }
> = {
  maintenance: {
    title: "We will be right back",
    message:
      "O & I Label is undergoing a brief update. Please check again shortly.",
  },
  sale_prep: {
    title: "Something special is on the way",
    message:
      "We are preparing our next drop. The storefront is paused while we get everything ready.",
  },
  closed: {
    title: "We are not taking orders right now",
    message:
      "Our shop is temporarily closed. Follow us on Instagram for updates, or check back soon.",
  },
};

export function isStorefrontClosedPreset(value: unknown): value is StorefrontClosedPreset {
  return (
    typeof value === "string" &&
    (STOREFRONT_CLOSED_PRESETS as readonly string[]).includes(value)
  );
}

export function parseStorefrontClosedCopy(value: unknown): StorefrontClosedCopy {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const raw = value as Record<string, unknown>;
  const copy: StorefrontClosedCopy = {};
  for (const preset of STOREFRONT_CLOSED_PRESETS) {
    const block = raw[preset];
    if (!block || typeof block !== "object" || Array.isArray(block)) continue;
    const b = block as Record<string, unknown>;
    copy[preset] = {
      ...(typeof b.title === "string" ? { title: b.title } : {}),
      ...(typeof b.message === "string" ? { message: b.message } : {}),
    };
  }
  return copy;
}

export function resolveStorefrontClosedDisplay(
  settings: Pick<StorefrontClosedSettings, "storefront_closed_preset" | "storefront_closed_copy">
): { preset: StorefrontClosedPreset; title: string; message: string } {
  const preset = settings.storefront_closed_preset;
  const defaults = DEFAULT_STOREFRONT_CLOSED_COPY[preset];
  const override = settings.storefront_closed_copy[preset];
  return {
    preset,
    title: override?.title?.trim() || defaults.title,
    message: override?.message?.trim() || defaults.message,
  };
}

/** Paths that stay reachable while the public storefront is closed. */
export function isPathAllowedDuringStorefrontClosed(pathname: string): boolean {
  const allowedPrefixes = [
    "/maintenance",
    "/admin",
    "/superadmin",
    "/login",
    "/signup",
    "/auth",
    "/track-order",
    "/api/admin",
    "/api/superadmin",
    "/api/webhooks",
    "/api/track-order",
    "/api/newsletter",
  ];
  return allowedPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export function storefrontClosedApiMessage(preset: StorefrontClosedPreset): string {
  return resolveStorefrontClosedDisplay({
    storefront_closed_preset: preset,
    storefront_closed_copy: {},
  }).title;
}

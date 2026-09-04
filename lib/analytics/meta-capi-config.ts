/** Server-only Meta Conversions API configuration. Never import from client components. */

export const DEFAULT_META_GRAPH_API_VERSION = "v26.0";

export type MetaCapiConfig = {
  pixelId: string;
  accessToken: string;
  graphApiVersion: string;
  testEventCode?: string;
  siteUrl: string;
};

function trimEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value || undefined;
}

export function resolveMetaPixelId(): string | undefined {
  return trimEnv("META_PIXEL_ID") ?? trimEnv("NEXT_PUBLIC_META_PIXEL_ID");
}

export function getMetaCapiConfig(): MetaCapiConfig | null {
  const pixelId = resolveMetaPixelId();
  const accessToken = trimEnv("META_CONVERSIONS_API_ACCESS_TOKEN");
  if (!pixelId || !accessToken) return null;

  const siteUrl =
    trimEnv("APP_BASE_URL") ??
    trimEnv("NEXT_PUBLIC_SITE_URL") ??
    trimEnv("NEXT_PUBLIC_APP_URL") ??
    "https://www.oandilabel.com";

  const config: MetaCapiConfig = {
    pixelId,
    accessToken,
    graphApiVersion: trimEnv("META_GRAPH_API_VERSION") ?? DEFAULT_META_GRAPH_API_VERSION,
    siteUrl: siteUrl.replace(/\/$/, ""),
  };

  const testEventCode = trimEnv("META_TEST_EVENT_CODE");
  if (testEventCode) config.testEventCode = testEventCode;

  return config;
}

export function isMetaCapiEnabled(): boolean {
  return getMetaCapiConfig() != null;
}

export function buildMetaCapiEventsUrl(config: MetaCapiConfig): string {
  return `https://graph.facebook.com/${config.graphApiVersion}/${config.pixelId}/events`;
}

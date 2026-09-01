import { GoogleAnalytics } from "@next/third-parties/google";

export function StoreGoogleAnalytics() {
  const measurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim();
  if (!measurementId) return null;

  return (
    <GoogleAnalytics
      gaId={measurementId}
      debugMode={process.env.NODE_ENV === "development"}
    />
  );
}

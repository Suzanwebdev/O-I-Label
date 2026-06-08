import Link from "next/link";
import { JsonSettingsEditor } from "@/components/admin/json-settings-editor";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getFeatureFlagsSnapshot } from "@/lib/data/admin";
import {
  STOREFRONT_CLOSED_PRESET_LABELS,
  resolveStorefrontClosedDisplay,
} from "@/lib/storefront-closed";
import { getStorefrontClosedSettings } from "@/lib/storefront-closed-server";

export default async function AdminFeatureFlagsPage() {
  const [{ featureFlags, maintenanceMode }, storefront] = await Promise.all([
    getFeatureFlagsSnapshot(),
    getStorefrontClosedSettings(),
  ]);

  const display = storefront
    ? resolveStorefrontClosedDisplay(storefront)
    : null;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">Feature Flags</h1>
      <p className="text-sm text-muted-foreground">
        Storefront is currently{" "}
        <span className="font-medium">{maintenanceMode ? "closed" : "open"}</span>
        {display ? (
          <>
            {" "}
            · preset:{" "}
            <span className="font-medium">{STOREFRONT_CLOSED_PRESET_LABELS[display.preset]}</span>
          </>
        ) : null}
        . Manage closure and messages in{" "}
        <Link href="/admin/settings" className="text-navy underline-offset-2 hover:underline">
          Settings
        </Link>
        .
      </p>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Feature flags JSON</CardTitle>
        </CardHeader>
        <CardContent>
          <JsonSettingsEditor
            endpoint="/api/admin/feature-flags"
            field="featureFlags"
            label="Edit site_settings.feature_flags"
            initialJson={JSON.stringify(featureFlags, null, 2)}
          />
        </CardContent>
      </Card>
    </div>
  );
}

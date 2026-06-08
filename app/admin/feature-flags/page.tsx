import { JsonSettingsEditor } from "@/components/admin/json-settings-editor";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getFeatureFlagsSnapshot } from "@/lib/data/admin";

export default async function AdminFeatureFlagsPage() {
  const { featureFlags, maintenanceMode } = await getFeatureFlagsSnapshot();

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">Feature Flags</h1>
      <p className="text-sm text-muted-foreground">
        Maintenance mode is currently: <span className="font-medium">{maintenanceMode ? "ON" : "OFF"}</span>
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

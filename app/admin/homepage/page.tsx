import { JsonSettingsEditor } from "@/components/admin/json-settings-editor";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getHomepageSectionsJson } from "@/lib/data/admin";

export default async function AdminHomepagePage() {
  const sectionsJson = await getHomepageSectionsJson();

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">Homepage</h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sections JSON</CardTitle>
        </CardHeader>
        <CardContent>
          <JsonSettingsEditor
            endpoint="/api/admin/homepage"
            field="sections"
            label="Edit home_content.sections"
            initialJson={sectionsJson}
          />
        </CardContent>
      </Card>
    </div>
  );
}

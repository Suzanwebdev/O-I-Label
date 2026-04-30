import { JsonSettingsEditor } from "@/components/admin/json-settings-editor";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getHomepageSectionsJson } from "@/lib/data/admin";

export default async function AdminHomepagePage() {
  const sectionsJson = await getHomepageSectionsJson();

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">Homepage</h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Featured collection carousel</CardTitle>
          <CardDescription>
            The homepage &quot;Shop by occasion&quot; tiles are edited under{" "}
            <Link href="/admin/collections" className="font-medium text-foreground underline underline-offset-2">
              Catalog → Collections → Homepage collection carousel
            </Link>
            .
          </CardDescription>
        </CardHeader>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Advanced · full sections JSON</CardTitle>
          <CardDescription>
            Experts only: replaces the entire <span className="font-mono">sections</span> object. Prefer{" "}
            <Link href="/admin/collections" className="font-medium underline underline-offset-2">
              Collections → Homepage collection carousel
            </Link>{" "}
            for shop-by-occasion cards.
          </CardDescription>
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

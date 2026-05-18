import Link from "next/link";
import { HomepageCmsEditor } from "@/components/admin/homepage-cms-editor";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { JsonSettingsEditor } from "@/components/admin/json-settings-editor";
import { getHomepageCmsAdmin } from "@/lib/data/homepage-cms";
import { getHomepageSectionsJson } from "@/lib/data/admin";

export default async function AdminHomepagePage() {
  const [cms, sectionsJson] = await Promise.all([getHomepageCmsAdmin(), getHomepageSectionsJson()]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Homepage</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Edit hero copy, slider images, promo band, section headings, and footer links.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Shop by occasion tiles</CardTitle>
          <CardDescription>
            Collection carousel images and links are edited under{" "}
            <Link href="/admin/collections" className="font-medium text-foreground underline underline-offset-2">
              Catalog → Collections
            </Link>
            .
          </CardDescription>
        </CardHeader>
      </Card>

      <HomepageCmsEditor initial={cms} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Advanced · full sections JSON</CardTitle>
          <CardDescription>
            Replaces the entire <span className="font-mono">sections</span> object. Prefer the forms above
            for hero and footer.
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

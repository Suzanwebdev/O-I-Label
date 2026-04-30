import { ShopByOccasionEditor } from "@/components/admin/shop-by-occasion-editor";
import { CollectionCreateForm } from "@/components/admin/collection-create-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getHomeContentSectionsAdmin, listAdminCollections } from "@/lib/data/admin";

export default async function AdminCollectionsPage() {
  const [collections, homeSections] = await Promise.all([listAdminCollections(), getHomeContentSectionsAdmin()]);
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">Collections</h1>
      <Card>
        <CardHeader className="space-y-4">
          <CardTitle className="text-base">Create collection</CardTitle>
          <CollectionCreateForm />
        </CardHeader>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Homepage collection carousel</CardTitle>
          <CardDescription>
            Large tiles under &quot;Shop by occasion&quot; on the homepage. Add cards, reorder, upload art, or use the four
            preset templates. This is saved as <span className="font-mono">home_content.sections.shop_by_occasion</span>{" "}
            (not the product collections list below).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ShopByOccasionEditor initialSections={homeSections} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Existing collections</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {collections.length ? (
            collections.map((c) => (
              <div key={c.id} className="rounded-lg border border-border bg-background px-4 py-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">{c.title}</p>
                  <span className="text-xs text-muted-foreground">/{c.slug}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {c.is_smart ? "Smart collection" : "Manual collection"}
                </p>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No collections yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

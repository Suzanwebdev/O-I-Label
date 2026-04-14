import { CollectionCreateForm } from "@/components/admin/collection-create-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listAdminCollections } from "@/lib/data/admin";

export default async function AdminCollectionsPage() {
  const collections = await listAdminCollections();
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

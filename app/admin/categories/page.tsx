import { CategoryCreateForm } from "@/components/admin/category-create-form";
import { CategoryRowActions } from "@/components/admin/category-row-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listAdminCategories } from "@/lib/data/admin";

export default async function AdminCategoriesPage() {
  const categories = await listAdminCategories();
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">Categories</h1>
      </div>
      <Card>
        <CardHeader className="space-y-4">
          <CardTitle className="text-base">Create category</CardTitle>
          <CategoryCreateForm />
        </CardHeader>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Current categories</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {categories.length ? (
            categories.map((c) => (
              <div key={c.id} className="rounded-lg border border-border bg-background px-4 py-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">{c.name}</p>
                  <p className="text-xs text-muted-foreground">/{c.slug}</p>
                </div>
                {c.description ? <p className="mt-1 text-xs text-muted-foreground">{c.description}</p> : null}
                <div className="mt-3">
                  <CategoryRowActions
                    categoryId={c.id}
                    initialName={c.name}
                    initialImageUrl={c.image_url ?? null}
                  />
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No categories yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

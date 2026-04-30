import { CategoryCreateForm } from "@/components/admin/category-create-form";
import { CategoriesManager } from "@/components/admin/categories-manager";
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
        <CardContent>
          <CategoriesManager categories={categories} />
        </CardContent>
      </Card>
    </div>
  );
}

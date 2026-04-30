import { InventoryStockTable } from "@/components/admin/inventory-stock-table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { listAdminInventory } from "@/lib/data/admin";

export default async function AdminInventoryPage() {
  const rows = await listAdminInventory();
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">Inventory</h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Variant stock</CardTitle>
          <CardDescription>
            Adjust quantity per SKU, then choose <strong>Save</strong>. You must be signed in as an admin or staff row
            in Supabase <span className="font-mono">admins</span>; otherwise saves return an access error.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {rows.length ? (
            <InventoryStockTable rows={rows} />
          ) : (
            <p className="text-sm text-muted-foreground">No variants found.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

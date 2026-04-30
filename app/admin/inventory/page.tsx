import { InventoryStockCell } from "@/components/admin/inventory-stock-cell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listAdminInventory } from "@/lib/data/admin";

export default async function AdminInventoryPage() {
  const rows = await listAdminInventory();
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">Inventory</h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Variant stock</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {rows.length ? (
            rows.map((r) => (
              <div
                key={r.variant_id}
                className="grid gap-3 rounded-lg border border-border bg-background px-4 py-3 text-sm md:grid-cols-[1.2fr_1fr_150px_140px]"
              >
                <div>
                  <p className="font-medium">{r.product_name}</p>
                  <p className="text-xs text-muted-foreground">{r.product_slug}</p>
                </div>
                <div>
                  <p className="font-medium">{r.sku}</p>
                  <p className="text-xs text-muted-foreground">SKU</p>
                </div>
                <div>
                  <p className="font-medium">GHc {r.price_ghs.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">Price</p>
                </div>
                <InventoryStockCell variantId={r.variant_id} stock={r.stock} />
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No variants found.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

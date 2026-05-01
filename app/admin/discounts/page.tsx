import { AdminDiscountsTable } from "@/components/admin/admin-discounts-table";
import { DiscountUpsertForm } from "@/components/admin/discount-upsert-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { listAdminDiscounts } from "@/lib/data/admin";

export const dynamic = "force-dynamic";

export default async function AdminDiscountsPage() {
  const discounts = await listAdminDiscounts();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif-display text-2xl font-semibold tracking-tight text-black md:text-3xl">Discounts</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Manage promo codes tied to the <code className="text-xs">discounts</code> table: percentage or fixed reductions,
          optional minimum spend, usage caps, and date windows.
        </p>
      </div>

      <Card id="create-discount" className="rounded-[var(--radius-lg)]">
        <CardHeader>
          <CardTitle className="text-base">Create discount</CardTitle>
          <CardDescription>New codes appear in this list immediately. Checkout still needs to read and honour them.</CardDescription>
        </CardHeader>
        <CardContent>
          <DiscountUpsertForm />
        </CardContent>
      </Card>

      <Card className="rounded-[var(--radius-lg)]">
        <CardHeader>
          <CardTitle className="text-base">Existing codes</CardTitle>
          <CardDescription>Usage counts stay read-only unless you rebuild redemption logic elsewhere.</CardDescription>
        </CardHeader>
        <CardContent>
          <AdminDiscountsTable discounts={discounts} />
        </CardContent>
      </Card>
    </div>
  );
}

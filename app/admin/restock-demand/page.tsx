import { RestockDemandOverview } from "@/components/admin/restock-demand-overview";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getRestockDemandOverview } from "@/lib/restock-notifications/demand-store";

export const dynamic = "force-dynamic";

export default async function AdminRestockDemandPage() {
  const result = await getRestockDemandOverview();
  const products = "error" in result ? [] : result;
  const loadError = "error" in result ? result.error : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Restock Demand</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Products with customers currently waiting via “Notify Me When Available”. Use this list to
          decide what to restock first. Preferences are for demand insight only — restock emails stay
          product-level.
        </p>
      </div>

      <Card className="rounded-[var(--radius-lg)]">
        <CardHeader>
          <CardTitle className="text-base">Active waiting by product</CardTitle>
          <CardDescription>
            Only products with at least one active subscription are listed. Expand a row for the full
            size and colour breakdown.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadError ? (
            <p className="text-sm text-red-600">Could not load restock demand. Try again shortly.</p>
          ) : (
            <RestockDemandOverview products={products} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

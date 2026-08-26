import { WebsiteHealthPanel } from "@/components/admin/website-health-panel";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getWebsiteHealthSnapshot } from "@/lib/website-health/store";
import { buildWebsiteHealthSummary } from "@/lib/website-health/present";

export const dynamic = "force-dynamic";

export default async function AdminWebsiteHealthPage() {
  const snapshot = await getWebsiteHealthSnapshot();
  const events = snapshot.ok ? snapshot.events : [];
  const summary = snapshot.ok ? snapshot.summary : buildWebsiteHealthSummary([]);
  const loadError = snapshot.ok ? null : snapshot.error;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Website Health</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Operational failures from checkout, payments, webhooks, inventory, email, restock, and auth.
          Customer-facing incident references can be matched here. This view is read-only.
        </p>
      </div>

      <Card className="rounded-[var(--radius-lg)]">
        <CardHeader>
          <CardTitle className="text-base">Operational events</CardTitle>
          <CardDescription>
            Aggregated by fingerprint. Repeated failures increase occurrence count instead of creating
            duplicate rows.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadError ? (
            <p className="text-sm text-red-600">Could not load website health. Try again shortly.</p>
          ) : (
            <WebsiteHealthPanel events={events} summary={summary} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

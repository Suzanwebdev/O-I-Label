import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { StorefrontClosedControls } from "@/components/admin/storefront-closed-controls";
import { getStorefrontClosedSettings } from "@/lib/storefront-closed-server";

export default async function AdminSettingsPage() {
  const storefront = await getStorefrontClosedSettings();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif-display text-2xl">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Control when the public storefront is open and what customers see while it is closed.
        </p>
      </div>

      {storefront ? (
        <StorefrontClosedControls variant="admin" initial={storefront} />
      ) : (
        <p className="text-sm text-destructive">Store settings could not be loaded.</p>
      )}

      <Card className="rounded-[var(--radius-lg)]">
        <CardHeader>
          <CardTitle className="text-base">Payment gateways</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {["Moolre", "Paystack", "Flutterwave"].map((g) => (
            <div key={g} className="flex items-center justify-between">
              <Label htmlFor={g}>{g}</Label>
              <Switch id={g} defaultChecked={g === "Moolre"} disabled />
            </div>
          ))}
          <p className="text-xs text-muted-foreground">
            Payment provider toggles are managed in Superadmin → Control center.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

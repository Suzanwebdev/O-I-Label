import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export default function AdminSettingsPage() {
  return (
    <div className="space-y-6">
      <h1 className="font-serif-display text-2xl">Settings</h1>
      <Card className="rounded-[var(--radius-lg)]">
        <CardHeader>
          <CardTitle className="text-base">Payment gateways</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {["Moolre", "Paystack", "Flutterwave"].map((g) => (
            <div key={g} className="flex items-center justify-between">
              <Label htmlFor={g}>{g}</Label>
              <Switch id={g} defaultChecked={g === "Moolre"} />
            </div>
          ))}
        </CardContent>
      </Card>
      <p className="text-sm text-muted-foreground">
        Keys and toggles persist in <code className="text-xs">site_settings</code>{" "}
        and environment variables. Never expose secrets to the browser.
      </p>
    </div>
  );
}

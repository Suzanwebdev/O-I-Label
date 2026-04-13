import { ControlCenter } from "@/components/superadmin/control-center";
import { getSiteSettingsForSuperadmin } from "@/lib/data/site-settings-superadmin";

export default async function SuperAdminHomePage() {
  const settings = await getSiteSettingsForSuperadmin();

  if (!settings) {
    return (
      <div className="rounded-xl border border-amber-400/30 bg-amber-950/30 p-6 text-sm text-amber-50">
        Store settings could not be loaded. Confirm Supabase has a{" "}
        <span className="font-medium">site_settings</span> row with{" "}
        <span className="font-medium">id = 1</span>, then refresh this page.
      </div>
    );
  }

  return <ControlCenter initialSettings={settings} />;
}

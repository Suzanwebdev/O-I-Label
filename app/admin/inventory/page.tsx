import { AdminModulePage } from "@/components/admin/admin-module-page";

export default function AdminInventoryPage() {
  return (
    <AdminModulePage
      title="Inventory"
      description="Stock control, adjustments, and low-stock monitoring across variants."
      bullets={[
        "View variant stock and movement history.",
        "Bulk adjust inventory with reasons.",
        "Set low-stock thresholds for alerts.",
      ]}
    />
  );
}

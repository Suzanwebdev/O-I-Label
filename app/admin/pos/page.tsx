import { AdminModulePage } from "@/components/admin/admin-module-page";

export default function AdminPOSPage() {
  return (
    <AdminModulePage
      title="POS"
      description="In-store checkout and assisted selling workflow for walk-in customers."
      bullets={[
        "Quick product search and cart compose.",
        "Apply discounts and capture payment references.",
        "Instant receipt and stock deduction sync.",
      ]}
    />
  );
}

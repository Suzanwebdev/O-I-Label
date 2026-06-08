import { StoreControlDashboard } from "@/components/admin/store-control-dashboard";
import { getStoreControlAdminSnapshot } from "@/lib/store-control/server";

export const dynamic = "force-dynamic";

export default async function AdminStoreControlPage() {
  const snapshot = await getStoreControlAdminSnapshot();
  return <StoreControlDashboard initial={snapshot} />;
}

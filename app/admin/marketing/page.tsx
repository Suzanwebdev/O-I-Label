import { MarketingCampaignsPanel } from "@/components/admin/marketing-campaigns-panel";
import { listMarketingCampaigns } from "@/lib/data/marketing";

export default async function AdminMarketingPage() {
  const campaigns = await listMarketingCampaigns();
  return <MarketingCampaignsPanel initialCampaigns={campaigns} />;
}

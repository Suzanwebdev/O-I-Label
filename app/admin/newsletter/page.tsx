import { NewsletterSubscribersPanel } from "@/components/admin/newsletter-subscribers-panel";
import { getNewsletterSubscriberCount } from "@/lib/newsletter/subscribers";

export const dynamic = "force-dynamic";

export default async function AdminNewsletterPage() {
  const total = await getNewsletterSubscriberCount();
  return <NewsletterSubscribersPanel initialTotal={total} />;
}

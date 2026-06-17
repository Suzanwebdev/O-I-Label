import Link from "next/link";
import { redirect } from "next/navigation";
import { Container } from "@/components/store/container";
import { AccountOrdersList } from "@/components/account/account-orders-list";
import { listAccountOrders } from "@/lib/data/account-orders";
import { buildPageMetadata } from "@/lib/seo/metadata";

export const metadata = buildPageMetadata({
  title: "Your orders",
  description: "View your O & I Label order history.",
  path: "/account/orders",
  noIndex: true,
});

export default async function AccountOrdersPage() {
  const { user, orders } = await listAccountOrders();

  if (!user) {
    redirect("/login?next=/account/orders");
  }

  return (
    <Container className="py-10 md:py-14">
      <div className="mx-auto w-full max-w-2xl space-y-6">
        <div className="space-y-2">
          <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Account</p>
          <h1 className="font-serif-display text-3xl tracking-tight text-foreground">Your orders</h1>
          <p className="text-sm text-muted-foreground">
            Signed in as <span className="text-foreground">{user.email}</span>
          </p>
        </div>

        <AccountOrdersList orders={orders} />

        <div className="flex flex-wrap gap-3 text-sm">
          <Link href="/track-order" className="text-navy underline-offset-4 hover:underline">
            Track with order number
          </Link>
          <Link href="/account" className="text-muted-foreground underline-offset-4 hover:underline">
            Back to account
          </Link>
        </div>
      </div>
    </Container>
  );
}

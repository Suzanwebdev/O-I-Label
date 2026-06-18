import Link from "next/link";
import { redirect } from "next/navigation";
import { Container } from "@/components/store/container";
import { SignOutButton } from "@/components/account/sign-out-button";
import { listAccountOrders } from "@/lib/data/account-orders";
import { buildPageMetadata } from "@/lib/seo/metadata";

export const metadata = buildPageMetadata({
  title: "Your account",
  description: "Manage your O & I Label account.",
  path: "/account",
  noIndex: true,
});

export default async function AccountPage() {
  const { user, orders } = await listAccountOrders();

  if (!user) {
    redirect("/login?next=/account");
  }

  const recentCount = orders.length;
  const displayName = user.fullName?.trim() || user.email;

  return (
    <Container className="py-10 md:py-14">
      <div className="mx-auto w-full max-w-2xl space-y-6 rounded-[var(--radius-lg)] border border-border bg-card p-6 shadow-[var(--shadow-soft)] md:p-8">
        <div className="space-y-2">
          <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Account</p>
          <h1 className="font-serif-display text-3xl tracking-tight text-foreground">
            Welcome back{displayName ? `, ${displayName.split(" ")[0]}` : ""}
          </h1>
          <p className="text-sm text-muted-foreground">{user.email}</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Link
            href="/account/orders"
            className="rounded-[var(--radius-md)] border border-border bg-background px-4 py-3 text-sm hover:bg-muted"
          >
            <span className="block font-medium">Orders</span>
            <span className="text-xs text-muted-foreground">
              {recentCount > 0 ? `${recentCount} order${recentCount === 1 ? "" : "s"}` : "No orders yet"}
            </span>
          </Link>
          <Link
            href="/account/wishlist"
            className="rounded-[var(--radius-md)] border border-border bg-background px-4 py-3 text-sm hover:bg-muted"
          >
            <span className="block font-medium">Wishlist</span>
            <span className="text-xs text-muted-foreground">Saved on this device</span>
          </Link>
          <Link
            href="/track-order"
            className="rounded-[var(--radius-md)] border border-border bg-background px-4 py-3 text-sm hover:bg-muted"
          >
            Track an order
          </Link>
          <Link
            href="/shop"
            className="rounded-[var(--radius-md)] border border-border bg-background px-4 py-3 text-sm hover:bg-muted"
          >
            Continue shopping
          </Link>
        </div>

        <div className="border-t border-border pt-4">
          <p className="mb-3 text-xs text-muted-foreground">
            Not you? Sign out to use your own account on this device.
          </p>
          <SignOutButton className="w-full sm:w-auto" />
        </div>
      </div>
    </Container>
  );
}

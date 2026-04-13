import Link from "next/link";
import { redirect } from "next/navigation";
import { Container } from "@/components/store/container";
import { getRequestAuthz } from "@/lib/authz";

const nav = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/customers", label: "Customers" },
  { href: "/admin/discounts", label: "Discounts" },
  { href: "/admin/content", label: "Content" },
  { href: "/admin/settings", label: "Settings" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const authz = await getRequestAuthz();
  if (!authz.user) {
    redirect("/login?next=/admin");
  }
  if (!authz.isAdmin) {
    redirect("/login?next=/admin&notice=no_access");
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b border-border bg-background">
        <Container className="flex h-14 items-center justify-between">
          <Link href="/admin" className="font-serif-display text-lg">
            O & I — Admin
          </Link>
          <Link href="/" className="text-sm text-muted-foreground hover:text-navy">
            View storefront
          </Link>
        </Container>
      </header>
      <Container className="flex gap-10 py-8">
        <aside className="hidden w-48 shrink-0 md:block">
          <nav className="space-y-1 text-sm">
            {nav.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className="block rounded-[var(--radius-md)] px-3 py-2 hover:bg-background"
              >
                {n.label}
              </Link>
            ))}
          </nav>
        </aside>
        <div className="min-w-0 flex-1">{children}</div>
      </Container>
    </div>
  );
}

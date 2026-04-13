import Link from "next/link";
import { Container } from "@/components/store/container";

const links = [
  { href: "/account", label: "Profile" },
  { href: "/account/addresses", label: "Addresses" },
  { href: "/account/orders", label: "Orders" },
  { href: "/account/wishlist", label: "Wishlist" },
];

export default function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Container className="py-10 md:py-14">
      <div className="grid gap-10 lg:grid-cols-[200px_1fr]">
        <nav className="flex flex-wrap gap-2 lg:flex-col lg:gap-1">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-[var(--radius-md)] px-3 py-2 text-sm hover:bg-muted"
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div>{children}</div>
      </div>
    </Container>
  );
}

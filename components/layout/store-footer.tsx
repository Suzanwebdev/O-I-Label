import Link from "next/link";
import { Container } from "@/components/store/container";
import { HomeNewsletter } from "@/components/home/newsletter-block";

const colLabel =
  "mb-5 text-[10px] font-medium uppercase tracking-[0.28em] text-white/55";

const cols = [
  {
    title: "Shop",
    links: [
      { href: "/shop", label: "All products" },
      { href: "/shop/new-arrivals", label: "New Arrivals" },
      { href: "/shop?tag=best_seller", label: "Best Sellers" },
      { href: "/blog", label: "Shop The Look" },
    ],
  },
  {
    title: "Support",
    links: [
      { href: "/contact", label: "Help & Contact" },
      { href: "/policies/shipping", label: "Shipping & Delivery" },
      { href: "/contact?topic=size-guide", label: "Size Guide" },
      { href: "/contact?topic=faq", label: "FAQs" },
      { href: "/track-order", label: "Track My Order" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/about", label: "Our story" },
      { href: "/blog", label: "Style Journal" },
      { href: "/policies/privacy", label: "Privacy" },
      { href: "/policies/terms", label: "Terms" },
    ],
  },
];

export function StoreFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-white/10 bg-[#0b1220] text-white">
      <Container className="py-16 md:py-[4.5rem]">
        <div className="grid gap-14 lg:grid-cols-12 lg:gap-0 lg:items-start">
          <div className="lg:col-span-5 lg:border-r lg:border-white/10 lg:pr-10 xl:pr-14">
            <p className={colLabel}>Newsletter</p>
            <div className="max-w-[22rem] space-y-4">
              <p className="font-serif-display text-[1.375rem] leading-[1.2] tracking-[-0.02em] text-white md:text-[1.5rem]">
                Join the VIP List
              </p>
              <p className="text-[13px] leading-[1.65] text-white/70">
                Be the first to shop new arrivals, get access to exclusive
                offers and sales.
              </p>
              <div className="pt-1 [&_input]:border-white/20 [&_input]:bg-white/5 [&_input]:text-white [&_input]:placeholder:text-white/40 [&_input:focus-visible]:ring-white/30 [&_[data-slot='select-trigger']]:border-white/20 [&_[data-slot='select-trigger']]:bg-white/5 [&_[data-slot='select-trigger']]:text-white/80 [&_button]:border-white/25 [&_button]:text-white [&_button:hover]:bg-white [&_button:hover]:text-[#0b1220]">
                <HomeNewsletter compact refined />
              </div>
            </div>
          </div>

          <nav
            aria-label="Footer"
            className="grid grid-cols-2 gap-x-8 gap-y-11 sm:grid-cols-3 lg:col-span-7 lg:grid-cols-3 lg:gap-x-6 lg:pl-10 xl:gap-x-10 xl:pl-14"
          >
            {cols.map((col) => (
              <div key={col.title} className="min-w-0">
                <p className={colLabel}>{col.title}</p>
                <ul className="space-y-2.5">
                  {col.links.map((l) => (
                    <li key={`${col.title}-${l.label}`}>
                      <Link
                        href={l.href}
                        className="inline-block text-[13px] leading-snug text-white/82 transition-colors duration-200 hover:text-white"
                      >
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <div className="mt-16 border-t border-white/10 pt-8 md:mt-[4.5rem] md:pt-10">
          <p className="text-[11px] tracking-[0.06em] text-white/50">
            © {year} O & I Label
          </p>
        </div>
      </Container>
    </footer>
  );
}

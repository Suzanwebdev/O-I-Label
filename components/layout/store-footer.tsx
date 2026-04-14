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

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.75" fill="currentColor" stroke="none" />
    </svg>
  );
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4.5 19.5L5.6 15.7A8 8 0 1 1 8.3 18.4z" />
      <path d="M9.6 8.8c.2-.4.5-.4.8-.4h.5c.2 0 .5 0 .7.5.2.5.8 1.9.9 2 .1.2.1.4 0 .6-.1.2-.2.3-.4.5l-.4.4c-.2.2-.3.3-.1.7.2.4.8 1.3 1.7 2.1 1.2 1 2.2 1.3 2.6 1.5.4.1.6.1.8-.1l.7-.8c.2-.2.4-.3.7-.2.3.1 1.8.9 2.1 1 .3.1.5.2.6.3.1.1.1.8-.1 1.5-.2.7-1.2 1.3-1.7 1.4-.5.1-1.1.2-1.8 0-.4-.1-.9-.3-1.6-.6-2.9-1.2-4.8-4.2-5-4.5-.2-.3-1.2-1.6-1.2-3 0-1.4.7-2.1 1-2.4z" />
    </svg>
  );
}

const socialLinks = [
  {
    href: "https://www.instagram.com/outfitsideas_gh?igsh=MTdqcTljZm00ZGQwbw%3D%3D&utm_source=qr",
    label: "Instagram",
    Icon: InstagramIcon,
  },
  {
    href: "https://api.whatsapp.com/send?phone=233503163721&text=Hello%20O%20%26%20I%20Label%2C%20I%20need%20help%20with%20an%20order.",
    label: "WhatsApp",
    Icon: WhatsAppIcon,
  },
];

export function StoreFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-white/10 bg-black text-white">
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
              <div className="pt-1">
                <HomeNewsletter compact refined dark />
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

        <div className="mt-16 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-8 md:mt-[4.5rem] md:pt-10">
          <p className="text-[11px] tracking-[0.06em] text-white/50">© {year} O & I Label</p>
          <div className="flex flex-wrap items-center gap-2">
            {socialLinks.map((item) => {
              const Icon = item.Icon;
              return (
                <a
                  key={item.label}
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={item.label}
                  title={item.label}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-white/[0.04] text-white/85 transition-colors duration-200 hover:border-white/45 hover:bg-white/10 hover:text-white"
                >
                  <Icon className="h-5 w-5" />
                </a>
              );
            })}
          </div>
        </div>
      </Container>
    </footer>
  );
}

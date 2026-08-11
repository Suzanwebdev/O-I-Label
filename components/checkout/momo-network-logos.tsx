import Image from "next/image";

const LOGOS = [
  {
    src: "/checkout/mtn-mobile-money.svg",
    alt: "MTN Mobile Money",
    width: 70,
    height: 26,
  },
  {
    src: "/checkout/telecel-cash.svg",
    alt: "Telecel Cash",
    width: 70,
    height: 26,
  },
  {
    src: "/checkout/airteltigo-money.svg",
    alt: "AirtelTigo Money",
    width: 70,
    height: 26,
  },
] as const;

/**
 * Visual-only Ghana Mobile Money network marks for checkout.
 * Not selectable payment methods — indicators next to the single MoMo option.
 */
export function MomoNetworkLogos({ className }: { className?: string }) {
  return (
    <span
      className={
        className ?? "inline-flex max-w-full flex-wrap items-center gap-1.5"
      }
      aria-label="Accepted networks: MTN Mobile Money, Telecel Cash, and AirtelTigo Money"
    >
      {LOGOS.map((logo) => (
        <Image
          key={logo.src}
          src={logo.src}
          alt={logo.alt}
          width={logo.width}
          height={logo.height}
          className="h-[26px] w-auto max-w-[70px] shrink-0 rounded-[3px] object-contain shadow-[0_0_0_1px_rgba(0,0,0,0.04)]"
          unoptimized
        />
      ))}
    </span>
  );
}

import Image from "next/image";

const LOGOS = [
  {
    src: "/checkout/mtn-mobile-money.png",
    alt: "MTN Mobile Money",
    width: 78,
    height: 28,
  },
  {
    src: "/checkout/telecel-cash.png",
    alt: "Telecel Cash",
    width: 78,
    height: 28,
  },
  {
    src: "/checkout/airteltigo-money.png",
    alt: "AirtelTigo Money",
    width: 78,
    height: 28,
  },
] as const;

/**
 * Visual-only Ghana Mobile Money network marks.
 * Not selectable payment methods.
 */
export function MomoNetworkLogos({
  className,
  imageClassName,
}: {
  className?: string;
  imageClassName?: string;
}) {
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
          className={
            imageClassName ??
            "h-[28px] w-auto max-w-[78px] shrink-0 rounded-[3px] object-contain"
          }
        />
      ))}
    </span>
  );
}

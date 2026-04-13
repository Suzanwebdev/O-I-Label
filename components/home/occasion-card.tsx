import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

export type OccasionCardProps = {
  image: string;
  title: string;
  href: string;
  alt?: string;
  className?: string;
  imageClassName?: string;
};

export function OccasionCard({
  image,
  title,
  href,
  alt,
  className,
  imageClassName,
}: OccasionCardProps) {
  return (
    <Link
      href={href}
      className={cn(
        "group relative block aspect-[3/4] w-full cursor-pointer overflow-hidden rounded-none md:aspect-auto md:min-h-[25.2rem] lg:min-h-[31.5rem]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy focus-visible:ring-offset-2",
        className
      )}
    >
      <Image
        src={image}
        alt={alt ?? title}
        fill
        quality={95}
        className={cn(
          "object-cover transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform motion-reduce:transition-none motion-reduce:group-hover:scale-100 group-hover:scale-[1.045]",
          imageClassName
        )}
        sizes="(max-width: 767px) 85vw, (max-width: 1023px) 43vw, 25vw"
      />
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/72 via-black/25 to-transparent transition-[opacity,background-image] duration-500 group-hover:from-black/82 group-hover:via-black/40"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-black/0 transition-colors duration-500 group-hover:bg-black/12"
        aria-hidden
      />
      <div className="absolute inset-x-0 bottom-0 p-[1.125rem] md:p-[1.575rem] lg:p-[1.8rem]">
        <p className="font-serif-display text-[1.215rem] font-medium leading-[1.15] tracking-[-0.02em] text-white md:text-[1.35rem] lg:text-[1.575rem]">
          {title}
        </p>
        <p className="mt-2.5 text-[10px] font-medium uppercase tracking-[0.22em] text-white/80 opacity-90 transition-opacity duration-300 group-hover:text-white group-hover:opacity-100 md:text-[11px]">
          Shop the look
        </p>
      </div>
    </Link>
  );
}

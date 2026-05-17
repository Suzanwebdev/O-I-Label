import type { Product } from "@/lib/types";
import { ProductCard } from "@/components/store/product-card";
import { cn } from "@/lib/utils";

const MOBILE_VISIBLE = 10;
const DESKTOP_VISIBLE = 8;

export function ProductYouMayAlsoLike({ products }: { products: Product[] }) {
  const items = products.slice(0, MOBILE_VISIBLE);
  if (items.length === 0) return null;

  return (
    <section
      className="mt-10 border-t border-border/60 pt-10 md:mt-12 md:pt-12"
      aria-label="You may also like"
    >
      <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Discover more</p>
      <h2 className="mt-2 font-serif-display text-[28px] leading-tight text-foreground md:text-[34px]">
        You may also like
      </h2>
      <div className="mt-6 grid grid-cols-2 gap-4 md:gap-5 lg:grid-cols-4 lg:gap-6">
        {items.map((product, index) => (
          <div key={product.id} className={cn(index >= DESKTOP_VISIBLE && "lg:hidden")}>
            <ProductCard product={product} />
          </div>
        ))}
      </div>
    </section>
  );
}

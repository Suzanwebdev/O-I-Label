import type { ProductBadge } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const labels: Record<ProductBadge, string> = {
  new: "New",
  best_seller: "Best Seller",
  limited: "Limited",
  sale: "Sale",
  selling_fast: "Selling Fast",
  trending: "Trending",
};

const variants: Record<
  ProductBadge,
  "default" | "secondary" | "new" | "sale" | "outline" | "pink"
> = {
  new: "new",
  best_seller: "default",
  limited: "pink",
  sale: "sale",
  selling_fast: "pink",
  trending: "secondary",
};

export function BadgeSet({
  badges,
  className,
}: {
  badges: ProductBadge[];
  className?: string;
}) {
  if (!badges.length) return null;
  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {badges.map((b) => (
        <Badge key={b} variant={variants[b]}>
          {labels[b]}
        </Badge>
      ))}
    </div>
  );
}

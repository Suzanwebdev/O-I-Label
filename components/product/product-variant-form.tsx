"use client";

import * as React from "react";
import type { Product } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCart } from "@/components/providers/cart-provider";
import { Price } from "@/components/store/price";

export function ProductVariantForm({ product }: { product: Product }) {
  const { addItem, openCart } = useCart();
  const sizes = Array.from(
    new Set(product.variants.map((v) => v.size).filter(Boolean))
  ) as string[];
  const colors = Array.from(
    new Set(product.variants.map((v) => v.color).filter(Boolean))
  ) as string[];

  const [size, setSize] = React.useState(sizes[0] ?? "");
  const [color, setColor] = React.useState(colors[0] ?? "");

  const variant = React.useMemo(() => {
    return (
      product.variants.find(
        (v) =>
          (sizes.length ? v.size === size : true) &&
          (colors.length ? v.color === color : true)
      ) ?? product.variants[0]
    );
  }, [product.variants, size, color, sizes.length, colors.length]);

  const oos = variant.stock <= 0;

  return (
    <div className="space-y-6">
      {sizes.length > 0 ? (
        <div className="space-y-2">
          <Label>Size</Label>
          <Select value={size} onValueChange={setSize}>
            <SelectTrigger className="h-11">
              <SelectValue placeholder="Select size" />
            </SelectTrigger>
            <SelectContent>
              {sizes.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}
      {colors.length > 0 ? (
        <div className="space-y-2">
          <Label>Colour</Label>
          <Select value={color} onValueChange={setColor}>
            <SelectTrigger className="h-11">
              <SelectValue placeholder="Select colour" />
            </SelectTrigger>
            <SelectContent>
              {colors.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-4">
        <Price
          amountGhs={variant.price_ghs}
          compareAtGhs={variant.compare_at_ghs}
        />
        <span className="text-sm text-muted-foreground">
          {oos ? "Out of stock" : `${variant.stock} in stock`}
        </span>
      </div>

      <Button
        type="button"
        size="lg"
        className="w-full rounded-[var(--radius-lg)]"
        disabled={oos}
        onClick={() => {
          addItem({
            variantId: variant.id,
            productId: product.id,
            productSlug: product.slug,
            name: product.name,
            image: product.images[0],
            size: variant.size,
            color: variant.color,
            quantity: 1,
            unitPriceGhs: variant.price_ghs,
          });
          openCart();
        }}
      >
        Add to bag
      </Button>
    </div>
  );
}

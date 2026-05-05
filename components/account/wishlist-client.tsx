"use client";

import Link from "next/link";
import { Container } from "@/components/store/container";
import { Button } from "@/components/ui/button";
import { useWishlist } from "@/components/providers/wishlist-provider";

export function WishlistClient() {
  const { items, removeItem, clear } = useWishlist();

  return (
    <Container className="py-10 md:py-14">
      <div className="mx-auto w-full max-w-3xl space-y-5 rounded-[var(--radius-lg)] border border-border bg-card p-6 shadow-[var(--shadow-soft)] md:p-8">
        <div className="space-y-2">
          <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            Account
          </p>
          <h1 className="font-serif-display text-3xl tracking-tight text-foreground">
            Wishlist
          </h1>
          <p className="text-sm text-muted-foreground">
            Pieces you have saved on this device.
          </p>
        </div>

        {items.length === 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Your wishlist is empty. Tap the heart on a product page to save an item.
            </p>
            <Button asChild variant="outline">
              <Link href="/shop">Continue shopping</Link>
            </Button>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {items.map((item) => (
                <div
                  key={item.key}
                  className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-border p-3"
                >
                  <Link href={`/product/${item.slug}`} className="min-w-0 flex-1 hover:underline">
                    <p className="truncate text-sm font-medium">{item.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{item.slug}</p>
                  </Link>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => removeItem(item.key)}
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={clear}>
                Clear wishlist
              </Button>
              <Button asChild>
                <Link href="/shop">Shop more</Link>
              </Button>
            </div>
          </>
        )}
      </div>
    </Container>
  );
}


import { Heading } from "@/components/store/heading";
import Link from "next/link";

export default function WishlistPage() {
  return (
    <div className="space-y-4">
      <Heading as="h1" eyebrow="Saved">
        Wishlist
      </Heading>
      <p className="text-sm text-muted-foreground">
        Heart pieces from the shop to build your wishlist here.
      </p>
      <Link href="/shop" className="text-sm font-medium text-navy underline">
        Browse shop
      </Link>
    </div>
  );
}

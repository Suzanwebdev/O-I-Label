"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";
import { Container } from "@/components/store/container";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { mockCategories } from "@/lib/mock-data";
import { useCart } from "@/components/providers/cart-provider";
import { useWishlist } from "@/components/providers/wishlist-provider";
import { Heart, Menu, Search, ShoppingBag, User } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const megaLinks = [
  { href: "/shop?tag=new", label: "New Arrivals" },
  { href: "/shop?tag=best_seller", label: "Best Sellers" },
  { href: "/shop?tag=trending", label: "Trending Now" },
];

/** Compact, optically centered touch targets — mobile header refinement */
const headerIconBtn =
  "relative inline-flex size-9 shrink-0 items-center justify-center rounded-full p-0 hover:bg-muted/70 md:size-10 [&_svg]:!size-[1.125rem] md:[&_svg]:!size-5";
const headerIconGlyph = "shrink-0 stroke-[1.5]";

function HeaderCountBadge({
  count,
  tone = "navy",
}: {
  count: number;
  tone?: "navy" | "rose";
}) {
  if (count <= 0) return null;
  return (
    <span
      className={cn(
        "pointer-events-none absolute end-1 top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full px-[3px] text-[9px] font-medium leading-none tabular-nums tracking-tight text-white ring-1 ring-background",
        tone === "rose" ? "bg-rose-600" : "bg-navy"
      )}
      aria-hidden
    >
      {count > 9 ? "9+" : count}
    </span>
  );
}

export function StoreHeader() {
  const router = useRouter();
  const { lines, toggleCart } = useCart();
  const { count: wishlistCount } = useWishlist();
  const [q, setQ] = React.useState("");
  const [isScrolled, setIsScrolled] = React.useState(false);
  const count = lines.reduce((n, l) => n + l.quantity, 0);

  React.useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(() => {
        setIsScrolled(window.scrollY > 14);
        raf = 0;
      });
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, []);

  function onSearch(e: React.FormEvent) {
    e.preventDefault();
    const query = q.trim();
    router.push(query ? `/shop?q=${encodeURIComponent(query)}` : "/shop");
  }

  return (
    <header className="sticky top-0 z-40">
      <div
        className={cn(
          "border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85",
          "transition-[background-color,box-shadow] duration-300",
          isScrolled && "bg-background/90 shadow-[0_10px_30px_rgb(15_23_42_/_0.08)]"
        )}
      >
        <Container
          className={cn(
            "flex items-center gap-3 transition-[height,padding] duration-300 md:gap-4",
            isScrolled ? "h-14 md:h-[4.25rem]" : "h-16 md:h-[4.75rem]"
          )}
        >
        <div className="flex min-w-0 items-center gap-2.5 sm:gap-3 lg:min-w-0 lg:gap-4">
        <Sheet>
          <SheetTrigger asChild className="lg:hidden">
            <Button variant="ghost" size="icon" className={headerIconBtn} aria-label="Open menu">
              <Menu className={headerIconGlyph} />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[min(100%,320px)] p-0">
            <SheetHeader className="sr-only">
              <SheetTitle>Menu</SheetTitle>
            </SheetHeader>
            <div className="border-b border-border p-6">
              <Link
                href="/"
                className="font-serif-display text-2xl tracking-tight"
              >
                O & I Label
              </Link>
            </div>
            <nav className="flex flex-col p-4">
              <Link
                href="/shop"
                className="rounded-[var(--radius-md)] px-4 py-3 text-sm font-medium hover:bg-muted"
              >
                Shop all
              </Link>
              {mockCategories.map((c) => (
                <Link
                  key={c.slug}
                  href={`/shop/${c.slug}`}
                  className="rounded-[var(--radius-md)] px-4 py-3 text-sm hover:bg-muted"
                >
                  {c.name}
                </Link>
              ))}
              <Link
                href="/blog"
                className="rounded-[var(--radius-md)] px-4 py-3 text-sm hover:bg-muted"
              >
                Style Journal
              </Link>
              <Link
                href="/about"
                className="rounded-[var(--radius-md)] px-4 py-3 text-sm hover:bg-muted"
              >
                Our story
              </Link>
            </nav>
          </SheetContent>
        </Sheet>

        <Link
          href="/"
          className="truncate font-serif-display text-lg leading-none tracking-tight sm:text-xl md:text-2xl"
        >
          O & I Label
        </Link>
        </div>

        <NavigationMenu className="mx-auto hidden max-w-max flex-1 lg:flex">
          <NavigationMenuList>
            <NavigationMenuItem>
              <NavigationMenuTrigger>Shop</NavigationMenuTrigger>
              <NavigationMenuContent>
                <div className="grid gap-6 p-6 md:grid-cols-[1fr_220px] lg:w-[640px]">
                  <div>
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Categories
                    </p>
                    <ul className="grid grid-cols-2 gap-2">
                      {mockCategories.slice(0, 10).map((c) => (
                        <li key={c.slug}>
                          <NavigationMenuLink asChild>
                            <Link
                              href={`/shop/${c.slug}`}
                              className={cn(
                                "block rounded-[var(--radius-md)] px-3 py-2 text-sm hover:bg-muted"
                              )}
                            >
                              {c.name}
                            </Link>
                          </NavigationMenuLink>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="space-y-2 rounded-[var(--radius-lg)] bg-muted/60 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Curated edits
                    </p>
                    {megaLinks.map((l) => (
                      <NavigationMenuLink key={l.href} asChild>
                        <Link
                          href={l.href}
                          className="block rounded-[var(--radius-md)] px-3 py-2 text-sm font-medium hover:bg-background"
                        >
                          {l.label}
                        </Link>
                      </NavigationMenuLink>
                    ))}
                    <Link
                      href="/shop"
                      className="mt-2 block text-sm text-navy underline-offset-4 hover:underline"
                    >
                      View all products
                    </Link>
                  </div>
                </div>
              </NavigationMenuContent>
            </NavigationMenuItem>
            <NavigationMenuItem>
              <NavigationMenuLink asChild>
                <Link
                  href="/blog"
                  className={cn(
                    "inline-flex h-10 items-center rounded-[var(--radius-md)] px-4 py-2 text-sm font-medium hover:bg-muted"
                  )}
                >
                  Journal
                </Link>
              </NavigationMenuLink>
            </NavigationMenuItem>
            <NavigationMenuItem>
              <NavigationMenuLink asChild>
                <Link
                  href="/about"
                  className={cn(
                    "inline-flex h-10 items-center rounded-[var(--radius-md)] px-4 py-2 text-sm font-medium hover:bg-muted"
                  )}
                >
                  About
                </Link>
              </NavigationMenuLink>
            </NavigationMenuItem>
          </NavigationMenuList>
        </NavigationMenu>

          <form
            onSubmit={onSearch}
            className="ml-auto hidden min-w-[220px] max-w-sm flex-1 items-center gap-2 md:flex lg:max-w-xs"
          >
            <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search pieces..."
              className="h-10 rounded-full border-border/70 bg-muted/20 pl-9"
              aria-label="Search products"
            />
          </div>
          </form>

        <div
          className={cn(
            "flex shrink-0 items-center gap-0 md:ml-0 md:gap-1 lg:gap-2",
            "ml-auto"
          )}
        >
          <Button
            variant="ghost"
            size="icon"
            className={cn(headerIconBtn, "md:hidden")}
            type="button"
            aria-label="Search"
            onClick={() => router.push("/shop")}
          >
            <Search className={headerIconGlyph} />
          </Button>
          <Button variant="ghost" size="icon" asChild aria-label="Wishlist" className={headerIconBtn}>
            <Link
              href="/account/wishlist"
              className="relative inline-flex size-full items-center justify-center"
            >
              <Heart
                className={cn(headerIconGlyph, wishlistCount > 0 && "fill-current text-rose-600")}
              />
              <HeaderCountBadge count={wishlistCount} tone="rose" />
            </Link>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className={headerIconBtn} aria-label="Account">
                <User className={headerIconGlyph} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem asChild>
                <Link href="/account">Profile</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/account/orders">Orders</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/track-order">Track order</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/login?next=/account">Sign in</Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="ghost"
            size="icon"
            className={headerIconBtn}
            type="button"
            onClick={toggleCart}
            aria-label="Open cart"
          >
            <ShoppingBag className={headerIconGlyph} />
            <HeaderCountBadge count={count} tone="navy" />
          </Button>
        </div>
        </Container>
      </div>
    </header>
  );
}

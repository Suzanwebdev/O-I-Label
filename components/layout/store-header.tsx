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

export function StoreHeader() {
  const router = useRouter();
  const { lines, openCart, toggleCart } = useCart();
  const [q, setQ] = React.useState("");
  const count = lines.reduce((n, l) => n + l.quantity, 0);

  function onSearch(e: React.FormEvent) {
    e.preventDefault();
    const query = q.trim();
    router.push(query ? `/shop?q=${encodeURIComponent(query)}` : "/shop");
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <Container className="flex h-16 items-center gap-4 md:h-[4.5rem]">
        <Sheet>
          <SheetTrigger asChild className="lg:hidden">
            <Button variant="ghost" size="icon" aria-label="Open menu">
              <Menu className="h-5 w-5" />
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
          className="font-serif-display text-xl tracking-tight md:text-2xl"
        >
          O & I Label
        </Link>

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
          className="ml-auto hidden min-w-[200px] max-w-sm flex-1 items-center gap-2 md:flex lg:max-w-xs"
        >
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search pieces..."
              className="h-10 pl-9"
              aria-label="Search products"
            />
          </div>
        </form>

        <div className="flex items-center gap-1 md:gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            type="button"
            aria-label="Search"
            onClick={() => router.push("/shop")}
          >
            <Search className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" asChild aria-label="Wishlist">
            <Link href="/account/wishlist">
              <Heart className="h-5 w-5" />
            </Link>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Account">
                <User className="h-5 w-5" />
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
            className="relative"
            type="button"
            onClick={toggleCart}
            aria-label="Open cart"
          >
            <ShoppingBag className="h-5 w-5" />
            {count > 0 ? (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-navy px-1 text-[10px] font-semibold text-white">
                {count > 9 ? "9+" : count}
              </span>
            ) : null}
          </Button>
        </div>
      </Container>
    </header>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Container } from "@/components/store/container";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

export function SuperAdminHeader() {
  const router = useRouter();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <header className="border-b border-white/10">
      <Container className="flex h-14 items-center justify-between gap-4">
        <span className="truncate font-serif-display text-lg text-white">Platform control</span>
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <Link
            href="/"
            className="hidden text-sm text-white/70 hover:text-white sm:inline"
          >
            Storefront
          </Link>
          <Link href="/admin" className="text-sm text-white/70 hover:text-white">
            Store admin
          </Link>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-white/25 bg-transparent text-white hover:bg-white/10"
            onClick={() => void signOut()}
          >
            Sign out
          </Button>
        </div>
      </Container>
    </header>
  );
}

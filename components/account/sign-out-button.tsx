"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";

type SignOutButtonProps = {
  variant?: "button" | "menu";
  className?: string;
};

export function SignOutButton({ variant = "button", className }: SignOutButtonProps) {
  const router = useRouter();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  if (variant === "menu") {
    return (
      <DropdownMenuItem
        className={className}
        onSelect={(event) => {
          event.preventDefault();
          void signOut();
        }}
      >
        Sign out
      </DropdownMenuItem>
    );
  }

  return (
    <Button type="button" variant="outline" className={className} onClick={() => void signOut()}>
      Sign out
    </Button>
  );
}

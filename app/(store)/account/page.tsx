import { Heading } from "@/components/store/heading";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function AccountProfilePage() {
  return (
    <div className="space-y-6">
      <Heading as="h1" eyebrow="Account">
        Profile
      </Heading>
      <p className="max-w-prose text-sm text-muted-foreground">
        Sign in with Supabase Auth to manage your profile. This shell previews
        the signed-in experience.
      </p>
      <Button asChild>
        <Link href="/login?next=/account">Sign in</Link>
      </Button>
    </div>
  );
}

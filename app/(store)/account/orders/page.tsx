import { Heading } from "@/components/store/heading";

export default function AccountOrdersPage() {
  return (
    <div className="space-y-4">
      <Heading as="h1" eyebrow="Account">
        Orders
      </Heading>
      <p className="text-sm text-muted-foreground">
        Order history syncs from Supabase once you are logged in.
      </p>
    </div>
  );
}

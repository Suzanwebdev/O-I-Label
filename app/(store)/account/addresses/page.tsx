import { Heading } from "@/components/store/heading";

export default function AccountAddressesPage() {
  return (
    <div className="space-y-4">
      <Heading as="h1" eyebrow="Account">
        Addresses
      </Heading>
      <p className="text-sm text-muted-foreground">
        Saved addresses will appear here after authentication.
      </p>
    </div>
  );
}

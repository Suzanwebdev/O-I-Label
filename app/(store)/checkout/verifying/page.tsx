import { Container } from "@/components/store/container";

export default function CheckoutVerifyingPage() {
  return (
    <Container className="py-24 text-center">
      <p className="font-serif-display text-2xl">Verifying payment…</p>
      <p className="mt-2 text-sm text-muted-foreground">
        Please wait while we confirm with your bank. Do not close this window.
      </p>
    </Container>
  );
}

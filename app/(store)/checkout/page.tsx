import { CheckoutWizard } from "@/components/checkout/checkout-wizard";
import { buildPageMetadata } from "@/lib/seo/metadata";

export const metadata = buildPageMetadata({
  title: "Checkout",
  description: "Secure checkout at O & I Label.",
  path: "/checkout",
  noIndex: true,
});

export default function CheckoutPage() {
  return <CheckoutWizard />;
}

import ForgotPasswordClient from "./forgot-password-client";
import { buildPageMetadata } from "@/lib/seo/metadata";

export const metadata = buildPageMetadata({
  title: "Reset password",
  description: "Reset your O & I Label account password.",
  path: "/forgot-password",
  noIndex: true,
});

export default function ForgotPasswordPage() {
  return <ForgotPasswordClient />;
}

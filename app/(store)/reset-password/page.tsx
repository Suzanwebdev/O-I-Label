import ResetPasswordClient from "./reset-password-client";
import { buildPageMetadata } from "@/lib/seo/metadata";

export const metadata = buildPageMetadata({
  title: "New password",
  description: "Set a new password for your O & I Label account.",
  path: "/reset-password",
  noIndex: true,
});

export default function ResetPasswordPage() {
  return <ResetPasswordClient />;
}

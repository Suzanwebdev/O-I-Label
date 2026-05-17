import { Suspense } from "react";
import { Container } from "@/components/store/container";
import LoginClient from "./login-client";
import { buildPageMetadata } from "@/lib/seo/metadata";

export const metadata = buildPageMetadata({
  title: "Sign In",
  description: "Sign in to your O & I Label account.",
  path: "/login",
  noIndex: true,
});

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <Container className="py-14">
          <div className="mx-auto w-full max-w-md rounded-[var(--radius-lg)] border border-border bg-card p-6 text-sm text-muted-foreground">
            Loading sign-in...
          </div>
        </Container>
      }
    >
      <LoginClient />
    </Suspense>
  );
}

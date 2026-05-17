import { Suspense } from "react";
import { Container } from "@/components/store/container";
import SignupClient from "./signup-client";
import { buildPageMetadata } from "@/lib/seo/metadata";

export const metadata = buildPageMetadata({
  title: "Create Account",
  description: "Create your O & I Label account.",
  path: "/signup",
  noIndex: true,
});

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <Container className="py-14">
          <div className="mx-auto w-full max-w-md rounded-[var(--radius-lg)] border border-border bg-card p-6 text-sm text-muted-foreground">
            Loading sign-up...
          </div>
        </Container>
      }
    >
      <SignupClient />
    </Suspense>
  );
}


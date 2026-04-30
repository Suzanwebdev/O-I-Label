import { Suspense } from "react";
import { Container } from "@/components/store/container";
import LoginClient from "./login-client";

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

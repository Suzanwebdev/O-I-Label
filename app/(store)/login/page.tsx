import { LoginForm } from "./login-form";
import { safeRedirectPath } from "@/lib/auth/safe-redirect";

type Props = {
  searchParams?: Promise<{ next?: string; notice?: string }>;
};

export default async function LoginPage({ searchParams }: Props) {
  const sp = searchParams != null ? await searchParams : {};
  const nextHref = safeRedirectPath(sp.next, "/admin");
  const notice = typeof sp.notice === "string" ? sp.notice : undefined;

  return <LoginForm nextHref={nextHref} notice={notice} />;
}

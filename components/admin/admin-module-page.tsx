import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
  title: string;
  description: string;
  bullets: string[];
  ctaHref?: string;
  ctaLabel?: string;
};

export function AdminModulePage({
  title,
  description,
  bullets,
  ctaHref,
  ctaLabel,
}: Props) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">{title}</h1>
        {ctaHref && ctaLabel ? (
          <Link
            href={ctaHref}
            className="inline-flex rounded-full bg-[#b9195f] px-4 py-2 text-sm font-medium text-white hover:bg-[#a11453]"
          >
            {ctaLabel}
          </Link>
        ) : null}
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Workspace</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>{description}</p>
          <ul className="list-disc space-y-1 pl-5">
            {bullets.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}


import { cn } from "@/lib/utils";

export function Price({
  amountGhs,
  compareAtGhs,
  className,
}: {
  amountGhs: number;
  compareAtGhs?: number;
  className?: string;
}) {
  const formatted = new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency: "GHS",
    minimumFractionDigits: 0,
  }).format(amountGhs);

  const compare =
    compareAtGhs && compareAtGhs > amountGhs
      ? new Intl.NumberFormat("en-GH", {
          style: "currency",
          currency: "GHS",
          minimumFractionDigits: 0,
        }).format(compareAtGhs)
      : null;

  return (
    <div className={cn("flex flex-wrap items-baseline gap-2", className)}>
      <span className="text-base font-semibold tabular-nums text-foreground">
        {formatted}
      </span>
      {compare ? (
        <span className="text-sm tabular-nums text-muted-foreground line-through">
          {compare}
        </span>
      ) : null}
    </div>
  );
}

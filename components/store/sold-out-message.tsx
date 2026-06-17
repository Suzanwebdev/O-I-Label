import { cn } from "@/lib/utils";

export function SoldOutBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full border border-border bg-background/95 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground shadow-sm backdrop-blur-sm",
        className
      )}
    >
      Sold out
    </span>
  );
}

export function SoldOutMessage({
  className,
  size = "sm",
}: {
  className?: string;
  size?: "xs" | "sm";
}) {
  return (
    <p
      className={cn(
        "font-medium text-muted-foreground",
        size === "xs" ? "text-[11px] md:text-xs" : "text-sm",
        className
      )}
      role="status"
    >
      Sold out
    </p>
  );
}

export function SoldOutNotice({
  className,
  productSoldOut,
  size,
  color,
}: {
  className?: string;
  productSoldOut?: boolean;
  size?: string | null;
  color?: string | null;
}) {
  const optionLabel = [size, color].filter(Boolean).join(" · ");

  return (
    <div
      className={cn(
        "rounded-[var(--radius-md)] border border-border bg-muted/50 px-3 py-2.5",
        className
      )}
      role="status"
    >
      <p className="text-sm font-medium text-foreground">Sold out</p>
      <p className="mt-0.5 text-sm text-muted-foreground">
        {productSoldOut
          ? "This item is currently unavailable."
          : optionLabel
            ? `${optionLabel} is currently unavailable. Try another size or colour.`
            : "This option is currently unavailable."}
      </p>
    </div>
  );
}

import Image from "next/image";
import type { AdminOrderPreviewItem } from "@/lib/data/admin";

const MAX_THUMBS = 3;

export function OrderItemPreviews({
  items,
  totalCount,
  size = "sm",
}: {
  items: AdminOrderPreviewItem[];
  totalCount?: number;
  size?: "sm" | "md";
}) {
  if (!items.length) {
    return <p className="text-xs text-muted-foreground">No line items</p>;
  }

  const count = totalCount ?? items.length;
  const extra = count > items.length ? count - items.length : 0;
  const dim = size === "md" ? "h-12 w-12" : "h-9 w-9";

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {items.slice(0, MAX_THUMBS).map((item, idx) => (
        <div
          key={`${item.name}-${idx}`}
          className={`relative ${dim} shrink-0 overflow-hidden rounded-md border border-border bg-muted`}
          title={`${item.name} ×${item.quantity}`}
        >
          <Image
            src={item.image || "/file.svg"}
            alt={item.name}
            fill
            className="object-cover"
            sizes={size === "md" ? "48px" : "36px"}
          />
        </div>
      ))}
      {extra > 0 ? (
        <span className="inline-flex h-9 min-w-9 items-center justify-center rounded-md border border-border bg-muted/60 px-1.5 text-[10px] font-medium text-muted-foreground">
          +{extra}
        </span>
      ) : null}
    </div>
  );
}

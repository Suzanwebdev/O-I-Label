const STATUS_LABELS: Record<string, string> = {
  pending: "Awaiting payment",
  paid: "Paid",
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

export function orderStatusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

export default function AdminOrdersPage() {
  return (
    <div className="space-y-4">
      <h1 className="font-serif-display text-2xl">Orders</h1>
      <p className="text-sm text-muted-foreground">
        Order pipeline: Pending → Paid → Processing → Shipped → Delivered.
        Fulfillment notes, tracking, PDF invoice, and customer notification
        toggles wire to Supabase <code className="text-xs">orders</code> and{" "}
        <code className="text-xs">shipments</code>.
      </p>
    </div>
  );
}

export default function AdminCustomersPage() {
  return (
    <div className="space-y-4">
      <h1 className="font-serif-display text-2xl">Customers</h1>
      <p className="text-sm text-muted-foreground">
        Purchase history, tags, and total spend from{" "}
        <code className="text-xs">customers</code> linked to auth users.
      </p>
    </div>
  );
}

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AdminNewProductPage() {
  return (
    <Card className="max-w-xl rounded-[var(--radius-lg)]">
      <CardHeader>
        <CardTitle>New product</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        Full create/edit form with image upload to the{" "}
        <code className="text-xs">product-images</code> bucket will use server
        actions + Supabase Storage policies for staff roles.
      </CardContent>
    </Card>
  );
}

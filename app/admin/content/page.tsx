import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAdminContentSnapshot } from "@/lib/data/admin";

export default async function AdminContentPage() {
  const snapshot = await getAdminContentSnapshot();

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">Content</h1>
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Blog posts</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold tabular-nums">{snapshot.blogCount}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Published posts</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold tabular-nums">{snapshot.publishedBlogCount}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Policy pages</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold tabular-nums">{snapshot.policyCount}</CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Manage content</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Link href="/admin/blog" className="rounded-lg border border-border bg-background px-4 py-3 text-sm hover:bg-muted/50">
            Blog editor
          </Link>
          <Link
            href="/admin/homepage"
            className="rounded-lg border border-border bg-background px-4 py-3 text-sm hover:bg-muted/50"
          >
            Homepage sections {snapshot.hasHomepageConfig ? "" : "(not configured)"}
          </Link>
          <Link
            href="/admin/feature-flags"
            className="rounded-lg border border-border bg-background px-4 py-3 text-sm hover:bg-muted/50"
          >
            Feature flags
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

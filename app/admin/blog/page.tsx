import { BlogDraftForm } from "@/components/admin/blog-draft-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listAdminBlogPosts } from "@/lib/data/admin";

export default async function AdminBlogPage() {
  const posts = await listAdminBlogPosts();

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">Blog</h1>
      <Card>
        <CardHeader className="space-y-4">
          <CardTitle className="text-base">Create draft</CardTitle>
          <BlogDraftForm />
        </CardHeader>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent posts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {posts.length ? (
            posts.map((p) => (
              <div key={p.id} className="rounded-lg border border-border bg-background px-4 py-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">{p.title}</p>
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">
                    {p.published ? "Published" : "Draft"}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{p.slug}</p>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No posts yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

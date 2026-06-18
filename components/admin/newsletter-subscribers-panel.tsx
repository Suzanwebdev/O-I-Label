"use client";

import * as React from "react";
import type { NewsletterSubscriberRow } from "@/lib/newsletter/subscribers";
import { formatNewsletterPhone } from "@/lib/newsletter/subscribers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
  initialTotal: number;
};

export function NewsletterSubscribersPanel({ initialTotal }: Props) {
  const [q, setQ] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [rows, setRows] = React.useState<NewsletterSubscriberRow[]>([]);
  const [total, setTotal] = React.useState(initialTotal);
  const [loading, setLoading] = React.useState(false);

  const pageSize = 25;

  async function load(nextPage = page) {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/newsletter/subscribers?q=${encodeURIComponent(q)}&page=${nextPage}&pageSize=${pageSize}`
      );
      if (!res.ok) return;
      const json = (await res.json()) as {
        rows?: NewsletterSubscriberRow[];
        total?: number;
      };
      setRows(json.rows ?? []);
      setTotal(json.total ?? 0);
      setPage(nextPage);
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    void load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial fetch only
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Newsletter</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Footer VIP list signups from the storefront. Distinct from presale waitlist in Store Control.
        </p>
      </div>

      <Card className="rounded-[var(--radius-lg)]">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base">Subscribers</CardTitle>
            <CardDescription>{total.toLocaleString()} total signups</CardDescription>
          </div>
          <Button asChild variant="outline" size="sm">
            <a href="/api/admin/newsletter/subscribers?export=csv">Export CSV</a>
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Search email or phone"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void load(1);
              }}
            />
            <Button type="button" onClick={() => void load(1)} disabled={loading}>
              {loading ? "…" : "Search"}
            </Button>
          </div>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Email</th>
                  <th className="px-3 py-2">Phone</th>
                  <th className="px-3 py-2">Country</th>
                  <th className="px-3 py-2">Source</th>
                  <th className="px-3 py-2">Welcome</th>
                  <th className="px-3 py-2">Joined</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="px-3 py-2">{r.email_raw}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {formatNewsletterPhone(r.phone_e164)}
                    </td>
                    <td className="px-3 py-2">{r.country_iso}</td>
                    <td className="px-3 py-2 text-muted-foreground">{r.source}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {r.welcome_email_sent_at
                        ? new Date(r.welcome_email_sent_at).toLocaleDateString()
                        : "—"}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {new Date(r.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
                {!loading && rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                      No subscribers yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1 || loading}
              onClick={() => void load(page - 1)}
            >
              Previous
            </Button>
            <span className="text-xs text-muted-foreground">
              Page {page} · {total.toLocaleString()} total
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page * pageSize >= total || loading}
              onClick={() => void load(page + 1)}
            >
              Next
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

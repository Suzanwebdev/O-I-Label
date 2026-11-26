"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { AdminContactSource, AdminCustomerRow } from "@/lib/data/admin";
import {
  brandedSmsLength,
  MOOLRE_SMS_CHAR_LIMIT,
} from "@/lib/sms/order-notifications";

type Segment =
  | "all"
  | "new30d"
  | "repeat"
  | "highValue"
  | "account"
  | "order"
  | "waitlist"
  | "newsletter";
type MessageChannel = "email" | "sms" | "both";

const SOURCE_LABELS: Record<AdminContactSource, string> = {
  account: "Account",
  order: "Order",
  waitlist: "Waitlist",
  newsletter: "Newsletter",
};

const MESSAGE_TEMPLATES: Array<{ id: string; label: string; subject: string; body: string }> = [
  {
    id: "promo",
    label: "Promo",
    subject: "Something special from O & I Label",
    body: "We thought you'd love this — a fresh note from the boutique, made for you.",
  },
  {
    id: "launch",
    label: "Launch note",
    subject: "We're opening soon",
    body: "The next chapter of O & I Label is almost here. Stay close for early access.",
  },
  {
    id: "custom",
    label: "Blank",
    subject: "",
    body: "",
  },
];

type MessageResultRow = {
  email?: string | null;
  phone?: string | null;
  emailStatus?: "sent" | "failed" | "skipped";
  smsStatus?: "sent" | "failed" | "skipped";
  reason?: string;
};

const MESSAGE_FAILURE_PREVIEW_LIMIT = 20;

function formatMessageFailureLines(results: MessageResultRow[]): string[] {
  const lines: string[] = [];
  for (const row of results) {
    const emailLabel = row.email?.trim() || null;
    const phoneLabel = row.phone?.trim() || null;
    const reason = row.reason?.trim();
    if (row.emailStatus === "failed") {
      lines.push(
        `Email failed: ${emailLabel ?? "unknown email"}${reason ? ` — ${reason}` : ""}`
      );
    }
    if (row.smsStatus === "failed") {
      lines.push(
        `SMS failed: ${phoneLabel ?? emailLabel ?? "unknown phone"}${reason ? ` — ${reason}` : ""}`
      );
    }
  }
  return lines;
}

export function AdminCustomersTable({ customers }: { customers: AdminCustomerRow[] }) {
  const router = useRouter();
  const [segment, setSegment] = React.useState<Segment>("all");
  const [q, setQ] = React.useState("");
  const [selected, setSelected] = React.useState<Record<string, boolean>>({});
  const [openCustomerId, setOpenCustomerId] = React.useState<string | null>(null);
  const [detailBusy, setDetailBusy] = React.useState(false);
  const [saveBusy, setSaveBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [noticeFailures, setNoticeFailures] = React.useState<string[]>([]);
  const [detailEditable, setDetailEditable] = React.useState(false);
  const [detail, setDetail] = React.useState<{
    customer: {
      id: string;
      email: string | null;
      full_name: string | null;
      phone: string | null;
      tags: string[];
      total_spend_ghs: number;
      created_at: string;
    };
    addresses: Array<{
      id: string;
      line1: string;
      line2: string | null;
      city: string;
      region: string | null;
      country: string;
      is_default: boolean;
      created_at: string;
    }>;
    orders: Array<{
      id: string;
      order_number: string;
      status: string;
      total_ghs: number;
      created_at: string;
    }>;
  } | null>(null);
  const [fullName, setFullName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [tagsInput, setTagsInput] = React.useState("");

  const [messageOpen, setMessageOpen] = React.useState(false);
  const [messageRecipients, setMessageRecipients] = React.useState<AdminCustomerRow[]>([]);
  const [messageChannel, setMessageChannel] = React.useState<MessageChannel>("email");
  const [messageSubject, setMessageSubject] = React.useState("");
  const [messageBody, setMessageBody] = React.useState("");
  const [respectOptOut, setRespectOptOut] = React.useState(true);
  const [messageBusy, setMessageBusy] = React.useState(false);

  /** Longest branded SMS among selected recipients (includes O & I Label prefix). */
  const smsBrandedLength = React.useMemo(() => {
    if (!messageRecipients.length) return brandedSmsLength(messageBody, null);
    return messageRecipients.reduce(
      (max, recipient) => Math.max(max, brandedSmsLength(messageBody, recipient.full_name)),
      brandedSmsLength(messageBody, null)
    );
  }, [messageBody, messageRecipients]);
  const smsOverLimit =
    (messageChannel === "sms" || messageChannel === "both") &&
    smsBrandedLength > MOOLRE_SMS_CHAR_LIMIT;

  const filtered = React.useMemo(() => {
    const key = q.trim().toLowerCase();
    const since = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return customers.filter((c) => {
      if (segment === "new30d" && new Date(c.created_at).getTime() < since) return false;
      if (segment === "repeat" && c.orders_count < 2) return false;
      if (segment === "highValue" && c.total_spend_ghs < 1000) return false;
      if (segment === "account" && !c.sources.includes("account")) return false;
      if (segment === "order" && !(c.orders_count > 0 || c.sources.includes("order"))) return false;
      if (segment === "waitlist" && !c.sources.includes("waitlist")) return false;
      if (segment === "newsletter" && !c.sources.includes("newsletter")) return false;
      if (!key) return true;
      return (
        (c.email ?? "").toLowerCase().includes(key) ||
        (c.full_name ?? "").toLowerCase().includes(key) ||
        (c.phone ?? "").toLowerCase().includes(key) ||
        c.tags.join(" ").toLowerCase().includes(key) ||
        c.sources.join(" ").toLowerCase().includes(key)
      );
    });
  }, [customers, q, segment]);

  const selectedIds = React.useMemo(
    () => filtered.filter((c) => selected[c.id]).map((c) => c.id),
    [filtered, selected]
  );

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((c) => selected[c.id]);

  function toggleAllFiltered() {
    setSelected((prev) => {
      const next = { ...prev };
      if (allFilteredSelected) {
        for (const c of filtered) delete next[c.id];
      } else {
        for (const c of filtered) next[c.id] = true;
      }
      return next;
    });
  }

  function openMessageComposer(rows: AdminCustomerRow[]) {
    setError(null);
    setNotice(null);
    setNoticeFailures([]);
    setMessageRecipients(rows);
    setMessageChannel("email");
    setMessageSubject(MESSAGE_TEMPLATES[0].subject);
    setMessageBody(MESSAGE_TEMPLATES[0].body);
    setRespectOptOut(true);
    setMessageOpen(true);
  }

  async function openDetail(customerId: string) {
    setOpenCustomerId(customerId);
    setDetail(null);
    setDetailEditable(false);
    setDetailBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/customers/${encodeURIComponent(customerId)}`);
      const json = (await res.json()) as {
        error?: string;
        editable?: boolean;
      } & NonNullable<typeof detail>;
      if (!res.ok) {
        setError(json.error ?? "Could not load contact");
        return;
      }
      setDetail(json);
      setDetailEditable(Boolean(json.editable));
      setFullName(json.customer.full_name ?? "");
      setPhone(json.customer.phone ?? "");
      setTagsInput((json.customer.tags ?? []).join(", "));
    } catch {
      setError("Network error while loading contact");
    } finally {
      setDetailBusy(false);
    }
  }

  async function saveCustomer() {
    if (!openCustomerId || !detailEditable) return;
    setSaveBusy(true);
    setError(null);
    try {
      const tags = tagsInput
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      const res = await fetch(`/api/admin/customers/${encodeURIComponent(openCustomerId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: fullName,
          phone,
          tags,
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(json.error ?? "Could not save customer");
        return;
      }
      await openDetail(openCustomerId);
      router.refresh();
    } catch {
      setError("Network error while saving customer");
    } finally {
      setSaveBusy(false);
    }
  }

  async function sendMessage() {
    if (!messageRecipients.length) return;
    if (!messageBody.trim()) {
      setError("Message is required.");
      return;
    }
    if ((messageChannel === "email" || messageChannel === "both") && !messageSubject.trim()) {
      setError("Subject is required for email.");
      return;
    }
    if (
      (messageChannel === "sms" || messageChannel === "both") &&
      smsBrandedLength > MOOLRE_SMS_CHAR_LIMIT
    ) {
      setError(
        `SMS is too long after branding (${smsBrandedLength}/${MOOLRE_SMS_CHAR_LIMIT}). Shorten the message so it fits including "O & I Label: Hi [Name],".`
      );
      return;
    }
    if (messageRecipients.length > 1) {
      const ok = window.confirm(
        `Send this ${messageChannel} message to ${messageRecipients.length} contacts?`
      );
      if (!ok) return;
    }

    setMessageBusy(true);
    setError(null);
    setNotice(null);
    setNoticeFailures([]);
    try {
      const res = await fetch("/api/admin/customers/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipients: messageRecipients.map((r) => ({
            id: r.id,
            email: r.email,
            phone: r.phone,
            fullName: r.full_name,
          })),
          channel: messageChannel,
          subject: messageSubject,
          message: messageBody,
          confirm: messageRecipients.length > 1,
          respectPromoOptOut: respectOptOut,
        }),
      });
      const json = (await res.json()) as {
        error?: string;
        summary?: string;
        sent?: number;
        results?: MessageResultRow[];
      };
      if (!res.ok) {
        setError(json.error ?? "Could not send message");
        return;
      }
      setNotice(json.summary ?? `Sent to ${json.sent ?? 0} recipient action(s).`);
      setNoticeFailures(formatMessageFailureLines(json.results ?? []));
      setMessageOpen(false);
      if (messageRecipients.length > 1) {
        setSelected({});
      }
    } catch {
      setError("Network error while sending message");
    } finally {
      setMessageBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {(
          [
            ["all", `All (${customers.length})`],
            ["account", "Accounts"],
            ["order", "Orders"],
            ["waitlist", "Waitlist"],
            ["newsletter", "Newsletter"],
            ["new30d", "New 30d"],
            ["repeat", "Repeat buyers"],
            ["highValue", "High value"],
          ] as const
        ).map(([key, label]) => (
          <Button
            key={key}
            size="sm"
            variant={segment === key ? "default" : "outline"}
            onClick={() => setSegment(key)}
          >
            {label}
          </Button>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="max-w-sm"
          placeholder="Search by name, email, phone, tags..."
        />
        <p className="text-sm text-muted-foreground">{filtered.length} customers</p>
      </div>

      {selectedIds.length > 0 ? (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/30 px-3 py-2">
          <p className="text-sm font-medium">{selectedIds.length} selected</p>
          <Button
            size="sm"
            onClick={() =>
              openMessageComposer(filtered.filter((c) => selected[c.id]))
            }
          >
            Message selected
          </Button>
          <Button size="sm" variant="outline" onClick={() => setSelected({})}>
            Clear
          </Button>
        </div>
      ) : null}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {notice ? (
        <div className="space-y-2 rounded-lg border border-emerald-200 bg-emerald-50/60 px-3 py-2">
          <p className="text-sm text-emerald-800">{notice}</p>
          {noticeFailures.length > 0 ? (
            <div className="space-y-1">
              <p className="text-xs font-medium text-red-700">
                Failed deliveries ({noticeFailures.length})
              </p>
              <ul className="max-h-48 list-disc space-y-0.5 overflow-y-auto pl-4 text-xs text-red-700">
                {noticeFailures.slice(0, MESSAGE_FAILURE_PREVIEW_LIMIT).map((line, i) => (
                  <li key={`${i}-${line}`}>{line}</li>
                ))}
              </ul>
              {noticeFailures.length > MESSAGE_FAILURE_PREVIEW_LIMIT ? (
                <p className="text-xs text-red-700">
                  …and {noticeFailures.length - MESSAGE_FAILURE_PREVIEW_LIMIT} more
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[960px] text-left text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 w-10">
                <Checkbox
                  checked={allFilteredSelected}
                  onCheckedChange={() => toggleAllFiltered()}
                  aria-label="Select all filtered customers"
                />
              </th>
              <th className="px-3 py-2">Contact</th>
              <th className="px-3 py-2">Sources</th>
              <th className="px-3 py-2">Phone</th>
              <th className="px-3 py-2">Tags</th>
              <th className="px-3 py-2">Orders</th>
              <th className="px-3 py-2">Total spend</th>
              <th className="px-3 py-2">Last order</th>
              <th className="px-3 py-2 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.id} className="border-t">
                <td className="px-3 py-3">
                  <Checkbox
                    checked={Boolean(selected[c.id])}
                    onCheckedChange={(v) =>
                      setSelected((prev) => {
                        const next = { ...prev };
                        if (v) next[c.id] = true;
                        else delete next[c.id];
                        return next;
                      })
                    }
                    aria-label={`Select ${c.full_name ?? c.email}`}
                  />
                </td>
                <td className="px-3 py-3">
                  <p className="font-medium">{c.full_name ?? "Unnamed contact"}</p>
                  <p className="text-xs text-muted-foreground">{c.email || "No email"}</p>
                </td>
                <td className="px-3 py-3">
                  <div className="flex flex-wrap gap-1">
                    {c.sources.map((source) => (
                      <span key={source} className="rounded-full bg-muted px-2 py-0.5 text-xs">
                        {SOURCE_LABELS[source]}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-3 py-3">{c.phone ?? "-"}</td>
                <td className="px-3 py-3">
                  <div className="flex flex-wrap gap-1">
                    {c.tags.length ? (
                      c.tags.map((tag) => (
                        <span key={tag} className="rounded-full bg-muted px-2 py-0.5 text-xs">
                          {tag}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-muted-foreground">No tags</span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-3">{c.orders_count}</td>
                <td className="px-3 py-3">GHc {c.total_spend_ghs.toFixed(2)}</td>
                <td className="px-3 py-3 text-muted-foreground">
                  {c.last_order_at ? new Date(c.last_order_at).toLocaleDateString() : "—"}
                </td>
                <td className="px-3 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="outline" onClick={() => openMessageComposer([c])}>
                      Message
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => void openDetail(c.id)}>
                      Detail
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-muted-foreground">
                  No contacts found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <Sheet open={Boolean(openCustomerId)} onOpenChange={(open) => !open && setOpenCustomerId(null)}>
        <SheetContent className="w-full max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Contact detail</SheetTitle>
            <SheetDescription>
              {detailEditable
                ? "Account profile, messaging, addresses, and order history."
                : "Read-only contact assembled from site activity. Messaging still works."}
            </SheetDescription>
          </SheetHeader>
          {detailBusy ? (
            <p className="mt-6 text-sm text-muted-foreground">Loading contact...</p>
          ) : detail ? (
            <div className="mt-6 space-y-6 text-sm">
              <section className="space-y-2">
                <h3 className="font-medium">Profile</h3>
                <p className="text-xs text-muted-foreground">{detail.customer.email}</p>
                <Input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Full name"
                  disabled={!detailEditable}
                />
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Phone"
                  disabled={!detailEditable}
                />
                <Input
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  placeholder="Tags (comma separated)"
                  disabled={!detailEditable}
                />
                <div className="flex flex-wrap gap-2">
                  {detailEditable ? (
                    <Button size="sm" onClick={() => void saveCustomer()} disabled={saveBusy}>
                      {saveBusy ? "Saving..." : "Save customer"}
                    </Button>
                  ) : null}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      openMessageComposer([
                        {
                          id: detail.customer.id,
                          customerId: detailEditable ? detail.customer.id : null,
                          email: detail.customer.email ?? "",
                          full_name: detail.customer.full_name,
                          phone: detail.customer.phone,
                          tags: detail.customer.tags ?? [],
                          sources: [],
                          total_spend_ghs: detail.customer.total_spend_ghs,
                          orders_count: detail.orders.length,
                          last_order_at: detail.orders[0]?.created_at ?? null,
                          created_at: detail.customer.created_at,
                        },
                      ])
                    }
                  >
                    Message contact
                  </Button>
                </div>
              </section>
              <section>
                <h3 className="font-medium">Addresses</h3>
                <ul className="mt-2 space-y-2">
                  {detail.addresses.map((a) => (
                    <li key={a.id} className="rounded border p-2 text-muted-foreground">
                      <p className="font-medium text-foreground">
                        {a.line1}
                        {a.line2 ? `, ${a.line2}` : ""}
                      </p>
                      <p>
                        {a.city}
                        {a.region ? `, ${a.region}` : ""} • {a.country}
                      </p>
                      {a.is_default ? <p className="text-xs">Default</p> : null}
                    </li>
                  ))}
                  {detail.addresses.length === 0 ? <li className="text-muted-foreground">No addresses.</li> : null}
                </ul>
              </section>
              <section>
                <h3 className="font-medium">Recent orders</h3>
                <ul className="mt-2 space-y-2">
                  {detail.orders.map((o) => (
                    <li key={o.id} className="rounded border p-2 text-muted-foreground">
                      {o.order_number} • {o.status} • GHc {o.total_ghs.toFixed(2)} •{" "}
                      {new Date(o.created_at).toLocaleDateString()}
                    </li>
                  ))}
                  {detail.orders.length === 0 ? <li className="text-muted-foreground">No orders yet.</li> : null}
                </ul>
              </section>
            </div>
          ) : (
            <p className="mt-6 text-sm text-muted-foreground">Select a contact to view details.</p>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={messageOpen} onOpenChange={setMessageOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {messageRecipients.length === 1
                ? "Message contact"
                : `Message ${messageRecipients.length} contacts`}
            </DialogTitle>
            <DialogDescription>
              Send a promotional email and/or SMS. Newsletter opt-outs are skipped by default.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="flex flex-wrap gap-2">
              {MESSAGE_TEMPLATES.map((t) => (
                <Button
                  key={t.id}
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setMessageSubject(t.subject);
                    setMessageBody(t.body);
                  }}
                >
                  {t.label}
                </Button>
              ))}
            </div>

            <div className="space-y-1">
              <Label htmlFor="msg-channel">Channel</Label>
              <select
                id="msg-channel"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={messageChannel}
                onChange={(e) => setMessageChannel(e.target.value as MessageChannel)}
              >
                <option value="email">Email</option>
                <option value="sms">SMS</option>
                <option value="both">Email + SMS</option>
              </select>
            </div>

            {messageChannel === "email" || messageChannel === "both" ? (
              <div className="space-y-1">
                <Label htmlFor="msg-subject">Subject</Label>
                <Input
                  id="msg-subject"
                  value={messageSubject}
                  onChange={(e) => setMessageSubject(e.target.value)}
                  placeholder="Email subject"
                />
              </div>
            ) : null}

            <div className="space-y-1">
              <Label htmlFor="msg-body">Message</Label>
              <Textarea
                id="msg-body"
                value={messageBody}
                onChange={(e) => setMessageBody(e.target.value)}
                placeholder="Write your message…"
                rows={6}
              />
              {messageChannel !== "email" ? (
                <div className="space-y-0.5">
                  <p
                    className={
                      smsOverLimit
                        ? "text-xs font-medium text-destructive"
                        : "text-xs text-muted-foreground"
                    }
                  >
                    {smsBrandedLength}/{MOOLRE_SMS_CHAR_LIMIT} SMS characters (includes O & I
                    Label greeting)
                  </p>
                  {smsOverLimit ? (
                    <p className="text-xs text-destructive">
                      Shorten the message — Moolre rejects SMS over {MOOLRE_SMS_CHAR_LIMIT}{" "}
                      characters.
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Keep SMS short. Longer updates should go by email.
                    </p>
                  )}
                </div>
              ) : null}
            </div>

            <label className="flex items-start gap-2 text-sm">
              <Checkbox
                checked={respectOptOut}
                onCheckedChange={(v) => setRespectOptOut(Boolean(v))}
              />
              <span>Skip newsletter promo opt-outs (recommended)</span>
            </label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setMessageOpen(false)} disabled={messageBusy}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void sendMessage()}
              disabled={messageBusy || smsOverLimit}
            >
              {messageBusy ? "Sending…" : "Send"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

"use client";

import * as React from "react";
import type { StorefrontProduct } from "@/lib/catalog/storefront-product";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  RESTOCK_PREF_ANY,
  buildRestockSubscribePayload,
  collectProductColors,
  collectProductSizes,
  mapRestockSubscribeResponse,
} from "@/lib/restock-notifications/ui";
import { isValidRestockEmail } from "@/lib/restock-notifications/helpers";
import { cn } from "@/lib/utils";

type Props = {
  product: StorefrontProduct;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Subscription source for analytics; defaults to PDP. */
  source?: "pdp" | "card" | "quick_view";
  className?: string;
};

export function RestockNotifyDialog({
  product,
  open,
  onOpenChange,
  source = "pdp",
  className,
}: Props) {
  const sizes = React.useMemo(() => collectProductSizes(product), [product]);
  const colors = React.useMemo(() => collectProductColors(product), [product]);

  const [email, setEmail] = React.useState("");
  const [preferredSize, setPreferredSize] = React.useState(RESTOCK_PREF_ANY);
  const [preferredColor, setPreferredColor] = React.useState(RESTOCK_PREF_ANY);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setError(null);
    setSuccessMessage(null);
    setBusy(false);
    setPreferredSize(RESTOCK_PREF_ANY);
    setPreferredColor(RESTOCK_PREF_ANY);
  }, [open, product.id]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || successMessage) return;

    setError(null);
    if (!isValidRestockEmail(email)) {
      setError("Valid email is required");
      return;
    }

    setBusy(true);
    try {
      const payload = buildRestockSubscribePayload({
        productId: product.id,
        email,
        preferredSize,
        preferredColor,
        source,
      });

      const res = await fetch("/api/restock-notifications/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      let body: unknown = {};
      try {
        body = await res.json();
      } catch {
        body = {};
      }

      const mapped = mapRestockSubscribeResponse({ status: res.status, body });
      if (!mapped.ok) {
        setError(mapped.message);
        return;
      }

      setSuccessMessage(mapped.message);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("max-w-md gap-0 p-0 sm:max-w-md", className)}>
        <div className="space-y-4 p-6">
          <DialogHeader className="space-y-2 text-left">
            <DialogTitle>Get notified when it&apos;s back</DialogTitle>
            <DialogDescription className="text-sm leading-relaxed">
              This piece is currently sold out. Choose your preferred options and we&apos;ll let you
              know when it becomes available again.
            </DialogDescription>
          </DialogHeader>

          {successMessage ? (
            <div className="space-y-4" role="status">
              <p className="text-sm font-medium text-foreground">
                {successMessage.startsWith("You're already")
                  ? successMessage
                  : "You're on the list."}
              </p>
              {!successMessage.startsWith("You're already") ? (
                <p className="text-sm text-muted-foreground">
                  We&apos;ll email you when this piece is available again.
                </p>
              ) : null}
              <Button
                type="button"
                variant="outline"
                className="w-full rounded-[var(--radius-lg)]"
                onClick={() => onOpenChange(false)}
              >
                Close
              </Button>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-3 text-left">
              <div className="space-y-1.5">
                <Label htmlFor="restock-email" className="text-xs text-muted-foreground">
                  Email
                </Label>
                <Input
                  id="restock-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="h-11 rounded-full border-border bg-white px-4 shadow-none"
                  disabled={busy}
                />
              </div>

              {sizes.length > 0 ? (
                <div className="space-y-1.5">
                  <Label htmlFor="restock-size" className="text-xs text-muted-foreground">
                    Size
                  </Label>
                  <Select
                    value={preferredSize}
                    onValueChange={setPreferredSize}
                    disabled={busy}
                  >
                    <SelectTrigger id="restock-size" className="h-11 rounded-full">
                      <SelectValue placeholder="Any" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={RESTOCK_PREF_ANY}>Any</SelectItem>
                      {sizes.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}

              {colors.length > 0 ? (
                <div className="space-y-1.5">
                  <Label htmlFor="restock-color" className="text-xs text-muted-foreground">
                    Colour
                  </Label>
                  <Select
                    value={preferredColor}
                    onValueChange={setPreferredColor}
                    disabled={busy}
                  >
                    <SelectTrigger id="restock-color" className="h-11 rounded-full">
                      <SelectValue placeholder="Any" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={RESTOCK_PREF_ANY}>Any</SelectItem>
                      {colors.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}

              {error ? (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              ) : null}

              <Button
                type="submit"
                size="lg"
                disabled={busy}
                className="w-full rounded-[var(--radius-lg)] bg-black font-semibold text-white hover:bg-black/90"
              >
                {busy ? "Saving…" : "Notify Me"}
              </Button>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

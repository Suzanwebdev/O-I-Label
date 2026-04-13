"use client";

import * as React from "react";
import { Container } from "@/components/store/container";
import { Heading } from "@/components/store/heading";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function TrackOrderPage() {
  const [order, setOrder] = React.useState("");
  const [contact, setContact] = React.useState("");
  const [msg, setMsg] = React.useState<string | null>(null);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(
      "Tracking will query Supabase orders when wired. For now, check your confirmation email."
    );
  }

  return (
    <Container className="py-14 md:py-20">
      <Heading as="h1" eyebrow="Orders">
        Track your order
      </Heading>
      <p className="mt-4 max-w-md text-sm text-muted-foreground">
        Enter your order number and the email or phone used at checkout.
      </p>
      <form
        onSubmit={onSubmit}
        className="mt-8 max-w-md space-y-4 rounded-[var(--radius-lg)] border border-border bg-card p-6 shadow-[var(--shadow-soft)]"
      >
        <div className="space-y-2">
          <Label htmlFor="order">Order number</Label>
          <Input
            id="order"
            value={order}
            onChange={(e) => setOrder(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="contact">Email or phone</Label>
          <Input
            id="contact"
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            required
          />
        </div>
        <Button type="submit">Track</Button>
        {msg ? <p className="text-sm text-muted-foreground">{msg}</p> : null}
      </form>
    </Container>
  );
}

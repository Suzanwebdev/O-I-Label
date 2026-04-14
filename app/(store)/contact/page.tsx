import { Container } from "@/components/store/container";
import { Heading } from "@/components/store/heading";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MessageCircle, Mail, AtSign } from "lucide-react";

export default function ContactPage() {
  return (
    <Container className="py-14 md:py-20">
      <Heading as="h1" eyebrow="Contact">
        We would love to hear from you
      </Heading>
      <div className="mt-10 grid gap-12 lg:grid-cols-2">
        <div className="space-y-6">
          <p className="text-muted-foreground">
            For styling advice, sizing help, or order questions, message us on
            WhatsApp. For partnerships and press, use the form.
          </p>
          <a
            href="https://api.whatsapp.com/send?phone=233503163721&text=Hello%20O%20%26%20I%20Label%2C%20I%20need%20help%20with%20an%20order."
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 rounded-[var(--radius-lg)] border border-border bg-muted/40 p-4 text-sm font-medium hover:border-navy"
          >
            <MessageCircle className="h-5 w-5 text-navy" />
            WhatsApp support
          </a>
          <a
            href="https://www.instagram.com/outfitsideas_gh?igsh=MTdqcTljZm00ZGQwbw%3D%3D&utm_source=qr"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 rounded-[var(--radius-lg)] border border-border bg-muted/40 p-4 text-sm font-medium hover:border-navy"
          >
            <AtSign className="h-5 w-5 text-navy" />
            Instagram: @outfitsideas_gh
          </a>
          <a
            href="mailto:hello@oilabel.com"
            className="flex items-center gap-3 text-sm text-muted-foreground hover:text-navy"
          >
            <Mail className="h-4 w-4" />
            hello@oilabel.com
          </a>
        </div>
        <form className="space-y-4 rounded-[var(--radius-lg)] border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="msg">Message</Label>
            <Textarea id="msg" required />
          </div>
          <Button type="submit">Send</Button>
        </form>
      </div>
    </Container>
  );
}

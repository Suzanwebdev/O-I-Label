import { Container } from "@/components/store/container";
import { Truck, ShieldCheck, MessageCircle } from "lucide-react";

const items = [
  { icon: Truck, label: "Fast delivery" },
  { icon: ShieldCheck, label: "Secure checkout" },
  { icon: MessageCircle, label: "Support on WhatsApp" },
];

export function TrustBar({ compact }: { compact?: boolean }) {
  return (
    <div className={compact ? "" : "border-b border-border bg-muted/50"}>
      <Container
        className={
          compact
            ? "flex flex-wrap gap-6 py-4 text-sm text-muted-foreground"
            : "flex flex-wrap justify-center gap-8 py-4 text-sm text-muted-foreground md:justify-between"
        }
      >
        {items.map(({ icon: Icon, label }) => (
          <div key={label} className="flex items-center gap-2">
            <Icon className="h-4 w-4 text-navy" aria-hidden />
            <span>{label}</span>
          </div>
        ))}
      </Container>
    </div>
  );
}

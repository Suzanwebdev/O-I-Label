import { Container } from "@/components/store/container";
import { Heading } from "@/components/store/heading";
import { TrustBar } from "@/components/store/trust-bar";

export default function AboutPage() {
  return (
    <Container className="py-14 md:py-20">
      <Heading as="h1" eyebrow="O & I Label">
        Our story
      </Heading>
      <div className="mt-10 max-w-2xl space-y-6 text-muted-foreground leading-relaxed">
        <p>
          O & I Label was founded on a simple belief: women deserve clothing that
          feels as considered as their calendars. We design elevated essentials
          with feminine structure — pieces that flatter real bodies and move
          through real days.
        </p>
        <p>
          Every drop is edited like a journal: limited quantities, tactile
          fabrics, and silhouettes inspired by contemporary art and classic
          tailoring. We are not chasing trends; we are building a wardrobe you
          reach for without thinking.
        </p>
        <p>
          Authenticity matters. Our products are sourced with integrity, our
          imagery celebrates diversity of form, and our service team is
          reachable when you need a second opinion — including on WhatsApp for
          styling support, never for checkout.
        </p>
      </div>
      <div className="mt-14">
        <TrustBar />
      </div>
    </Container>
  );
}

import { cn } from "@/lib/utils";

type Level = "h1" | "h2" | "h3" | "h4";

const styles: Record<Level, string> = {
  h1: "font-serif-display text-[2.25rem] leading-[1.1] tracking-tight text-foreground md:text-[2.75rem] md:leading-[1.08] lg:text-[3.25rem] max-w-[18ch]",
  h2: "font-serif-display text-2xl md:text-3xl lg:text-[2.25rem] tracking-tight text-foreground",
  h3: "font-serif-display text-xl md:text-2xl tracking-tight text-foreground",
  h4: "text-base font-semibold tracking-wide text-foreground uppercase",
};

export function Heading({
  as,
  className,
  children,
  eyebrow,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement> & {
  as: Level;
  eyebrow?: string;
}) {
  const Comp = as;
  return (
    <div className="space-y-3">
      {eyebrow ? (
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-navy/80">
          {eyebrow}
        </p>
      ) : null}
      <Comp className={cn(styles[as], className)} {...props}>
        {children}
      </Comp>
    </div>
  );
}

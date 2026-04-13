import { cn } from "@/lib/utils";

export function Section({
  className,
  muted,
  ...props
}: React.HTMLAttributes<HTMLElement> & { muted?: boolean }) {
  return (
    <section
      className={cn(
        "py-14 md:py-20 lg:py-24",
        muted && "bg-accent-pink/40",
        className
      )}
      {...props}
    />
  );
}

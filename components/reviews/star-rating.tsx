"use client";

import { cn } from "@/lib/utils";

export function StarRating({
  value,
  size = "md",
  className,
}: {
  value: number;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(5, value));
  const sizeClass = size === "sm" ? "text-xs" : size === "lg" ? "text-lg" : "text-sm";
  return (
    <span
      className={cn("inline-flex items-center gap-0.5 text-foreground", sizeClass, className)}
      aria-label={`${clamped.toFixed(1)} out of 5 stars`}
    >
      {Array.from({ length: 5 }, (_, i) => {
        const filled = i + 1 <= Math.round(clamped);
        return (
          <span key={i} aria-hidden className={filled ? "text-foreground" : "text-border"}>
            ★
          </span>
        );
      })}
    </span>
  );
}

export function StarRatingInput({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (n: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5 sm:gap-2" role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} star${n === 1 ? "" : "s"}`}
          disabled={disabled}
          onClick={() => onChange(n)}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight" || e.key === "ArrowUp") {
              e.preventDefault();
              onChange(Math.min(5, value + 1));
            } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
              e.preventDefault();
              onChange(Math.max(1, value - 1));
            }
          }}
          className={cn(
            "flex h-11 w-11 items-center justify-center text-[1.35rem] leading-none transition-colors",
            "rounded-[var(--radius-sm)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy focus-visible:ring-offset-2",
            "disabled:pointer-events-none disabled:opacity-50",
            n <= value ? "text-foreground" : "text-border hover:text-foreground/45"
          )}
        >
          ★
        </button>
      ))}
    </div>
  );
}

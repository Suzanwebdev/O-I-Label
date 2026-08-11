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
    <div className="flex items-center gap-1" role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} star${n === 1 ? "" : "s"}`}
          disabled={disabled}
          onClick={() => onChange(n)}
          className={cn(
            "h-10 w-10 text-xl transition-colors",
            n <= value ? "text-foreground" : "text-border hover:text-foreground/50"
          )}
        >
          ★
        </button>
      ))}
    </div>
  );
}

import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  SUPERADMIN_PAYMENTS_PERIOD_OPTIONS,
  type SuperadminPaymentsPeriod,
} from "@/lib/superadmin/payments-period";

export function PaymentsPeriodFilter({ active }: { active: SuperadminPaymentsPeriod }) {
  return (
    <div
      className="flex flex-wrap gap-2"
      role="tablist"
      aria-label="Payment reporting period"
    >
      {SUPERADMIN_PAYMENTS_PERIOD_OPTIONS.map((option) => {
        const isActive = option.id === active;
        return (
          <Link
            key={option.id}
            href={`/superadmin/payments?period=${option.id}`}
            role="tab"
            aria-selected={isActive}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              isActive
                ? "border-white bg-white text-black"
                : "border-white/20 bg-white/[0.04] text-white/70 hover:border-white/40 hover:text-white"
            )}
          >
            {option.label}
          </Link>
        );
      })}
    </div>
  );
}

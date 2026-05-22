export type SuperadminPaymentsPeriod =
  | "today"
  | "7d"
  | "30d"
  | "week"
  | "month"
  | "year"
  | "all";

export const SUPERADMIN_PAYMENTS_PERIOD_OPTIONS: Array<{
  id: SuperadminPaymentsPeriod;
  label: string;
  short: string;
}> = [
  { id: "today", label: "Today", short: "Today" },
  { id: "7d", label: "Last 7 days", short: "7d" },
  { id: "30d", label: "Last 30 days", short: "30d" },
  { id: "week", label: "This week", short: "Week" },
  { id: "month", label: "This month", short: "Month" },
  { id: "year", label: "This year", short: "Year" },
  { id: "all", label: "All time", short: "All" },
];

const VALID = new Set<string>(SUPERADMIN_PAYMENTS_PERIOD_OPTIONS.map((o) => o.id));

export function parseSuperadminPaymentsPeriod(raw: string | undefined): SuperadminPaymentsPeriod {
  if (raw && VALID.has(raw)) return raw as SuperadminPaymentsPeriod;
  return "7d";
}

export type PaymentsPeriodRange = {
  since: string | null;
  until: string | null;
  label: string;
};

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function startOfUtcWeek(d: Date): Date {
  const day = d.getUTCDay();
  const mondayOffset = day === 0 ? 6 : day - 1;
  const start = startOfUtcDay(d);
  start.setUTCDate(start.getUTCDate() - mondayOffset);
  return start;
}

export function resolvePaymentsPeriodRange(period: SuperadminPaymentsPeriod): PaymentsPeriodRange {
  const now = new Date();
  const option = SUPERADMIN_PAYMENTS_PERIOD_OPTIONS.find((o) => o.id === period);

  switch (period) {
    case "today": {
      return { since: startOfUtcDay(now).toISOString(), until: null, label: option?.label ?? "Today" };
    }
    case "7d": {
      const since = new Date(now);
      since.setUTCDate(since.getUTCDate() - 7);
      return { since: since.toISOString(), until: null, label: option?.label ?? "Last 7 days" };
    }
    case "30d": {
      const since = new Date(now);
      since.setUTCDate(since.getUTCDate() - 30);
      return { since: since.toISOString(), until: null, label: option?.label ?? "Last 30 days" };
    }
    case "week": {
      return {
        since: startOfUtcWeek(now).toISOString(),
        until: null,
        label: option?.label ?? "This week",
      };
    }
    case "month": {
      const since = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      return { since: since.toISOString(), until: null, label: option?.label ?? "This month" };
    }
    case "year": {
      const since = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
      return { since: since.toISOString(), until: null, label: option?.label ?? "This year" };
    }
    case "all":
    default:
      return { since: null, until: null, label: option?.label ?? "All time" };
  }
}

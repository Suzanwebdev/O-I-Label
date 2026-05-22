export type PublicOrderTracking = {
  order_number: string;
  status: string;
  status_label: string;
  payment_status: string;
  payment_label: string;
  placed_at: string;
  total_ghs: number;
  items: Array<{ name: string; quantity: number; sku: string | null }>;
  tracking: Array<{
    carrier: string | null;
    tracking_number: string | null;
    status: string | null;
    updated_at: string;
  }>;
};

export type PaymentProviderId = "moolre" | "paystack" | "flutterwave";

export interface InitiatePaymentInput {
  orderId: string;
  amountGhs: number;
  email: string;
  callbackUrl: string;
  metadata?: Record<string, string>;
}

export interface InitiatePaymentResult {
  provider: PaymentProviderId;
  redirectUrl?: string;
  reference: string;
  raw?: unknown;
}

export interface WebhookParseResult {
  reference: string;
  orderId?: string;
  amountGhs?: number;
  success: boolean;
  raw: unknown;
}

export type OrderStatusKey =
  | "pending"
  | "paid"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "refunded";

export type OrderStatusEmailCopy = {
  subject: string;
  eyebrow: string;
  headline: string;
  body: string;
  ctaLabel: string;
};

const statusCopy: Record<OrderStatusKey, OrderStatusEmailCopy> = {
  pending: {
    subject: "Complete your order",
    eyebrow: "Almost yours",
    headline: "Your order is reserved",
    body: "We have saved your pieces. Complete payment when you are ready to confirm your order — we will begin preparing it as soon as payment is received.",
    ctaLabel: "Complete payment",
  },
  paid: {
    subject: "Payment received",
    eyebrow: "Thank you",
    headline: "Your payment is confirmed",
    body: "We have received your payment and your order is now confirmed. Our team will begin preparing your pieces with care.",
    ctaLabel: "View order",
  },
  processing: {
    subject: "Being prepared",
    eyebrow: "In the studio",
    headline: "Your order is being prepared",
    body: "Your pieces are being carefully prepared and quality-checked. We will notify you the moment your parcel is on its way.",
    ctaLabel: "Track order",
  },
  shipped: {
    subject: "On its way to you",
    eyebrow: "Dispatched",
    headline: "Your parcel has shipped",
    body: "Your order is on its way. Use the tracking details below to follow your delivery.",
    ctaLabel: "Track delivery",
  },
  delivered: {
    subject: "Delivered",
    eyebrow: "Arrived",
    headline: "Your order has been delivered",
    body: "We hope you love every piece. If you need styling advice or support with your order, we are here for you.",
    ctaLabel: "Shop new arrivals",
  },
  cancelled: {
    subject: "Order update",
    eyebrow: "Order cancelled",
    headline: "Your order has been cancelled",
    body: "This order is no longer active. If you have questions or would like assistance placing a new order, please reach out to our team.",
    ctaLabel: "Contact support",
  },
  refunded: {
    subject: "Refund processed",
    eyebrow: "Refund",
    headline: "Your refund has been processed",
    body: "A refund has been issued for this order. Please allow a few business days for it to appear on your statement, depending on your payment provider.",
    ctaLabel: "Contact support",
  },
};

export function orderStatusEmailCopy(status: string): OrderStatusEmailCopy {
  const key = status as OrderStatusKey;
  if (key in statusCopy) return statusCopy[key];
  return {
    subject: "Order update",
    eyebrow: "Update",
    headline: "There is an update on your order",
    body: `Your order status is now: ${status}.`,
    ctaLabel: "Track order",
  };
}

export function orderConfirmationCopy(customerName: string | null) {
  const greeting = customerName ? `Dear ${customerName},` : "Hello,";
  return {
    subject: (orderNumber: string) => `Your order is confirmed — ${orderNumber}`,
    eyebrow: "Order confirmed",
    headline: "Thank you for your order",
    greeting,
    body: "We are delighted to confirm your order. Your pieces will be prepared with the care and attention O & I Label is known for. You will receive updates as your order progresses.",
    ctaLabel: "View your order",
  };
}

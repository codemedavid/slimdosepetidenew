import posthog from 'posthog-js';

declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
  }
}

export type OrderStatus =
  | 'new'
  | 'confirmed'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled';

export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';

type EventPayload = Record<string, unknown>;

function push(event: string, payload: EventPayload = {}) {
  if (typeof window === 'undefined') return;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event, ...payload });
  if (posthog.__loaded) {
    posthog.capture(event, payload);
  }
}

export function trackOrderStatus(status: OrderStatus, payload: EventPayload = {}) {
  push(`sldp_order_${status}`, { order_status: status, ...payload });
}

export function trackPaymentStatus(status: PaymentStatus, payload: EventPayload = {}) {
  push(`sldp_payment_${status}`, { payment_status: status, ...payload });
}

export function trackEvent(name: string, payload: EventPayload = {}) {
  push(`sldp_${name}`, payload);
}

export function identifyUser(email: string, traits: EventPayload = {}) {
  if (typeof window === 'undefined') return;
  const normalized = email.trim().toLowerCase();
  if (!normalized) return;
  if (posthog.__loaded) {
    posthog.identify(normalized, { email: normalized, ...traits });
  }
}

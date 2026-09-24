// Super Admin orders & payments — website (/order) purchases recorded by the
// Stripe webhook.
//
// POST /v1/dietitian/api/web/super-admin-orders (super_admin only), backend
// controller super-admin-orders.js.
//
// shipping → { status, addresses: [ { id, purchased_at (ISO UTC), customer: { name, email },
//              ship_to: { name, phone, line1, line2, city, state, postal_code, country },
//              partner_code, subscription_status, stripe_subscription_id } ],
//              pagination: { page, limit, total, total_pages } }
// payments → { status, payments: [ { id, date, customer: { name, email }, partner_code,
//              type: "first_payment" | "renewal" | …, period_start, period_end, currency,
//              amount_paid, amount_refunded, fee, net, status, failure_message,
//              payment_method: { type, last4 },
//              stripe: { subscription_id, invoice_id, payment_intent_id, charge_id } } ],
//              summary: [ { status, currency, count, amount_paid, amount_refunded } ],
//              status_options: [...], pagination: { … } }

import { apiFetcher } from "@/config/fetcher";
import { API_ENDPOINTS } from "@/config/apiConfig";

export const ORDERS_SEARCH_MIN_LENGTH = 3;

const post = (payload) =>
  apiFetcher(API_ENDPOINTS.SALES.SUPERADMINORDERS, {
    method: "POST",
    body: JSON.stringify(payload),
    timeoutMs: 29000,
  });

export const fetchShippingAddressesService = async ({ search = "", page = 1, limit = 20 }) =>
  post({ view: "shipping", ...(search ? { search } : {}), page, limit });

export const fetchPaymentTransactionsService = async ({ status = "all", search = "", page = 1, limit = 20 }) =>
  post({ view: "payments", status, ...(search ? { search } : {}), page, limit });

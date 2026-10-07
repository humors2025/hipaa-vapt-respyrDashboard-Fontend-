// Super Admin orders & payments — website (/order) purchases recorded by the
// Stripe webhook.
//
// POST /v1/dietitian/api/web/super-admin-orders (super_admin only), backend
// controller super-admin-orders.js.
//
// shipping → { status, addresses: [ { id, purchased_at (ISO UTC), customer: { name, email },
//              ship_to: { name, phone, line1, line2, city, state, postal_code, country },
//              partner_code, subscription_status (active | expired | cancelled | …; "expired" is
//              derived when an active plan's current_period_end has passed), stripe_status,
//              current_period_start, current_period_end, canceled_at, stripe_subscription_id } ],
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

// Free app-onboarding test codes (super-admin-test-codes.js): rows shaped like a
// paid purchase in trainer_client_plan_subscriptions, so the app redeems them
// as usual, but with no Stripe payment behind them. One redemption per code.
//
// Every code is issued under one real trainer account (connect@respyr.in unless
// the backend's SUPER_ADMIN_TEST_CODE_TRAINER_EMAIL says otherwise), so whoever
// redeems one shows up in that trainer's client list. trainer.found === false
// means that account is missing or deactivated: generate then answers 409 and
// mints nothing, because a code whose trainer the app cannot resolve never
// redeems.
//
// generate → { status, codes: ["RSP…"], expires_at, trainer_code, trainer }
// list     → { status, codes: [ { id, code, trainer_code, created_at, expires_at,
//              state: "unused" | "redeemed" | "expired", redeemed_profile_id, redeemed_at } ],
//              trainer: { email, name, code, found },
//              pagination: { page, limit, total, total_pages } }
const postTestCodes = (payload) =>
  apiFetcher(API_ENDPOINTS.SALES.SUPERADMINTESTCODES, {
    method: "POST",
    body: JSON.stringify(payload),
    timeoutMs: 29000,
  });

export const generateTestCodesService = async ({ count = 1 }) => postTestCodes({ action: "generate", count });

export const fetchTestCodesService = async ({ page = 1, limit = 20 }) => postTestCodes({ action: "list", page, limit });

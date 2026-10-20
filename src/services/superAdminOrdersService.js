// Super Admin orders & payments — website (/order) purchases recorded by the
// Stripe webhook.
//
// POST /v1/dietitian/api/web/super-admin-orders (super_admin only), backend
// controller super-admin-orders.js.
//
// shipping → { status, addresses: [ { id, purchased_at (ISO UTC), customer: { name, email },
//              ship_to: { name, phone, line1, line2, city, state, postal_code, country },
//              partner_code, facility: { id, name, partner_code, status, admin_user_id, admin_name } | null
//              (the gym behind the partner code; null for website purchases and trainers outside
//              a facility), subscription_status (active | expired | cancelled | …; "expired" is
//              derived when an active plan's current_period_end has passed), stripe_status,
//              current_period_start, current_period_end, canceled_at, stripe_subscription_id } ],
//              pagination: { page, limit, total, total_pages } }
// payments → { status, payments: [ { id, date, customer: { name, email }, partner_code,
//              facility (same shape as a shipping row's, or null),
//              type: "first_payment" | "renewal" | …, renewal_number (1 = first renewal,
//              null for other invoices), period_start, period_end, currency,
//              amount_paid, amount_refunded, fee, net, status, failure_message,
//              payment_method: { type, last4 },
//              stripe: { subscription_id, invoice_id, payment_intent_id, charge_id },
//              plan: { subscription_status, stripe_status, current_period_start,
//                      current_period_end, canceled_at } (the subscription as it stands now) } ],
//              summary: [ { status, currency, count, amount_paid, amount_refunded } ],
//              status_options: [...], pagination: { … } }
//            type "renewal" (Renewals tab) keeps renewal invoices only; the summary
//            then counts renewals only. paidOnly drops failed / open invoices
//            (list, summary and status_options), so only renewals that went
//            through are left.
// upcoming_renewals → { status, upcoming: [ { id, renews_at (current_period_end), customer,
//              partner_code, facility, purchased_at, renewals_so_far (this renewal is
//              renewals_so_far + 1), last_payment: { amount_paid, currency, date, type } | null,
//              plan_price: { amount, currency }, subscription_status, stripe_status,
//              current_period_start, current_period_end, stripe_subscription_id } ],
//              filters: { days, … }, pagination: { … } }
//            Plans still set to renew (active / trialing, not cancelled) whose
//            period ends in the next `days` days (default 7), soonest first.

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

export const fetchPaymentTransactionsService = async ({ status = "all", type = "all", paidOnly = false, search = "", page = 1, limit = 20 }) =>
  post({
    view: "payments",
    status,
    ...(type !== "all" ? { type } : {}),
    ...(paidOnly ? { paid_only: true } : {}),
    ...(search ? { search } : {}),
    page,
    limit,
  });

export const fetchUpcomingRenewalsService = async ({ days = 7, search = "", page = 1, limit = 20 }) =>
  post({ view: "upcoming_renewals", days, ...(search ? { search } : {}), page, limit });

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

// Google Authenticator gate for the Test codes tab (test-codes-lock.js). Same
// authenticator as Settings, but its own unlock: super-admin-test-codes answers
// 403 TEST_CODES_LOCKED until test-codes-mfa-verify accepts a code.
// status → { ok, unlocked, mfa_enrolled, expires_in_seconds }
// verify → { ok, unlocked, used_backup, backup_codes_left, expires_in_seconds }
const postTestCodesLock = (endpoint, payload = {}) =>
  apiFetcher(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

export const fetchTestCodesLockStatusService = () => postTestCodesLock(API_ENDPOINTS.SALES.TESTCODESLOCKSTATUS);
export const verifyTestCodesMfaService = ({ code }) => postTestCodesLock(API_ENDPOINTS.SALES.TESTCODESMFAVERIFY, { code });

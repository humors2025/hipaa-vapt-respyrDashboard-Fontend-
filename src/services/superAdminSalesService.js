// Super Admin sales analytics — the only place the Sales Analytics page gets data.
//
// Data source is chosen by NEXT_PUBLIC_SALES_ANALYTICS_SOURCE:
//   unset / "api" → POST API_ENDPOINTS.SALES.SUPERADMINSALESANALYTICS
//   "mock"        → local generated data from components/super-admin/sales/salesMock.js
//   "off"         → the page shows a not-connected notice and fetches nothing
//
// Backend: controllers/dietitian/api/web/super-admin-sales-analytics.js in
// respyr-metabolism-web (needs the sales_invoices table, migration 006).
//
// ─── Contract ─────────────────────────────────────────────────────────────────
//
// POST /v1/dietitian/api/web/super-admin-sales-analytics   (Bearer JWT, super_admin only)
//
// 1) view = "overview"  → KPI cards, trend, doughnut, channel comparison, top trainers
//   Request:
//   { "view": "overview", "period": "week"|"month"|"year",
//     "date_from": "YYYY-MM-DD", "date_to": "YYYY-MM-DD",              // inclusive, viewer's calendar
//     "tz_offset_minutes": 330 }                                     // viewer's UTC offset
//   Response:
//   { "status": true,
//     "filters": { "period", "date_from", "date_to", "granularity": "day"|"month" },
//     "summary": { "currency": "USD", "other_currencies": [], "gross_sales", "discounts",
//                  "refunds", "net_sales", "new_purchase_net_sales", "renewal_net_sales",
//                  "total_purchases", "website_purchases", "trainer_code_purchases",
//                  "average_order_value", "active_paid_subscribers" },
//     "source_breakdown": {
//       "website":      { "purchases", "gross_sales", "net_sales", "new_net_sales" },
//       "trainer_code": { "purchases", "gross_sales", "net_sales", "new_net_sales" } },
//     "trend": [ { "bucket": "2026-09-01" | "2026-09",   // day or month key
//                  "website_sales", "trainer_sales", "total_sales",
//                  "website_purchases", "trainer_purchases" } ],
//     "top_trainers": [ { "trainer_id", "trainer_name", "partner_code",
//                         "purchases", "gross_sales", "net_sales" } ],   // net_sales DESC, max 50
//     "top_trainers_total": 12 }
//
// 2) view = "purchases" → Purchase Details table (server-side paginated)
//   Request:
//   { "view": "purchases", "period", "date_from", "date_to",
//     "source": "all"|"website"|"trainer_code",
//     "subscription_status": "all"|<one of filter_options.subscription_status>,
//     "payment_status": "all"|<one of filter_options.payment_status>,
//     "search": "",            // >= 3 chars; name, email, purchase code, trainer code
//     "page": 1, "limit": 10 }
//   Response:
//   { "status": true,
//     "purchases": [ {
//         "purchase_id", "purchased_at": "2026-09-02T10:00:05Z",   // ISO, UTC
//         "customer": { "name", "email", "profile_id" },
//         "plan": { "code", "name" },
//         "purchase_source": "website"|"trainer_code",
//         "trainer": { "trainer_id", "name" } | null,
//         "attributed_partner_code", "purchase_code", "coupon_code",
//         "currency", "gross_amount", "discount_amount", "net_amount",
//         "subscription_status", "subscription_start", "subscription_end",
//         "payment_status",
//         "stripe": { "checkout_session_id", "payment_intent_id",
//                     "subscription_id", "invoice_id" } } ],
//     "pagination": { "page", "limit", "total", "total_pages" },
//     "filter_options": { "subscription_status": [...], "payment_status": [...] } }
//
// 3) view = "sync" → { "offset": 0 } backfills sales_invoices from Stripe in batches;
//    returns { next_offset | null, subscriptions_total, subscriptions_processed, ... }
//
// All amounts are major units (e.g. 24580.5), matching trainer-sales-analytics.
// Net sales include renewals; purchases count first payments only.

import { apiFetcher } from "@/config/fetcher";
import { API_ENDPOINTS } from "@/config/apiConfig";

export const SALES_SEARCH_MIN_LENGTH = 3;

export function getSalesDataSource() {
  const raw = (process.env.NEXT_PUBLIC_SALES_ANALYTICS_SOURCE || "").trim().toLowerCase();
  if (raw === "mock") return "mock";
  if (raw === "off") return "unavailable";
  return "api";
}

async function loadMock() {
  // Dynamic import keeps the mock generator out of the bundle path the API mode uses.
  return import("@/components/super-admin/sales/salesMock");
}

// Minutes east of UTC, so the backend buckets sales by the viewer's calendar days.
const tzOffsetMinutes = () => -new Date().getTimezoneOffset();

async function post(payload) {
  return apiFetcher(API_ENDPOINTS.SALES.SUPERADMINSALESANALYTICS, {
    method: "POST",
    body: JSON.stringify(payload),
    timeoutMs: 29000,
  });
}

export const fetchSuperAdminSalesOverviewService = async ({ period, dateFrom, dateTo }) => {
  const payload = { view: "overview", period, date_from: dateFrom, date_to: dateTo, tz_offset_minutes: tzOffsetMinutes() };

  if (getSalesDataSource() === "mock") {
    const mock = await loadMock();
    return mock.mockSalesOverview(payload);
  }
  return post(payload);
};

export const fetchSuperAdminSalesPurchasesService = async ({
  period,
  dateFrom,
  dateTo,
  source = "all",
  subscriptionStatus = "all",
  paymentStatus = "all",
  search = "",
  page = 1,
  limit = 10,
}) => {
  const payload = {
    view: "purchases",
    period,
    date_from: dateFrom,
    date_to: dateTo,
    tz_offset_minutes: tzOffsetMinutes(),
    source,
    subscription_status: subscriptionStatus,
    payment_status: paymentStatus,
    page,
    limit,
  };
  if (search) payload.search = search;

  if (getSalesDataSource() === "mock") {
    const mock = await loadMock();
    return mock.mockSalesPurchases(payload);
  }
  return post(payload);
};

// Loads past Stripe invoices into sales_invoices, one batch per request.
// onProgress({ processed, total }) is called after each batch.
export const syncSuperAdminSalesFromStripeService = async (onProgress) => {
  let offset = 0;
  for (;;) {
    const res = await post({ view: "sync", offset });
    onProgress?.({ processed: res?.subscriptions_processed || 0, total: res?.subscriptions_total || 0 });
    if (res?.next_offset == null) return res;
    offset = res.next_offset;
  }
};

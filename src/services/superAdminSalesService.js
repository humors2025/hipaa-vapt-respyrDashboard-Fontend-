// Super Admin sales analytics — the only place the Sales Analytics page gets data.
//
// POST /v1/dietitian/api/web/super-admin-sales-analytics (super_admin only),
// backend controller super-admin-sales-analytics.js. Built from existing tables
// (referral_subscriptions, partner_promotion_codes, pricing_settings,
// commission_entries). Amounts are the first payment of each purchase;
// renewals are not included.
//
// NEXT_PUBLIC_SALES_ANALYTICS_SOURCE=mock switches to the generated data in
// components/super-admin/sales/salesMock.js for UI work without a backend.
//
// Trainer Admin views: pass trainerAdmin (the TA's email) to scope overview and
// purchases to that TA's network; view=trainer_admins lists the TAs (the
// active admin-group members, same as TA Analytics).
//
// overview  → { status, filters: { period, date_from, date_to, granularity },
//               summary: { currency, other_currencies, gross_sales, discounts, net_sales,
//                          total_purchases, website_purchases, trainer_code_purchases,
//                          average_order_value, active_paid_subscribers, excluded_purchases },
//               source_breakdown: { website | trainer_code: { purchases, gross_sales, net_sales, new_net_sales } },
//               trend: [ { bucket: "YYYY-MM-DD" | "YYYY-MM", website_sales, trainer_sales,
//                          total_sales, website_purchases, trainer_purchases } ],
//               top_trainers: [ { trainer_id, trainer_name, trainer_email, partner_code, role, parent_user_id,
//                                 parent_name, facility: { id, name, partner_code, status, admin_user_id, admin_name } | null,
//                                 purchases, gross_sales, net_sales } ],
//               top_trainers_total }
// purchases → { status, purchases: [ { purchase_id, purchased_at (ISO UTC), customer: { name, email, profile_id },
//               plan: { code, name }, purchase_source, trainer: { trainer_id, name, email },
//               attributed_partner_code, linked_partner_code, linked_trainer_name, linked_trainer_email,
//               purchase_code (the app referral code), coupon_code, currency,
//               gross_amount, discount_amount, net_amount, amount_source: "invoice" | "price",
//               subscription_status, subscription_start, subscription_end, payment_status,
//               stripe: { checkout_session_id, payment_intent_id, subscription_id, invoice_id } } ],
//               pagination: { page, limit, total, total_pages },
//               filter_options: { subscription_status: [...], payment_status: [...] } }

import { apiFetcher } from "@/config/fetcher";
import { API_ENDPOINTS } from "@/config/apiConfig";

export const SALES_SEARCH_MIN_LENGTH = 3;

export const isSalesMockData = () =>
  (process.env.NEXT_PUBLIC_SALES_ANALYTICS_SOURCE || "").trim().toLowerCase() === "mock";

// Minutes east of UTC, so the backend groups sales by the viewer's calendar days.
const tzOffsetMinutes = () => -new Date().getTimezoneOffset();

async function post(payload) {
  if (isSalesMockData()) {
    const mock = await import("@/components/super-admin/sales/salesMock");
    if (payload.view === "trainer_admins") return { status: true, trainer_admins: mock.MOCK_TRAINER_ADMINS };
    return payload.view === "overview" ? mock.mockSalesOverview(payload) : mock.mockSalesPurchases(payload);
  }
  return apiFetcher(API_ENDPOINTS.SALES.SUPERADMINSALESANALYTICS, {
    method: "POST",
    body: JSON.stringify(payload),
    timeoutMs: 29000,
  });
}

// Trainer Admins offered in the page's view dropdown: [{ user_id, name, partner_code, role, groups }].
export const fetchSalesTrainerAdminsService = async () => {
  const res = await post({ view: "trainer_admins" });
  return Array.isArray(res?.trainer_admins) ? res.trainer_admins : [];
};

export const fetchSuperAdminSalesOverviewService = async ({ period, dateFrom, dateTo, trainerAdmin = "" }) =>
  post({
    view: "overview",
    period,
    date_from: dateFrom,
    date_to: dateTo,
    tz_offset_minutes: tzOffsetMinutes(),
    ...(trainerAdmin ? { trainer_admin: trainerAdmin } : {}),
  });

export const fetchSuperAdminSalesPurchasesService = async ({
  period,
  dateFrom,
  dateTo,
  trainerAdmin = "",
  source = "all",
  partnerCode = "",
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
  if (partnerCode) payload.partner_code = partnerCode;
  if (trainerAdmin) payload.trainer_admin = trainerAdmin;
  return post(payload);
};

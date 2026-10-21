// Facility admin › Payments — Stripe invoices of the members who bought
// through the facility admin's own code (wall QR) or one of their trainers'
// codes. Read-only.
//
// POST /v1/dietitian/api/web/facility-admin-payments (facility_admin only),
// backend controller facility-admin-payments.js.
//
// → { status, payments: [ { id, date, customer: { name, email }, partner_code,
//       referred_by: { kind: "facility" | "trainer", name, user_id, status } | null,
//       type: "first_payment" | "renewal" | …, renewal_number (1 = first renewal),
//       period_start, period_end, currency, amount_paid, amount_refunded, status,
//       failure_message,
//       plan: { subscription_status, current_period_start, current_period_end, canceled_at }
//       (the membership as it stands now) } ],
//     summary: [ { status, currency, count, amount_paid, amount_refunded } ]
//       (every payment of this type and code, ignoring status and search),
//     sources: [ { code, kind, name, user_id, status } ] (the "Referred by" filter),
//     status_options, filters, pagination: { page, limit, total, total_pages } }

import { apiFetcher } from "@/config/fetcher";
import { API_ENDPOINTS } from "@/config/apiConfig";

export const FACILITY_PAYMENTS_SEARCH_MIN_LENGTH = 3;

export const fetchFacilityPaymentsService = async ({ status = "all", type = "all", code = "all", search = "", page = 1, limit = 20 }) =>
  apiFetcher(API_ENDPOINTS.SALES.FACILITYADMINPAYMENTS, {
    method: "POST",
    body: JSON.stringify({
      status,
      ...(type !== "all" ? { type } : {}),
      ...(code !== "all" ? { code } : {}),
      ...(search ? { search } : {}),
      page,
      limit,
    }),
    timeoutMs: 29000,
  });

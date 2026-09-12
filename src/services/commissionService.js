// services/commissionService.js
//
// Gym referral commission programme: facilities, trainer splits, Stripe
// Connect payout setup, earnings and payouts. Every call is POST + JSON and
// authenticated by the access_token cookie, which apiFetcher attaches.

import { apiFetcher } from "../config/fetcher";
import { API_ENDPOINTS } from "../config/apiConfig";

const post = (endpoint, body = {}) =>
  apiFetcher(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

// ── Facilities (trainer-admin / super-admin) ─────────────────────────────────

export const listFacilitiesService = () =>
  post(API_ENDPOINTS.COMMISSION.LISTFACILITIES);

export const inviteFacilityAdminService = ({ firstName, lastName, email, phone, facilityName }) =>
  post(API_ENDPOINTS.COMMISSION.INVITEFACILITYADMIN, {
    first_name: firstName,
    last_name: lastName,
    email,
    phone: phone || undefined,
    facility_name: facilityName,
  });

// ── Trainers under the caller (facility-admin / trainer-admin) ───────────────

export const listMyTrainersService = () =>
  post(API_ENDPOINTS.COMMISSION.LISTTRAINERUSERS);

export const setTrainerCommissionSplitService = ({ trainerUserId, splitPct }) =>
  post(API_ENDPOINTS.COMMISSION.SETTRAINERSPLIT, {
    trainer_user_id: trainerUserId,
    split_pct: splitPct,
  });

// target_type disambiguates an email that is both a trainer and a client
// (a trainer who added themselves as their own client).
export const removeTrainerService = ({ trainerUserId, reason }) =>
  post(API_ENDPOINTS.COMMISSION.REMOVEUSER, {
    target_user_id: trainerUserId,
    target_type: "trainer",
    reason: reason || undefined,
  });

// ── Earnings & Stripe Connect (any payee) ────────────────────────────────────

export const fetchEarningsSummaryService = () =>
  post(API_ENDPOINTS.COMMISSION.EARNINGSSUMMARY);

export const fetchConnectStatusService = ({ forceSync = false } = {}) =>
  post(API_ENDPOINTS.COMMISSION.CONNECTSTATUS, { force_sync: forceSync });

export const createConnectOnboardingLinkService = () =>
  post(API_ENDPOINTS.COMMISSION.CONNECTONBOARDINGLINK);

export const createConnectDashboardLinkService = () =>
  post(API_ENDPOINTS.COMMISSION.CONNECTDASHBOARDLINK);

export const fetchCommissionRateService = () =>
  post(API_ENDPOINTS.COMMISSION.GETRATE);

// ── Super admin ──────────────────────────────────────────────────────────────

export const setCommissionRateService = ({ ratePct, effectiveFrom, note }) =>
  post(API_ENDPOINTS.COMMISSION.SETRATE, {
    rate_pct: ratePct,
    effective_from: effectiveFrom || undefined,
    note: note || undefined,
  });

export const runPayoutsService = ({ dryRun = false, periodEnd } = {}) =>
  post(API_ENDPOINTS.COMMISSION.RUNPAYOUTS, { dry_run: dryRun, period_end: periodEnd || undefined });

export const runBreathCreditsService = ({ dryRun = false } = {}) =>
  post(API_ENDPOINTS.COMMISSION.RUNBREATHCREDITS, { dry_run: dryRun });

export const listPayoutsService = ({ page = 1, limit = 25, status } = {}) =>
  post(API_ENDPOINTS.COMMISSION.LISTPAYOUTS, { page, limit, status: status || undefined });

export const fetchCommissionOverviewService = () =>
  post(API_ENDPOINTS.COMMISSION.OVERVIEW);

// ── Public order page (no auth) ──────────────────────────────────────────────

export const createCheckoutSessionService = ({ partnerCode, email }) =>
  post(API_ENDPOINTS.COMMISSION.CREATECHECKOUTSESSION, {
    partner_code: partnerCode || undefined,
    email: email || undefined,
  });

// ── Formatting helpers shared by the earnings pages ──────────────────────────

export function formatMinor(minor, currency = "USD") {
  const n = Number(minor || 0) / 100;
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n);
  } catch {
    return `$${n.toFixed(2)}`;
  }
}

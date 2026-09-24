// ════════════════════════════════════════════════════════════════════════════
//  MOCK DATA — FOR UI PREVIEW ONLY. NOT PRODUCTION DATA.
//
//  Used only when NEXT_PUBLIC_SALES_ANALYTICS_SOURCE=mock. Everything here is
//  generated (seeded PRNG) so the Sales Analytics page can be previewed before
//  the backend endpoint exists. Trainer names/codes and customers are obviously
//  fake ("Mock Trainer 01", MOCKTR01, mock-customer-12@example.com).
//
//  To remove: delete this file and the loadMock() branch in
//  src/services/superAdminSalesService.js.
// ════════════════════════════════════════════════════════════════════════════

const CURRENCY = "USD";
const SUB_STATUSES = ["active", "expired", "cancelled", "upcoming"];
const PAY_STATUSES = ["paid", "refunded", "failed"];

const PLANS = [
  { code: "RYS_MONTHLY", name: "Rysflo Monthly", price: 29.99, months: 1 },
  { code: "RYS_QUARTERLY", name: "Rysflo Quarterly", price: 79.99, months: 3 },
  { code: "RYS_ANNUAL", name: "Rysflo Annual", price: 299.99, months: 12 },
];

const TRAINERS = Array.from({ length: 12 }, (_, i) => ({
  trainer_id: `MOCK-T-${String(i + 1).padStart(2, "0")}`,
  name: `Mock Trainer ${String(i + 1).padStart(2, "0")}`,
  code: `MOCKTR${String(i + 1).padStart(2, "0")}`,
  weight: 12 - i, // earlier trainers sell more
}));

function mulberry32(seed) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pad = (n) => String(n).padStart(2, "0");
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const isoTime = (d) => `${iso(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
const round2 = (n) => Math.round(n * 100) / 100;

let cache = null;

function dataset() {
  if (cache) return cache;
  const rand = mulberry32(20260924);
  const today = new Date();
  const start = new Date(today.getFullYear() - 1, 0, 1);
  const trainerWeightTotal = TRAINERS.reduce((s, t) => s + t.weight, 0);
  const rows = [];
  let n = 0;

  for (let d = new Date(start); d <= today; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
    // Some zero-sales days on purpose so empty buckets are exercised.
    const perDay = rand() < 0.12 ? 0 : Math.floor(rand() * 7);
    for (let i = 0; i < perDay; i++) {
      n += 1;
      const at = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 7 + Math.floor(rand() * 15), Math.floor(rand() * 60));
      if (at > today) continue;
      const plan = PLANS[rand() < 0.6 ? 0 : rand() < 0.7 ? 1 : 2];
      const isTrainer = rand() < 0.4;
      let trainer = null;
      if (isTrainer) {
        let pick = rand() * trainerWeightTotal;
        trainer = TRAINERS.find((t) => (pick -= t.weight) < 0) || TRAINERS[0];
      }
      const coupon = rand() < 0.2 ? "MOCK10" : null;
      const discount = coupon ? round2(plan.price * 0.1) : 0;
      const pr = rand();
      const paymentStatus = pr < 0.92 ? "paid" : pr < 0.97 ? "refunded" : "failed";
      const end = new Date(at.getFullYear(), at.getMonth() + plan.months, at.getDate());
      const upcoming = paymentStatus === "paid" && rand() < 0.03;
      const subStart = upcoming ? new Date(today.getFullYear(), today.getMonth(), today.getDate() + 3) : at;
      let subStatus;
      if (paymentStatus !== "paid") subStatus = paymentStatus === "refunded" ? "cancelled" : null;
      else if (upcoming) subStatus = "upcoming";
      else if (rand() < 0.08) subStatus = "cancelled";
      else subStatus = end < today ? "expired" : "active";

      rows.push({
        purchase_id: `mock_${n}`,
        purchased_at: isoTime(at),
        customer: {
          name: `Mock Customer ${n}`,
          email: `mock-customer-${n}@example.com`,
          profile_id: rand() < 0.85 ? `MOCKP${100000 + n}` : null,
        },
        plan: { code: plan.code, name: plan.name },
        purchase_source: isTrainer ? "trainer_code" : "website",
        trainer: trainer ? { trainer_id: trainer.trainer_id, name: trainer.name } : null,
        attributed_partner_code: trainer ? trainer.code : null,
        purchase_code: `MPC${(100000 + n * 7919).toString(36).toUpperCase()}`,
        coupon_code: coupon,
        currency: CURRENCY,
        gross_amount: plan.price,
        discount_amount: discount,
        net_amount: round2(plan.price - discount),
        subscription_status: subStatus,
        subscription_start: paymentStatus === "paid" ? isoTime(subStart) : null,
        subscription_end: paymentStatus === "paid" ? isoTime(end) : null,
        payment_status: paymentStatus,
        stripe: {
          checkout_session_id: `cs_test_mock${n}a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6`,
          payment_intent_id: paymentStatus === "failed" ? null : `pi_mock${n}Q1w2E3r4T5y6U7i8`,
          subscription_id: `sub_mock${n}Z9x8C7v6B5n4M3`,
          invoice_id: `in_mock${n}K1j2H3g4F5`,
        },
      });
    }
  }
  cache = rows;
  return rows;
}

function inRange(row, from, to) {
  const day = row.purchased_at.slice(0, 10);
  return day >= from && day <= to;
}

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

export async function mockSalesOverview({ period, date_from, date_to }) {
  await delay(450);
  const all = dataset();
  const paid = all.filter((r) => r.payment_status === "paid" && inRange(r, date_from, date_to));
  const sum = (rows, k) => round2(rows.reduce((s, r) => s + r[k], 0));
  const web = paid.filter((r) => r.purchase_source === "website");
  const tr = paid.filter((r) => r.purchase_source === "trainer_code");
  const net = sum(paid, "net_amount");
  const granularity = period === "year" ? "month" : "day";

  const trendMap = new Map();
  for (const r of paid) {
    const key = granularity === "month" ? r.purchased_at.slice(0, 7) : r.purchased_at.slice(0, 10);
    const b = trendMap.get(key) || { bucket: key, website_sales: 0, trainer_sales: 0, total_sales: 0, website_purchases: 0, trainer_purchases: 0 };
    if (r.purchase_source === "website") {
      b.website_sales = round2(b.website_sales + r.net_amount);
      b.website_purchases += 1;
    } else {
      b.trainer_sales = round2(b.trainer_sales + r.net_amount);
      b.trainer_purchases += 1;
    }
    b.total_sales = round2(b.total_sales + r.net_amount);
    trendMap.set(key, b);
  }

  const byTrainer = new Map();
  for (const r of tr) {
    const t = byTrainer.get(r.attributed_partner_code) || {
      trainer_id: r.trainer.trainer_id,
      trainer_name: r.trainer.name,
      partner_code: r.attributed_partner_code,
      purchases: 0,
      gross_sales: 0,
      net_sales: 0,
    };
    t.purchases += 1;
    t.gross_sales = round2(t.gross_sales + r.gross_amount);
    t.net_sales = round2(t.net_sales + r.net_amount);
    byTrainer.set(r.attributed_partner_code, t);
  }
  const topTrainers = [...byTrainer.values()].sort((a, b) => b.net_sales - a.net_sales);

  return {
    status: true,
    filters: { period, date_from, date_to, granularity },
    summary: {
      currency: CURRENCY,
      gross_sales: sum(paid, "gross_amount"),
      discounts: sum(paid, "discount_amount"),
      net_sales: net,
      new_purchase_net_sales: net,
      renewal_net_sales: 0,
      total_purchases: paid.length,
      website_purchases: web.length,
      trainer_code_purchases: tr.length,
      average_order_value: paid.length ? round2(net / paid.length) : 0,
      active_paid_subscribers: all.filter((r) => r.subscription_status === "active").length,
    },
    source_breakdown: {
      website: { purchases: web.length, gross_sales: sum(web, "gross_amount"), net_sales: sum(web, "net_amount"), new_net_sales: sum(web, "net_amount") },
      trainer_code: { purchases: tr.length, gross_sales: sum(tr, "gross_amount"), net_sales: sum(tr, "net_amount"), new_net_sales: sum(tr, "net_amount") },
    },
    trend: [...trendMap.values()],
    top_trainers: topTrainers.slice(0, 50),
    top_trainers_total: topTrainers.length,
  };
}

export async function mockSalesPurchases({
  date_from,
  date_to,
  source = "all",
  subscription_status = "all",
  payment_status = "all",
  search = "",
  page = 1,
  limit = 10,
}) {
  await delay(350);
  const q = String(search || "").trim().toLowerCase();
  const rows = dataset()
    .filter((r) => inRange(r, date_from, date_to))
    .filter((r) => source === "all" || r.purchase_source === source)
    .filter((r) => subscription_status === "all" || r.subscription_status === subscription_status)
    .filter((r) => payment_status === "all" || r.payment_status === payment_status)
    .filter(
      (r) =>
        !q ||
        [r.customer.name, r.customer.email, r.purchase_code, r.attributed_partner_code]
          .filter(Boolean)
          .some((v) => v.toLowerCase().includes(q))
    )
    .sort((a, b) => (a.purchased_at < b.purchased_at ? 1 : -1));

  const total = rows.length;
  const start = (page - 1) * limit;
  return {
    status: true,
    purchases: rows.slice(start, start + limit),
    pagination: { page, limit, total, total_pages: Math.max(1, Math.ceil(total / limit)) },
    filter_options: { subscription_status: SUB_STATUSES, payment_status: PAY_STATUSES },
  };
}

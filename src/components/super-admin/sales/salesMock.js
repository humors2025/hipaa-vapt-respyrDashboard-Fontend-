// ════════════════════════════════════════════════════════════════════════════
//  MOCK DATA — FOR UI PREVIEW ONLY. NOT PRODUCTION DATA.
//
//  Generated (seeded PRNG) purchases so the Sales Analytics page can be
//  previewed without a backend (NEXT_PUBLIC_SALES_ANALYTICS_SOURCE=mock), for
//  both the network-wide view and the per-Trainer-Admin views.
//  Trainers, facilities and customers are obviously fake ("Mock Trainer E01",
//  MOCKE01, mock-customer-12@example.com). Only the Trainer Admins themselves
//  are real accounts, so the dropdown matches TA Analytics.
//
//  To remove: point src/services/superAdminSalesService.js at a real data
//  source and delete this file.
// ════════════════════════════════════════════════════════════════════════════

const CURRENCY = "USD";
const LIST_PRICE = 50;
const REFERRAL_DISCOUNT = 21; // $50 list, $29 with a trainer / gym code
const PLAN = { code: "rysflo_monthly", name: "Rysflo Membership" };

export const MOCK_TRAINER_ADMINS = [
  { user_id: "evan.gaudet@gmail.com", name: "Evan Gaudet", partner_code: "RESPYRD05" },
  { user_id: "derek.lopez88@gmail.com", name: "Derek Lopez", partner_code: "RESPYRD06" },
];

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

function seedOf(text) {
  let h = 2166136261;
  for (const ch of text) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

const pad = (n) => String(n).padStart(2, "0");
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const isoTime = (d) => `${iso(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
const round2 = (n) => Math.round(n * 100) / 100;

// ─── Networks ────────────────────────────────────────────────────────────────

function networkWide() {
  const trainers = Array.from({ length: 12 }, (_, i) => ({
    trainer_id: `MOCK-T-${pad(i + 1)}`,
    name: `Mock Trainer ${pad(i + 1)}`,
    email: `mock-trainer-${pad(i + 1)}@example.com`,
    code: `MOCKTR${pad(i + 1)}`,
    role: "trainer",
    parent_user_id: i % 2 ? MOCK_TRAINER_ADMINS[0].user_id : MOCK_TRAINER_ADMINS[1].user_id,
    parent_name: i % 2 ? MOCK_TRAINER_ADMINS[0].name : MOCK_TRAINER_ADMINS[1].name,
    facility: null,
    weight: 12 - i,
  }));
  return { key: "network", seed: 20260924, trainers, websiteShare: 0.55, maxPerDay: 6 };
}

// A Trainer Admin's network: trainers they onboarded directly, plus two
// facilities they onboarded, each with a facility admin code and trainers.
function trainerAdminNetwork(ta) {
  const letter = ta.name[0].toUpperCase();
  const trainers = [];
  const direct = 5;
  for (let i = 1; i <= direct; i++) {
    trainers.push({
      trainer_id: `MOCK-${letter}-${pad(i)}`,
      name: `Mock Trainer ${letter}${pad(i)}`,
      email: `mock-trainer-${letter.toLowerCase()}${pad(i)}@example.com`,
      code: `MOCK${letter}${pad(i)}`,
      role: "trainer",
      parent_user_id: ta.user_id,
      parent_name: ta.name,
      facility: null,
      weight: direct + 3 - i,
    });
  }
  for (let f = 1; f <= 2; f++) {
    const facility = {
      id: 900 + f + (letter === "E" ? 0 : 10),
      name: `Mock ${letter} Fitness ${f}`,
      partner_code: `MOCKFAC${letter}${f}`,
      status: "active",
      admin_user_id: `mock-owner-${letter.toLowerCase()}${f}@example.com`,
      admin_name: `Mock Owner ${letter}${f}`,
    };
    trainers.push({
      trainer_id: `MOCK-${letter}-F${f}`,
      name: facility.admin_name,
      email: facility.admin_user_id,
      code: facility.partner_code,
      role: "facility_admin",
      parent_user_id: ta.user_id,
      parent_name: ta.name,
      facility,
      weight: 3,
    });
    for (let i = 1; i <= 2; i++) {
      trainers.push({
        trainer_id: `MOCK-${letter}-F${f}T${i}`,
        name: `Mock Trainer ${letter}F${f}-${i}`,
        email: `mock-trainer-${letter.toLowerCase()}f${f}-${i}@example.com`,
        code: `MOCK${letter}F${f}${i}`,
        role: "trainer",
        parent_user_id: facility.admin_user_id,
        parent_name: facility.admin_name,
        facility,
        weight: 2,
      });
    }
  }
  return { key: ta.user_id, seed: seedOf(ta.user_id), trainers, websiteShare: 0.2, maxPerDay: 3 };
}

// ─── Purchases ───────────────────────────────────────────────────────────────

const cache = new Map();

function dataset(network) {
  if (cache.has(network.key)) return cache.get(network.key);
  const rand = mulberry32(network.seed);
  const today = new Date();
  const start = new Date(today.getFullYear() - 1, 0, 1);
  const weightTotal = network.trainers.reduce((s, t) => s + t.weight, 0);
  const rows = [];
  let n = 0;
  const prefix = network.key === "network" ? "" : network.trainers[0].code.slice(4, 5).toLowerCase();

  for (let d = new Date(start); d <= today; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
    // Some zero-sales days on purpose so empty buckets are exercised.
    const perDay = rand() < 0.2 ? 0 : Math.floor(rand() * (network.maxPerDay + 1));
    for (let i = 0; i < perDay; i++) {
      n += 1;
      const at = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 7 + Math.floor(rand() * 15), Math.floor(rand() * 60));
      if (at > today) continue;

      let pick = rand() * weightTotal;
      const trainer = network.trainers.find((t) => (pick -= t.weight) < 0) || network.trainers[0];
      const website = rand() < network.websiteShare;
      const discount = website ? 0 : REFERRAL_DISCOUNT;

      const pr = rand();
      const paymentStatus = pr < 0.95 ? "paid" : "refunded";
      const end = new Date(at.getFullYear(), at.getMonth() + 1, at.getDate());
      let subStatus;
      // Older memberships are more likely to have been cancelled by now.
      const ageDays = (today - at) / 86400000;
      if (paymentStatus === "refunded") subStatus = "cancelled";
      else if (rand() < Math.min(0.9, 0.08 + ageDays / 400)) subStatus = "cancelled";
      else subStatus = "active";

      const id = `${prefix}${n}`;
      rows.push({
        purchase_id: `mock_${id}`,
        purchased_at: isoTime(at),
        customer: {
          name: `Mock Customer ${id.toUpperCase()}`,
          email: `mock-customer-${id}@example.com`,
          profile_id: rand() < 0.85 ? `MOCKP${100000 + n}` : null,
        },
        plan: PLAN,
        purchase_source: website ? "website" : "trainer_code",
        trainer: website ? null : { trainer_id: trainer.trainer_id, name: trainer.name, email: trainer.email },
        attributed_partner_code: website ? null : trainer.code,
        // Website buyers in a Trainer Admin's view linked one of their trainers in the app later.
        linked_partner_code: website && network.key !== "network" ? trainer.code : null,
        linked_trainer_name: website && network.key !== "network" ? trainer.name : null,
        linked_trainer_email: website && network.key !== "network" ? trainer.email : null,
        purchase_code: `MPC${(100000 + n * 7919).toString(36).toUpperCase()}`,
        coupon_code: website ? null : trainer.code,
        currency: CURRENCY,
        gross_amount: LIST_PRICE,
        discount_amount: discount,
        net_amount: LIST_PRICE - discount,
        amount_source: "price",
        subscription_status: subStatus,
        subscription_start: isoTime(at),
        subscription_end: isoTime(end),
        payment_status: paymentStatus,
        stripe: {
          checkout_session_id: `cs_test_mock${id}a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6`,
          payment_intent_id: null,
          subscription_id: `sub_mock${id}Z9x8C7v6B5n4M3`,
          invoice_id: `in_mock${id}K1j2H3g4F5`,
        },
        _trainer: trainer,
      });
    }
  }
  cache.set(network.key, rows);
  return rows;
}

function networkFor(trainerAdmin) {
  const ta = trainerAdmin ? MOCK_TRAINER_ADMINS.find((t) => t.user_id === trainerAdmin) : null;
  return ta ? trainerAdminNetwork(ta) : networkWide();
}

function inRange(row, from, to) {
  const day = row.purchased_at.slice(0, 10);
  return day >= from && day <= to;
}

const delay = (ms) => new Promise((r) => setTimeout(r, ms));
const strip = ({ _trainer, ...row }) => row;

// ─── Responses (same shape as the real API) ──────────────────────────────────

export async function mockSalesOverview({ period, date_from, date_to, trainer_admin }) {
  await delay(400);
  const network = networkFor(trainer_admin);
  const all = dataset(network);
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
    const t = r._trainer;
    const row = byTrainer.get(t.code) || {
      trainer_id: t.trainer_id,
      trainer_name: t.name,
      trainer_email: t.email,
      partner_code: t.code,
      role: t.role,
      parent_user_id: t.parent_user_id,
      parent_name: t.parent_name,
      facility: t.facility,
      purchases: 0,
      gross_sales: 0,
      net_sales: 0,
    };
    row.purchases += 1;
    row.gross_sales = round2(row.gross_sales + r.gross_amount);
    row.net_sales = round2(row.net_sales + r.net_amount);
    byTrainer.set(t.code, row);
  }
  const topTrainers = [...byTrainer.values()].sort((a, b) => b.net_sales - a.net_sales);

  const breakdown = (rows) => ({
    purchases: rows.length,
    gross_sales: sum(rows, "gross_amount"),
    net_sales: sum(rows, "net_amount"),
    new_net_sales: sum(rows, "net_amount"),
  });

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
      trainers_total: network.trainers.length,
      trainers_selling: byTrainer.size,
    },
    source_breakdown: { website: breakdown(web), trainer_code: breakdown(tr) },
    trend: [...trendMap.values()],
    top_trainers: topTrainers,
    top_trainers_total: topTrainers.length,
  };
}

export async function mockSalesPurchases({
  date_from,
  date_to,
  trainer_admin,
  source = "all",
  partner_code = "",
  subscription_status = "all",
  payment_status = "all",
  search = "",
  page = 1,
  limit = 10,
}) {
  await delay(300);
  const q = String(search || "").trim().toLowerCase();
  const all = dataset(networkFor(trainer_admin)).filter((r) => inRange(r, date_from, date_to));
  const rows = all
    .filter((r) => source === "all" || r.purchase_source === source)
    .filter((r) => !partner_code || r.attributed_partner_code === partner_code)
    .filter((r) => subscription_status === "all" || r.subscription_status === subscription_status)
    .filter((r) => payment_status === "all" || r.payment_status === payment_status)
    .filter(
      (r) =>
        !q ||
        [r.customer.name, r.customer.email, r.purchase_code, r.attributed_partner_code, r.linked_partner_code]
          .filter(Boolean)
          .some((v) => v.toLowerCase().includes(q))
    )
    .sort((a, b) => (a.purchased_at < b.purchased_at ? 1 : -1));

  const total = rows.length;
  const start = (page - 1) * limit;
  return {
    status: true,
    purchases: rows.slice(start, start + limit).map(strip),
    pagination: { page, limit, total, total_pages: Math.max(1, Math.ceil(total / limit)) },
    filter_options: {
      subscription_status: [...new Set(all.map((r) => r.subscription_status))].sort(),
      payment_status: [...new Set(all.map((r) => r.payment_status))].sort(),
    },
  };
}

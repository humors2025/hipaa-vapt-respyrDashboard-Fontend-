// Synthetic data for previewing role-based dashboards before backend ships.
// Source of truth for what /super-admin/*, /trainer-admin/*, /trainer/* render
// when there's no real backend. Replace with API calls per HIERARCHY_AND_ONBOARDING_SPEC.md.
//
// All ids are strings to match the eventual UUID format.

export const TRAINER_ADMINS = [
  {
    id: "ta-evan",
    first_name: "Evan",
    last_name: "Gaudet",
    email: "evan@respyr.ai",
    phone: "+1 713 555 0101",
    partner_code: "EVAN2026",
    status: "active",
    created_at: "2026-04-15",
  },
  {
    id: "ta-derek",
    first_name: "Derek",
    last_name: "Lopez",
    email: "derek@respyr.ai",
    phone: "+1 713 555 0102",
    partner_code: "DEREK2026",
    status: "active",
    created_at: "2026-04-18",
  },
];

export const TRAINERS = [
  // Under Evan (4 trainers)
  { id: "t-001", first_name: "Marcus",   last_name: "Hill",      email: "marcus@example.com",   partner_code: "MARCUS01",   parent_user_id: "ta-evan",  status: "active", created_at: "2026-04-20" },
  { id: "t-002", first_name: "Jasmine",  last_name: "Carter",    email: "jasmine@example.com",  partner_code: "JASMINE01",  parent_user_id: "ta-evan",  status: "active", created_at: "2026-04-22" },
  { id: "t-003", first_name: "Tyrell",   last_name: "Brooks",    email: "tyrell@example.com",   partner_code: "TYRELL01",   parent_user_id: "ta-evan",  status: "active", created_at: "2026-04-25" },
  { id: "t-004", first_name: "Sofia",    last_name: "Reyes",     email: "sofia@example.com",    partner_code: "SOFIA01",    parent_user_id: "ta-evan",  status: "active", created_at: "2026-04-28" },
  // Under Derek (3 trainers)
  { id: "t-005", first_name: "Kai",      last_name: "Nakamura",  email: "kai@example.com",      partner_code: "KAI01",      parent_user_id: "ta-derek", status: "active", created_at: "2026-04-21" },
  { id: "t-006", first_name: "Priya",    last_name: "Shah",      email: "priya@example.com",    partner_code: "PRIYA01",    parent_user_id: "ta-derek", status: "active", created_at: "2026-04-26" },
  { id: "t-007", first_name: "Ethan",    last_name: "Mitchell",  email: "ethan@example.com",    partner_code: "ETHAN01",    parent_user_id: "ta-derek", status: "suspended", created_at: "2026-04-23" },
];

// 15 clients distributed across trainers, mixed tiers.
const tierAmount = { coach: 5000, lease: 15000, owned: 30000 };
export const CLIENTS = [
  // Marcus's clients (4)
  { id: "c-001", first_name: "Hannah",   last_name: "Lee",       email: "hannah.lee@example.com",     parent_user_id: "t-001", tier: "coach",  amount_paid: tierAmount.coach,  status: "active",   subscribed_at: "2026-04-26" },
  { id: "c-002", first_name: "James",    last_name: "Walker",    email: "james.w@example.com",        parent_user_id: "t-001", tier: "owned",  amount_paid: tierAmount.owned,  status: "active",   subscribed_at: "2026-04-28" },
  { id: "c-003", first_name: "Emily",    last_name: "Tan",       email: "emily.tan@example.com",      parent_user_id: "t-001", tier: "lease",  amount_paid: tierAmount.lease,  status: "active",   subscribed_at: "2026-04-30" },
  { id: "c-004", first_name: "Aaron",    last_name: "Kim",       email: "aaron.kim@example.com",      parent_user_id: "t-001", tier: "coach",  amount_paid: tierAmount.coach,  status: "past_due", subscribed_at: "2026-05-01" },
  // Jasmine's clients (3)
  { id: "c-005", first_name: "Olivia",   last_name: "Bennett",   email: "olivia.b@example.com",       parent_user_id: "t-002", tier: "lease",  amount_paid: tierAmount.lease,  status: "active",   subscribed_at: "2026-04-27" },
  { id: "c-006", first_name: "Noah",     last_name: "Rivera",    email: "noah.r@example.com",         parent_user_id: "t-002", tier: "coach",  amount_paid: tierAmount.coach,  status: "active",   subscribed_at: "2026-04-29" },
  { id: "c-007", first_name: "Ava",      last_name: "Patel",     email: "ava.patel@example.com",      parent_user_id: "t-002", tier: "owned",  amount_paid: tierAmount.owned,  status: "active",   subscribed_at: "2026-05-02" },
  // Tyrell's clients (2)
  { id: "c-008", first_name: "Liam",     last_name: "Foster",    email: "liam.f@example.com",         parent_user_id: "t-003", tier: "coach",  amount_paid: tierAmount.coach,  status: "active",   subscribed_at: "2026-05-01" },
  { id: "c-009", first_name: "Mia",      last_name: "Gomez",     email: "mia.g@example.com",          parent_user_id: "t-003", tier: "lease",  amount_paid: tierAmount.lease,  status: "active",   subscribed_at: "2026-05-03" },
  // Sofia's clients (1)
  { id: "c-010", first_name: "Lucas",    last_name: "Anderson",  email: "lucas.a@example.com",        parent_user_id: "t-004", tier: "coach",  amount_paid: tierAmount.coach,  status: "active",   subscribed_at: "2026-05-02" },
  // Kai's clients (3)
  { id: "c-011", first_name: "Sophia",   last_name: "Diaz",      email: "sophia.d@example.com",       parent_user_id: "t-005", tier: "owned",  amount_paid: tierAmount.owned,  status: "active",   subscribed_at: "2026-04-25" },
  { id: "c-012", first_name: "Ethan",    last_name: "Brown",     email: "ethan.b@example.com",        parent_user_id: "t-005", tier: "lease",  amount_paid: tierAmount.lease,  status: "active",   subscribed_at: "2026-04-29" },
  { id: "c-013", first_name: "Isabella", last_name: "Martin",    email: "isabella.m@example.com",     parent_user_id: "t-005", tier: "coach",  amount_paid: tierAmount.coach,  status: "active",   subscribed_at: "2026-05-01" },
  // Priya's clients (2)
  { id: "c-014", first_name: "Mason",    last_name: "Ng",        email: "mason.ng@example.com",       parent_user_id: "t-006", tier: "coach",  amount_paid: tierAmount.coach,  status: "active",   subscribed_at: "2026-05-02" },
  { id: "c-015", first_name: "Charlotte",last_name: "O'Brien",   email: "charlotte.o@example.com",    parent_user_id: "t-006", tier: "lease",  amount_paid: tierAmount.lease,  status: "active",   subscribed_at: "2026-05-04" },
];

const COMMISSION_RATE = 0.20;

// ---------- Aggregations ----------

export function clientsOf(trainerId) {
  return CLIENTS.filter((c) => c.parent_user_id === trainerId);
}

export function trainersOf(taId) {
  return TRAINERS.filter((t) => t.parent_user_id === taId);
}

export function clientsUnderTA(taId) {
  const trainerIds = trainersOf(taId).map((t) => t.id);
  return CLIENTS.filter((c) => trainerIds.includes(c.parent_user_id));
}

export function networkSummary() {
  const activeClients = CLIENTS.filter((c) => c.status === "active");
  const tierMix = {
    coach: activeClients.filter((c) => c.tier === "coach").length,
    lease: activeClients.filter((c) => c.tier === "lease").length,
    owned: activeClients.filter((c) => c.tier === "owned").length,
  };
  const monthRevenue = activeClients.reduce((sum, c) => sum + c.amount_paid, 0);
  return {
    trainerAdmins:    TRAINER_ADMINS.length,
    trainers:         TRAINERS.length,
    activeTrainers:   TRAINERS.filter((t) => t.status === "active").length,
    clients:          CLIENTS.length,
    activeClients:    activeClients.length,
    tierMix,
    monthRevenueCents: monthRevenue,
  };
}

export function trainerCommissionThisMonth(trainerId) {
  return clientsOf(trainerId)
    .filter((c) => c.status === "active")
    .reduce((sum, c) => sum + Math.round(c.amount_paid * COMMISSION_RATE), 0);
}

export function taOverrideThisMonth(taId) {
  return clientsUnderTA(taId)
    .filter((c) => c.status === "active")
    .reduce((sum, c) => sum + Math.round(c.amount_paid * COMMISSION_RATE), 0);
}

export const fmtUSDCents = (cents) =>
  (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

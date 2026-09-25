// Formatting + period helpers shared by the Sales Analytics components.

export const PERIODS = [
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "year", label: "Year" },
];

export const SOURCE_COLORS = {
  website: "#308BF9",
  trainer_code: "#3FAF58",
  total: "#252525",
};

// ─── Numbers ────────────────────────────────────────────────────────────────

function toNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// Currency comes from the API. Falls back to "CODE 1,234.00" when Intl does not
// recognise the code, and to a plain number when no currency is known.
export function formatMoney(amount, currency, { compact = false } = {}) {
  const n = toNumber(amount);
  if (n === null) return "—";
  const code = String(currency || "").toUpperCase();
  const digits = compact ? { maximumFractionDigits: 1 } : { minimumFractionDigits: 2, maximumFractionDigits: 2 };
  if (code) {
    try {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: code,
        ...(compact ? { notation: "compact" } : {}),
        ...digits,
      }).format(n);
    } catch {
      // unknown currency code — fall through
    }
  }
  const plain = new Intl.NumberFormat("en-US", {
    ...(compact ? { notation: "compact" } : {}),
    ...digits,
  }).format(n);
  return code ? `${code} ${plain}` : plain;
}

export function formatCount(v) {
  const n = toNumber(v);
  return n === null ? "—" : n.toLocaleString("en-US");
}

export function formatPercent(part, whole) {
  const p = toNumber(part);
  const w = toNumber(whole);
  if (p === null || !w) return "0.0%";
  return `${((p / w) * 100).toFixed(1)}%`;
}

// ─── Dates ──────────────────────────────────────────────────────────────────

const pad = (n) => String(n).padStart(2, "0");

export function toISODate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseISODate(s) {
  const [y, m, d] = String(s).split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

// Returns { from, to } (inclusive Date objects) for the period containing `anchor`.
// Weeks run Monday → Sunday.
export function getPeriodRange(period, anchor) {
  const a = startOfDay(anchor);
  if (period === "week") {
    const offset = (a.getDay() + 6) % 7; // Mon = 0
    const from = new Date(a.getFullYear(), a.getMonth(), a.getDate() - offset);
    const to = new Date(from.getFullYear(), from.getMonth(), from.getDate() + 6);
    return { from, to };
  }
  if (period === "year") {
    return { from: new Date(a.getFullYear(), 0, 1), to: new Date(a.getFullYear(), 11, 31) };
  }
  return {
    from: new Date(a.getFullYear(), a.getMonth(), 1),
    to: new Date(a.getFullYear(), a.getMonth() + 1, 0),
  };
}

// Moves the anchor one period back (-1) or forward (+1).
export function shiftAnchor(period, anchor, dir) {
  if (period === "week") return new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() + 7 * dir);
  if (period === "year") return new Date(anchor.getFullYear() + dir, 0, 1);
  return new Date(anchor.getFullYear(), anchor.getMonth() + dir, 1);
}

export function isCurrentOrFuturePeriod(period, anchor, today = new Date()) {
  const { to } = getPeriodRange(period, anchor);
  return to >= startOfDay(today);
}

export function formatRangeLabel(from, to) {
  const sameYear = from.getFullYear() === to.getFullYear();
  const left = from.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
  const right = to.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  return `${left} – ${right}`;
}

// Chart buckets for the period. Year → months, week/month → days. The keys match
// the API's trend[].bucket so missing buckets can be filled with zeros.
export function buildBuckets(period, from, to) {
  if (period === "year") {
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date(from.getFullYear(), i, 1);
      return {
        key: `${d.getFullYear()}-${pad(i + 1)}`,
        label: d.toLocaleDateString("en-US", { month: "short" }),
        tooltip: d.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
      };
    });
  }
  const out = [];
  for (let d = new Date(from); d <= to; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
    out.push({
      key: toISODate(d),
      label:
        period === "week"
          ? d.toLocaleDateString("en-US", { weekday: "short" })
          : d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      tooltip: d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" }),
    });
  }
  return out;
}

// One date format for the whole page: "Sep 24, 2026" (+ ", 3:05 PM" with time).
export function formatDate(raw, withTime = false) {
  if (!raw) return "—";
  const s = String(raw);
  const d = /^\d{4}-\d{2}-\d{2}$/.test(s) ? parseISODate(s) : new Date(s.replace(" ", "T"));
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}),
  });
}

export function humanizeStatus(s) {
  if (!s) return "—";
  return String(s)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
